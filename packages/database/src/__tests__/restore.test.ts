import { describe, it, expect } from 'vitest';
import { RESTORE_SESSIONS_SQL, RESTORE_SOLVES_SQL, restoreMissingCountSql } from '../migrations/restore.js';

describe('restoreLegacyData — v1 → v2 restore statements', () => {
  it('restores sessions first (solves FK depends on sessions)', () => {
    // The two statements must be applied in order: sessions before solves,
    // because v2 solves has a real FOREIGN KEY on sessions(id).
    const sessionsIdx = RESTORE_SESSIONS_SQL;
    const solvesIdx = RESTORE_SOLVES_SQL;
    expect(sessionsIdx).toContain('INSERT OR IGNORE INTO sessions');
    expect(solvesIdx).toContain('INSERT OR IGNORE INTO solves');
    // Sanity: the constants are the distinct statements.
    expect(RESTORE_SESSIONS_SQL).not.toBe(RESTORE_SOLVES_SQL);
  });

  it('converts v1 TEXT ISO date → v2 INTEGER epoch-milliseconds for solves', () => {
    // `date` is parsed with julianday and converted to epoch-ms (preserves
    // sub-second precision from the v1 ISO strings).
    expect(RESTORE_SOLVES_SQL).toContain('julianday(date)');
    expect(RESTORE_SOLVES_SQL).toContain('* 86400000');
    expect(RESTORE_SOLVES_SQL).toContain('FROM _backup_v1_solves');
    // The v2 column is `timestamp` — the restore must target it.
    expect(RESTORE_SOLVES_SQL).toContain('timestamp');
  });

  it('preserves every v2 solve column', () => {
    for (const col of [
      'id', 'session_id', 'time_ms', 'timestamp', 'scramble', 'penalty', 'method',
      'source', 'note', 'moves', 'orientation_timeline', 'analysis_engine_version',
      'analysis', 'puzzle_type', 'is_demo', 'created_at', 'updated_at',
    ]) {
      expect(RESTORE_SOLVES_SQL).toContain(col);
    }
  });

  it('converts created_at/updated_at TEXT → INTEGER epoch-milliseconds', () => {
    expect(RESTORE_SESSIONS_SQL).toContain('julianday(created_at)');
    expect(RESTORE_SOLVES_SQL).toContain('julianday(updated_at)');
    expect(RESTORE_SESSIONS_SQL).toContain('* 86400000');
    expect(RESTORE_SOLVES_SQL).toContain('* 86400000');
  });

  it('defaults missing puzzle_type to 3x3x3 and missing is_demo to 0', () => {
    expect(RESTORE_SESSIONS_SQL).toContain("COALESCE(puzzle_type, '3x3x3')");
    expect(RESTORE_SOLVES_SQL).toContain("COALESCE(puzzle_type, '3x3x3')");
    expect(RESTORE_SESSIONS_SQL).toContain('COALESCE(is_demo, 0)');
    expect(RESTORE_SOLVES_SQL).toContain('COALESCE(is_demo, 0)');
  });

  it('is idempotent (INSERT OR IGNORE — re-running never duplicates)', () => {
    expect(RESTORE_SESSIONS_SQL).toContain('INSERT OR IGNORE');
    expect(RESTORE_SOLVES_SQL).toContain('INSERT OR IGNORE');
  });

  it('restoreMissingCountSql builds a guarded count for the given tables', () => {
    const sql = restoreMissingCountSql('_backup_v1_solves', 'solves');
    expect(sql).toContain('SELECT COUNT(*)');
    expect(sql).toContain('_backup_v1_solves');
    expect(sql).toContain('solves');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "solves" s WHERE s.id = b.id)');
  });
});
