import { describe, expect, it, vi } from "vitest";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendDirectory,
  fetchFriendProfile,
  fetchFriendStats,
  fetchPrivacy,
  fetchPhotoUrls,
  fetchShowcase,
  photoKey,
  removeFriend,
  savePrivacy,
  sendFriendRequest,
  unblockUser,
} from "../friends";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal PostgREST-shaped double: records the calls and answers with whatever
 * the test scripted for that function name. The service under test is pure
 * logic over the client's resolved value, which is exactly why it takes the
 * client as an argument instead of reaching for a singleton — that is what
 * makes these tests possible without a DOM or a network.
 */
function client(
  scripts: Record<string, { data?: unknown; error?: unknown }>,
): { supabase: SupabaseClient; calls: { fn: string; args: unknown }[] } {
  const calls: { fn: string; args: unknown }[] = [];
  const supabase = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      const scripted = scripts[fn];
      if (!scripted) return { data: null, error: null };
      if (scripted.error === "throw") throw new Error("network down");
      return { data: scripted.data ?? null, error: scripted.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const PROFILE_ROW = {
  user_id: "u-1",
  display_name: "Ana",
  handle: "ana",
  bio: "hi",
  avatar_kind: "photo",
  avatar_data: "data:image/png;base64,AAA",
  main_puzzle: "333",
  declared_methods: ["CFOP"],
  country: "ES",
  created_at: 1000,
};

describe("friends service — directory", () => {
  it("maps the whole directory and its nested shares", async () => {
    const { supabase, calls } = client({
      friend_list: {
        data: {
          ok: true,
          list: {
            friends: [{ profile: PROFILE_ROW, shares: { stats: true, locker: false } }],
            incoming: [{ profile: PROFILE_ROW, message: "hola", created_at: 5 }],
            outgoing: [{ profile: PROFILE_ROW, message: "", created_at: 6 }],
            blocked: [PROFILE_ROW],
          },
          counts: { friends: 1, incoming: 1 },
        },
      },
    });

    const res = await fetchFriendDirectory(supabase);
    expect(calls[0]).toEqual({ fn: "friend_list", args: {} });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.friends[0]).toEqual({
      profile: {
        userId: "u-1",
        displayName: "Ana",
        handle: "ana",
        bio: "hi",
        avatarKind: "photo",
        avatarData: "data:image/png;base64,AAA",
        mainPuzzle: "333",
        declaredMethods: ["CFOP"],
        country: "ES",
        createdAt: 1000,
      },
      shares: { stats: true, locker: false },
    });
    expect(res.data.incoming[0]).toMatchObject({ message: "hola", createdAt: 5 });
    expect(res.data.outgoing[0]).toMatchObject({ message: "", createdAt: 6 });
    expect(res.data.blocked).toHaveLength(1);
    expect(res.data.counts).toEqual({ friends: 1, incoming: 1 });
  });

  it("accepts `declared_methods` as an array or as a JSON string", async () => {
    // The RPC sends a real JSONB array; a local row holds TEXT. Both must map,
    // because silently turning the second into [] drops data with no error.
    const asString = client({
      friend_list: {
        data: {
          ok: true,
          list: {
            friends: [
              { profile: { ...PROFILE_ROW, declared_methods: '["CFOP","Roux"]' } },
            ],
          },
        },
      },
    });
    const res = await fetchFriendDirectory(asString.supabase);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.friends[0].profile.declaredMethods).toEqual(["CFOP", "Roux"]);

    const corrupt = client({
      friend_list: {
        data: { ok: true, list: { friends: [{ profile: { ...PROFILE_ROW, declared_methods: "{oops" } }] } },
      },
    });
    const broken = await fetchFriendDirectory(corrupt.supabase);
    expect(broken.ok).toBe(true);
    if (!broken.ok) return;
    expect(broken.data.friends[0].profile.declaredMethods).toEqual([]);
  });

  it("degrades a malformed payload instead of throwing", async () => {
    // A version skew or an unexpected shape must not blow up the view: every
    // field falls back (arrays to [], numbers to 0) and the screen renders.
    const { supabase } = client({ friend_list: { data: { ok: true, list: {} } } });
    const res = await fetchFriendDirectory(supabase);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.friends).toEqual([]);
    expect(res.data.incoming).toEqual([]);
    expect(res.data.blocked).toEqual([]);
    expect(res.data.counts).toEqual({ friends: 0, incoming: 0 });
  });
});

