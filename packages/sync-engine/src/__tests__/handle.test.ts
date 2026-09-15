import { describe, expect, it, vi } from "vitest";
import { claimHandle, type HandleClaimFailure, type HandleClaimResult } from "../handle";
import type { Profile } from "@cubalyze/models";
import type { SyncContext } from "../types";

/**
 * `claimHandle` is the client half of `handle_claim`: it turns the RPC's answer
 * into an outcome the UI can render, and adopts the SERVER's stamp locally.
 *
 * The reason this file exists: the server grew a third rejection
 * (`rate_limited`) when its attempt budget landed, and the client used to fold
 * every unrecognised reason into `invalid`. The user then read "pick another
 * name" for a request that never got as far as the name. Every reason the SQL
 * can return is asserted here, one by one.
 */

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function localProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: UID,
    displayName: "Ana",
    handle: "",
    bio: "",
    avatarKind: "identicon",
    mainPuzzle: "333",
    declaredMethods: [],
    country: "",
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function makeCtx(
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>,
  local: Profile = localProfile(),
): { ctx: SyncContext; upserts: Profile[] } {
  const upserts: Profile[] = [];
  const ctx = {
    supabase: { rpc },
    profiles: {
      getOrCreate: async () => local,
      upsert: async (profile: Profile) => {
        upserts.push(profile);
      },
    },
  } as unknown as SyncContext;
  return { ctx, upserts };
}

describe("claimHandle — adopting the server's answer", () => {
  it("writes the handle with the SERVER's stamp, never a local one", async () => {
    const { ctx, upserts } = makeCtx(async (fn, args) => {
      expect(fn).toBe("handle_claim");
      expect(args).toEqual({ p_handle: "  @Ana " });
      return { data: { ok: true, handle: "ana", updated_at: 4_242 } };
    });

    await expect(claimHandle(ctx, UID, "  @Ana ")).resolves.toEqual({ ok: true, handle: "ana" });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].handle).toBe("ana");
    // A local stamp would make the claim lose the next LWW comparison and the
    // pull would never deliver the server's copy.
    expect(upserts[0].updatedAt).toBe(4_242);
  });

  it("keeps the local stamp on the idempotent branch (no `updated_at`)", async () => {
    const { ctx, upserts } = makeCtx(async () => ({
      data: { ok: true, handle: "ana", unchanged: true },
    }));
    await claimHandle(ctx, UID, "ana");
    expect(upserts[0].updatedAt).toBe(100); // el sello local, no 0
  });
});

describe("claimHandle — every rejection the SQL can answer", () => {
  const cases: Array<{ reason: string; expected: HandleClaimFailure; suggestion?: string }> = [
    { reason: "taken", expected: "taken", suggestion: "ana_4f2a" },
    { reason: "invalid", expected: "invalid" },
    { reason: "rate_limited", expected: "rate_limited" },
    // Un motivo que este cliente no conoce (skew de versión) NO se puede
    // confundir con un problema de formato.
    { reason: "conflict", expected: "invalid" },
  ];

  for (const testCase of cases) {
    it(`maps '${testCase.reason}' to a typed outcome`, async () => {
      const { ctx, upserts } = makeCtx(async () => ({
        data: { ok: false, reason: testCase.reason, suggestion: testCase.suggestion },
      }));
      const res: HandleClaimResult = await claimHandle(ctx, UID, "ana");
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toBe(testCase.expected);
      if (res.reason === "taken") {
        expect(res.suggestion).toBe(testCase.suggestion);
      }
      // Nothing was written: a refused claim leaves the local row alone.
      expect(upserts).toHaveLength(0);
    });
  }

  it("separates a signed-out session from a network failure", async () => {
    const unauthorized = makeCtx(async () => ({ error: { status: 401 } }));
    await expect(claimHandle(unauthorized.ctx, UID, "ana")).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });

    const offline = makeCtx(async () => ({ error: { status: 503 } }));
    await expect(claimHandle(offline.ctx, UID, "ana")).resolves.toEqual({
      ok: false,
      reason: "offline",
    });

    const threw = makeCtx(async () => {
      throw new Error("network down");
    });
    await expect(claimHandle(threw.ctx, UID, "ana")).resolves.toEqual({
      ok: false,
      reason: "offline",
    });
  });

  it("refuses to run without an account — that is a programming error", async () => {
    const { ctx } = makeCtx(vi.fn());
    await expect(claimHandle(ctx, "", "ana")).rejects.toThrow(/signed-in/);
  });
});
