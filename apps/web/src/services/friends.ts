"use client";

/**
 * friends.ts — the web side of the Fase 8 social surface.
 *
 * Everything here goes through the server's RPCs (`friend_*`, `privacy_*`) or
 * through the `friend-photo-urls` edge function. **No table is ever read
 * directly**: the four social tables have RLS and zero grants on purpose, so a
 * bug in this file cannot leak another user's rows — the worst it can do is ask
 * a question the server refuses to answer.
 *
 * Two conventions matter for the callers:
 *
 *  1. **Rejections are values, not exceptions.** A refused friend request
 *     (`taken`, `not_friends`, `rate_limited`, `not_shared`…) is a normal
 *     outcome that the UI must render with copy, so `call()` returns a
 *     discriminated result. Only programming errors (no client at all) throw.
 *     `offline` covers the transport, including an expired session the client
 *     could not refresh — indistinguishable from the UI's point of view, and
 *     the honest thing to say.
 *
 *  2. **Wire names are snake_case, app names are camelCase.** The server's
 *     contract is the SQL (validated live in `supabase/validation/`), so the
 *     mapping happens here, once, instead of leaking snake_case into views.
 *     These functions are the ONLY place that knows the JSON's shape.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Result type ───────────────────────────────────────────────────────────

/**
 * Why a call did not produce data. Every value is something the UI has copy
 * for; `unknown` exists so an unrecognised server reason never gets reported
 * as something it is not (e.g. pretending a version skew is `invalid`).
 */
export type FriendsFailure =
  | "offline"
  | "unauthorized"
  | "not_friends"
  | "not_shared"
  | "invalid"
  | "taken"
  | "not_found"
  | "self"
  | "closed"
  | "already_friends"
  | "pending"
  | "not_pending"
  | "rate_limited"
  | "unknown";

export type FriendsResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: FriendsFailure; suggestion?: string | null };

const KNOWN_REASONS: readonly FriendsFailure[] = [
  "not_friends",
  "not_shared",
  "invalid",
  "taken",
  "not_found",
  "self",
  "closed",
  "already_friends",
  "pending",
  "not_pending",
  "rate_limited",
];

// ─── Wire shapes ───────────────────────────────────────────────────────────

/** The whitelisted identity fields (never `user_id`-adjacent private fields). */
export interface FriendProfile {
  userId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarKind: "identicon" | "photo";
  /** Base64 data URL, when the friend uses a photo avatar. */
  avatarData?: string;
  mainPuzzle: string;
  declaredMethods: string[];
  country: string;
  createdAt: number;
}

/** What a friend shares with you, as advertised on their card. */
export interface FriendShares {
  stats: boolean;
  locker: boolean;
}

export interface FriendEntry {
  profile: FriendProfile;
  shares: FriendShares;
}

export interface FriendRequestEntry {
  profile: FriendProfile;
  message: string;
  createdAt: number;
}

export interface FriendDirectory {
  friends: FriendEntry[];
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
  blocked: FriendProfile[];
  counts: { friends: number; incoming: number };
}

export interface ShowcaseCategory {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  accent: string | null;
}

export interface ShowcaseType {
  id: string;
  categoryId: string;
  name: string;
  puzzleCategory: string | null;
}

export interface ShowcasePhotoRef {
  id: string;
  width?: number;
  height?: number;
  addedAt?: number;
}

/**
 * One item of a friend's Locker. Everything the Locker's own card model needs
 * EXCEPT the private fields: `serial`, `smart_id`, prices, `notes` and `links`
 * do not exist on the wire (the SQL never selects them).
 */
export interface ShowcaseItem {
  id: string;
  categoryId: string;
  typeId: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  finish: string | null;
  palette: string[];
  status: string;
  condition: string | null;
  tags: string[];
  photos: ShowcasePhotoRef[];
  isPrimary: boolean;
  isFavorite: boolean;
  rating: number | null;
  quantity: number;
  acquiredAt: string | null;
}

export interface ShowcasePage {
  categories: ShowcaseCategory[];
  types: ShowcaseType[];
  items: ShowcaseItem[];
  /** Keyset cursor; `null` means this was the last page. */
  next: { categoryId: string; id: string } | null;
}

/** A trimmed average, encoded explicitly: `{ms}`, `{dnf}` or `null`. */
export type AverageValue = { ms: number } | { dnf: true } | null;

