import type { Solve } from './types.js';
import type { CubeMoveEvent, OrientationTimeline } from '@cubeforge/types';
import { withTransaction } from './transaction.js';

export interface SolveRow {
  id: string;
  session_id: string;
  time_ms: number;
  timestamp: number;
  scramble: string;
  penalty: string;
  method: string | null;
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
 * Falls back to `undefined` on any parse failure or non-object result.
 */
function safeParseOrientationTimeline(raw: string | null): OrientationTimeline | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as OrientationTimeline)
      : undefined;
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
    source: (row.source as Solve['source']) ?? 'manual',
    note: row.note ?? undefined,
    moves: safeParseMoves(row.moves),
    orientationTimeline: safeParseOrientationTimeline(row.orientation_timeline),
    analysisEngineVersion: row.analysis_engine_version ?? undefined,
    analysis: row.analysis ?? undefined,
    puzzleType: row.puzzle_type ?? '3x3x3',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function solveToRow(solve: Solve): SolveRow {
  return {
    id: solve.id,
    session_id: solve.sessionId,
    time_ms: solve.timeMs,
    timestamp: solve.timestamp,
    scramble: solve.scramble,
    penalty: solve.penalty,
    method: solve.method ?? null,
    source: solve.source ?? 'manual',
    note: solve.note ?? null,
    moves: JSON.stringify(solve.moves || []),
    orientation_timeline: solve.orientationTimeline
      ? JSON.stringify(solve.orientationTimeline)
      : null,
    analysis_engine_version: solve.analysisEngineVersion ?? null,
    analysis: solve.analysis ?? null,
    puzzle_type: solve.puzzleType ?? '3x3x3',
    created_at: solve.createdAt ?? Date.now(),
    updated_at: solve.updatedAt ?? Date.now(),
  };
}

export class SolvesRepository {
  private db: DBExecutor;
  constructor(db: DBExecutor) {
    this.db = db;
  }

  async findAll(sessionId?: string): Promise<Solve[]> {
    let sql = 'SELECT * FROM solves';
    const bind: unknown[] = [];
    if (sessionId) {
      sql += ' WHERE session_id = ? ORDER BY timestamp ASC';
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
   * Insert a solve. Pass `{ isDemo: true }` to flag seeded/demo solves so they
   * stay isolated from the user's real statistics (see countNonDemo / deleteDemoData).
   */
  async insert(solve: Solve, options?: { isDemo?: boolean }): Promise<void> {
    const row = solveToRow(solve);
    await this.db(
      'INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.session_id, row.time_ms, row.timestamp, row.scramble, row.penalty, row.method, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, options?.isDemo ? 1 : 0, row.created_at, row.updated_at]
    );
  }

  /**
   * Insert many solves inside a single SQLite transaction (all-or-nothing).
   *
   * Used by bulk imports: a failure mid-batch rolls the whole batch back, so
   * the user never ends up with a partially imported file. Returns the number
   * of rows inserted (throws on failure — the batch is rolled back).
   */
  async insertMany(solves: Solve[]): Promise<number> {
    if (solves.length === 0) return 0;
    return withTransaction(this.db, async (exec) => {
      for (const solve of solves) {
        const row = solveToRow(solve);
        await exec(
          'INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [row.id, row.session_id, row.time_ms, row.timestamp, row.scramble, row.penalty, row.method, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, 0, row.created_at, row.updated_at]
        );
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

  async update(solve: Solve): Promise<void> {
    const row = solveToRow(solve);
    await this.db(
      'UPDATE solves SET session_id = ?, time_ms = ?, timestamp = ?, scramble = ?, penalty = ?, method = ?, source = ?, note = ?, moves = ?, orientation_timeline = ?, analysis_engine_version = ?, analysis = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [row.session_id, row.time_ms, row.timestamp, row.scramble, row.penalty, row.method, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, Date.now(), row.id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db('DELETE FROM solves WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves');
    return (rows[0] as { cnt: number }).cnt;
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
