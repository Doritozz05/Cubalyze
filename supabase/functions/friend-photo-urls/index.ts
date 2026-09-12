// Supabase Edge Function: sign short-lived URLs for a FRIEND's Locker photos.
//
// Invoked from the web app's showcase with the user's access token in the
// Authorization header.
//
// Why a function and not a Storage policy: granting a friend `select` on
// `storage.objects` limited by folder would ALSO grant `list` on that folder,
// which lets them enumerate every `photo_id` in the collection — including the
// ones we never asked for. A signer can answer exactly the refs it was asked
// about, in one batch, with a short TTL, and refuse everything else.
//
// Deno Deploy runtime (esm.sh import) — do not add npm imports.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PHOTO_BUCKET = "locker-photos";

/** Signed URL lifetime: long enough to paint a grid, short enough to be stale. */
const TTL_SECONDS = 60;

/** Refs per call. The client's page is 60 items, so 120 covers a full page. */
const MAX_REFS = 120;

/** Photo-signing budget per user and minute (mirrors the RPC rate limits). */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** `{user}/{item}/{photo}/{full|thumb}.jpg` — same layout the uploader writes. */
function objectPath(
  userId: string,
  itemId: string,
  photoId: string,
  rendition: "full" | "thumb",
): string {
  return `${userId}/${itemId}/${photoId}/${rendition}.jpg`;
}

interface PhotoRef {
  item_id?: unknown;
  photo_id?: unknown;
  thumb?: unknown;
}

interface ReqBody {
  owner?: unknown;
  refs?: unknown;
}

/** A safe identifier for a path segment: no slashes, no traversal, bounded. */
function safeSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return value;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Fixed-window rate limit, via `public.friend_rate_bump` (migration 19): the
 * same table and semantics as the RPCs' `friend_rate_check`, but with an
 * EXPLICIT actor, because a service-role call has no `auth.uid()`. The counter
 * is incremented always, so retrying does not reset the window.
 *
 * Any failure here (missing function, transport, permissions) answers `false`:
 * a rate-limit hiccup must fail CLOSED, never open.
 */
async function rateCheck(
  supabase: ReturnType<typeof createClient>,
  actor: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("friend_rate_bump", {
    p_actor: actor,
    p_action: "photo_urls",
    p_window_ms: RATE_WINDOW_MS,
    p_limit: RATE_LIMIT,
  });
  if (error) {
    console.warn("[friend-photo-urls] rate check failed:", error.message);
    return false;
  }
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, reason: "method" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, reason: "misconfigured" }, 500);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, reason: "unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return json({ ok: false, reason: "unauthorized" }, 401);
  const uid = user.id;

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return json({ ok: false, reason: "invalid" }, 400);
  }

  const owner = safeSegment(body.owner);
  if (!owner) return json({ ok: false, reason: "invalid" }, 400);

  const rawRefs = Array.isArray(body.refs) ? (body.refs as PhotoRef[]) : [];
  if (rawRefs.length === 0) return json({ ok: true, urls: {}, ttl: TTL_SECONDS });
  if (rawRefs.length > MAX_REFS) return json({ ok: false, reason: "too_many" }, 400);

  // Own photos need no friendship (the Locker's own previews use local blobs,
  // but the account could legitimately ask for its own signed URLs).
  if (owner !== uid) {
    const low = owner < uid ? owner : uid;
    const high = owner < uid ? uid : owner;

    const { data: friendship } = await supabase
      .from("friendships")
      .select("status")
      .eq("user_low", low)
      .eq("user_high", high)
      .eq("status", "accepted")
      .maybeSingle();
    if (!friendship) return json({ ok: false, reason: "not_friends" }, 403);

    const { data: visibility } = await supabase
      .from("profile_visibility")
      .select("share_locker")
      .eq("user_id", owner)
      .maybeSingle();
    if (!visibility?.share_locker) return json({ ok: false, reason: "not_shared" }, 403);

    if (!(await rateCheck(supabase, uid))) {
      return json({ ok: false, reason: "rate_limited" }, 429);
    }
  }

  // Validate every ref before signing anything: a mixed batch must not sign
  // the valid half and silently drop the rest.
  const wanted: { key: string; itemId: string; photoId: string; path: string }[] = [];
  const seen = new Set<string>();
  for (const ref of rawRefs) {
    const itemId = safeSegment(ref?.item_id);
    const photoId = safeSegment(ref?.photo_id);
    if (!itemId || !photoId) return json({ ok: false, reason: "invalid" }, 400);
    const key = `${itemId}:${photoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push({
      key,
      itemId,
      photoId,
      path: objectPath(owner, itemId, photoId, ref?.thumb === false ? "full" : "thumb"),
    });
  }

  // The ref has to be one the item actually declares: signing a path derived
  // from a forged id would hand out a URL for an object that is not part of
  // any shared item (and, for a nonexistent object, one that merely 404s).
  const itemIds = [...new Set(wanted.map((w) => w.itemId))];
  const { data: items, error: itemsError } = await supabase
    .from("gear_items")
    .select("id, photos")
    .eq("user_id", owner)
    .eq("is_demo", 0)
    .in("id", itemIds);
  if (itemsError) return json({ ok: false, reason: "server" }, 500);

  const declared = new Map<string, Set<string>>();
  for (const row of items ?? []) {
    const photos = Array.isArray(row.photos) ? row.photos : [];
    declared.set(
      String(row.id),
      new Set(
        photos
          .map((p: { id?: unknown }) => (typeof p?.id === "string" ? p.id : null))
          .filter((id: string | null): id is string => id !== null),
      ),
    );
  }

  const urls: Record<string, string> = {};
  for (const want of wanted) {
    if (!declared.get(want.itemId)?.has(want.photoId)) continue; // not part of a shared item
    const { data: signed, error: signError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(want.path, TTL_SECONDS);
    if (signError) {
      console.warn("[friend-photo-urls] sign failed:", signError.message);
      continue;
    }
    if (signed?.signedUrl) urls[want.key] = signed.signedUrl;
  }

  return json({ ok: true, urls, ttl: TTL_SECONDS });
});
