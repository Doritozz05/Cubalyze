import type { Session } from './types.js';

export interface SessionRow {
  id: string;
  name: string;
  puzzle_type: string;
  created_at: string;
  updated_at: string;
}

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    puzzleType: row.puzzle_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionsRepository {
  private db: DBExecutor;
  constructor(db: DBExecutor) {
    this.db = db;
  }

  async findAll(): Promise<Session[]> {
    const rows = await this.db('SELECT * FROM sessions ORDER BY created_at ASC');
    return rows.map((r) => rowToSession(r as unknown as SessionRow));
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db('SELECT * FROM sessions WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToSession(rows[0] as unknown as SessionRow);
  }

  async insert(session: Session): Promise<void> {
    await this.db(
      'INSERT INTO sessions (id, name, puzzle_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [session.id, session.name, session.puzzleType, session.createdAt || new Date().toISOString(), session.updatedAt || new Date().toISOString()]
    );
  }

  async update(session: Session): Promise<void> {
    await this.db(
      'UPDATE sessions SET name = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [session.name, session.puzzleType, new Date().toISOString(), session.id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db('DELETE FROM sessions WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM sessions');
    return (rows[0] as { cnt: number }).cnt;
  }
}
