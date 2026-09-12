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
  GearRepository,
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
import { claimHandle } from "../handle";
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
    gear: new GearRepository(executor),
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
  gear_categories = new Map<string, Record<string, unknown>>();
  gear_types = new Map<string, Record<string, unknown>>();
  gear_items = new Map<string, Record<string, unknown>>();
  sync_tombstones = new Map<string, Record<string, unknown>>();

  /**
   * F8.0 — handle → user_id, i.e. the cloud's partial unique index
   * (`uq_profiles_handle`). Global to the cloud, not per device: that is the
   * whole point of an identity.
   */
  handles = new Map<string, string>();

  /** Monotonic server clock — the seal `handle_claim` stamps rows with. */
  private serverClock = Date.now();

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
    // Profiles go through the handle guard, not plain LWW (F8.0).
    this.applyProfile(p.profiles ?? []);
    this.applyLww("training_attempts", p.training_attempts ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("training_sessions", p.training_sessions ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("training_tasks", p.training_tasks ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    // Fase 6 — the Locker. Order (categories → types → items) mirrors the
    // production blocks and the parent-before-child contract.
    this.applyLww("gear_categories", p.gear_categories ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("gear_types", p.gear_types ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
    this.applyLww("gear_items", p.gear_items ?? [], (r) => `${r.user_id}:${r.id}`, "updated_at", UID);
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
      // The cloud gear tables carry NO FKs (schema note: a push must never
      // depend on block order), so a deleted category does NOT cascade here —
      // exactly like production. Every child travels as its own tombstone.
      case "gear_items": {
        const row = this.findRow(this.gear_items, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.gear_items.delete(`${user}:${id}`);
        break;
      }
      case "gear_types": {
        const row = this.findRow(this.gear_types, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.gear_types.delete(`${user}:${id}`);
        break;
      }
      case "gear_categories": {
        const row = this.findRow(this.gear_categories, id, user);
        if (row && Number(row.updated_at) <= deletedAt) this.gear_categories.delete(`${user}:${id}`);
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

  /**
   * Mirror of the cloud's `sync_apply` profiles block, INCLUDING the
   * `profiles_protect_handle` trigger: rule A (never blank a stored handle)
   * and rule B (never steal one). Without this the fake would happily accept
   * the empty handle of a fresh device and the tests below would prove
   * nothing about the real path.
   */
  private applyProfile(rows: Record<string, unknown>[]): void {
    for (const r of rows) {
      if (String(r.user_id) !== UID) continue; // server-side per-row check
      const key = String(r.user_id);
      const cur = this.profiles.get(key);
      const incoming: Record<string, unknown> = { ...r, user_id: UID };
      const stored = String(cur?.handle ?? "");
      const next = String(incoming.handle ?? "");
      if (next === "" && stored !== "") {
        incoming.handle = stored; // rule A
      } else if (next !== "") {
        const owner = this.handles.get(next.toLowerCase());
        if (owner !== undefined && owner !== key) incoming.handle = stored; // rule B
        else this.handles.set(next.toLowerCase(), key);
      }
      if (!cur || Number(incoming.updated_at) >= Number(cur.updated_at)) {
        this.profiles.set(key, incoming);
      }
    }
  }

  /**
   * Mirror of `handle_claim`: normalize, uniqueness, and a server seal that is
   * strictly greater than the row's previous stamp (so the claiming device's
   * own pull sees it as new).
   */
  claimHandle(raw: unknown, uid: string) {
    const clean = fakeNormalizeHandle(raw);
    if (clean === null) return { data: { ok: false, reason: "invalid" }, error: null };

    const mine = this.profiles.get(uid);
    if (mine && String(mine.handle ?? "").toLowerCase() === clean) {
      return { data: { ok: true, handle: clean, unchanged: true }, error: null };
    }
    const owner = this.handles.get(clean);
    if (owner !== undefined && owner !== uid) {
      return {
        data: { ok: false, reason: "taken", suggestion: `${clean}_0001` },
        error: null,
      };
    }

    this.serverClock += 1;
    const stamp = Math.max(Number(mine?.updated_at ?? 0) + 1, this.serverClock);
    this.profiles.set(uid, { ...(mine ?? { user_id: uid }), handle: clean, updated_at: stamp });
    this.handles.set(clean, uid);
    return { data: { ok: true, handle: clean, updated_at: stamp }, error: null };
  }

  /** PostgREST-shaped client. */
  client() {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => {
            const map = (this as unknown as Record<string, Map<string, Record<string, unknown>>>)[
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
      }),
      // `handle_claim` derives the caller from the JWT (`auth.uid()`), not from
      // an argument. Every device in these tests is the same account, so the
      // constant UID stands in for that JWT.
      rpc: (name: string, args: Record<string, unknown>) => {
        if (name === "handle_claim") return this.claimHandle(args.p_handle, UID);
        return this.rpc(name, args as { payload: Record<string, Record<string, unknown>[]> });
      },
    };
  }
}

/**
 * Mirror of `normalize_handle`: trim, lower, optional `@`, 3–20 chars of
 * `[a-z0-9_]`, and a short reserved list. Deliberately a re-implementation and
 * not an import — this package must not depend on server SQL, and a divergent
 * fake is caught by the live suites in `supabase/.freebuff/` (which run the
 * real functions against the real Postgres).
 */
const FAKE_RESERVED = ["admin", "support", "cubeforge", "system", "root", "me"];

function fakeNormalizeHandle(raw: unknown): string | null {
  if (raw == null) return null;
  let c = String(raw).trim().toLowerCase();
  if (c.startsWith("@")) c = c.slice(1);
  if (!/^[a-z0-9_]{3,20}$/.test(c)) return null;
  if (FAKE_RESERVED.includes(c)) return null;
  return c;
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
    await b.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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
    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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
    await dev.ctx.sessions.insert({ id: "s2", name: "Session 2", createdAt: 2000, updatedAt: 2000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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

    await dev.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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
    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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
          penalty: "none", source: "manual", moves: [],
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

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
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
        penalty: "+2", source: "manual", moves: [],
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

// ────────────────────────────────────────────────────────────────────────────
// L) Solve attribution (M13) — the cube you solved with travels with the solve.
//
// Phase 3 let a solve name the Locker item it was done with. Two halves must
// both hold or the feature is a silent no-op:
//   • the client must PUT cube_id/cube_label in the payload (solveToCloudRow);
//   • the cloud's sync_apply must DECLARE and WRITE them — a key that is not
//     in the function's `jsonb_to_recordset(...) as x(<column list>)` is
//     dropped without an error, so the push looks successful while the
//     attribution never leaves the device.
// The second half is SQL that no runtime test can reach without a live
// Postgres, so it is asserted against the migration source itself.
// ────────────────────────────────────────────────────────────────────────────
describe("L) solve attribution travels between devices (M13)", () => {
  it("pushes the attribution and pulls it on another device", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "s1-solve",
      sessionId: "s1",
      timeMs: 8888,
      timestamp: 1000,
      scramble: "R U R'",
      penalty: "none",
      source: "smart",
      moves: [],
      puzzleType: "333",
      cubeId: "item_gan12",
      cubeLabel: "GAN 12",
      createdAt: 1000,
      updatedAt: 1000,
    });

    await pushChanges(a.ctx, UID);
    const cloudRow = cloud.solves.get(`${UID}:s1-solve`);
    expect(cloudRow?.cube_id).toBe("item_gan12");
    expect(cloudRow?.cube_label).toBe("GAN 12");

    await pullChanges(b.ctx, UID);
    const pulled = await b.ctx.solves.findById("s1-solve");
    expect(pulled?.cubeId).toBe("item_gan12");
    expect(pulled?.cubeLabel).toBe("GAN 12");
  });

  it("leaves a deliberate no-cube solve NULL on the cloud", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);

    await a.ctx.sessions.insert({ id: "s1", name: "Main", createdAt: 1000, updatedAt: 1000 });
    await a.ctx.solves.insert({
      id: "no-cube",
      sessionId: "s1",
      timeMs: 1000,
      timestamp: 1000,
      scramble: "R",
      penalty: "none",
      source: "manual",
      moves: [],
      puzzleType: "222",
      createdAt: 1000,
      updatedAt: 1000,
    });

    await pushChanges(a.ctx, UID);
    const cloudRow = cloud.solves.get(`${UID}:no-cube`);
    expect(cloudRow?.cube_id).toBeNull();
    expect(cloudRow?.cube_label).toBeNull();
  });

  it("sync_apply declares AND writes both columns (no silent drop)", async () => {
    const url = new URL(
      "../../../../supabase/migrations/20260912000010_sync_apply_solve_cube.sql",
      import.meta.url,
    );
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(url, "utf8");

    // The recordset declares the columns the client sends…
    const declaration = sql.slice(
      sql.indexOf("jsonb_to_recordset(payload -> 'solves')"),
      sql.indexOf("loop"),
    );
    expect(declaration).toContain("cube_id text");
    expect(declaration).toContain("cube_label text");

    // …the insert writes them…
    const insertSolves = sql.slice(
      sql.indexOf("insert into public.solves ("),
      sql.indexOf("on conflict (user_id, id) do update set"),
    );
    expect(insertSolves.match(/cube_id/g)?.length ?? 0).toBeGreaterThanOrEqual(2); // column list + values
    expect(insertSolves.match(/cube_label/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

    // …and the LWW update carries them, so an edit that changes the cube wins.
    const upsert = sql.slice(
      sql.indexOf("on conflict (user_id, id) do update set"),
      sql.indexOf("where excluded.updated_at >= public.solves.updated_at"),
    );
    expect(upsert).toContain("cube_id = excluded.cube_id");
    expect(upsert).toContain("cube_label = excluded.cube_label");
  });

  it("keeps the other synced tables byte-identical (only solves changed)", async () => {
    // The recreated function must not drift: everything after the solves block
    // is a verbatim copy of 20260902000007's sync_apply.
    const { readFileSync } = await import("node:fs");
    const read = (name: string) =>
      readFileSync(new URL(`../../../../supabase/migrations/${name}`, import.meta.url), "utf8");
    const body = (sql: string) => {
      const from = sql.indexOf("create or replace function public.sync_apply");
      return sql.slice(from, sql.indexOf("$$;", from) + 3);
    };
    const previous = body(read("20260902000007_drop_sessions_puzzle_type.sql"));
    const next = body(read("20260912000010_sync_apply_solve_cube.sql"));

    const solvesBlock = (sql: string) => {
      const from = sql.indexOf("payload -> 'solves'");
      const to = sql.indexOf("payload -> 'sessions'");
      return sql.slice(from, to);
    };

    // Whitespace (line endings and where the SQL wraps) carries no meaning, so
    // both sides are normalised before comparing.
    const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

    // Removing exactly the four cube additions (with the comma they were
    // spliced next to) must reproduce the previous function verbatim — proof
    // that nothing else was rewritten while recreating it.
    const withoutCubeColumns = norm(solvesBlock(next))
      .replaceAll("cube_id text, cube_label text, ", "")
      .replaceAll("rec.cube_id, rec.cube_label, ", "")
      .replaceAll("cube_id = excluded.cube_id, cube_label = excluded.cube_label, ", "")
      .replaceAll("cube_id, cube_label, ", "");

    expect(withoutCubeColumns).toBe(norm(solvesBlock(previous)));
    // Everything outside the solves block is untouched.
    expect(norm(next.replace(solvesBlock(next), ""))).toBe(
      norm(previous.replace(solvesBlock(previous), "")),
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// M) The Locker (Fase 6) travels whole: categories → types → items, with the
// photos as references and the smart-cube address as a plain column.
// ────────────────────────────────────────────────────────────────────────────
const gearCategory = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Category ${id}`,
  kind: "cube" as const,
  icon: "Box",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const gearType = (id: string, categoryId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  categoryId,
  name: `Type ${id}`,
  puzzleCategory: null,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const gearItem = (id: string, categoryId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  categoryId,
  typeId: null as string | null,
  name: `Item ${id}`,
  palette: ["#ffffff", "#ffd500"],
  links: [],
  photos: [],
  tags: [],
  status: "owned" as const,
  primary: false,
  favorite: false,
  quantity: 1,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe("M) the Locker syncs between two devices", () => {
  it("A's collection (category, type, item with photos) arrives whole on B", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.gear.upsertCategory(gearCategory("c1", { name: "3x3", icon: "Box" }));
    await a.ctx.gear.upsertType(gearType("t1", "c1", { puzzleCategory: "333" }));
    await a.ctx.gear.upsertItem(
      gearItem("i1", "c1", {
        typeId: "t1",
        name: "GAN 12 UI",
        brand: "GAN",
        serial: "SN-1",
        smartId: "AABBCCDDEEFF",
        photos: [{ id: "p1", width: 1200, height: 1200, addedAt: 42 }],
        tags: ["maglev"],
        price: { amount: 64.95, currency: "EUR" },
        rating: 4.5,
        condition: "mint",
      }),
    );

    const pushed = await pushChanges(a.ctx, UID);
    expect(pushed.pushed.gear_categories).toBe(1);
    expect(pushed.pushed.gear_types).toBe(1);
    expect(pushed.pushed.gear_items).toBe(1);
    expect(cloud.gear_items.get(`${UID}:i1`)?.photos).toBe(
      JSON.stringify([{ id: "p1", width: 1200, height: 1200, addedAt: 42 }]),
    );

    await pullChanges(b.ctx, UID);
    const snapshot = await b.ctx.gear.loadAll();
    expect(snapshot.categories.map((c) => c.name)).toEqual(["3x3"]);
    expect(snapshot.types.map((t) => t.puzzleCategory)).toEqual(["333"]);
    expect(snapshot.items).toHaveLength(1);
    const item = snapshot.items[0]!;
    expect(item.typeId).toBe("t1");
    expect(item.smartId).toBe("AABBCCDDEEFF");
    expect(item.photos).toEqual([{ id: "p1", width: 1200, height: 1200, addedAt: 42 }]);
    expect(item.price).toEqual({ amount: 64.95, currency: "EUR" });
    expect(item.rating).toBe(4.5);
    expect(item.condition).toBe("mint");
    expect(item.tags).toEqual(["maglev"]);

    // Convergence: A's watermarks are already at the rows' stamps, so its next
    // push is empty. B's pull re-dirtied the rows (the local triggers fire on
    // every applied row), so B pushes them back ONCE — an idempotent trip that
    // LWW accepts with `>=` — and is at rest from then on.
    const againOnA = await pushChanges(a.ctx, UID);
    expect(againOnA.pushed.gear_items ?? 0).toBe(0);
    await pushChanges(b.ctx, UID);
    const restOnB = await pushChanges(b.ctx, UID);
    expect(restOnB.pushed.gear_items ?? 0).toBe(0);
  });
});

describe("N) a deleted Locker category is deleted everywhere (cascade + tombstones)", () => {
  it("category, type and items all disappear from the cloud and from B", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.gear.upsertCategory(gearCategory("c1"));
    await a.ctx.gear.upsertType(gearType("t1", "c1"));
    await a.ctx.gear.upsertItem(gearItem("i1", "c1", { typeId: "t1" }));
    await a.ctx.gear.upsertItem(gearItem("i2", "c1"));
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);
    expect((await b.ctx.gear.loadAll()).items).toHaveLength(2);

    // Delete the category on A: the repository deletes children explicitly
    // (a plain cascade would not fire the tombstone triggers), so three
    // tombstones are produced.
    await a.ctx.gear.deleteCategory("c1");
    const pushed = await pushChanges(a.ctx, UID);
    expect(pushed.pushedTombstones).toBe(4);
    expect(cloud.gear_categories.size).toBe(0);
    expect(cloud.gear_types.size).toBe(0);
    expect(cloud.gear_items.size).toBe(0);

    await pullChanges(b.ctx, UID);
    const onB = await b.ctx.gear.loadAll();
    expect(onB.categories).toHaveLength(0);
    expect(onB.types).toHaveLength(0);
    expect(onB.items).toHaveLength(0);

    // …and it stays gone on a brand-new device (nothing resurrects).
    const c = makeDevice(cloud);
    await pullChanges(c.ctx, UID);
    expect((await c.ctx.gear.loadAll()).items).toHaveLength(0);
  });

  it("an ITEM deleted on A but edited later on B survives (LWW)", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.gear.upsertCategory(gearCategory("c1"));
    await a.ctx.gear.upsertItem(gearItem("i1", "c1", { name: "Original" }));
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);

    await a.ctx.gear.deleteItem("i1");
    await pushChanges(a.ctx, UID);
    expect(cloud.gear_items.size).toBe(0);

    // B renamed the item offline, after A's delete was published.
    await b.ctx.gear.upsertItem(gearItem("i1", "c1", { name: "Still mine" }), { local: true });
    const editedOnB = (await b.ctx.gear.loadAll()).items[0]!;

    // B pushes first, the tombstone pull comes after: the conditional delete
    // (`updated_at <= deleted_at`) spares the newer row, which stays in the
    // cloud under B's name.
    await runCycle(b.ctx);
    expect(cloud.gear_items.get(`${UID}:i1`)?.name).toBe("Still mine");
    expect(Number(cloud.gear_items.get(`${UID}:i1`)?.updated_at)).toBe(editedOnB.updatedAt);

    // A gets its item back on the next pull: the category is still there.
    await runCycle(a.ctx);
    const onA = await a.ctx.gear.loadAll();
    expect(onA.items.map((i) => i.name)).toEqual(["Still mine"]);
  });

  it("a child edited later is never destroyed by the parent's delete (no echo escalation)", async () => {
    // The bug this pins: B applied the category tombstone, its local cascade
    // deleted the item, and the TRIGGER re-announced that delete with a FRESHER
    // `deleted_at` than A's original tombstone. Pushed back, the echo destroyed
    // B's newer "Edited after" row in the cloud (`updated_at <= deleted_at`),
    // on every device, permanently — the exact opposite of what a
    // LWW-conditional delete exists to guarantee. Applying a remote tombstone
    // now deletes locally and says nothing (tombstone-echo.ts), so the newer
    // edit survives.
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.gear.upsertCategory(gearCategory("c1"));
    await a.ctx.gear.upsertItem(gearItem("i1", "c1"));
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);

    // A deletes the whole category and publishes it.
    await a.ctx.gear.deleteCategory("c1");
    await pushChanges(a.ctx, UID);
    expect((await a.ctx.gear.loadAll()).items).toHaveLength(0);

    // B renames the item offline, after the delete.
    await b.ctx.gear.upsertItem(gearItem("i1", "c1", { name: "Edited after" }), { local: true });

    for (let i = 0; i < 3; i += 1) {
      await runCycle(b.ctx);
      await runCycle(a.ctx);
    }

    // The newer edit is alive in the cloud — not escalated away by an echo.
    expect(cloud.gear_items.get(`${UID}:i1`)?.name).toBe("Edited after");

    // Locally the parent delete still wins (a child with no category has no
    // home): B dropped it with the cascade, A re-pulled the re-published
    // category and item. Documented in the phase plan, risks.
    expect((await a.ctx.gear.loadAll()).items.map((i) => i.name)).toEqual(["Edited after"]);
    expect((await b.ctx.gear.loadAll()).items).toHaveLength(0);
  });
});

describe("O) deleting a Locker type re-homes its items instead of losing them", () => {
  it("the re-homed items carry a fresh stamp and reach the other device", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    await a.ctx.gear.upsertCategory(gearCategory("c1"));
    await a.ctx.gear.upsertType(gearType("t1", "c1"));
    await a.ctx.gear.upsertItem(gearItem("i1", "c1", { typeId: "t1" }));
    await pushChanges(a.ctx, UID);
    await pullChanges(b.ctx, UID);
    expect((await b.ctx.gear.loadAll()).items[0]?.typeId).toBe("t1");

    await a.ctx.gear.deleteType("t1");
    await pushChanges(a.ctx, UID);

    // The type is gone from the cloud, the item is not — and it no longer
    // points at the deleted type anywhere.
    expect(cloud.gear_types.size).toBe(0);
    expect(cloud.gear_items.get(`${UID}:i1`)?.type_id).toBeNull();

    await pullChanges(b.ctx, UID);
    const onB = await b.ctx.gear.loadAll();
    expect(onB.types).toHaveLength(0);
    expect(onB.items).toHaveLength(1);
    expect(onB.items[0]?.typeId).toBeNull();
    expect(onB.items[0]?.categoryId).toBe("c1");
  });
});

describe("P) the pull never wedges on an incomplete Locker (FK guards)", () => {
  it("skips a type and an item whose category is missing, re-homes an unknown type", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    // A type whose category never reached this device, an item in the same
    // state, and an item whose TYPE is unknown but whose category is present.
    cloud.gear_types.set(`${UID}:orphan-type`, {
      user_id: UID,
      id: "orphan-type",
      category_id: "nowhere",
      name: "Orphan",
      puzzle_category: null,
      is_demo: 0,
      created_at: 10,
      updated_at: 10,
    });
    cloud.gear_categories.set(`${UID}:c1`, {
      user_id: UID,
      id: "c1",
      name: "Cubes",
      kind: "cube",
      icon: "Box",
      accent: null,
      is_demo: 0,
      created_at: 10,
      updated_at: 10,
    });
    cloud.gear_items.set(`${UID}:orphan-item`, {
      user_id: UID,
      id: "orphan-item",
      category_id: "nowhere",
      type_id: null,
      name: "Homeless",
      palette: "[]",
      links: "[]",
      photos: "[]",
      tags: "[]",
      status: "owned",
      is_primary: 0,
      is_favorite: 0,
      quantity: 1,
      is_demo: 0,
      created_at: 10,
      updated_at: 10,
    });
    cloud.gear_items.set(`${UID}:rehomed`, {
      user_id: UID,
      id: "rehomed",
      category_id: "c1",
      type_id: "ghost-type",
      name: "Re-homed",
      palette: "[]",
      links: "[]",
      photos: "[]",
      tags: "[]",
      status: "owned",
      is_primary: 0,
      is_favorite: 0,
      quantity: 1,
      is_demo: 0,
      created_at: 10,
      updated_at: 10,
    });

    await expect(pullChanges(dev.ctx, UID)).resolves.toBeDefined();

    const snapshot = await dev.ctx.gear.loadAll();
    expect(snapshot.types).toHaveLength(0);
    expect(snapshot.items.map((i) => i.id)).toEqual(["rehomed"]);
    // The item survived; only its dangling reference was dropped.
    expect(snapshot.items[0]?.typeId).toBeNull();
    expect(snapshot.items[0]?.categoryId).toBe("c1");
  });
});

describe("Q) the Locker respects LWW in both directions", () => {
  it("a pull never overwrites a newer local item, which then wins on the cloud", async () => {
    const cloud = new FakeCloud();
    const dev = makeDevice(cloud);

    await dev.ctx.gear.upsertCategory(gearCategory("c1"));
    cloud.gear_categories.set(`${UID}:c1`, {
      user_id: UID,
      id: "c1",
      name: "Cubes",
      kind: "cube",
      icon: "Box",
      accent: null,
      is_demo: 0,
      created_at: 1000,
      updated_at: 1000,
    });
    // Cloud has an OLDER copy of the item…
    cloud.gear_items.set(`${UID}:i1`, {
      user_id: UID,
      id: "i1",
      category_id: "c1",
      type_id: null,
      name: "From the cloud",
      palette: "[]",
      links: "[]",
      photos: "[]",
      tags: "[]",
      status: "owned",
      is_primary: 0,
      is_favorite: 0,
      quantity: 1,
      is_demo: 0,
      created_at: 1000,
      updated_at: 2000,
    });
    // …while this device edited it later, offline.
    await dev.ctx.gear.upsertItem(gearItem("i1", "c1", { name: "Local edit", updatedAt: 9000 }));

    await pullChanges(dev.ctx, UID);
    expect((await dev.ctx.gear.loadAll()).items[0]?.name).toBe("Local edit");

    await pushChanges(dev.ctx, UID);
    expect(cloud.gear_items.get(`${UID}:i1`)?.name).toBe("Local edit");

    // An older cloud copy must never claw back a newer local row, even after
    // the watermark advanced past it.
    await dev.ctx.gear.upsertItem(
      gearItem("i1", "c1", { name: "Local edit 2", updatedAt: 12000 }),
    );
    cloud.gear_items.set(`${UID}:i1`, {
      ...(cloud.gear_items.get(`${UID}:i1`) as Record<string, unknown>),
      name: "Stale cloud",
      updated_at: 11000,
    });
    await dev.ctx.meta.set(`sync_watermark_pull_gear_items_${UID}`, "0");
    await pullChanges(dev.ctx, UID);
    expect((await dev.ctx.gear.loadAll()).items[0]?.name).toBe("Local edit 2");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// R) The cloud function must DECLARE every gear column the client sends: a key
// missing from `jsonb_to_recordset(...) as x(<columns>)` is dropped silently,
// so a push looks successful while the data never leaves the device (the M13
// lesson, applied to the Locker).
// ────────────────────────────────────────────────────────────────────────────
describe("R) the cloud gear blocks declare every column the client sends", () => {
  it("every key of the mapped rows appears in the recordset declaration", async () => {
    const { readFileSync } = await import("node:fs");
    const read = (name: string) =>
      readFileSync(new URL(`../../../../supabase/migrations/${name}`, import.meta.url), "utf8");
    // The DEPLOYED body is the last migration that recreates sync_apply; the
    // guardian constants still live in 12, which defines sync_payload_guard and
    // is not redefined afterwards.
    const sql = read("20260912000015_sync_apply_hardening.sql");
    const guardSql = read("20260912000012_gear_sync_apply.sql");

    const declaration = (table: string) => {
      const from = sql.indexOf(`jsonb_to_recordset(payload -> '${table}')`);
      expect(from, `${table} block missing`).toBeGreaterThan(-1);
      return sql.slice(from, sql.indexOf("loop", from));
    };
    const insertBlock = (table: string) => {
      const from = sql.indexOf(`insert into public.${table} (`);
      expect(from, `${table} insert missing`).toBeGreaterThan(-1);
      return sql.slice(from, sql.indexOf("where excluded.updated_at", from));
    };

    const { gearCategoryToCloudRow, gearTypeToCloudRow, gearItemToCloudRow } = await import(
      "../mappers"
    );
    // A fully populated item: every optional field set, so the key set is the
    // widest the client can produce.
    const rows: Record<string, Record<string, unknown>> = {
      gear_categories: gearCategoryToCloudRow(
        {
          id: "c1",
          name: "Cubes",
          kind: "cube",
          icon: "Box",
          accent: "#fff",
          createdAt: 1,
          updatedAt: 2,
        },
        UID,
      ),
      gear_types: gearTypeToCloudRow(
        {
          id: "t1",
          categoryId: "c1",
          name: "3x3",
          puzzleCategory: "333",
          createdAt: 1,
          updatedAt: 2,
        },
        UID,
      ),
      gear_items: gearItemToCloudRow(
        {
          id: "i1",
          categoryId: "c1",
          typeId: "t1",
          name: "GAN 12",
          brand: "GAN",
          model: "12 UI",
          finish: "Stickerless",
          serial: "SN-1",
          smartId: "AABBCCDDEEFF",
          palette: ["#fff"],
          acquiredAt: "2026-01-01",
          price: { amount: 1, currency: "EUR" },
          notes: "note",
          links: [{ label: "Shop", url: "https://example.com" }],
          photos: [{ id: "p1", width: 10, height: 10, addedAt: 1 }],
          tags: ["tag"],
          status: "owned",
          primary: true,
          favorite: true,
          rating: 3,
          quantity: 2,
          condition: "good",
          createdAt: 1,
          updatedAt: 2,
        },
        UID,
      ),
    };

    for (const [table, row] of Object.entries(rows)) {
      const declared = declaration(table);
      for (const key of Object.keys(row)) {
        // Every key the mapper emits must be declared, or the value is dropped
        // without an error and never reaches the cloud.
        expect(declared, `${table}.${key} is not declared`).toContain(`${key} `);
      }
      // …and the insert + LWW update actually write them (not just declare).
      const insert = insertBlock(table);
      for (const key of Object.keys(row)) {
        expect(insert, `${table}.${key} is never written`).toContain(key);
      }
    }

    // The payload guardian (bounded size and row count) is what keeps a buggy
    // or hostile client from making the function materialise a huge JSON.
    expect(sql).toContain("sync_payload_guard");
    expect(guardSql).toContain("8388608");
    expect(guardSql).toContain("4000");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// S) Hardening de la auditoría (2026-09-12). Dos invariantes que el SQL
// desplegado debe cumplir, porque su incumplimiento cuesta el sync COMPLETO:
//
//   H2 · `jsonb_to_recordset` deja NULL en una clave AUSENTE (no aplica el
//        DEFAULT de la tabla), y un NULL explícito en una columna NOT NULL
//        revierte el lote entero — solves, training y Locker incluidos —
//        dejando el watermark atrás: cuelgue hasta actualizar la app.
//        ⇒ toda columna NOT NULL debe ir envuelta en `coalesce`.
//
//   H1 · El pull avanza su watermark al MÁXIMO de lo descargado, así que un
//        solo sello en el futuro (reloj roto o cliente manipulado) fija el
//        cursor de TODOS los dispositivos en ese instante y no vuelven a
//        descargar nada de esa tabla: apagón permanente y silencioso.
//        ⇒ todo sello temporal debe ir acotado con `least(..., max_stamp)`.
//        ⇒ y una DURACIÓN (time_ms, duration_ms) NUNCA debe acotarse: no es
//          un instante y acotarla corrompería el dato.
// ────────────────────────────────────────────────────────────────────────────
describe("S) sync_apply: null-safety y acotado de sellos (auditoría 2026-09-12)", () => {
  const CONTRACT: Record<
    string,
    { notNull: string[]; stamps: string[]; durations: string[] }
  > = {
    solves: {
      notNull: [
        "id", "session_id", "time_ms", "timestamp", "scramble", "penalty", "source",
        "moves", "puzzle_type", "is_demo", "created_at", "updated_at",
      ],
      stamps: ["timestamp", "created_at", "updated_at"],
      durations: ["time_ms"],
    },
    sessions: {
      notNull: ["id", "name", "created_at", "updated_at", "is_demo"],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    profiles: {
      notNull: [
        "display_name", "handle", "bio", "avatar_kind", "main_puzzle",
        "declared_methods", "country", "created_at", "updated_at",
      ],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    training_attempts: {
      notNull: [
        "id", "exercise_id", "method_id", "scramble", "time_ms", "verdict",
        "play_mode", "metric_kind", "timestamp", "updated_at",
      ],
      stamps: ["timestamp", "updated_at"],
      durations: ["time_ms"],
    },
    training_sessions: {
      notNull: [
        "id", "exercise_id", "method_id", "started_at", "duration_ms",
        "smart_cube_used", "status", "updated_at",
      ],
      stamps: ["started_at", "updated_at"],
      durations: ["duration_ms"],
    },
    training_tasks: {
      notNull: [
        "id", "title", "description", "start_date", "repeat", "days_of_week",
        "color", "created_at", "updated_at",
      ],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    skill_progress: {
      notNull: ["skill_id", "completed_at"],
      stamps: ["completed_at"],
      durations: [],
    },
    gear_categories: {
      notNull: ["id", "name", "kind", "icon", "is_demo", "created_at", "updated_at"],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    gear_types: {
      notNull: ["id", "category_id", "name", "is_demo", "created_at", "updated_at"],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    gear_items: {
      notNull: [
        "id", "category_id", "name", "palette", "links", "photos", "tags", "status",
        "is_primary", "is_favorite", "quantity", "is_demo", "created_at", "updated_at",
      ],
      stamps: ["created_at", "updated_at"],
      durations: [],
    },
    tombstones: {
      notNull: ["entity", "entity_id", "deleted_at"],
      stamps: ["deleted_at"],
      durations: [],
    },
  };

  it("every NOT NULL column is coalesced and every stamp is clamped", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260912000015_sync_apply_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    );

    /** Text of one table's block: from its recordset declaration to the next. */
    const block = (table: string) => {
      const start = sql.indexOf(`jsonb_to_recordset(payload -> '${table}')`);
      expect(start, `${table} block missing`).toBeGreaterThan(-1);
      const next = sql.indexOf("jsonb_to_recordset(payload -> '", start + 10);
      return sql.slice(start, next === -1 ? sql.length : next);
    };

    for (const [table, rule] of Object.entries(CONTRACT)) {
      const text = block(table);
      for (const col of rule.notNull) {
        // `user_id` is written as `uid` on purpose (never trusted from the
        // payload), so it is not part of the contract.
        expect(text, `${table}.${col} is not coalesced`).toContain(`coalesce(rec.${col}`);
      }
      for (const col of rule.stamps) {
        expect(text, `${table}.${col} is not clamped`).toContain(
          `least(coalesce(rec.${col}, 0), max_stamp)`,
        );
      }
      for (const col of rule.durations) {
        expect(text, `${table}.${col} must NOT be clamped (it is a duration)`).not.toContain(
          `least(coalesce(rec.${col}`,
        );
      }
    }

    // The clamp must exist and be bounded, and the guard must run first.
    expect(sql).toContain("max_stamp bigint := now_ms + 300000");
    expect(sql).toContain("perform public.sync_payload_guard(payload)");

    // H3: an entity with no physical-delete branch must still be purged.
    expect(sql).toContain("st.entity not in (");

    // …and the index the sessions guard needs must be created here.
    expect(sql).toContain("idx_solves_user_session");
  });
});

/**
 * The cloud row a claimed handle leaves behind (mirrors `handle_claim`: it
 * writes the row itself, not just the handle). `owner` defaults to the account
 * these devices are linked to; pass another id to model a handle that belongs
 * to somebody else.
 */
function claimOnCloud(
  cloud: FakeCloud,
  handle: string,
  stamp: number,
  owner: string = UID,
): void {
  cloud.handles.set(handle, owner);
  cloud.profiles.set(owner, {
    user_id: owner,
    display_name: "Ana",
    handle,
    bio: "",
    avatar_kind: "identicon",
    avatar_data: null,
    main_puzzle: "333",
    declared_methods: "[]",
    country: "",
    created_at: stamp,
    updated_at: stamp,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// T) F8.0 — identidad pública: el handle pertenece a la CUENTA, no al
// dispositivo. Un handle solo existe si alguien lo reclamó en el servidor
// (`handle_claim`), y el servidor es el que decide quién lo tiene: el trigger
// `profiles_protect_handle` nunca lo vacía (regla A) ni lo roba (regla B).
//
// Esto importa porque un segundo dispositivo NO llega con el handle: llega con
// un perfil local por defecto sellado con su propio `Date.now()`, que suele ser
// MÁS NUEVO que el sello de la reclamación del primero. Con LWW estricto ese
// dispositivo jamás adoptaría el handle de la cuenta y la UI mostraría "sin
// handle" para una cuenta que sí lo tiene.
// ────────────────────────────────────────────────────────────────────────────
describe("T) el handle lo decide el servidor, no el dispositivo", () => {
  it("reclamar un handle adopta el sello del servidor (y no gasta un push)", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    await a.ctx.profiles.getOrCreate(UID);

    const res = await claimHandle(a.ctx, UID, "@Ana");
    expect(res).toEqual({ ok: true, handle: "ana" });

    const local = await a.ctx.profiles.findById(UID);
    const onCloud = cloud.profiles.get(UID);
    expect(local?.handle).toBe("ana");
    // El sello local es EXACTAMENTE el del servidor: ni antes (el pull no lo
    // traería) ni después (el push lo reenviaría para siempre).
    expect(Number(local?.updatedAt)).toBe(Number(onCloud?.updated_at));
    expect(Number(local?.updatedAt)).toBeGreaterThan(0);

    // Reclamar el mismo handle otra vez es idempotente y no mueve el sello
    // (el servidor devuelve `unchanged`, sin `updated_at`).
    const again = await claimHandle(a.ctx, UID, "ana");
    expect(again).toEqual({ ok: true, handle: "ana" });
    expect(Number((await a.ctx.profiles.findById(UID))?.updatedAt)).toBe(
      Number(local?.updatedAt),
    );
  });

  it("un handle tomado no toca el dispositivo que lo pidió", async () => {
    const cloud = new FakeCloud();
    // 'ana' es de OTRA cuenta: el índice único es del servidor, no del usuario.
    const otherAccount = "ffffffff-1111-2222-3333-444444444444";
    claimOnCloud(cloud, "ana", Date.now() + 1000, otherAccount);
    const b = makeDevice(cloud);
    await b.ctx.profiles.getOrCreate(UID);

    // El perfil local ya existe (lo crea `getOrCreate` sellado con `Date.now()`
    // — justo el sello que hace que un segundo dispositivo sea "más nuevo" que
    // la nube). Lo que importa: un rechazo NO lo mueve.
    const before = Number((await b.ctx.profiles.findById(UID))?.updatedAt);
    const res = await claimHandle(b.ctx, UID, "ANA");
    expect(res).toEqual({ ok: false, reason: "taken", suggestion: "ana_0001" });
    // El rechazo no escribe nada: ni handle, ni sello que dispare un push.
    const local = await b.ctx.profiles.findById(UID);
    expect(local?.handle).toBe("");
    expect(Number(local?.updatedAt)).toBe(before);
    expect(String(cloud.profiles.get(otherAccount)?.handle)).toBe("ana");
  });

  it("un formato inválido no llega al servidor y la red caída no miente", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    await a.ctx.profiles.getOrCreate(UID);

    expect(await claimHandle(a.ctx, UID, "ab")).toEqual({ ok: false, reason: "invalid" });
    expect(await claimHandle(a.ctx, UID, "admin")).toEqual({ ok: false, reason: "invalid" });

    // Sin red: `offline`, y el perfil local intacto (nunca un handle a medias).
    const offline = makeDevice(cloud);
    offline.ctx.supabase = {
      rpc: async () => {
        throw new Error("Failed to fetch");
      },
    } as never;
    expect(await claimHandle(offline.ctx, UID, "ana")).toEqual({
      ok: false,
      reason: "offline",
    });

    // Una sesión caducada es OTRA cosa: decir "pareces estar sin conexión"
    // manda al usuario a mirar el wifi cuando el problema es el login.
    const expired = makeDevice(cloud);
    expired.ctx.supabase = {
      rpc: async () => ({ data: null, error: { status: 401, message: "jwt expired" } }),
    } as never;
    expect(await claimHandle(expired.ctx, UID, "ana")).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    // …y un error de servidor que no sabemos interpretar sigue siendo `offline`.
    const broken = makeDevice(cloud);
    broken.ctx.supabase = {
      rpc: async () => ({ data: null, error: { status: 500, message: "boom" } }),
    } as never;
    expect(await claimHandle(broken.ctx, UID, "ana")).toEqual({
      ok: false,
      reason: "offline",
    });
  });

  it("el contrato de `handle_claim` que el cliente espera sigue en la migración", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260912000016_handle_identity.sql",
        import.meta.url,
      ),
      "utf8",
    );

    // Los DOS motivos de rechazo que `HandleClaimFailure` sabe interpretar. Un
    // tercero ('rate_limited', 'conflict', …) se degradaría a `invalid` en el
    // cliente y el usuario vería "elige otro" para algo que no es formato.
    expect(sql).toContain("'reason', 'invalid'");
    expect(sql).toContain("'reason', 'taken'");
    expect(sql).not.toMatch(/'reason', '(?!invalid|taken')/);

    // El sello que el cliente adopta tiene que ser estrictamente mayor que el
    // anterior, o el pull del propio dispositivo no lo vería como nuevo.
    expect(sql).toContain("greatest(public.profiles.updated_at + 1, now_ms)");
    // …y la rama idempotente NO lo devuelve (el cliente conserva el suyo).
    expect(sql).toContain("'unchanged', true");

    // Reglas A (nunca vaciar) y B (nunca robar), más el INSERT de una fila
    // nueva con el handle ya tomado (que se queda vacío, sin lanzar).
    expect(sql.match(/new\.handle := old\.handle;/g)).toHaveLength(2);
    expect(sql).toContain("new.handle := '';");
    // Un BEFORE que reescribe NEW nunca lanza: no hay `unique_violation` que
    // pueda tumbar un lote de `sync_apply`.
    expect(sql).not.toContain("raise exception 'handle taken'");
  });

  it("un dispositivo con el perfil local más nuevo adopta el handle de la cuenta", async () => {
    const cloud = new FakeCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);

    const claimedAt = Date.now() + 1000;
    claimOnCloud(cloud, "ana", claimedAt);
    // A reclama (su fila local se sella con el sello del servidor).
    void a;

    // B es un dispositivo recién vinculado: perfil local por defecto, sin
    // handle, y con un sello MÁS NUEVO que el de la reclamación.
    const newerThanCloud = claimedAt + 5000;
    await b.ctx.profiles.upsert({
      userId: UID,
      displayName: "Bea",
      handle: "",
      bio: "",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "",
      createdAt: newerThanCloud,
      updatedAt: newerThanCloud,
    });

    await pullChanges(b.ctx, UID);

    const onB = await b.ctx.profiles.findById(UID);
    expect(onB?.handle).toBe("ana");
    // …y adoptarlo no ha costado nada local: sus campos y su sello siguen
    // siendo los suyos (el handle no arrastra el resto de la fila).
    expect(onB?.displayName).toBe("Bea");
    expect(Number(onB?.updatedAt)).toBe(newerThanCloud);
  });

  it("el push posterior de ese dispositivo no borra el handle de la nube (regla A)", async () => {
    const cloud = new FakeCloud();
    const b = makeDevice(cloud);

    const claimedAt = Date.now() + 1000;
    claimOnCloud(cloud, "ana", claimedAt);

    // El caso exacto de instalar la app en un segundo dispositivo: perfil por
    // defecto (handle vacío) con un sello nuevo, y el motor EMPUJA ANTES de
    // tirar. Sin la regla A, ese vacío publicaría el handle a la nube.
    const stamp = claimedAt + 5000;
    await b.ctx.profiles.upsert({
      userId: UID,
      displayName: "",
      handle: "",
      bio: "",
      avatarKind: "identicon",
      mainPuzzle: "333",
      declaredMethods: [],
      country: "",
      createdAt: stamp,
      updatedAt: stamp,
    });
    await pushChanges(b.ctx, UID);
    expect(String(cloud.profiles.get(UID)?.handle)).toBe("ana");

    // Y el pull siguiente se lo trae de vuelta: la UI de B no queda "sin
    // handle" para una cuenta que sí lo tiene.
    await pullChanges(b.ctx, UID);
    expect((await b.ctx.profiles.findById(UID))?.handle).toBe("ana");
  });
});
