import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The `friend-photo-urls` edge function cannot run in vitest (Deno runtime,
 * esm.sh imports, service-role-only RPC). What CAN run is its pure half —
 * `logic.ts`, covered behaviourally in `friendPhotoUrls.logic.test.ts` — and
 * what this file guards is the part that only exists in `index.ts`: the ORDER
 * and the PRESENCE of the authorization gates, plus the two structural
 * decisions that keep its behaviour honest (the quota applies to everyone, and
 * the logic is imported rather than re-implemented inline).
 *
 * The historical warning: a missing gate is not a bug you notice, it is a leak.
 * And a re-implemented `parsePhotos` is how A1 happened — the source had the
 * right shape and the wrong behaviour.
 */

const SOURCE = readFileSync(
  new URL("../../../../../supabase/functions/friend-photo-urls/index.ts", import.meta.url),
  "utf8",
);

/** Index of a required snippet — fails loudly when the line disappears. */
function at(needle: string): number {
  const index = SOURCE.indexOf(needle);
  expect(index, `missing from the function: ${needle}`).toBeGreaterThan(-1);
  return index;
}

describe("friend-photo-urls — authorization gates", () => {
  it("authenticates the caller before doing anything else", () => {
    const auth = at("supabase.auth.getUser(token)");
    const quota = at("rateCheck(supabase, uid)");
    const friendship = at('from("friendships")');
    const block = at('from("friend_blocks")');
    const visibility = at('from("profile_visibility")');
    const signing = at("createSignedUrls");

    // Identity, then the budget, then the relationship, then the block, then
    // consent — and only then a URL.
    expect(auth).toBeLessThan(quota);
    expect(quota).toBeLessThan(friendship);
    expect(friendship).toBeLessThan(block);
    expect(block).toBeLessThan(visibility);
    expect(visibility).toBeLessThan(signing);
  });

  it("charges the quota to EVERY caller, own photos included", () => {
    // The quota used to sit inside the `owner !== uid` branch, so a session
    // could extract unlimited egress from its own folder with no counter.
    expect(at("rateCheck(supabase, uid)")).toBeLessThan(at("if (owner !== uid)"));
    // …and it is consumed before the reads, so this cannot become a query
    // amplifier for a client that is already over budget.
    expect(at("rateCheck(supabase, uid)")).toBeLessThan(at('from("gear_items")'));
  });

  it("requires an ACCEPTED friendship, no block in either direction, and share_locker", () => {
    expect(SOURCE).toContain('.eq("status", "accepted")');
    expect(SOURCE).toContain("share_locker");
    // Both refusals exist, with the same vocabulary the RPCs use.
    expect(SOURCE).toContain('reason: "not_friends"');
    expect(SOURCE).toContain('reason: "not_shared"');
    // The block is checked in BOTH directions (`are_friends` semantics), and a
    // blocked caller gets the same answer as a stranger.
    expect(SOURCE).toContain('blocker.eq.${uid},blocked.eq.${owner}');
    expect(SOURCE).toContain('blocker.eq.${owner},blocked.eq.${uid}');
    // The owner short-circuit is what keeps your own previews working.
    expect(SOURCE).toContain("owner !== uid");
  });

  it("canonicalises the owner and delegates the parsing of photos", () => {
    // A uuid compared as text (uppercase) inverted the canonical pair and
    // signed paths that do not exist.
    expect(SOURCE).toContain("canonicalUserId(body.owner)");
    // The behaviour lives in logic.ts — never re-implemented inline.
    expect(SOURCE).toContain('from "./logic.ts"');
    expect(SOURCE).not.toContain("Array.isArray(row.photos)");
    expect(SOURCE).toContain("declaredPhotoIds(items ?? [])");
  });

  it("only signs refs declared by a non-demo item of that owner", () => {
    expect(SOURCE).toContain('from("gear_items")');
    expect(SOURCE).toContain('.eq("user_id", owner)');
    expect(SOURCE).toContain('.eq("is_demo", 0)');
    // The declared set is what the sign list consults, so a forged photo_id
    // cannot produce a URL for an object nobody shared.
    expect(SOURCE).toContain("declared.get(want.itemId)?.has(want.photoId)");
  });

  it("signs the whole batch in one call and tells the client when it dies", () => {
    expect(SOURCE).toContain("createSignedUrls(");
    expect(SOURCE).not.toContain(".createSignedUrl(");
    expect(SOURCE).toContain("expires_at");
    // The function never falls back to a public URL.
    expect(SOURCE).not.toContain("getPublicUrl");
  });

  it("bounds the batch, the TTL and the quota, and fails closed", () => {
    expect(SOURCE).toMatch(/TTL_SECONDS = \d+/);
    expect(SOURCE).toMatch(/MAX_REFS = \d+/);
    // El límite vive en `buildWanted` (logic.ts) y la negativa se propaga tal
    // cual: invalid/too_many se decide en un sitio y se responde en otro, sin
    // reinterpretar el motivo por el camino.
    expect(SOURCE).toContain("buildWanted(body.refs, owner, MAX_REFS)");
    expect(SOURCE).toContain("reason: built.reason");
    expect(SOURCE).toContain('rpc("friend_rate_bump"');
    // A rate-limit failure must deny, never allow.
    expect(SOURCE).toMatch(/rate check failed[\s\S]{0,80}?return false/);
  });
});
