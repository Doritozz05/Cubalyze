import { describe, expect, it } from "vitest";
import {
  AppMetaRepository,
  CalendarRepository,
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
} from "@cubeforge/database";
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
      for (let i = 0; i < bind.length; i += 17) {
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
    // skipped solve is never re-pulled on the next cycle.
    expect(totals.pulled.solves).toBe(2);
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
