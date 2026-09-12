import type { Solve } from './types.js';
import { isDbPuzzleType } from '@cubeforge/events';
import type { CubeMoveEvent, OrientationTimeline } from '@cubeforge/types';
import { withTransaction } from './transaction.js';
import { nextLocalStamps } from './local-clock.js';

export interface SolveRow {
  id: string;
  session_id: string;
  time_ms: number;
  timestamp: number;
  scramble: string;
  penalty: string;
  method: string | null;
  cube_id: string | null;
  cube_label: string | null;
  source: string;
  note: string | null;
  moves: string;
  orientation_timeline: string | null;
  analysis_engine_version: string | null;
  analysis: string | null;
  puzzle_type?: string;
  is_demo?: number;
  created_at: number;
  updated_at: number;
}

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Safely parse the `moves` JSON column.
 *
 * Protects against:
 *  - empty strings (`JSON.parse('')` → SyntaxError)
 *  - invalid JSON (`JSON.parse('[invalid]')` → SyntaxError)
 *  - JSON null literal (`JSON.parse('null')` → null instead of [])
 *
 * All failures return an empty array so downstream code that iterates
 * over `solve.moves` never crashes on corrupt data.
 */
function safeParseMoves(raw: string): CubeMoveEvent[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Safely parse the `orientation_timeline` JSON column.
 *
 * OrientationTimeline is a COMPACT keyframe ARRAY: `[moveIndex, orientationIndex][]`
 * (see packages/types). The old parser rejected arrays (`!Array.isArray`) — it
 * was written against a prototype object shape (`{events:[...]}`) that no
 * producer emits — so every stored timeline came back `undefined` after a
 * reload and replays lost their grip + rotations ("only works the first
 * time" bug). Falls back to `undefined` on any parse failure or wrong shape.
 */
function safeParseOrientationTimeline(raw: string | null): OrientationTimeline | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    // Validate the shape: every entry is a [moveIndex, orientationIndex] pair
    // of finite numbers. Anything else (objects, null, strings) → undefined.
    const valid = parsed.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'number' &&
        Number.isFinite(entry[0]) &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]),
    );
    return valid ? (parsed as OrientationTimeline) : undefined;
  } catch {
    return undefined;
  }
}