describe("friends service — failures", () => {
  it("maps every reason the server can answer", async () => {
    for (const reason of [
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
    ]) {
      const { supabase } = client({
        friend_list: { data: { ok: false, reason, suggestion: "sug" } },
      });
      const res = await fetchFriendDirectory(supabase);
      expect(res).toEqual({ ok: false, reason, suggestion: "sug" });
    }
  });

  it("keeps an unrecognised reason as `unknown` instead of guessing", async () => {
    const { supabase } = client({ friend_list: { data: { ok: false, reason: "who_knows" } } });
    const res = await fetchFriendDirectory(supabase);
    expect(res).toEqual({ ok: false, reason: "unknown", suggestion: null });
  });

  it("reports a 401 as unauthorized and any other transport error as offline", async () => {
    const unauthorized = client({ friend_list: { error: { status: 401, message: "jwt" } } });
    expect(await fetchFriendDirectory(unauthorized.supabase)).toEqual({
      ok: false,
      reason: "unauthorized",
    });

    const offline = client({ friend_list: { error: { status: 503, message: "boom" } } });
    expect(await fetchFriendDirectory(offline.supabase)).toEqual({ ok: false, reason: "offline" });

    const thrown = client({ friend_list: { error: "throw" } });
    expect(await fetchFriendDirectory(thrown.supabase)).toEqual({ ok: false, reason: "offline" });
  });

  it("refuses to call anything without a client (signed out)", async () => {
    expect(await fetchFriendDirectory(null)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await fetchPrivacy(null)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await removeFriend(null, "u-2")).toEqual({ ok: false, reason: "unauthorized" });
  });
});

describe("friends service — mutations", () => {
  it("passes the handle and message on a send, and reports auto-accept", async () => {
    const { supabase, calls } = client({
      friend_request_send: { data: { ok: true, accepted: true, target: PROFILE_ROW } },
    });
    const res = await sendFriendRequest(supabase, "@ana", "hey");
    expect(calls[0]).toEqual({
      fn: "friend_request_send",
      args: { p_handle: "@ana", p_message: "hey" },
    });
    expect(res).toEqual({
      ok: true,
      data: { accepted: true, target: expect.objectContaining({ userId: "u-1" }) },
    });
  });

  it("names each management RPC exactly as the server declares it", async () => {
    const expectCall = async (
      run: (supabase: SupabaseClient) => Promise<unknown>,
      fn: string,
    ) => {
      const { supabase, calls } = client({ [fn]: { data: { ok: true } } });
      await run(supabase);
      expect(calls[0]).toEqual({ fn, args: { p_other: "u-2" } });
    };

    await expectCall((sb) => acceptFriendRequest(sb, "u-2"), "friend_request_accept");
    await expectCall((sb) => declineFriendRequest(sb, "u-2"), "friend_request_decline");
    await expectCall((sb) => cancelFriendRequest(sb, "u-2"), "friend_request_cancel");
    await expectCall((sb) => removeFriend(sb, "u-2"), "friend_remove");
    await expectCall((sb) => blockUser(sb, "u-2"), "friend_block");
    await expectCall((sb) => unblockUser(sb, "u-2"), "friend_unblock");
  });
});

