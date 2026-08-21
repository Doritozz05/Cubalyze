import { describe, expect, it } from "vitest";
import { SyncEngine } from "../SyncEngine";
import type { DBExecutor } from "../types";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/** Minimal supabase-js shape for the `head:true` count chain. */
function mockSupabase(
  counts: Record<string, number>,
  error: unknown = null,
): unknown {
  return {
    from: (table: string) => ({
      select: (_cols: string, _opts: { count?: string; head?: boolean }) => ({
        eq: () => ({ count: counts[table] ?? 0, error }),
      }),
    }),
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
