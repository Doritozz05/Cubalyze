/**
 * Sync data-integrity regression suite.
 *
 * Runs the REAL migration SQL + REAL repositories + REAL push/pull against an
 * in-memory sqlite-wasm database and a fake cloud that mirrors the production
 * `sync_apply` RPC semantics (LWW upserts, tombstone LWW + physical delete,
 * RLS-filtered selects).
 *
 * Every test guards a previously-confirmed data-integrity bug:
 *   A) updated_at inflation / eternal re-sync (convergence after one cycle);
 *   B) deleted rows resurrecting on fresh device links (physical deletion);
 *   C) a tombstone destroying a NEWER offline edit (deletes are LWW-conditional);
 *   D) writes during claim() being swallowed (watermarks never stamped with
 *      Date.now(); the dirty flag is preserved and the write is pushed next);
 *   E) "start fresh" overwriting the account's cloud profile with the local one;
 *   F) batched pushes with (updated_at, id) keyset cursors (no lost rows, no
 *      Math.max(...spread) stack crash on 200k rows).
 */
import { describe, expect, it, beforeAll } from "vitest";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { MIGRATIONS } from "@cubeforge/database";
import {
  AppMetaRepository,
  CalendarRepository,
  ProfilesRepository,
  SessionsRepository,
  SkillProgressRepository,
  SolvesRepository,
  TrainingRepository,
  IDENTICON_SEED_KEY,
  USER_ID_KEY,
} from "@cubeforge/database";
import { SyncEngine } from "../SyncEngine";
import { maxOf, pushChanges } from "../push";
import { pullChanges } from "../pull";
import type { DBExecutor, SyncContext } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any;

beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

let dbSeq = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any {
  dbSeq += 1;
  return new sqlite3.oo1.DB(`/integrity-${dbSeq}.sqlite3`, "c");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runMigrations(db: any): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.exec({ sql: "SELECT id FROM _migrations", rowMode: "array" }) as any[][];
  const applied = new Set((rows || []).map((r) => r[0]));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.exec("INSERT OR IGNORE INTO _migrations (id) VALUES (?)", {
        bind: [migration.id],
      });
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    }
  }
  db.exec("PRAGMA foreign_keys = ON;");
}

/** A device = one sqlite DB + one context + one supabase view of the SAME cloud. */
function makeDevice(cloud: FakeCloud) {
  const db = openDb();
  runMigrations(db);
  const executor: DBExecutor = async (sql, bind = []) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = [];
    db.exec({ sql, bind, rowMode: "object", resultRows: rows });
    return rows as Record<string, unknown>[];
  };
  const ctx: SyncContext = {
    db: executor,
    supabase: cloud.client() as never,
    meta: new AppMetaRepository(executor),
    profiles: new ProfilesRepository(executor),
    solves: new SolvesRepository(executor),
    sessions: new SessionsRepository(executor),
    training: new TrainingRepository(executor),
    calendar: new CalendarRepository(executor),
    skills: new SkillProgressRepository(executor),
  };
  return { db, ctx, executor };
}

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One full push+pull cycle. */
async function runCycle(ctx: SyncContext): Promise<void> {
  await pushChanges(ctx, UID);
  await pullChanges(ctx, UID);
}

/**
 * Fake cloud mirroring the production Postgres:
 *  - tables keyed by primary key (profiles by user_id; skills by user_id+skill_id);
 *  - sync_apply: LWW upsert `excluded.updated_at >= current.updated_at` (+ user partition guard);
 *  - tombstones keyed by (user_id, entity, entity_id), LWW on deleted_at, AND
 *    conditional PHYSICAL delete of the target row (updated_at <= deleted_at;
 *    sessions additionally guarded by newer child solves) — mirroring the
 *    production function;
 *  - select .eq(user_id).gt(col, wm) returns only rows above the watermark.
 */
class FakeCloud {
  solves = new Map<string, Record<string, unknown>>();
  sessions = new Map<string, Record<string, unknown>>();
  profiles = new Map<string, Record<string, unknown>>();
  training_attempts = new Map<string, Record<string, unknown>>();
  training_sessions = new Map<string, Record<string, unknown>>();
  training_tasks = new Map<string, Record<string, unknown>>();
  skill_progress = new Map<string, Record<string, unknown>>();
  sync_tombstones = new Map<string, Record<string, unknown>>();