function rowToSolve(row: SolveRow): Solve {
  return {
    id: row.id,
    sessionId: row.session_id,
    timeMs: row.time_ms,
    timestamp: row.timestamp,
    scramble: row.scramble,
    penalty: row.penalty as Solve['penalty'],
    method: row.method ?? undefined,
    cubeId: row.cube_id ?? undefined,
    cubeLabel: row.cube_label ?? undefined,
    source: (row.source as Solve['source']) ?? 'manual',
    note: row.note ?? undefined,
    moves: safeParseMoves(row.moves),
    orientationTimeline: safeParseOrientationTimeline(row.orientation_timeline),
    analysisEngineVersion: row.analysis_engine_version ?? undefined,
    analysis: row.analysis ?? undefined,
    puzzleType: row.puzzle_type ?? '333',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function solveToRow(solve: Solve): SolveRow {
  // Phase A2 (ADR-002) — validate puzzle_type against the WCA event
  // registry at the write boundary (covers insert, insertMany and update).
  // Undefined is allowed (defaults to '333'); a DEFINED value that is not a
  // WCA event code is a bug and must never reach the disk. The SQLite CHECK
  // (migration 027) enforces the same contract at the schema level.
  if (solve.puzzleType !== undefined && !isDbPuzzleType(solve.puzzleType)) {
    throw new Error(
      `Cannot persist solve: unknown puzzle_type '${solve.puzzleType}' — must be a WCA event code declared by the registry`
    );
  }
  return {
    id: solve.id,
    session_id: solve.sessionId,
    // M5: normalize to integer milliseconds at the write boundary. The cloud
    // stores bigint, so a float (smart-cube / StackMat sub-ms precision)
    // would be rounded by Postgres on the way up and silently changed on the
    // way down — explicit rounding here keeps local == cloud everywhere.
    time_ms: Math.round(solve.timeMs),
    timestamp: solve.timestamp,
    scramble: solve.scramble,
    penalty: solve.penalty,
    method: solve.method ?? null,
    cube_id: solve.cubeId ?? null,
    cube_label: solve.cubeLabel ?? null,
    source: solve.source ?? 'manual',
    note: solve.note ?? null,
    moves: JSON.stringify(solve.moves || []),
    orientation_timeline: solve.orientationTimeline
      ? JSON.stringify(solve.orientationTimeline)
      : null,
    analysis_engine_version: solve.analysisEngineVersion ?? null,
    analysis: solve.analysis ?? null,
    puzzle_type: solve.puzzleType ?? '333',
    created_at: solve.createdAt ?? Date.now(),
    updated_at: solve.updatedAt ?? Date.now(),
  };
}

export class SolvesRepository {
  private db: DBExecutor;
  constructor(db: DBExecutor) {
    this.db = db;
  }

  /**
   * All NON-demo solves (optionally for one session), oldest first.
   *
   * Demo solves (is_demo = 1) are excluded here so seeded sample data can
   * never leak into the user's session list, stats or history — isolation
   * no longer depends solely on demo solves living in a demo session.
   */
  async findAll(sessionId?: string): Promise<Solve[]> {
    let sql = 'SELECT * FROM solves WHERE is_demo = 0';
    const bind: unknown[] = [];
    if (sessionId) {
      sql += ' AND session_id = ? ORDER BY timestamp ASC';
      bind.push(sessionId);
    } else {
      sql += ' ORDER BY timestamp ASC';
    }
    const rows = await this.db(sql, bind);
    return rows.map((r) => rowToSolve(r as unknown as SolveRow));
  }

  async findById(id: string): Promise<Solve | null> {
    const rows = await this.db('SELECT * FROM solves WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToSolve(rows[0] as unknown as SolveRow);
  }

  /**
   * Every NON-demo solve attributed to one Locker item, oldest first (so the
   * order matches `findAll` and a caller can slice a chronological window
   * without reversing anything).
   *
   * Backed by `idx_solves_cube` (migration 035). The per-cube statistics are a
   * FILTER over the solve history, never a synced counter (ADR-029): a device
   * that edits a penalty offline would otherwise silently disagree with the
   * cloud, and the number would be wrong in both places.
   *
   * Solves are deliberately NOT tied to an item by a foreign key (see 035), so
   * this keeps answering for a cube that has since been sold or deleted — the
   * history is a fact and the frozen `cube_label` keeps it readable.
   */
  async findByCube(cubeId: string): Promise<Solve[]> {
    const rows = await this.db(
      'SELECT * FROM solves WHERE is_demo = 0 AND cube_id = ? ORDER BY timestamp ASC',
      [cubeId],
    );
    return rows.map((r) => rowToSolve(r as unknown as SolveRow));
  }

  /**
   * How many NON-demo solves each attributed cube has, and when it was last
   * used — ONE grouped query for the whole Locker grid.
   *
   * Asking per card would mean N queries for N cubes on every render; this is a
   * single pass over the `cube_id` index. Unattributed solves (cube_id NULL)
   * have no owner and are simply absent from the result.
   */
  async summarizeCubes(): Promise<Map<string, { count: number; lastUsedAt: number }>> {
    const rows = await this.db(
      'SELECT cube_id, COUNT(*) AS cnt, MAX(timestamp) AS last_ts FROM solves WHERE is_demo = 0 AND cube_id IS NOT NULL GROUP BY cube_id',
    );
    const summary = new Map<string, { count: number; lastUsedAt: number }>();
    for (const row of rows) {
      const cubeId = row.cube_id == null ? '' : String(row.cube_id);
      if (!cubeId) continue;
      summary.set(cubeId, {
        count: Number(row.cnt) || 0,
        lastUsedAt: Number(row.last_ts) || 0,
      });
    }
    return summary;
  }

  /**
   * All NON-demo solves edited strictly after `updatedAt` (epoch ms) — the
   * sync push cursor. A fresh link passes 0 so every real solve is pushed.
   * Solves are immutable-ish (penalty/method/note/analysis edits bump
   * updated_at), so LWW on updated_at is the conflict rule.
   *
   * Optional (updated_at, id) keyset pagination: when `opts` is given the
   * cursor continues after `(afterUpdatedAt, afterId)` — rows that share the
   * exact same `updated_at` are NEVER skipped (a plain `> wm` boundary would
   * silently drop every row beyond the first page that shares the max
   * timestamp, which bulk imports routinely produce).
   */
  async findAllSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<Solve[]> {
    let sql = 'SELECT * FROM solves WHERE is_demo = 0';
    const bind: unknown[] = [];
    if (opts?.afterUpdatedAt !== undefined && opts.afterId !== undefined) {
      sql +=
        ' AND (updated_at > ? OR (updated_at = ? AND id > ?))';
      bind.push(opts.afterUpdatedAt, opts.afterUpdatedAt, opts.afterId);
    } else {
      sql += ' AND updated_at > ?';
      bind.push(updatedAt);
    }
    sql += ' ORDER BY updated_at ASC, id ASC';
    if (opts?.limit !== undefined) {
      sql += ' LIMIT ?';
      bind.push(opts.limit);
    }
    const rows = await this.db(sql, bind);
    return rows.map((r) => rowToSolve(r as unknown as SolveRow));
  }

  /**
   * Existing updated_at values for a batch of ids (pull LWW check).
   * Chunked IN query — returns a Map<id, updated_at>.
   */
  async findUpdatedAts(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await this.db(
        `SELECT id, updated_at FROM solves WHERE id IN (${placeholders})`,
        chunk,
      );
      for (const r of rows) map.set(String(r.id), Number(r.updated_at) || 0);
    }
    return map;
  }

  /**
   * Insert a solve. Pass `{ isDemo: true }` to flag seeded/demo solves so they
   * stay isolated from the user's real statistics (see countNonDemo / deleteDemoData).
   */
  async insert(solve: Solve, options?: { isDemo?: boolean }): Promise<void> {
    // Validate BEFORE any DB access: solveToRow throws on an unknown
    // puzzle_type, and a rejected row must not reach the DB at all (the
    // clock would otherwise have written app_meta first).
    solveToRow(solve);
    // Local insert (no declared timestamp) → take a monotonic clock stamp so
    // two writes can never share an updated_at (M9) and a clock that jumped
    // backwards cannot re-issue an old stamp. Pulled rows always carry the
    // cloud timestamp and are written as-is.
    const stamped =
      solve.updatedAt === undefined
        ? { ...solve, updatedAt: await nextLocalStamps(this.db, 'solves') }
        : solve;
    const row = solveToRow(stamped);
    await this.db(
      'INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, cube_id, cube_label, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.session_id, row.time_ms, row.timestamp, row.scramble, row.penalty, row.method, row.cube_id, row.cube_label, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, options?.isDemo ? 1 : 0, row.created_at, row.updated_at]
    );
  }

  /**
   * Insert many solves inside a single SQLite transaction (all-or-nothing).
   *
   * Used by bulk imports: a failure mid-batch rolls the whole batch back, so
   * the user never ends up with a partially imported file. Returns the number
   * of rows inserted (throws on failure — the batch is rolled back).
   *
   * Performance: solves are grouped into multi-row INSERT statements instead
   * of one round-trip per solve. Every `execute()` crosses the worker bridge
   * (Comlink postMessage → WASM → postMessage), so a 5000-solve import used to
   * cost 5000+ round-trips; batching cuts that to a handful. 500 rows × 19
   * columns = 9500 bound variables, well under SQLite's MAX_VARIABLE_NUMBER
   * (32766) and SQL length limits.
   */
  async insertMany(solves: Solve[]): Promise<number> {
    if (solves.length === 0) return 0;
    // Validate the WHOLE batch before any DB access (solveToRow throws on an
    // unknown puzzle_type; the clock / transaction must not touch the DB for
    // a rejected batch).
    for (const s of solves) solveToRow(s);
    // Rows per INSERT statement. Keeps each statement far below SQLite's
    // variable/size limits while minimizing round-trips to the DB worker.
    const ROWS_PER_STATEMENT = 500;

    // Reserve ONE monotonic stamp range for the local rows in the batch (one
    // clock read/write instead of one per row); pulled rows keep the cloud
    // timestamp they already carry.
    const needStamp = solves.filter((s) => s.updatedAt === undefined).length;
    let base = 0;
    let stampIdx = 0;
    if (needStamp > 0) {
      base = await nextLocalStamps(this.db, 'solves', needStamp);
    }

    return withTransaction(this.db, async (exec) => {
      for (let start = 0; start < solves.length; start += ROWS_PER_STATEMENT) {
        const chunk = solves.slice(start, start + ROWS_PER_STATEMENT);
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const sql =
          'INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, cube_id, cube_label, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at) VALUES ' +
          placeholders;
        const bind: unknown[] = [];
        for (const solve of chunk) {
          const stamped =
            solve.updatedAt === undefined
              ? { ...solve, updatedAt: base + stampIdx++ }
              : solve;
          const row = solveToRow(stamped);
          bind.push(
            row.id, row.session_id, row.time_ms, row.timestamp, row.scramble,
            row.penalty, row.method, row.cube_id, row.cube_label, row.source,
            row.note, row.moves,
            row.orientation_timeline, row.analysis_engine_version, row.analysis,
            row.puzzle_type, 0, row.created_at, row.updated_at
          );
        }
        await exec(sql, bind);
      }
      return solves.length;
    });
  }

  /**
   * Delete every solve belonging to a session in a single statement
   * (replaces the previous delete-one-by-one loop). Returns how many rows
   * were removed.
   */
  async deleteBySession(sessionId: string): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves WHERE session_id = ?', [sessionId]);
    const count = (rows[0] as { cnt: number }).cnt;
    if (count > 0) {
      await this.db('DELETE FROM solves WHERE session_id = ?', [sessionId]);
    }
    return count;
  }

  /**
   * Update a solve, writing the EXACT `updated_at` the caller declared
   * (0/undefined = "now"). The sync pull passes the cloud's value so a
   * pulled row never gets a fresh local timestamp (which would re-select it
   * on the next push and trigger an eternal re-sync ping-pong). Pass
   * `{ local: true }` from local edit paths: the repo then takes a monotonic
   * clock stamp that is strictly greater than the row's previous stamp and
   * the wall clock (M9) — no bare Date.now() at the call site.
   */
  async update(solve: Solve, opts?: { local?: boolean }): Promise<void> {
    const stamped = opts?.local
      ? {
          ...solve,
          updatedAt: await nextLocalStamps(this.db, 'solves', 1, {
            floor: solve.updatedAt ?? 0,
          }),
        }
      : solve;
    const row = solveToRow(stamped);
    const updatedAt = row.updated_at > 0 ? row.updated_at : Date.now();
    await this.db(
      'UPDATE solves SET session_id = ?, time_ms = ?, timestamp = ?, scramble = ?, penalty = ?, method = ?, cube_id = ?, cube_label = ?, source = ?, note = ?, moves = ?, orientation_timeline = ?, analysis_engine_version = ?, analysis = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [row.session_id, row.time_ms, row.timestamp, row.scramble, row.penalty, row.method, row.cube_id, row.cube_label, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, updatedAt, row.id]
    );
  }

  /**
   * Versioned delete for remote tombstones (LWW): only removes the row when
   * it was NOT edited after the tombstone. A newer edit survives locally and
   * is re-pushed, resurrecting the row — deletes only win against older data.
   */
  async deleteIfNotNewer(id: string, deletedAt: number): Promise<void> {
    await this.db(
      'DELETE FROM solves WHERE id = ? AND updated_at <= ?',
      [id, deletedAt],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db('DELETE FROM solves WHERE id = ?', [id]);
  }

  /** Delete every solve — "start fresh" wipe (tombstones are purged by the caller). */
  async deleteAll(): Promise<void> {
    await this.db('DELETE FROM solves');
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves');
    return (rows[0] as { cnt: number }).cnt;
  }

  /**
   * Count solves per session in a single GROUP BY query.
   *
   * Replaces N separate `findAll(sessionId)` round-trips when only counts are
   * needed (e.g. building the session list at startup), so startup cost does
   * not grow linearly with the number of sessions.
   */
  async countBySession(): Promise<Map<string, number>> {
    const rows = await this.db(
      'SELECT session_id AS sid, COUNT(*) AS cnt FROM solves GROUP BY session_id'
    );
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(String(row.sid), Number(row.cnt));
    }
    return counts;
  }

  /** Count solves that are NOT demo data (the user's real solves). */
  async countNonDemo(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves WHERE is_demo = 0');
    return (rows[0] as { cnt: number }).cnt;
  }

  /**
   * Delete every demo solve (is_demo = 1). Returns how many rows were removed.
   * Used by window.clearDemoData() so seeded data never lingers in the DB.
   */
  async deleteDemoData(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves WHERE is_demo = 1');
    const count = (rows[0] as { cnt: number }).cnt;
    if (count > 0) {
      await this.db('DELETE FROM solves WHERE is_demo = 1');
    }
    return count;
  }
}
