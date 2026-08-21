import type { Session } from './types.js';
import { isDbPuzzleType } from '@cubeforge/events';
import { nextLocalStamps } from './local-clock.js';

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
   * Optional (updated_at, id) keyset pagination (see SolvesRepository
   * findAllSince) so batched pushes never skip rows that share a timestamp.
   */
  async findAllSince(
    updatedAt: number,
    opts?: { limit?: number; afterUpdatedAt?: number; afterId?: string },
  ): Promise<Session[]> {
    let sql = 'SELECT * FROM sessions WHERE is_demo = 0';
    const bind: unknown[] = [];
    if (opts?.afterUpdatedAt !== undefined && opts.afterId !== undefined) {
      sql += ' AND (updated_at > ? OR (updated_at = ? AND id > ?))';
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
   * Which of the given ids exist locally (chunked IN query). The sync pull
   * uses this to drop orphaned solves — a solve whose session no longer
   * exists must be skipped, not crash the whole pull with an FK violation.
   */
  async findExistingIds(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await this.db(
        `SELECT id FROM sessions WHERE id IN (${placeholders})`,
        chunk,
      );
      for (const r of rows) found.add(String(r.id));
    }
    return found;
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
    const stamped =
      session.updatedAt === undefined
        ? {
            ...session,
            updatedAt: await nextLocalStamps(this.db, 'sessions'),
          }
        : session;
    await this.db(
      'INSERT INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo) VALUES (?, ?, ?, ?, ?, ?)',
      [stamped.id, stamped.name, puzzleType, stamped.createdAt || Date.now(), stamped.updatedAt || Date.now(), options?.isDemo ? 1 : 0]
    );
  }

  /**
   * Update a session, writing the EXACT `updated_at` the caller declared
   * (0/undefined = "now"). Same contract as SolvesRepository.update: the
   * sync pull passes the cloud value (no re-selection on the next push).
   * Pass `{ local: true }` from local edit paths for a monotonic clock stamp
   * (M9).
   */
  async update(session: Session, opts?: { local?: boolean }): Promise<void> {
    assertValidSessionPuzzleType(session);
    const stamped = opts?.local
      ? {
          ...session,
          updatedAt: await nextLocalStamps(this.db, 'sessions', 1, {
            floor: session.updatedAt ?? 0,
          }),
        }
      : session;
    const updatedAt =
      stamped.updatedAt && stamped.updatedAt > 0
        ? stamped.updatedAt
        : Date.now();
    await this.db(
      'UPDATE sessions SET name = ?, puzzle_type = ?, updated_at = ? WHERE id = ?',
      [stamped.name, stamped.puzzleType, updatedAt, stamped.id]
    );
  }

  /**
   * Versioned delete for remote tombstones (LWW): the session is removed
   * only when it was not edited after the tombstone AND no child solve was
   * edited after it (a newer solve added offline protects the session — the
   * FK cascade would otherwise orphan it).
   */
  async deleteIfNotNewer(id: string, deletedAt: number): Promise<void> {
    await this.db(
      `DELETE FROM sessions WHERE id = ? AND updated_at <= ?
         AND NOT EXISTS (
           SELECT 1 FROM solves WHERE session_id = ? AND updated_at > ?
         )`,
      [id, deletedAt, id, deletedAt],
    );
  }

  async delete(id: string): Promise<void> {
    // Session deletes cascade to solves, but SQLite row triggers do NOT fire
    // on cascaded deletes — tombstone the child solves explicitly (migration
    // 028) so the sync engine removes them on every other device too.
    // Millisecond precision (migration 029) so tombstone LWW comparisons
    // against row updated_at are exact.
    await this.db(
      `INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
       SELECT 'solves', id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
       FROM solves WHERE session_id = ? AND is_demo = 0`,
      [id],
    );
    await this.db('DELETE FROM sessions WHERE id = ?', [id]);
  }

  /**
   * Delete every session. Session deletes cascade to solves, but SQLite row
   * triggers do NOT fire on cascaded deletes — tombstone the child solves
   * explicitly (M8) so the sync engine removes them on every other device
   * too, exactly like the single-row delete(). Demo solves never tombstone
   * (migration 030 / M7). The caller (wipe) purges the tombstones after.
   */
  async deleteAll(): Promise<void> {
    await this.db(
      `INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
       SELECT 'solves', id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
       FROM solves WHERE is_demo = 0`,
    );
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
