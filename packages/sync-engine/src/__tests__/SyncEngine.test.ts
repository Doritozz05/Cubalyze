import { describe, expect, it } from "vitest";
import { SyncEngine } from "../SyncEngine";
import type { DBExecutor } from "../types";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/**
 * Minimal supabase-js shape covering the three call chains the engine uses:
 *  - head:true count (hasCloudData) → { count, error }
 *  - full select for tombstones and pulls → { data, error }
 *  - rpc sync_apply → { error }
 */
function mockSupabase(
  counts: Record<string, number> = {},
  error: unknown = null,
): unknown {
  const countChain = (table: string) => ({ count: counts[table] ?? 0, error });
  const pullChain = { gt: () => ({ order: () => ({ data: [], error }) }) };
  return {
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => ({
        eq: () => (opts?.head ? countChain(table) : pullChain),
      }),
    }),
    rpc: () => ({ error }),
  };
}

function makeEngine(supabase: unknown): SyncEngine {
  const db: DBExecutor = async () => [];
  return new SyncEngine(db, supabase as never, undefined);
}

describe("SyncEngine.hasCloudData", () => {
  it("is false when the cloud holds nothing for the account", async () => {
    const engine = makeEngine(mockSupabase({}));
    engine.setUser(UID);
    expect(await engine.hasCloudData()).toBe(false);
  });

  it("is true when any data table has rows", async () => {
    const engine = makeEngine(mockSupabase({ training_attempts: 42 }));
    engine.setUser(UID);
    expect(await engine.hasCloudData()).toBe(true);
  });

  it("ignores the profile row (signup trigger always creates one)", async () => {
    const engine = makeEngine(mockSupabase({ profiles: 1 }));
    engine.setUser(UID);
    expect(await engine.hasCloudData()).toBe(false);
  });

  it("is false when signed out", async () => {
    const engine = makeEngine(mockSupabase({ solves: 5 }));
    expect(await engine.hasCloudData()).toBe(false);
  });

  it("propagates API errors", async () => {
    const engine = makeEngine(
      mockSupabase({}, new Error("boom")),
    );
    engine.setUser(UID);
    await expect(engine.hasCloudData()).rejects.toThrow("boom");
  });
});

describe("claim gate", () => {
  it("no-ops syncNow while a claim is pending (nothing touches the DB)", async () => {
    let calls = 0;
    const db: DBExecutor = async () => {
      calls += 1;
      return [];
    };
    const engine = new SyncEngine(db, mockSupabase({}) as never, undefined);
    engine.setUser(UID, { schedule: false });
    engine.setClaimPending();
    await engine.syncNow();
    await engine.syncNow();
    expect(calls).toBe(0);
  });

  it("no-ops scheduleSync while a claim is pending", async () => {
    let calls = 0;
    const db: DBExecutor = async () => {
      calls += 1;
      return [];
    };
    const engine = new SyncEngine(db, mockSupabase({}) as never, undefined);
    engine.setUser(UID, { schedule: false });
    engine.setClaimPending();
    engine.scheduleSync(10);
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toBe(0);
  });

  it("reports no pending changes while a claim is pending", async () => {
    let calls = 0;
    const db: DBExecutor = async () => {
      calls += 1;
      return [];
    };
    const engine = new SyncEngine(db, mockSupabase({}) as never, undefined);
    engine.setUser(UID, { schedule: false });
    engine.setClaimPending();
    expect(await engine.hasPendingChanges()).toBe(false);
    expect(calls).toBe(0);
  });

  it("opens the gate after claim resolves", async () => {
    let calls = 0;
    const db: DBExecutor = async () => {
      calls += 1;
      return [];
    };
    const engine = new SyncEngine(db, mockSupabase({}) as never, undefined);
    engine.setUser(UID, { schedule: false });
    engine.setClaimPending();
    await engine.syncNow();
    expect(calls).toBe(0);
    await engine.claim("merge");
    await engine.syncNow();
    expect(calls).toBeGreaterThan(0);
  });
});
