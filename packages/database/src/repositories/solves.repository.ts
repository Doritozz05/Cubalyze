import type { Solve } from './types.js';
import type { CubeMoveEvent, OrientationTimeline } from '@cubeforge/types';

export interface SolveRow {
  id: string;
  session_id: string;
  time_ms: number;
  date: string;
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
  created_at: string;
  updated_at: string;
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
    date: row.date,
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
    date: solve.date,
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
    created_at: solve.createdAt ?? new Date().toISOString(),
    updated_at: solve.updatedAt ?? new Date().toISOString(),
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
      sql += ' WHERE session_id = ? ORDER BY date ASC';
      bind.push(sessionId);
    } else {
      sql += ' ORDER BY date ASC';
    }
    const rows = await this.db(sql, bind);
    return rows.map((r) => rowToSolve(r as unknown as SolveRow));
  }

  async findById(id: string): Promise<Solve | null> {
    const rows = await this.db('SELECT * FROM solves WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToSolve(rows[0] as unknown as SolveRow);
  }

  async insert(solve: Solve): Promise<void> {
    const row = solveToRow(solve);
    await this.db(
      'INSERT INTO solves (id, session_id, time_ms, date, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.session_id, row.time_ms, row.date, row.scramble, row.penalty, row.method, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, row.created_at, row.updated_at]
    );
  }

  async update(solve: Solve): Promise<void> {
    const row = solveToRow(solve);
    await this.db(
      'UPDATE solves SET session_id = ?, time_ms = ?, date = ?, scramble = ?, penalty = ?, method = ?, source = ?, note = ?, moves = ?, orientation_timeline = ?, analysis_engine_version = ?, analysis = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [row.session_id, row.time_ms, row.date, row.scramble, row.penalty, row.method, row.source, row.note, row.moves, row.orientation_timeline, row.analysis_engine_version, row.analysis, row.puzzle_type, new Date().toISOString(), row.id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db('DELETE FROM solves WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM solves');
    return (rows[0] as { cnt: number }).cnt;
  }
}
