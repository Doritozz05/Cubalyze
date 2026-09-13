import { describe, expect, it } from "vitest";
import {
  buildWanted,
  canonicalUserId,
  declaredPhotoIds,
  objectPath,
  parsePhotos,
  safeSegment,
} from "../../../../../supabase/functions/friend-photo-urls/logic.ts";

/**
 * The signer's pure half, executed for real.
 *
 * This file exists because the previous test could only read `index.ts` as a
 * string and assert that certain snippets were present — and that is exactly
 * how A1 survived: `Array.isArray(row.photos)` is a perfectly present snippet
 * that never returns true for the column it reads. Behaviour, not prose.
 */

const UID = "f8aa0000-0000-4000-8000-0000000000a1";

describe("friend-photo-urls logic — segments and identities", () => {
  it("accepts only safe path segments", () => {
    expect(safeSegment("it_gan12")).toBe("it_gan12");
    expect(safeSegment("A-Z_0-9")).toBe("A-Z_0-9");
    expect(safeSegment("")).toBeNull();
    expect(safeSegment("a".repeat(65))).toBeNull();
    expect(safeSegment("../../etc/passwd")).toBeNull();
    expect(safeSegment("has/slash")).toBeNull();
    expect(safeSegment("has space")).toBeNull();
    expect(safeSegment(42)).toBeNull();
    expect(safeSegment(null)).toBeNull();
  });

  it("canonicalises a user id to lowercase and refuses anything that is not a uuid", () => {
    expect(canonicalUserId(UID)).toBe(UID);
    // The case that inverted the friendship pair and signed a path that did
    // not exist: an uppercase copy of a real id.
    expect(canonicalUserId(UID.toUpperCase())).toBe(UID);
    expect(canonicalUserId("not-a-uuid")).toBeNull();
    expect(canonicalUserId(`${UID}/../other`)).toBeNull();
    expect(canonicalUserId(null)).toBeNull();
  });

  it("derives the object path from the canonical owner", () => {
    expect(objectPath(UID, "it1", "p1", "thumb")).toBe(`${UID}/it1/p1/thumb.jpg`);
    expect(objectPath(UID, "it1", "p1", "full")).toBe(`${UID}/it1/p1/full.jpg`);
  });
});

describe("friend-photo-urls logic — declared photos (A1)", () => {
  it("reads photos stored as TEXT with JSON — the real wire shape", () => {
    // `gear_items.photos` is `text` (migration 11) and PostgREST hands it over
    // as a string. Before the fix this returned [] and every friend photo was
    // silently unsignable.
    const stored = JSON.stringify([
      { id: "p1", width: 1280, height: 1280, addedAt: 1 },
      { id: "p2", width: 640, height: 640, addedAt: 2 },
    ]);
    expect(parsePhotos(stored).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("also reads an already-parsed array (jsonb path, test fixtures)", () => {
    expect(parsePhotos([{ id: "p1" }]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("degrades to [] instead of throwing for empty or corrupt values", () => {
    expect(parsePhotos("")).toEqual([]);
    expect(parsePhotos("   ")).toEqual([]);
    expect(parsePhotos("{oops")).toEqual([]);
    expect(parsePhotos('{"id":"not-an-array"}')).toEqual([]);
    expect(parsePhotos(null)).toEqual([]);
    expect(parsePhotos({ id: "p1" })).toEqual([]);
  });

  it("indexes declared photos per item and ignores unnamed ones", () => {
    const declared = declaredPhotoIds([
      { id: "it1", photos: JSON.stringify([{ id: "p1" }, { id: "p2" }, { width: 1 }]) },
      { id: "it2", photos: "[not json" },
      { id: "it3", photos: [] },
    ]);
    expect([...(declared.get("it1") ?? [])]).toEqual(["p1", "p2"]);
    expect(declared.get("it2")?.size).toBe(0);
    expect(declared.get("it3")?.size).toBe(0);
  });
});

describe("friend-photo-urls logic — the batch to sign", () => {
  it("builds paths, defaults to thumb and de-duplicates refs", () => {
    const built = buildWanted(
      [
        { item_id: "it1", photo_id: "p1" },
        { item_id: "it1", photo_id: "p1" },
        { item_id: "it1", photo_id: "p2", thumb: false },
      ],
      UID,
      120,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.wanted.map((w) => w.key)).toEqual(["it1:p1", "it1:p2"]);
    expect(built.wanted[0].path).toBe(`${UID}/it1/p1/thumb.jpg`);
    expect(built.wanted[1].path).toBe(`${UID}/it1/p2/full.jpg`);
  });

  it("refuses the WHOLE batch when one ref is malformed", () => {
    const built = buildWanted(
      [{ item_id: "it1", photo_id: "p1" }, { item_id: "../x", photo_id: "p2" }],
      UID,
      120,
    );
    expect(built).toEqual({ ok: false, reason: "invalid" });
  });

  it("bounds the batch", () => {
    const refs = Array.from({ length: 121 }, (_, i) => ({
      item_id: "it1",
      photo_id: `p${i}`,
    }));
    expect(buildWanted(refs, UID, 120)).toEqual({ ok: false, reason: "too_many" });
    expect(buildWanted(refs.slice(0, 120), UID, 120).ok).toBe(true);
  });

  it("treats a missing or non-array refs payload as an empty batch", () => {
    for (const refs of [undefined, null, "nope", 7, {}]) {
      expect(buildWanted(refs, UID, 120)).toEqual({ ok: true, wanted: [] });
    }
  });
});