export interface PuzzleAggregate {
  puzzle: string;
  total: number;
  count: number;
  best: number | null;
  worst: number | null;
  mean: number | null;
  sessionTime: number;
  bestAt: number | null;
  ao5: AverageValue;
  ao12: AverageValue;
}

export interface FriendOverall {
  total: number;
  count: number;
  best: number | null;
  worst: number | null;
  mean: number | null;
  sessionTime: number;
  lastActiveAt: number | null;
}

export interface FriendStats {
  owner: FriendProfile;
  overall: FriendOverall;
  byPuzzle: PuzzleAggregate[];
  streakDays: number;
  /** Daily solve counts, oldest → newest, `days` entries (365 by default). */
  heatmap: number[];
}

export interface FriendVisibility {
  shareProfile: boolean;
  shareStats: boolean;
  shareLocker: boolean;
  allowRequests: boolean;
}

export interface FriendProfileView {
  profile: FriendProfile;
  visibility: { stats: boolean; locker: boolean };
}

// ─── Raw → app mapping ─────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const nullableStr = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const nullableNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => v === true || v === "true";
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * A list of strings, from either encoding the platform actually uses.
 *
 * The social RPCs send real JSON arrays (`jsonb_or_empty(...)::jsonb`), which
 * is the primary case. A JSON-encoded string is accepted too because the LOCAL
 * SQLite columns store these path as TEXT, so the same field reaches this
 * mapper as `'["CFOP"]'` on any path that reads a local row — and a mapper
 * that silently turns that into an empty list would drop data without an
 * error anywhere.
 */
const strings = (v: unknown): string[] => {
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return arr(v).map(String);
};

function toProfile(raw: unknown): FriendProfile {
  const r = (raw ?? {}) as Raw;
  return {
    userId: str(r.user_id),
    displayName: str(r.display_name),
    handle: str(r.handle),
    bio: str(r.bio),
    avatarKind: r.avatar_kind === "photo" ? "photo" : "identicon",
    avatarData: r.avatar_data == null ? undefined : String(r.avatar_data),
    mainPuzzle: str(r.main_puzzle) || "333",
    declaredMethods: strings(r.declared_methods),
    country: str(r.country),
    createdAt: num(r.created_at),
  };
}

function toPhotoRefs(v: unknown): ShowcasePhotoRef[] {
  return arr(v).map((p) => {
    const r = (p ?? {}) as Raw;
    return {
      id: str(r.id),
      width: nullableNum(r.width) ?? undefined,
      height: nullableNum(r.height) ?? undefined,
      addedAt: nullableNum(r.addedAt) ?? undefined,
    };
  });
}

function toItem(raw: unknown): ShowcaseItem {
  const r = (raw ?? {}) as Raw;
  return {
    id: str(r.id),
    categoryId: str(r.category_id),
    typeId: nullableStr(r.type_id),
    name: str(r.name),
    brand: nullableStr(r.brand),
    model: nullableStr(r.model),
    finish: nullableStr(r.finish),
    palette: strings(r.palette),
    status: str(r.status) || "owned",
    condition: nullableStr(r.condition),
    tags: strings(r.tags),
    photos: toPhotoRefs(r.photos),
    isPrimary: bool(r.is_primary),
    isFavorite: bool(r.is_favorite),
    rating: nullableNum(r.rating),
    quantity: num(r.quantity) || 1,
    acquiredAt: nullableStr(r.acquired_at),
  };
}

function toAverage(v: unknown): AverageValue {
  if (v == null) return null;
  const r = v as Raw;
  if (r.dnf === true) return { dnf: true };
  const ms = nullableNum(r.ms);
  return ms == null ? null : { ms };
}

function toAggregate(raw: unknown): PuzzleAggregate {
  const r = (raw ?? {}) as Raw;
  return {
    puzzle: str(r.puzzle),
    total: num(r.total),
    count: num(r.count),
    best: nullableNum(r.best),
    worst: nullableNum(r.worst),
    mean: nullableNum(r.mean),
    sessionTime: num(r.session_time),
    bestAt: nullableNum(r.best_at),
    ao5: toAverage(r.ao5),
    ao12: toAverage(r.ao12),
  };
}

// ─── The one call helper ───────────────────────────────────────────────────

/**
 * Run one JSON-returning RPC. `ok: false` in the payload (or a transport
 * failure) becomes a value; anything else comes back as data.
 */
