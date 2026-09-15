import { describe, expect, it } from "vitest";
import {
  AppMetaRepository,
  CalendarRepository,
  GearRepository,
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
} from "@cubalyze/database";
import { pullChanges } from "../pull";
import type { DBExecutor, SyncContext } from "../types";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/** supabase mock: returns `rows` for the named table, [] for everything else. */
function cloud(rowsByTable: Record<string, Record<string, unknown>[]>) {
  const chain = (rows: Record<string, unknown>[]) => ({
    gt: () => ({ order: () => ({ data: rows, error: null }) }),
    order: () => ({ data: rows, error: null }),
  });
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => chain(rowsByTable[table] ?? []),
      }),
    }),
  };
}

/**
 * Number of columns in an `INSERT INTO <table> (a, b, …) VALUES …` statement —
 * one row's worth of bound values.
 */
function insertColumnCount(sql: string): number {
  const list = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')'));
  return list.split(',').length;
}

/**
 * Fake SQLite that emulates the real constraints the pull must respect:
 *  - solves.session_id → sessions(id) FK (throws on violation),
 *  - training_attempts.case_id → algorithm_cases(id) FK,
 * and records what actually landed so tests can assert on it.
 */
function makeDb(knownCases: string[] = []) {
  const sessions = new Set<string>();
  const solves: string[] = [];
  const attempts: { id: string; case_id: string | null }[] = [];
  const db: DBExecutor = async (sql, bind = []) => {
    if (/INSERT INTO sessions/.test(sql)) {
      sessions.add(String(bind[0]));
      return [];
    }
    if (/INSERT OR IGNORE INTO training_attempts/.test(sql)) {
      attempts.push({
        id: String(bind[0]),
        case_id: bind[5] == null ? null : String(bind[5]),
      });
      return [];
    }
    if (/INSERT INTO solves/.test(sql)) {
      // Derive the row stride from the statement itself: the column list grows
      // over time (cube_id/cube_label did), and a hardcoded 17 would silently
      // mis-parse every row after the first.
      const stride = insertColumnCount(sql);
      for (let i = 0; i < bind.length; i += stride) {
        const sessionId = String(bind[i + 1]);
        if (!sessions.has(sessionId)) {
          throw new Error(
            `FK violation: solve references missing session ${sessionId}`,
          );
        }
        solves.push(String(bind[i]));
      }
      return [];
    }
    if (/SELECT id FROM sessions WHERE id IN/.test(sql)) {
      return (bind as unknown[])
        .map(String)
        .filter((id) => sessions.has(id))
        .map((id) => ({ id }));
    }
    if (/SELECT id FROM algorithm_cases WHERE id IN/.test(sql)) {
      return (bind as unknown[])
        .map(String)
        .filter((id) => knownCases.includes(id))
        .map((id) => ({ id }));
    }
    return [];
  };
  return { db, sessions, solves, attempts };
}

function makeCtx(db: DBExecutor, supabase: unknown): SyncContext {
  return {
    db,
    supabase: supabase as never,
    meta: new AppMetaRepository(db),
    profiles: new ProfilesRepository(db),
    solves: new SolvesRepository(db),
    sessions: new SessionsRepository(db),
    training: new TrainingRepository(db),
    calendar: new CalendarRepository(db),
    skills: new SkillProgressRepository(db),
    gear: new GearRepository(db),
  };
}

