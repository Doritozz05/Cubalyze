import type { Solve } from './types.js';

export interface SolveRow {
  id: string;
  session_id: string;
  time_ms: number;
  date: string;
  scramble: string;
  penalty: string;
  method: string | null;
  moves: string;
  analysis_engine_version: string | null;
  created_at: string;
  updated_at: string;
}

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToSolve(row: SolveRow): Solve {
  return {
    id: row.id,
    sessionId: row.session_id,
    timeMs: row.time_ms,
    date: row.date,
    scramble: row.scramble,
    penalty: row.penalty,
    method: row.method ?? undefined,
    moves: JSON.parse(row.moves),
    analysisEngineVersion: row.analysis_engine_version ?? undefined,
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
    moves: JSON.stringify(solve.moves || []),
    analysis_engine_version: solve.analysisEngineVersion ?? null,
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
      'INSERT INTO solves (id, session_id, time_ms, date, scramble, penalty, method, moves, analysis_engine_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.session_id, row.time_ms, row.date, row.scramble, row.penalty, row.method, row.moves, row.analysis_engine_version, row.created_at, row.updated_at]
    );
  }

  async update(solve: Solve): Promise<void> {
    const row = solveToRow(solve);
    await this.db(
      'UPDATE solves SET session_id = ?, time_ms = ?, date = ?, scramble = ?, penalty = ?, method = ?, moves = ?, analysis_engine_version = ?, updated_at = ? WHERE id = ?',
      [row.session_id, row.time_ms, row.date, row.scramble, row.penalty, row.method, row.moves, row.analysis_engine_version, new Date().toISOString(), row.id]
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