async function call<T>(
  supabase: SupabaseClient | null,
  fn: string,
  args: Record<string, unknown>,
  map: (payload: Raw) => T,
): Promise<FriendsResult<T>> {
  if (!supabase) return { ok: false, reason: "unauthorized" };

  let payload: Raw;
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      // PostgREST reports an expired/absent JWT as 401; everything else is
      // transport. Both mean "we could not establish anything".
      const status = (error as { status?: number }).status;
      return { ok: false, reason: status === 401 ? "unauthorized" : "offline" };
    }
    payload = (data ?? {}) as Raw;
  } catch {
    return { ok: false, reason: "offline" };
  }

  if (payload.ok === false) {
    const raw = str(payload.reason);
    const reason = (KNOWN_REASONS as readonly string[]).includes(raw)
      ? (raw as FriendsFailure)
      : "unknown";
    return {
      ok: false,
      reason,
      suggestion: typeof payload.suggestion === "string" ? payload.suggestion : null,
    };
  }

  return { ok: true, data: map(payload) };
}

// ─── The surface ───────────────────────────────────────────────────────────

/** Everything a badge or the friends screen needs, in one round trip. */
export async function fetchFriendDirectory(
  supabase: SupabaseClient | null,
): Promise<FriendsResult<FriendDirectory>> {
  return call(supabase, "friend_list", {}, (p) => {
    const list = (p.list ?? {}) as Raw;
    const counts = (p.counts ?? {}) as Raw;
    return {
      friends: arr(list.friends).map((f) => {
        const r = (f ?? {}) as Raw;
        const shares = (r.shares ?? {}) as Raw;
        return {
          profile: toProfile(r.profile),
          shares: { stats: bool(shares.stats), locker: bool(shares.locker) },
        };
      }),
      incoming: arr(list.incoming).map(toRequest),
      outgoing: arr(list.outgoing).map(toRequest),
      blocked: arr(list.blocked).map(toProfile),
      counts: { friends: num(counts.friends), incoming: num(counts.incoming) },
    };
  });
}

function toRequest(raw: unknown): FriendRequestEntry {
  const r = (raw ?? {}) as Raw;
  return { profile: toProfile(r.profile), message: str(r.message), createdAt: num(r.created_at) };
}

/**
 * Send a request by exact handle. `accepted: true` means the other person had
 * already asked you (decision D1: mutual intent is a friendship, no second
 * click).
 */
export async function sendFriendRequest(
  supabase: SupabaseClient | null,
  handle: string,
  message = "",
): Promise<FriendsResult<{ accepted: boolean; target: FriendProfile | null }>> {
  return call(
    supabase,
    "friend_request_send",
    { p_handle: handle, p_message: message },
    (p) => ({ accepted: bool(p.accepted), target: p.target ? toProfile(p.target) : null }),
  );
}

export const acceptFriendRequest = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_request_accept", { p_other: other }, () => true);

export const declineFriendRequest = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_request_decline", { p_other: other }, () => true);

export const cancelFriendRequest = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_request_cancel", { p_other: other }, () => true);

/**
 * Stop being friends. Silent by design (D6): the other side simply stops
 * seeing you, and no notification is sent.
 */
export const removeFriend = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_remove", { p_other: other }, () => true);

/** Block: also revokes the friendship or the pending request, server-side. */
export const blockUser = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_block", { p_other: other }, () => true);

/** Unblock. Deliberately does NOT restore the friendship (D3). */
export const unblockUser = (supabase: SupabaseClient | null, other: string) =>
  call(supabase, "friend_unblock", { p_other: other }, () => true);

export async function fetchPrivacy(
  supabase: SupabaseClient | null,
): Promise<FriendsResult<FriendVisibility>> {
  return call(supabase, "privacy_get", {}, toVisibility);
}

export async function savePrivacy(
  supabase: SupabaseClient | null,
  settings: FriendVisibility,
): Promise<FriendsResult<FriendVisibility>> {
  return call(
    supabase,
    "privacy_set",
    {
      p_share_profile: settings.shareProfile,
      p_share_stats: settings.shareStats,
      p_share_locker: settings.shareLocker,
      p_allow_requests: settings.allowRequests,
    },
    toVisibility,
  );
}