describe("friends service — privacy", () => {
  it("reads the four flags with their product defaults from the payload", async () => {
    const { supabase } = client({
      privacy_get: {
        data: {
          share_profile: true,
          share_stats: false,
          share_locker: true,
          allow_requests: true,
        },
      },
    });
    expect(await fetchPrivacy(supabase)).toEqual({
      ok: true,
      data: { shareProfile: true, shareStats: false, shareLocker: true, allowRequests: true },
    });
  });

  it("sends the full set (no partial writes) and adopts the server echo", async () => {
    const { supabase, calls } = client({
      privacy_set: {
        data: {
          share_profile: false,
          share_stats: true,
          share_locker: true,
          allow_requests: false,
        },
      },
    });
    const res = await savePrivacy(supabase, {
      shareProfile: true,
      shareStats: false,
      shareLocker: false,
      allowRequests: true,
    });
    expect(calls[0]).toEqual({
      fn: "privacy_set",
      args: {
        p_share_profile: true,
        p_share_stats: false,
        p_share_locker: false,
        p_allow_requests: true,
      },
    });
    // The echo is what gets stored: the toggle reflects the server, not hope.
    expect(res).toEqual({
      ok: true,
      data: { shareProfile: false, shareStats: true, shareLocker: true, allowRequests: false },
    });
  });
});

