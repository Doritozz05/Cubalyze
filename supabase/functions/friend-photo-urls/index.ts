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
// The pure half of this file (segments, `photos` parsing, object paths) lives in
// `./logic.ts`, where vitest can execute it. What stays here is I/O — the gates
// and the Storage call — plus the order in which they run.
//
// Deno Deploy runtime (esm.sh import) — do not add npm imports.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildWanted,
  canonicalUserId,
  declaredPhotoIds,
} from "./logic.ts";

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

/**
 * Photo-signing budget per user and minute.
 *
 * The client signs a whole page in ONE call, so 30/minute is generous for a
 * human and useless for a scraper. It applies to EVERY caller, including the
 * account asking for its own photos: a signed-in session is not a licence for
 * unbounded egress, and the own-photos shortcut only exists so the Locker's
 * previews keep working.
 */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

interface ReqBody {
  owner?: unknown;
  refs?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** When the URLs handed out with this response stop working (epoch ms). */
function expiresAt(now = Date.now()): number {
  return now + TTL_SECONDS * 1000;
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

  // The owner is a uuid, and it is compared as such (friend pair, storage
  // folder). Everything downstream uses this canonical form, so an uppercase
  // copy of a real id cannot invert the friendship pair or sign a path that
  // does not exist.
  const owner = canonicalUserId(body.owner);
  if (!owner) return json({ ok: false, reason: "invalid" }, 400);

  const built = buildWanted(body.refs, owner, MAX_REFS);
  if (!built.ok) return json({ ok: false, reason: built.reason }, 400);
  const { wanted } = built;
  if (wanted.length === 0) {
    return json({ ok: true, urls: {}, ttl: TTL_SECONDS, expires_at: expiresAt() });
  }

  // Quota first, for EVERY caller (own photos included). Putting it after the
  // ownership branch meant a session could pull unlimited egress out of its own
  // folder with no counter at all; and doing it before the reads below keeps an
  // abusive caller from turning this function into a query amplifier.
  if (!(await rateCheck(supabase, uid))) {
    return json({ ok: false, reason: "rate_limited" }, 429);
  }

  // Own photos need no relationship (the Locker's own previews use local blobs,
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

    // Friendship is NOT enough on its own: `are_friends` also denies when a
    // block exists in either direction, and this function has to mean the same
    // thing the RPCs mean. Checking it here too is not redundant — `friend_block`
    // revokes the friendship in the same transaction, but a concurrent block can
    // interleave and leave an `accepted` row behind, and then the signer would
    // be the only door still open.
    const { data: block } = await supabase
      .from("friend_blocks")
      .select("blocker")
      .or(`and(blocker.eq.${uid},blocked.eq.${owner}),and(blocker.eq.${owner},blocked.eq.${uid})`)
      .limit(1);
    if (block && block.length > 0) {
      // Same answer as "not friends": a blocked caller must not learn that the
      // block exists.
      return json({ ok: false, reason: "not_friends" }, 403);
    }

    const { data: visibility } = await supabase
      .from("profile_visibility")
      .select("share_locker")
      .eq("user_id", owner)
      .maybeSingle();
    if (!visibility?.share_locker) return json({ ok: false, reason: "not_shared" }, 403);
  }

  // The ref has to be one the item actually declares: signing a path derived
  // from a forged id would hand out a URL for an object that is not part of any
  // shared item (and, for a nonexistent object, one that merely 404s).
  const itemIds = [...new Set(wanted.map((w) => w.itemId))];
  const { data: items, error: itemsError } = await supabase
    .from("gear_items")
    .select("id, photos")
    .eq("user_id", owner)
    .eq("is_demo", 0)
    .in("id", itemIds);
  if (itemsError) return json({ ok: false, reason: "server" }, 500);

  const declared = declaredPhotoIds(items ?? []);

  const toSign = wanted.filter((want) =>
    declared.get(want.itemId)?.has(want.photoId),
  );
  if (toSign.length === 0) {
    return json({ ok: true, urls: {}, ttl: TTL_SECONDS, expires_at: expiresAt() });
  }

  // One call for the whole batch (`createSignedUrls`, plural) instead of a
  // sequential round trip per object: a 60-item page used to be up to 60
  // requests to Storage, each one billed and each one a chance to time out.
  const { data: signed, error: signError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      toSign.map((entry) => entry.path),
      TTL_SECONDS,
    );
  if (signError) {
    // A signing failure is not a client error: the showcase falls back to the
    // 3D render. Answering `ok` with no URLs says the same thing as a 500 would
    // (the client turns both into "no photos"), without pretending the request
    // was malformed.
    console.warn("[friend-photo-urls] batch sign failed:", signError.message);
    return json({ ok: true, urls: {}, ttl: TTL_SECONDS, expires_at: expiresAt() });
  }

  const urls: Record<string, string> = {};
  const keyByPath = new Map(toSign.map((entry) => [entry.path, entry.key]));
  for (const [index, entry] of (signed ?? []).entries()) {
    if (!entry?.signedUrl) continue;
    // Storage echoes the path back; fall back to position if it ever does not.
    const key = (entry.path != null ? keyByPath.get(entry.path) : undefined) ??
      toSign[index]?.key;
    if (key) urls[key] = entry.signedUrl;
  }

  return json({
    ok: true,
    urls,
    ttl: TTL_SECONDS,
    expires_at: expiresAt(),
  });
});
