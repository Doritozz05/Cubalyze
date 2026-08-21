import type { Session } from './types.js';
import { isDbPuzzleType } from '@cubeforge/events';

export interface SessionRow {
  id: string;
  name: string;
  puzzle_type: string;
  created_at: number;
  updated_at: number;
  is_demo?: number;
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

  /**
   * All non-demo sessions, oldest first. Demo sessions (is_demo = 1) are
   * hidden from the UI so seeded sample data never mixes with the user's own.
   */
  async findAllNonDemo(): Promise<Session[]> {
    const rows = await this.db('SELECT * FROM sessions WHERE is_demo = 0 ORDER BY created_at ASC');
    return rows.map((r) => rowToSession(r as unknown as SessionRow));
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db('SELECT * FROM sessions WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return rowToSession(rows[0] as unknown as SessionRow);
  }

  /**
   * All NON-demo sessions edited strictly after `updatedAt` (epoch ms) — the
   * sync push cursor. A fresh link passes 0 so every real session is pushed.
   */
  async findAllSince(updatedAt: number): Promise<Session[]> {
    const rows = await this.db(
      'SELECT * FROM sessions WHERE is_demo = 0 AND updated_at > ? ORDER BY updated_at ASC',
      [updatedAt],
    );
    return rows.map((r) => rowToSession(r as unknown as SessionRow));
  }

  /** Existing updated_at values for a batch of ids (pull LWW check). */
  async findUpdatedAts(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await this.db(
        `SELECT id, updated_at FROM sessions WHERE id IN (${placeholders})`,
        chunk,
      );
      for (const r of rows) map.set(String(r.id), Number(r.updated_at) || 0);
    }
    return map;
  }

  /**
   * Insert a session. Pass `{ isDemo: true }` for the seeded "Demo Session" so
   * it stays hidden from the UI and removable via deleteDemoSessions().
   */
  async insert(session: Session, options?: { isDemo?: boolean }): Promise<void> {
    // Same default as the SessionSchema (ADR-002): a missing puzzle_type is
    // '333', never a legacy alias.
    const puzzleType = session.puzzleType ?? '333';
    assertValidSessionPuzzleType({ ...session, puzzleType });
    await this.db(
      'INSERT INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo) VALUES (?, ?, ?, ?, ?, ?)',
      [session.id, session.name, puzzleType, session.createdAt || Date.now(), session.updatedAt || Date.now(), options?.isDemo ? 1 : 0]
    );
  }

  async update(session: Session): Promise<void> {
    assertValidSessionPuzzleType(session);
    await this.db(
      'UPDATE sessions SET name = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [session.name, session.puzzleType, Date.now(), session.id]
    );
  }

  async delete(id: string): Promise<void> {
    // Session deletes cascade to solves, but SQLite row triggers do NOT fire
    // on cascaded deletes — tombstone the child solves explicitly (migration
    // 028) so the sync engine removes them on every other device too.
    await this.db(
      `INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
       SELECT 'solves', id, CAST(strftime('%s','now') AS INTEGER) * 1000
       FROM solves WHERE session_id = ?`,
      [id],
    );
    await this.db('DELETE FROM sessions WHERE id = ?', [id]);
  }

  /** Delete every session (plus its cascade tombstones) — "start fresh" wipe. */
  async deleteAll(): Promise<void> {
    await this.db('DELETE FROM sessions');
  }

  /** Delete every demo session (is_demo = 1). Returns how many were removed. */
  async deleteDemoSessions(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM sessions WHERE is_demo = 1');
    const count = (rows[0] as { cnt: number }).cnt;
    if (count > 0) {
      await this.db('DELETE FROM sessions WHERE is_demo = 1');
    }
    return count;
  }

  async count(): Promise<number> {
    const rows = await this.db('SELECT COUNT(*) as cnt FROM sessions');
    return (rows[0] as { cnt: number }).cnt;
  }
}

/**
 * Phase A2 (ADR-002) — validate a session's puzzle_type against the WCA
 * event registry before any write. Same contract as the solves repository
 * and the SQLite CHECK (migration 027): unknown values never reach the disk.
 */
function assertValidSessionPuzzleType(session: Session): void {
  if (!isDbPuzzleType(session.puzzleType)) {
    throw new Error(
      `Cannot persist session: unknown puzzle_type '${session.puzzleType}' — must be a WCA event code declared by the registry`
    );
  }
}