describe("pullChanges FK guards", () => {
  it("inserts sessions before solves and skips solves whose session is missing", async () => {
    const { db, sessions, solves } = makeDb();
    const supabase = cloud({
      sessions: [
        {
          user_id: UID, id: "s1", name: "S", puzzle_type: "333",
          created_at: 1, updated_at: 2, is_demo: 0,
        },
      ],
      solves: [
        {
          user_id: UID, id: "v1", session_id: "s1", time_ms: 1000,
          timestamp: 1, scramble: "", penalty: "none", source: "manual",
          moves: "[]", is_demo: 0, created_at: 1, updated_at: 2,
        },
        {
          user_id: UID, id: "v2", session_id: "ghost-session", time_ms: 2000,
          timestamp: 1, scramble: "", penalty: "none", source: "manual",
          moves: "[]", is_demo: 0, created_at: 1, updated_at: 3,
        },
      ],
    });

    const totals = await pullChanges(makeCtx(db, supabase), UID);

    // The valid solve landed, the orphaned one did not — and the pull did
    // not throw (the fake DB would have raised FK on a missing session).
    expect(sessions.has("s1")).toBe(true);
    expect(solves).toEqual(["v1"]);
    // The watermark advances over ALL rows (including the orphan), so the
    // skipped solve is never re-pulled on the next cycle. `pulled` counts
    // only applied rows, so the orphaned solve is excluded here.
    expect(totals.pulled.solves).toBe(1);
  });

  it("unlinks training attempts whose case is unknown to this device", async () => {
    const { db, attempts } = makeDb(["case-known"]);
    const supabase = cloud({
      training_attempts: [
        {
          user_id: UID, id: "a1", exercise_id: "x", method_id: "m",
          case_id: "case-known", scramble: "", time_ms: 100,
          verdict: "correct", play_mode: "manual", metric_kind: "execution",
          timestamp: 1, updated_at: 2,
        },
        {
          user_id: UID, id: "a2", exercise_id: "x", method_id: "m",
          case_id: "case-ghost", scramble: "", time_ms: 200,
          verdict: "correct", play_mode: "manual", metric_kind: "execution",
          timestamp: 1, updated_at: 3,
        },
      ],
    });

    const totals = await pullChanges(makeCtx(db, supabase), UID);

    // Both attempts are kept (no data loss); the unknown case linkage is
    // dropped so the local FK cannot reject the insert.
    expect(attempts.find((a) => a.id === "a1")?.case_id).toBe("case-known");
    expect(attempts.find((a) => a.id === "a2")?.case_id).toBeNull();
    expect(totals.pulled.training_attempts).toBe(2);
  });

  it("does not rewrite skill_progress when the cloud rows are already applied (no dirty loop)", async () => {
    const store = new Map<string, number>();
    let upserts = 0;
    const base = makeDb();
    const db: DBExecutor = async (sql, bind = []) => {
      if (/INSERT INTO skill_progress/.test(sql)) {
        upserts += 1;
        store.set(String(bind[0]), Number(bind[1]));
        return [];
      }
      if (/FROM skill_progress/.test(sql)) {
        return [...store.entries()].map(([skill_id, completed_at]) => ({
          skill_id,
          completed_at,
        }));
      }
      return base.db(sql, bind);
    };
    const supabase = cloud({
      skill_progress: [
        { user_id: UID, skill_id: "s1", completed_at: 100 },
      ],
    });

    const first = await pullChanges(makeCtx(db, supabase), UID);
    expect(first.pulled.skill_progress).toBe(1);
    expect(upserts).toBe(1);

    // Steady state: same cloud rows must neither write (the upsert would fire
    // the dirty trigger and re-schedule a sync 250ms later, forever) nor be
    // reported as pulled (that would rebuild + notify every cycle).
    const second = await pullChanges(makeCtx(db, supabase), UID);
    expect(second.pulled.skill_progress).toBeUndefined();
    expect(upserts).toBe(1);
  });

  it("pulls a solve whose session arrives in the same pass (ordering)", async () => {
    const { db, solves } = makeDb();
    const supabase = cloud({
      sessions: [
        {
          user_id: UID, id: "s2", name: "S2", puzzle_type: "333",
          created_at: 1, updated_at: 5, is_demo: 0,
        },
      ],
      solves: [
        {
          user_id: UID, id: "v3", session_id: "s2", time_ms: 3000,
          timestamp: 1, scramble: "", penalty: "none", source: "manual",
          moves: "[]", is_demo: 0, created_at: 1, updated_at: 6,
        },
      ],
    });

    await pullChanges(makeCtx(db, supabase), UID);

    expect(solves).toEqual(["v3"]);
  });
});

