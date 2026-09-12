import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";
import { FRIEND_FAILURE_KEY, displayNameOf } from "../friendsCopy";
import type { FriendProfile, FriendsFailure } from "@/services/friends";

/** Resolve a dotted key path inside the `friends` namespace object. */
function resolve(locale: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      locale,
    );
}

const ALL_REASONS: FriendsFailure[] = [
  "offline",
  "unauthorized",
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
  "unknown",
];

describe("friends copy — every rejection is a sentence, in every language", () => {
  it("covers exactly the failure reasons the service can report", () => {
    // Compile-time this is a Record<FriendsFailure, …>; this pins it at runtime
    // so a reason added to the union without copy fails a test, not a screen.
    expect(Object.keys(FRIEND_FAILURE_KEY).sort()).toEqual([...ALL_REASONS].sort());
  });

  it("resolves to real text in en and es (no missing key, no English leak)", () => {
    for (const reason of ALL_REASONS) {
      const key = FRIEND_FAILURE_KEY[reason];
      const english = resolve(en.friends as Record<string, unknown>, key);
      const spanish = resolve(es.friends as Record<string, unknown>, key);

      expect(typeof english, `en:${key}`).toBe("string");
      expect((english as string).trim().length, `en:${key}`).toBeGreaterThan(0);
      expect(typeof spanish, `es:${key}`).toBe("string");
      expect((spanish as string).trim().length, `es:${key}`).toBeGreaterThan(0);
      // A locale that simply copied the English string is a translation hole;
      // the two sentences must differ (they are prose, never "Ao5").
      expect(spanish, `es:${key} looks untranslated`).not.toBe(english);
    }
  });

  it("has copy for every handle-claim outcome too", () => {
    for (const reason of ["taken", "invalid", "offline", "unauthorized"] as const) {
      const key = `handle.error.${reason}`;
      expect(typeof resolve(en.friends as Record<string, unknown>, key), key).toBe("string");
      expect(typeof resolve(es.friends as Record<string, unknown>, key), key).toBe("string");
    }
  });
});

describe("displayNameOf", () => {
  const profile = (patch: Partial<FriendProfile>): FriendProfile => ({
    userId: "u-1",
    displayName: "",
    handle: "",
    bio: "",
    avatarKind: "identicon",
    mainPuzzle: "333",
    declaredMethods: [],
    country: "",
    createdAt: 0,
    ...patch,
  });

  it("prefers the display name", () => {
    expect(displayNameOf(profile({ displayName: "Ana", handle: "ana" }))).toBe("Ana");
  });

  it("falls back to the handle, then to nothing (the caller decides the label)", () => {
    expect(displayNameOf(profile({ handle: "ana" }))).toBe("@ana");
    // Whitespace-only names are not names: without this the UI would render an
    // empty line and look broken instead of falling back.
    expect(displayNameOf(profile({ displayName: "   ", handle: "ana" }))).toBe("@ana");
    expect(displayNameOf(profile({}))).toBe("");
  });
});