function toVisibility(p: Raw): FriendVisibility {
  return {
    shareProfile: bool(p.share_profile),
    shareStats: bool(p.share_stats),
    shareLocker: bool(p.share_locker),
    allowRequests: bool(p.allow_requests),
  };
}

export async function fetchFriendProfile(
  supabase: SupabaseClient | null,
  other: string,
): Promise<FriendsResult<FriendProfileView>> {
  return call(supabase, "friend_profile", { p_other: other }, (p) => {
    const v = (p.visibility ?? {}) as Raw;
    return {
      profile: toProfile(p.profile),
      visibility: { stats: bool(v.stats), locker: bool(v.locker) },
    };
  });
}

/** One page of a friend's Locker (the showcase). Taxonomy rides with page one. */
export async function fetchShowcase(
  supabase: SupabaseClient | null,
  other: string,
  cursor?: { categoryId: string; id: string } | null,
  limit = 60,
): Promise<FriendsResult<ShowcasePage>> {
  return call(
    supabase,
    "friend_locker",
    {
      p_other: other,
      p_after_category: cursor?.categoryId ?? null,
      p_after_id: cursor?.id ?? null,
      p_limit: limit,
    },
    (p) => {
      const next = (p.next ?? null) as Raw | null;
      return {
        categories: arr(p.categories).map((c) => {
          const r = (c ?? {}) as Raw;
          return {
            id: str(r.id),
            name: str(r.name),
            kind: str(r.kind),
            icon: nullableStr(r.icon),
            accent: nullableStr(r.accent),
          };
        }),
        types: arr(p.types).map((t) => {
          const r = (t ?? {}) as Raw;
          return {
            id: str(r.id),
            categoryId: str(r.category_id),
            name: str(r.name),
            puzzleCategory: nullableStr(r.puzzle_category),
          };
        }),
        items: arr(p.items).map(toItem),
        next: next
          ? { categoryId: str(next.category_id), id: str(next.id) }
          : null,
      };
    },
  );
}

export async function fetchFriendStats(
  supabase: SupabaseClient | null,
  other: string,
  windowDays = 365,
): Promise<FriendsResult<FriendStats>> {
  return call(supabase, "friend_stats", { p_other: other, p_window_days: windowDays }, (p) => {
    const overall = (p.overall ?? {}) as Raw;
    return {
      owner: toProfile(p.owner),
      overall: {
        total: num(overall.total),
        count: num(overall.count),
        best: nullableNum(overall.best),
        worst: nullableNum(overall.worst),
        mean: nullableNum(overall.mean),
        sessionTime: num(overall.session_time),
        lastActiveAt: nullableNum(overall.last_active_at),
      },
      byPuzzle: arr(p.by_puzzle).map(toAggregate),
      streakDays: num(p.streak_days),
      heatmap: arr(p.heatmap).map(num),
    };
  });
}

// ─── Photo signing (edge function) ─────────────────────────────────────────

/** One photo to sign: the item/photo pair as the Locker's own refs carry it. */
export interface PhotoSignRequest {
  itemId: string;
  photoId: string;
  size?: "thumb" | "full";
}

/** Key of a signed URL in the response map. */
export function photoKey(itemId: string, photoId: string): string {
  return `${itemId}:${photoId}`;
}

/**
 * Ask the server for short-lived URLs of a friend's photos.
 *
 * Photo bytes never become readable by friendship alone: the alternative
 * (letting a friend `SELECT` the storage folder) would also let them LIST it
 * and enumerate every `photo_id` in the collection. A signing function can
 * answer exactly the refs it was asked about, in a batch, with a short TTL —
 * and refuse everything else.
 *
 * Failure is always "no photos": the showcase renders the 3D cube from the
 * item's palette, which needs no network at all.
 */
export async function fetchPhotoUrls(
  supabase: SupabaseClient | null,
  owner: string,
  refs: PhotoSignRequest[],
): Promise<Record<string, string>> {
  if (!supabase || refs.length === 0) return {};
  try {
    const { data, error } = await supabase.functions.invoke("friend-photo-urls", {
      body: {
        owner,
        refs: refs.map((r) => ({
          item_id: r.itemId,
          photo_id: r.photoId,
          thumb: r.size !== "full",
        })),
      },
    });
    if (error) return {};
    const urls = ((data ?? {}) as Raw).urls;
    if (!urls || typeof urls !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(urls as Raw)) {
      if (typeof value === "string" && value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