describe("friends service — profile & showcase", () => {
  it("maps the friend's profile with its per-scope visibility", async () => {
    const { supabase } = client({
      friend_profile: {
        data: { ok: true, profile: PROFILE_ROW, visibility: { stats: false, locker: true } },
      },
    });
    const res = await fetchFriendProfile(supabase, "u-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.visibility).toEqual({ stats: false, locker: true });
    expect(res.data.profile.handle).toBe("ana");
  });

  it("maps a showcase page: whitelisted item fields, taxonomy and cursor", async () => {
    const { supabase, calls } = client({
      friend_locker: {
        data: {
          ok: true,
          categories: [{ id: "c1", name: "Cubos", kind: "cube", icon: "Box", accent: null }],
          types: [{ id: "t1", category_id: "c1", name: "3x3", puzzle_category: "3x3" }],
          items: [
            {
              id: "i1",
              category_id: "c1",
              type_id: "t1",
              name: "GAN 12",
              brand: "GAN",
              model: "12",
              finish: "UV",
              palette: ["#fff", "#000"],
              status: "owned",
              condition: "good",
              tags: ["main"],
              photos: [{ id: "p1", width: 100, height: 100, addedAt: 7 }],
              is_primary: true,
              is_favorite: false,
              rating: 9.5,
              quantity: 1,
              acquired_at: "2024-03-11",
            },
          ],
          next: { category_id: "c1", id: "i1" },
        },
      },
    });

    const res = await fetchShowcase(supabase, "u-1", { categoryId: "c0", id: "old" }, 10);
    expect(calls[0]).toEqual({
      fn: "friend_locker",
      args: { p_other: "u-1", p_after_category: "c0", p_after_id: "old", p_limit: 10 },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items[0]).toEqual({
      id: "i1",
      categoryId: "c1",
      typeId: "t1",
      name: "GAN 12",
      brand: "GAN",
      model: "12",
      finish: "UV",
      palette: ["#fff", "#000"],
      status: "owned",
      condition: "good",
      tags: ["main"],
      photos: [{ id: "p1", width: 100, height: 100, addedAt: 7 }],
      isPrimary: true,
      isFavorite: false,
      rating: 9.5,
      quantity: 1,
      acquiredAt: "2024-03-11",
    });
    expect(res.data.next).toEqual({ categoryId: "c1", id: "i1" });
    expect(res.data.types[0].puzzleCategory).toBe("3x3");
  });

  it("reads `next: null` as the last page", async () => {
    const { supabase } = client({
      friend_locker: { data: { ok: true, categories: [], types: [], items: [], next: null } },
    });
    const res = await fetchShowcase(supabase, "u-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.next).toBeNull();
  });
});

describe("friends service — stats", () => {
  it("decodes the three average encodings and keeps the aggregates exact", async () => {
    const { supabase } = client({
      friend_stats: {
        data: {
          ok: true,
          owner: PROFILE_ROW,
          overall: {
            total: 6,
            count: 5,
            best: 7000,
            worst: 14000,
            mean: 10000.5,
            session_time: 39000,
            last_active_at: 600000,
          },
          by_puzzle: [
            {
              puzzle: "333",
              total: 5,
              count: 4,
              best: 7000,
              worst: 14000,
              mean: 10000,
              session_time: 39000,
              best_at: 300000,
              ao5: { ms: 10667 },
              ao12: null,
            },
            {
              puzzle: "222",
              total: 1,
              count: 1,
              best: 5000,
              worst: 5000,
              mean: 5000,
              session_time: 5000,
              best_at: 600000,
              ao5: { dnf: true },
              ao12: null,
            },
          ],
          streak_days: 3,
          heatmap: [0, 2, 1],
        },
      },
    });

    const res = await fetchFriendStats(supabase, "u-1", 30);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.overall.lastActiveAt).toBe(600000);
    expect(res.data.byPuzzle[0].ao5).toEqual({ ms: 10667 });
    expect(res.data.byPuzzle[0].ao12).toBeNull();
    // `{dnf: true}` is NOT `null`: one means "the average is a DNF", the other
    // "there is not enough data". Collapsing them would show a wrong number.
    expect(res.data.byPuzzle[1].ao5).toEqual({ dnf: true });
    expect(res.data.streakDays).toBe(3);
    expect(res.data.heatmap).toEqual([0, 2, 1]);
  });
});

describe("friends service — photo signing", () => {
  const withFunctions = (invoke: ReturnType<typeof vi.fn>) =>
    ({ functions: { invoke } }) as unknown as SupabaseClient;

  it("returns the signed URLs keyed by item:photo", async () => {
    const invoke = vi.fn(async () => ({
      data: { ok: true, urls: { "i1:p1": "https://signed", "i2:p2": "https://signed2" } },
      error: null,
    }));
    const urls = await fetchPhotoUrls(withFunctions(invoke), "u-1", [
      { itemId: "i1", photoId: "p1" },
      { itemId: "i2", photoId: "p2", size: "full" },
    ]);
    expect(urls).toEqual({ "i1:p1": "https://signed", "i2:p2": "https://signed2" });
    expect(invoke).toHaveBeenCalledWith("friend-photo-urls", {
      body: {
        owner: "u-1",
        refs: [
          { item_id: "i1", photo_id: "p1", thumb: true },
          { item_id: "i2", photo_id: "p2", thumb: false },
        ],
      },
    });
  });

  it("never throws and never returns junk on failure — the cube render takes over", async () => {
    expect(await fetchPhotoUrls(null, "u-1", [{ itemId: "i", photoId: "p" }])).toEqual({});
    expect(await fetchPhotoUrls(withFunctions(vi.fn()), "u-1", [])).toEqual({});

    const errored = withFunctions(vi.fn(async () => ({ data: null, error: new Error("403") })));
    expect(await fetchPhotoUrls(errored, "u-1", [{ itemId: "i", photoId: "p" }])).toEqual({});

    const threw = withFunctions(
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    expect(await fetchPhotoUrls(threw, "u-1", [{ itemId: "i", photoId: "p" }])).toEqual({});

    // A payload that is not a string map is discarded, not passed to <img>.
    const junk = withFunctions(vi.fn(async () => ({ data: { urls: { "i:p": 42 } }, error: null })));
    expect(await fetchPhotoUrls(junk, "u-1", [{ itemId: "i", photoId: "p" }])).toEqual({});
  });

  it("keys photos the same way the server does", () => {
    expect(photoKey("item", "photo")).toBe("item:photo");
  });
});