  /** Number of sync_apply RPC calls made (batching assertions). */
  rpcCalls = 0;

  /**
   * When > 0, the next sync_apply reports this many skipped rows (M1) — the
   * client must refuse to advance its watermark and throw.
   */
  skippedNext = 0;

  /** When set, table pulls (gt path) await this before answering. */
  pullGate: Promise<void> | null = null;
  pullStarted: (() => void) | null = null;
  pullStartedPromise: Promise<void> | null = null;

  /** Find a cloud row by its entity id (composite-keyed maps). */
  private findRow(
    map: Map<string, Record<string, unknown>>,
    id: string,
    user?: string,
  ): Record<string, unknown> | undefined {
    return [...map.values()].find(
      (r) =>
        String(r.id) === id && (user === undefined || String(r.user_id) === user),
    );
  }

  rpc(name: string, args: { payload: Record<string, Record<string, unknown>[]> }) {
    if (name !== "sync_apply") throw new Error(`unexpected rpc ${name}`);
    this.rpcCalls += 1;
    const p = args.payload;
    // Rows first, tombstones last (same order as the production function).
    // Composite keys (user_id, id) mirror the M2 cloud PKs.
    this.applyLww("solves", p.solves ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("sessions", p.sessions ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("profiles", p.profiles ?? [], (r) => String(r.user_id), "updated_at", UID);
    this.applyLww("training_attempts", p.training_attempts ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("training_sessions", p.training_sessions ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("training_tasks", p.training_tasks ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    for (const r of p.skill_progress ?? []) {
      const key = `${r.user_id}:${r.skill_id}`;
      const cur = this.skill_progress.get(key);
      if (!cur || Number(r.completed_at) >= Number(cur.completed_at)) {
        this.skill_progress.set(key, { ...r });
      }
    }
    for (const t of p.tombstones ?? []) {
      const key = `${t.user_id}:${t.entity}:${t.entity_id}`;
      const cur = this.sync_tombstones.get(key);
      if (!cur || Number(t.deleted_at) >= Number(cur.deleted_at)) {
        this.sync_tombstones.set(key, { ...t });
      }
      this.applyTombstone(t);
    }
    return {
      data: { ok: true, skipped: this.skippedNext, applied: {} },
      error: null,
    };
  }

  /** Conditional physical delete mirroring the cloud function. */
  private applyTombstone(t: Record<string, unknown>): void {
    const deletedAt = Number(t.deleted_at);
    const id = String(t.entity_id);
    const user = String(t.user_id);
    switch (t.entity) {
      case "solves": {
        const row = this.findRow(this.solves, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.solves.delete(`${user}:${id}`);
        break;
      }
      case "sessions": {
        const row = this.findRow(this.sessions, id, user);
        const hasNewerChild = [...this.solves.values()].some(
          (s) =>
            String(s.session_id) === id &&
            String(s.user_id) === user &&
            Number(s.updated_at) > deletedAt,
        );
        if (row && Number(row.updated_at) <= deletedAt && !hasNewerChild) {
          this.sessions.delete(`${user}:${id}`);
        }
        break;
      }
      case "training_tasks": {
        const row = this.findRow(this.training_tasks, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.training_tasks.delete(`${user}:${id}`);
        break;
      }
      case "skill_progress": {
        const row = [...this.skill_progress.values()].find(
          (r) => String(r.skill_id) === id && String(r.user_id) === user,
        );
        if (row && Number(row.completed_at) <= deletedAt) {
          this.skill_progress.delete(`${user}:${id}`);
        }
        break;
      }
      case "training_sessions": {
        const row = this.findRow(this.training_sessions, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.training_sessions.delete(`${user}:${id}`);
        break;
      }
      default:
        break;
    }
  }

  private applyLww(
    table: keyof FakeCloud,
    rows: Record<string, unknown>[],
    keyOf: (r: Record<string, unknown>) => string,
    lwwCol: string,
    uid: string,
  ) {
    const map = this[table] as Map<string, Record<string, unknown>>;
    for (const r of rows) {
      if (String(r.user_id) !== uid) continue; // server-side per-row check
      const key = keyOf(r);
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { ...r, user_id: uid });
      } else if (
        String(cur.user_id) === uid &&
        Number(r[lwwCol]) >= Number(cur[lwwCol])
      ) {
        map.set(key, { ...r, user_id: uid });
      }
    }
  }

  /** PostgREST-shaped client. */
  client() {
    const self = this;
    return {
      from(table: string) {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              const map = (self as unknown as Record<string, Map<string, Record<string, unknown>>>)[
                table
              ] as Map<string, Record<string, unknown>> | undefined;
              const rows = map
                ? [...map.values()].filter((r) => String(r[col]) === String(val))
                : [];
              return {
                gt: (col2: string, wm: number) => ({
                  order: (col3: string, opts: { ascending?: boolean }) => {
                    const filtered = rows.filter((r) => Number(r[col2]) > Number(wm));
                    filtered.sort((a, b) =>
                      opts?.ascending === false
                        ? Number(b[col3]) - Number(a[col3])
                        : Number(a[col3]) - Number(b[col3]),
                    );
                    return { data: filtered, error: null };
                  },
                }),
                data: rows,
                error: null,
              };
            },
          }),
        };
      },
      rpc: (name: string, args: { payload: Record<string, Record<string, unknown>[]> }) =>
        self.rpc(name, args),
    };
  }
}

async function countRows(executor: DBExecutor, table: string): Promise<number> {
  const rows = await executor(`SELECT COUNT(*) AS cnt FROM ${table}`);
  return Number(rows[0]?.cnt ?? 0);
}

// ────────────────────────────────────────────────────────────────────────────
// A) updated_at inflation — the system must CONVERGE: pulled rows keep the
// cloud timestamp, so no row is ever re-pulled/re-pushed in a loop.
// ────────────────────────────────────────────────────────────────────────────
describe("A) updated_at convergence (no eternal re-sync)", () => {
  it("a row edited on A and pulled by B converges without inflation", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);
    const engineA = new SyncEngine(a.executor, cloud.client() as never, undefined);
    const engineB = new SyncEngine(b.executor, cloud.client() as never, undefined);
    engineA.setUser(UID, { schedule: false });
    engineB.setUser(UID, { schedule: false });

    // B creates session + solve and pushes (one full engine cycle).
    await b.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await b.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await engineB.syncNow();

    // A pulls (watermark 0 → full pull), then edits the solve.
    await engineA.syncNow();
    await sleep(3);
    await a.ctx.solves.update({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "+2", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 0,
    });
    const editedOnA = await a.ctx.solves.findById("x1");
    const editTs = Number(editedOnA?.updatedAt);
    expect(editTs).toBeGreaterThan(1000);
    await engineA.syncNow();

    // B pulls the edit: B's local copy must carry the CLOUD timestamp, not a
    // fresh Date.now() (that fresh stamp was the inflation bug). The pull
    // re-sets the dirty flag (SQLite trigger) → one extra no-op cycle, which
    // is exactly how the engine's 250ms follow-up behaves.
    await engineB.syncNow();
    const onB = await b.ctx.solves.findById("x1");
    expect(Number(onB?.updatedAt)).toBe(editTs);
    await engineB.syncNow();
    const onB2 = await b.ctx.solves.findById("x1");
    expect(Number(onB2?.updatedAt)).toBe(editTs);

    // A pulls the (identical) row: cursor at rest — further cycles transfer
    // nothing.
    await engineA.syncNow();
    const onA = await a.ctx.solves.findById("x1");
    expect(Number(onA?.updatedAt)).toBe(editTs);

    const aClean = await engineA.syncNow();
    const bClean = await engineB.syncNow();
    expect(aClean.pushed.solves ?? 0).toBe(0);
    expect(aClean.pulled.solves ?? 0).toBe(0);
    expect(bClean.pushed.solves ?? 0).toBe(0);
    expect(bClean.pulled.solves ?? 0).toBe(0);

    // No lingering dirty flag → the 250ms self-reschedule loop is dead.
    expect(await a.ctx.meta.get("sync_dirty")).toBe("0");
    expect(await b.ctx.meta.get("sync_dirty")).toBe("0");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// B) Tombstones physically delete the cloud row → nothing resurrects on a
// fresh device link.
// ────────────────────────────────────────────────────────────────────────────
describe("B) deleted data never resurrects on a fresh link", () => {
  it("a solve deleted on device A is gone from the cloud and from a new device C", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);

    await a.ctx.solves.delete("x1");
    await pushChanges(a.ctx, UID);

    // The tombstone PHYSICALLY deleted the cloud row.
    expect(cloud.sync_tombstones.size).toBe(1);
    expect(cloud.solves.has(`${UID}:x1`)).toBe(false);

    const c = makeDevice(cloud);
    await pullChanges(c.ctx, UID);
    expect(await c.ctx.solves.findById("x1")).toBeNull();
    expect(await countRows(c.executor, "solves")).toBe(0);
  });

  it("a deleted session (with its solves) never comes back on a new device", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);

    await a.ctx.sessions.delete("s1");
    await pushChanges(a.ctx, UID);

    expect(cloud.sessions.has(`${UID}:s1`)).toBe(false);
    expect(cloud.solves.has(`${UID}:x1`)).toBe(false);

    const c = makeDevice(cloud);
    await pullChanges(c.ctx, UID);
    expect(await c.ctx.sessions.findById("s1")).toBeNull();
    expect(await c.ctx.solves.findById("x1")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// C) Tombstones are LWW-conditional: a NEWER offline edit survives the delete
// and resurrects the row everywhere.
// ────────────────────────────────────────────────────────────────────────────
describe("C) a newer offline edit beats an older delete (LWW)", () => {
  it("an edit newer than the delete survives and propagates", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    // Seed: A creates the solve, B pulls it.
    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);

    // A deletes the solve and pushes the tombstone (deleted_at T_del).
    await a.ctx.solves.delete("x1");
    await pushChanges(a.ctx, UID);
    const tomb = [...cloud.sync_tombstones.values()][0];
    const deletedAt = Number(tomb.deleted_at);

    // B edits the solve OFFLINE afterwards (updated_at T2 > T_del).
    await sleep(3);
    await b.ctx.solves.update({
      id: "x1", sessionId: "s1", timeMs: 2500, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 0,
    });
    const editedOnB = await b.ctx.solves.findById("x1");
    const editTs = Number(editedOnB?.updatedAt);
    expect(editTs).toBeGreaterThan(deletedAt);

    // B comes online and syncs (push first, then pull).
    await runCycle(b.ctx);

    // The edit survives locally AND was uploaded (row resurrected with T2).
    const afterSyncOnB = await b.ctx.solves.findById("x1");
    expect(afterSyncOnB).not.toBeNull();
    expect(Number(afterSyncOnB?.timeMs)).toBe(2500);
    expect(cloud.solves.get(`${UID}:x1`)?.time_ms).toBe(2500);

    // And it propagates back to A (newer edit wins over A's delete).
    await runCycle(a.ctx);
    const onA = await a.ctx.solves.findById("x1");
    expect(Number(onA?.timeMs)).toBe(2500);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// D) claim() never stamps watermarks with Date.now() and never erases a
// concurrent dirty flag → a write during the claim is pushed next cycle.
// ────────────────────────────────────────────────────────────────────────────
describe("D) writes during claim() are preserved", () => {
  it("a solve recorded while claim runs is uploaded by the follow-up cycle", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await dev.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });

    // Gate the first table pull so the test can write mid-claim.
    let release: () => void = () => {};
    cloud.pullGate = new Promise((r) => (release = r));
    let started: () => void = () => {};
    cloud.pullStartedPromise = new Promise((r) => (started = r));
    const originalClient = cloud.client();
    const gatedClient = {
      ...originalClient,
      from: (table: string) => {
        const inner = originalClient.from(table);
        return {
          select: () => {
            const sel = inner.select();
            return {
              eq: (col: string, val: string) => {
                const eqRes = sel.eq(col, val);
                const rows = eqRes.data as Record<string, unknown>[];
                return {
                  ...eqRes,
                  gt: (col2: string, wm: number) => ({
                    order: async (col3: string, opts: { ascending?: boolean }) => {
                      started();
                      await cloud.pullGate;
                      const filtered = rows.filter((r) => Number(r[col2]) > Number(wm));
                      filtered.sort((a, b) =>
                        opts?.ascending === false
                          ? Number(b[col3]) - Number(a[col3])
                          : Number(a[col3]) - Number(b[col3]),
                      );
                      return { data: filtered, error: null };
                    },
                  }),
                };
              },
            };
          },
        };
      },
    };
    const ctx = dev.ctx;
    ctx.supabase = gatedClient as never;

    const engine = new SyncEngine(dev.executor, gatedClient as never, undefined);
    engine.setUser(UID, { schedule: false });

    const claimPromise = engine.claim("merge");

    // While the pull is gated, record a NEW solve (as the analysis pipeline
    // or a fast user would).
    await cloud.pullStartedPromise;
    await dev.ctx.sessions.insert({ id: "s2", name: "Session 2", puzzleType: "333", createdAt: 2000, updatedAt: 2000 });
    await dev.ctx.solves.insert({
      id: "x2", sessionId: "s2", timeMs: 500, timestamp: 2000, scramble: "U",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 2000, updatedAt: 2000,
    });
    release();

    await claimPromise;

    // The dirty flag set by the mid-claim write was NOT erased.
    expect(await dev.ctx.meta.get("sync_dirty")).toBe("1");

    // Watermarks reflect what was actually exchanged — never Date.now().
    const pushWm = await dev.ctx.meta.get(`sync_watermark_push_solves_${UID}`);
    const pullWm = await dev.ctx.meta.get(`sync_watermark_pull_solves_${UID}`);
    expect(Number(pushWm)).toBe(1000);
    expect(Number(pullWm)).toBe(1000);
    expect(Number(pushWm)).toBeLessThan(Date.now() - 10_000);

    // The follow-up cycle uploads the write (its timestamp is above the
    // push watermark, which the old Date.now() ceiling used to swallow).
    await engine.syncNow();
    expect(cloud.solves.has(`${UID}:x2`)).toBe(true);
    expect(cloud.sessions.has(`${UID}:s2`)).toBe(true);
    expect(await dev.ctx.meta.get("sync_dirty")).toBe("0");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// E) claim("fresh") must NOT upload the local anonymous profile over the
// account's cloud profile — the cloud replaces the device including identity.
// ────────────────────────────────────────────────────────────────────────────
describe("E) claim fresh keeps the cloud profile", () => {
  it("the account's cloud profile survives a fresh claim", async () => {
    const cloud = new FakeCloud();
    cloud.profiles.set(UID, {
      user_id: UID,
      display_name: "Cloud User",
      handle: "cloudy",
      bio: "profile edited on another device",
      avatar_kind: "identicon",
      avatar_data: null,
      main_puzzle: "333",
      declared_methods: "[]",
      country: "US",
      created_at: 4000,
      updated_at: 5000,
    });

    const dev = makeDevice(cloud);
    await dev.ctx.meta.set(USER_ID_KEY, "anon-1111");
    await dev.ctx.profiles.upsert({
      userId: "anon-1111",
      displayName: "Local Ada",
      handle: "ada",
      bio: "edited anonymously",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "ES",
      createdAt: 1000,
      updatedAt: 0,
    });

    const engine = new SyncEngine(dev.executor, cloud.client() as never, undefined);
    engine.setUser(UID, { schedule: false });
    await engine.claim("fresh");

    // The cloud profile was NOT overwritten by the local anonymous one.
    const cloudProfile = cloud.profiles.get(UID);
    expect(cloudProfile?.display_name).toBe("Cloud User");
    expect(cloudProfile?.country).toBe("US");

    // And the device now follows the account's identity from the cloud.
    const localProfile = await dev.ctx.profiles.findById(UID);
    expect(localProfile?.displayName).toBe("Cloud User");

    // The CubeMark seed was parked (D2: the mark stays stable).
    expect(await dev.ctx.meta.get("identicon_seed")).toBe("anon-1111");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// E2/M11) A second (EMPTY) device that links the same account must NOT clobber
// an edited cloud profile with its installation-default profile — the cloud
// profile wins the merge.
// ────────────────────────────────────────────────────────────────────────────
describe("E2) an empty device cannot overwrite an edited cloud profile (M11)", () => {
  it("device B's empty local profile yields to device A's edited cloud profile", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    // Device A: an edited local profile (name + bio + country) under its
    // anonymous id, which then claims the account with a merge.
    await a.ctx.meta.set(USER_ID_KEY, "anon-A");
    await a.ctx.profiles.upsert({
      userId: "anon-A",
      displayName: "Ada Cube",
      handle: "ada",
      bio: "edited on device A",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "AR",
      createdAt: 1000,
      updatedAt: 0,
    });
    const engineA = new SyncEngine(a.executor, cloud.client() as never, undefined);
    engineA.setUser(UID, { schedule: false });
    await engineA.claim("merge");

    // Cloud now holds A's edited profile.
    const cloudProfileAfterA = cloud.profiles.get(UID);
    expect(cloudProfileAfterA?.display_name).toBe("Ada Cube");
    expect(cloudProfileAfterA?.bio).toBe("edited on device A");

    // Device B: an EMPTY installation-default profile under its anonymous id.
    await b.ctx.meta.set(USER_ID_KEY, "anon-B");
    await b.ctx.profiles.getOrCreate("anon-B");
    const engineB = new SyncEngine(b.executor, cloud.client() as never, undefined);
    engineB.setUser(UID, { schedule: false });
    await engineB.claim("merge");

    // The empty device must NOT have clobbered A's edited profile.
    const cloudProfileAfterB = cloud.profiles.get(UID);
    expect(cloudProfileAfterB?.display_name).toBe("Ada Cube");
    expect(cloudProfileAfterB?.bio).toBe("edited on device A");

    // And device B now follows the cloud profile, not its empty local one.
    const localOnB = await b.ctx.profiles.findById(UID);
    expect(localOnB?.displayName).toBe("Ada Cube");
    expect(localOnB?.country).toBe("AR");
  });

  it("the FIRST edited device can still seed an empty cloud profile", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.meta.set(USER_ID_KEY, "anon-A");
    await dev.ctx.profiles.upsert({
      userId: "anon-A",
      displayName: "First User",
      handle: "first",
      bio: "",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "US",
      createdAt: 1000,
      updatedAt: 0,
    });
    const engine = new SyncEngine(dev.executor, cloud.client() as never, undefined);
    engine.setUser(UID, { schedule: false });
    await engine.claim("merge");

    // Account's cloud profile was empty (signup trigger) → local seeded it.
    expect(cloud.profiles.get(UID)?.display_name).toBe("First User");
    expect(cloud.profiles.get(UID)?.country).toBe("US");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// E3/M11) The CubeMark identicon seed travels with the cloud profile, so a
// second device that links the account renders the same identicon (not its
// own anonymous seed).
// ────────────────────────────────────────────────────────────────────────────
describe("E3) identicon seed propagates across devices (M11)", () => {
  it("the seed pushed by the first device is re-applied on a second device", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    // Device A: edited profile (seeds the empty cloud) + its CubeMark seed.
    await a.ctx.meta.set(USER_ID_KEY, "anon-A");
    await a.ctx.profiles.upsert({
      userId: "anon-A",
      displayName: "Ada Cube",
      handle: "ada",
      bio: "",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "US",
      createdAt: 1000,
      updatedAt: 0,
    });
    const engineA = new SyncEngine(a.executor, cloud.client() as never, undefined);
    engineA.setUser(UID, { schedule: false });
    await engineA.claim("merge");

    // The cloud profile now carries A's mark seed.
    expect(cloud.profiles.get(UID)?.identicon_seed).toBe("anon-A");

    // Device B: empty default profile + its OWN (different) local seed.
    await b.ctx.meta.set(USER_ID_KEY, "anon-B");
    await b.ctx.meta.set(IDENTICON_SEED_KEY, "anon-B");
    await b.ctx.profiles.getOrCreate("anon-B");
    const engineB = new SyncEngine(b.executor, cloud.client() as never, undefined);
    engineB.setUser(UID, { schedule: false });
    await engineB.claim("merge");

    // B re-applies the account's seed from the cloud profile, so its
    // identicon matches device A instead of its own anon seed.
    expect(await b.ctx.meta.getIdenticonSeed()).toBe("anon-A");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// F) Batched pushes: keyset cursors never lose rows that share a timestamp,
// and maxOf() survives 200k-element arrays (the Math.max(...spread) crash).
// ────────────────────────────────────────────────────────────────────────────
describe("F) batched push correctness and scale", () => {
  it("pushes 1200 same-timestamp solves in batches without losing any", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    const solves = Array.from({ length: 1200 }, (_, i) => ({
      id: `solve-${String(i).padStart(4, "0")}`,
      sessionId: "s1",
      timeMs: 1000 + i,
      timestamp: 1000,
      scramble: "R",
      penalty: "none" as const,
      source: "manual" as const,
      moves: [],
      puzzleType: "333",
      createdAt: 1000,
      updatedAt: 1000, // ALL share the same timestamp — the keyset trap
    }));
    await dev.ctx.solves.insertMany(solves);

    await pushChanges(dev.ctx, UID);

    expect(cloud.solves.size).toBe(1200);
    // 3 solve batches (500/500/200) + 1 session batch.
    expect(cloud.rpcCalls).toBe(4);
    const pushWm = await dev.ctx.meta.get(`sync_watermark_push_solves_${UID}`);
    expect(Number(pushWm)).toBe(1000);
  });

  it("maxOf does not crash on 200k elements (Math.max(...spread) did)", () => {
    const huge = new Array(200_000).fill(1700000000000);
    expect(maxOf(huge)).toBe(1700000000000);
    expect(maxOf([])).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// G) M4 — tombstones are pulled ONCE (watermarked), not re-applied forever.
// ────────────────────────────────────────────────────────────────────────────
describe("G) tombstone pull watermark (M4)", () => {
  it("a tombstone is applied exactly once; only new ones arrive later", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);
    await a.ctx.solves.delete("x1");
    await pushChanges(a.ctx, UID);
    expect(cloud.sync_tombstones.size).toBe(1);

    // First pull: the tombstone is applied.
    const first = await pullChanges(b.ctx, UID);
    expect(first.appliedTombstones).toBe(1);
    expect(await b.ctx.solves.findById("x1")).toBeNull();

    // Second pull: the watermark has advanced — nothing is re-applied
    // (before M4 every pull re-fetched the whole tombstone history).
    const second = await pullChanges(b.ctx, UID);
    expect(second.appliedTombstones).toBe(0);

    // A NEW tombstone still arrives on the next pull.
    await a.ctx.sessions.delete("s1");
    await pushChanges(a.ctx, UID);
    const third = await pullChanges(b.ctx, UID);
    expect(third.appliedTombstones).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// H) M1 — sync_apply reporting skipped rows must make push throw instead of
// silently advancing the watermark.
// ────────────────────────────────────────────────────────────────────────────
describe("H) sync_apply skip feedback (M1)", () => {
  it("push refuses to advance the watermark when the cloud reports skips", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await dev.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });

    cloud.skippedNext = 2;
    await expect(pushChanges(dev.ctx, UID)).rejects.toThrow(/rejected/);

    // Watermark untouched → the rows are retried on the next cycle.
    const wm = await dev.ctx.meta.get(`sync_watermark_push_solves_${UID}`);
    expect(Number(wm)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// I) M9 — local writes take strictly-increasing monotonic clock stamps, so
// two writes in the same millisecond (or after a backwards clock jump) can
// never collide with the push watermark and be skipped forever.
// ────────────────────────────────────────────────────────────────────────────
describe("I) monotonic local clock (M9)", () => {
  it("back-to-back inserts never share an updated_at", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    const base = {
      sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none" as const, source: "manual" as const, moves: [],
      puzzleType: "333", createdAt: 1000,
    };
    await dev.ctx.solves.insert({ id: "x1", ...base });
    await dev.ctx.solves.insert({ id: "x2", ...base });
    const r1 = await dev.ctx.solves.findById("x1");
    const r2 = await dev.ctx.solves.findById("x2");
    expect(Number(r2?.updatedAt)).toBeGreaterThan(Number(r1?.updatedAt));
    expect(Number(r1?.updatedAt)).toBeGreaterThanOrEqual(Date.now() - 5000);
  });

  it("a local edit (update { local: true }) advances past the previous stamp", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await dev.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    const before = await dev.ctx.solves.findById("x1");
    await dev.ctx.solves.update(
      {
        id: "x1", sessionId: "s1", timeMs: 1000, timestamp: 1000, scramble: "R",
        penalty: "+2", source: "manual", moves: [], puzzleType: "333", createdAt: 1000,
        updatedAt: before?.updatedAt ?? 0,
      },
      { local: true },
    );
    const after = await dev.ctx.solves.findById("x1");
    expect(Number(after?.updatedAt)).toBeGreaterThan(Number(before?.updatedAt));
    // And the edit is pushed (above the watermark) and converges.
    await pushChanges(dev.ctx, UID);
    expect(cloud.solves.get(`${UID}:x1`)?.penalty).toBe("+2");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// J) M5 — float time_ms is normalized to integer ms at the write boundary so
// the cloud bigint never silently changes the stored value.
// ────────────────────────────────────────────────────────────────────────────
describe("J) float time normalization (M5)", () => {
  it("a sub-ms time is rounded consistently at insert", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await dev.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 112.729, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    const row = await dev.ctx.solves.findById("x1");
    expect(row?.timeMs).toBe(113);
    // And the cloud receives the same rounded integer.
    await pushChanges(dev.ctx, UID);
    expect(cloud.solves.get(`${UID}:x1`)?.time_ms).toBe(113);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// K) 031 — tombstone deleted_at is floored at OLD.updated_at + 1 so a delete
// always wins LWW against the very row being deleted, even when the monotonic
// clock advanced updated_at past the wall-clock (bursts of moves/edits).
// ────────────────────────────────────────────────────────────────────────────
describe("K) tombstone clock floor (031)", () => {
  it("a delete after a burst of moves produces a tombstone that wins LWW on the other device", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    // Seed: A creates a session + solve.
    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 5000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);

    // Simulate a burst of moves/edits that advances the monotonic clock
    // past the wall-clock (each local edit takes prev+1).
    const before = await a.ctx.solves.findById("x1");
    const burstCount = 5;
    for (let i = 0; i < burstCount; i++) {
      const cur = await a.ctx.solves.findById("x1");
      await a.ctx.solves.update(
        {
          id: "x1", sessionId: "s1", timeMs: 5000 + i, timestamp: 1000, scramble: "R",
          penalty: "none", source: "manual", moves: [], puzzleType: "333",
          createdAt: 1000, updatedAt: cur?.updatedAt ?? 0,
        },
        { local: true },
      );
    }
    const after = await a.ctx.solves.findById("x1");
    const movedUpdatedAt = Number(after?.updatedAt);

    // The monotonic clock should have advanced updated_at significantly.
    expect(movedUpdatedAt).toBeGreaterThan(Number(before?.updatedAt));

    // Now delete the solve on A and push the tombstone.
    await a.ctx.solves.delete("x1");
    await pushChanges(a.ctx, UID);

    // The tombstone's deleted_at must be > the solve's updated_at.
    const tomb = [...cloud.sync_tombstones.values()].find(
      (t) => String(t.entity) === "solves" && String(t.entity_id) === "x1",
    );
    expect(tomb).toBeDefined();
    const deletedAt = Number(tomb?.deleted_at);
    expect(deletedAt).toBeGreaterThan(movedUpdatedAt);

    // B pulls the tombstone — the solve must be deleted (tombstone wins LWW).
    await pullChanges(b.ctx, UID);
    expect(await b.ctx.solves.findById("x1")).toBeNull();
  });

  it("a NEWER edit on another device still survives the delete (LWW preserved)", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", puzzleType: "333", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "x1", sessionId: "s1", timeMs: 5000, timestamp: 1000, scramble: "R",
      penalty: "none", source: "manual", moves: [], puzzleType: "333", createdAt: 1000, updatedAt: 1000,
    });
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);

    // A deletes the solve (tombstone deleted_at = max(now, updated_at+1)).
    await a.ctx.solves.delete("x1");
    await pushChanges(a.ctx, UID);
    const tomb = [...cloud.sync_tombstones.values()].find(
      (t) => String(t.entity) === "solves" && String(t.entity_id) === "x1",
    );
    const deletedAt = Number(tomb?.deleted_at);

    // B edits the solve AFTER A's delete — the edit's updated_at must be
    // even higher than the tombstone's deleted_at (monotonic clock floors at
    // the row's previous updated_at + 1, and the tombstone used that same
    // floor). The edit wins LWW and resurrects the row.
    await sleep(5);
    await b.ctx.solves.update(
      {
        id: "x1", sessionId: "s1", timeMs: 9999, timestamp: 1000, scramble: "R",
        penalty: "+2", source: "manual", moves: [], puzzleType: "333",
        createdAt: 1000, updatedAt: 0,
      },
      { local: true },
    );
    const edited = await b.ctx.solves.findById("x1");
    expect(Number(edited?.updatedAt)).toBeGreaterThan(deletedAt);

    // B syncs: push the newer edit, then pull the tombstone.
    // The edit wins (updated_at > deleted_at), the tombstone is a no-op.
    await runCycle(b.ctx);
    expect(await b.ctx.solves.findById("x1")).not.toBeNull();
    expect(cloud.solves.get(`${UID}:x1`)?.time_ms).toBe(9999);
  });
});