describe("pullChanges poison-row resilience (gear)", () => {
  const categoryRow = (updatedAt: number) => ({
    user_id: UID, id: "c1", name: "Cubes", kind: "cube", icon: "Box",
    created_at: 1, updated_at: updatedAt,
  });
  const itemRow = (id: string, updatedAt: number) => ({
    user_id: UID, id, category_id: "c1", type_id: null, name: `Item ${id}`,
    palette: "[]", links: "[]", photos: "[]", tags: "[]", status: "owned",
    is_primary: 0, is_favorite: 0, quantity: 1,
    created_at: 1, updated_at: updatedAt,
  });

  /**
   * Fake over makeDb: a local gear store plus an app_meta KV so watermarks
   * behave like the real thing. The `poison` item's upsert always throws
   * (the stale-trigger 1555 signature); everything else lands.
   */
  function makeGearDb() {
    const base = makeDb();
    const meta = new Map<string, string>();
    const categories = new Map<string, number>();
    const items = new Map<string, number>();
    const itemAttempts = new Map<string, number>();
    const db: DBExecutor = async (sql, bind = []) => {
      if (/FROM gear_items WHERE id IN/.test(sql)) {
        return [...items.entries()]
          .filter(([id]) => (bind as unknown[]).map(String).includes(id))
          .map(([id, updated_at]) => ({ id, updated_at }));
      }
      if (/FROM gear_categories WHERE id IN/.test(sql)) {
        return [...categories.entries()]
          .filter(([id]) => (bind as unknown[]).map(String).includes(id))
          .map(([id, updated_at]) => ({ id, updated_at }));
      }
      if (/FROM gear_types WHERE id IN/.test(sql)) return [];
      if (/INSERT INTO gear_categories/.test(sql)) {
        categories.set(String(bind[0]), 1);
        return [];
      }
      if (/INSERT INTO gear_items/.test(sql)) {
        const id = String(bind[0]);
        itemAttempts.set(id, (itemAttempts.get(id) ?? 0) + 1);
        if (id === "poison") {
          throw new Error(
            "SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key",
          );
        }
        // updated_at is bound late in the column list; the cloud value rides
        // in the row — recover it from the known fixture watermarks.
        items.set(id, id === "good" ? 5 : Number(bind[bind.length - 1]) || 0);
        return [];
      }
      if (/FROM app_meta WHERE key = \?/.test(sql)) {
        const v = meta.get(String(bind[0]));
        return v === undefined ? [] : [{ value: v }];
      }
      if (/INSERT OR REPLACE INTO app_meta/.test(sql)) {
        meta.set(String(bind[0]), String(bind[1]));
        return [];
      }
      return base.db(sql, bind);
    };
    return { db, meta, items, itemAttempts };
  }

  it("skips a throwing gear row, applies the rest, and retries the failed row next cycle", async () => {
    const { db, meta, items, itemAttempts } = makeGearDb();
    const supabase = cloud({
      gear_categories: [categoryRow(1)],
      gear_items: [itemRow("good", 5), itemRow("poison", 9)],
    });

    const totals = await pullChanges(makeCtx(db, supabase), UID);

    // No throw: the good row landed, the poison row did not.
    expect(items.has("good")).toBe(true);
    expect(items.has("poison")).toBe(false);
    expect(totals.pulled.gear_items).toBe(1);
    expect(totals.pulled.gear_categories).toBe(1);
    // The watermark advanced over the applied row but NOT past the failure,
    // so the poison row is retried instead of silently dropped.
    expect(meta.get(`sync_watermark_pull_gear_items_${UID}`)).toBe("5");

    // Second cycle, same cloud state: the poison row is attempted again,
    // the applied row is left alone (LWW, no rewrite).
    await pullChanges(makeCtx(db, supabase), UID);
    expect(itemAttempts.get("poison")).toBe(2);
    expect(itemAttempts.get("good")).toBe(1);
  });
});
