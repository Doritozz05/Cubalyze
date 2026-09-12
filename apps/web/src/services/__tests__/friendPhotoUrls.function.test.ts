import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The `friend-photo-urls` edge function cannot run in vitest (Deno runtime,
 * esm.sh imports, service-role-only RPC), so its *behaviour* is covered by
 * `supabase/validation/f8-photos.sql` for the SQL it depends on and by the
 * live smoke check that an unauthenticated call is refused at the gateway.
 *
 * What this file guards is the part a future edit is most likely to drop
 * silently: the ORDER and the PRESENCE of the authorization gates. The same
 * technique the sync-engine tests use to assert that `sync_apply` declares
 * every column the client sends — read the source, assert the invariant.
 *
 * A reminder of what is at stake: this function hands out URLs to private
 * photo bytes. A missing gate is not a bug you notice; it is a leak.
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
    const friendship = at('from("friendships")');
    const visibility = at('from("profile_visibility")');
    const signing = at("createSignedUrl");

    // Order matters: identity first, then the relationship, then the consent,
    // and only then a URL.
    expect(auth).toBeLessThan(friendship);
    expect(friendship).toBeLessThan(visibility);
    expect(visibility).toBeLessThan(signing);
  });

  it("requires an ACCEPTED friendship and an explicit share_locker", () => {
    expect(SOURCE).toContain('.eq("status", "accepted")');
    expect(SOURCE).toContain("share_locker");
    // Both refusals exist, with the same vocabulary the RPCs use.
    expect(SOURCE).toContain('reason: "not_friends"');
    expect(SOURCE).toContain('reason: "not_shared"');
    // …and the owner short-circuit is what keeps your own previews working.
    expect(SOURCE).toContain("owner !== uid");
  });

  it("only signs refs declared by a non-demo item of that owner", () => {
    expect(SOURCE).toContain('from("gear_items")');
    expect(SOURCE).toContain('.eq("user_id", owner)');
    expect(SOURCE).toContain('.eq("is_demo", 0)');
    // The declared-photos set is what the sign loop consults, so a forged
    // photo_id cannot produce a URL for an object nobody shared.
    const declared = at("declared.get(want.itemId)?.has(want.photoId)");
    expect(declared).toBeLessThan(at("createSignedUrl"));
  });

  it("sanitises every path segment (no traversal, no folder escape)", () => {
    expect(SOURCE).toContain("function safeSegment");
    expect(SOURCE).toMatch(/\/\^\[A-Za-z0-9_-\]\+\$\//);
    // Both ids go through it.
    expect(SOURCE).toContain("safeSegment(ref?.item_id)");
    expect(SOURCE).toContain("safeSegment(ref?.photo_id)");
  });

  it("bounds the batch, the TTL and the quota, and fails closed", () => {
    expect(SOURCE).toMatch(/TTL_SECONDS = \d+/);
    expect(SOURCE).toMatch(/MAX_REFS = \d+/);
    expect(SOURCE).toContain('reason: "too_many"');
    expect(SOURCE).toContain('rpc("friend_rate_bump"');
    // A rate-limit failure must deny, never allow.
    expect(SOURCE).toMatch(
      /rate check failed[\s\S]{0,80}?return false/,
    );
    // The function never falls back to a public URL.
    expect(SOURCE).not.toContain("getPublicUrl");
  });
});
