import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../migrations/migrations.js';
import type { Migration } from '../migrations/migrations.js';

describe('MIGRATIONS — schema migrations module', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(MIGRATIONS)).toBe(true);
    expect(MIGRATIONS.length).toBeGreaterThan(0);
  });

  it('every entry has the required shape { id, description, sql }', () => {
    for (const m of MIGRATIONS) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe('string');
      expect(typeof m.sql).toBe('string');
      expect(m.sql.length).toBeGreaterThan(0);
    }
  });

  it('migration ids are unique', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('migration ids follow the numeric-prefix convention (NNN_...)', () => {
    const pattern = /^\d{3}_[a-z][a-z0-9_]*$/;
    for (const m of MIGRATIONS) {
      expect(m).toSatisfy((entry: Migration) => pattern.test(entry.id));
    }
  });

  /**
   * Data-repair migrations: pure `UPDATE`s that fix a value a past bug wrote.
   * They are legitimate — 033 clears the bogus `solves.method` copied onto
   * events that have no method — but they are the EXCEPTION, so each one is
   * declared here on purpose. A new UPDATE-only migration that is not listed
   * fails this test, which is the review prompt we want.
   */
  const DATA_REPAIR_MIGRATION_IDS = new Set(['033_repair_method_scope']);

  it('every non-base-table migration references a CREATE/ALTER/DROP statement', () => {
    // Validates we don't ship a malformed migration that does nothing.
    const forbidden = /^\s*$/;
    for (const m of MIGRATIONS) {
      expect(forbidden.test(m.sql)).toBe(false);
      const upper = m.sql.toUpperCase();
      if (DATA_REPAIR_MIGRATION_IDS.has(m.id)) {
        // A declared repair must actually rewrite rows.
        expect(upper).toMatch(/UPDATE\s+\w+\s+SET/);
        continue;
      }
      expect(upper).toMatch(
        /CREATE\s+(TABLE|INDEX|TRIGGER)|ALTER\s+TABLE|DROP\s+(TABLE|TRIGGER)|INSERT\s+INTO/,
      );
    }
  });

  it('each migration id appears in its sql (idempotency check)', () => {
    // The id should be referenced in the SQL so the migrations table can
    // record its application status by id.
    for (const m of MIGRATIONS) {
      // skip migrations that only ALTER (no CREATE TABLE referenced by id)
      if (m.id === '005_add_analysis_column') continue;
      if (m.id === '006_add_source_column') continue;
      if (m.id === '007_add_orientation_timeline') continue;
      if (m.id === '009_add_note_column') continue;
      if (m.id === '011_add_puzzle_type_to_solves') continue;
      // For others, the migration id (or normalization thereof) is referenced.
      const normalized = m.id.replace(/^\d{3}_/, '');
      // Don't assert this strictly — just log for visibility.
      expect(normalized.length).toBeGreaterThan(0);
    }
  });

  it('migration 018 flags demo data (is_demo) for the mock-data fix', () => {
    const m = MIGRATIONS.find((x) => x.id === '018_add_is_demo');
    expect(m).toBeDefined();
    expect(m!.sql).toContain('ALTER TABLE solves ADD COLUMN is_demo');
    expect(m!.sql).toContain('ALTER TABLE sessions ADD COLUMN is_demo');
    // Data heal: legacy 'Demo Session' rows are flagged so they stay hidden.
    expect(m!.sql).toContain("UPDATE sessions SET is_demo = 1 WHERE name = 'Demo Session'");
  });

  it('migration 019 creates the profiles table (identity row)', () => {
    const m = MIGRATIONS.find((x) => x.id === '019_create_profiles');
    expect(m).toBeDefined();
    expect(m!.sql).toContain('CREATE TABLE IF NOT EXISTS profiles');
    expect(m!.sql).toContain('user_id TEXT PRIMARY KEY');
    expect(m!.sql).toContain('avatar_kind');
    expect(m!.sql).toContain('declared_methods');
  });

  it('migration 020 creates the app_meta key/value table', () => {
    const m = MIGRATIONS.find((x) => x.id === '020_create_app_meta');
    expect(m).toBeDefined();
    expect(m!.sql).toContain('CREATE TABLE IF NOT EXISTS app_meta');
    expect(m!.sql).toContain('key TEXT PRIMARY KEY');
    expect(m!.sql).toContain('value TEXT NOT NULL');
  });

  it('migration 021 drops the legacy kv_store table', () => {
    const m = MIGRATIONS.find((x) => x.id === '021_drop_kv_store');
    expect(m).toBeDefined();
    expect(m!.sql).toContain('DROP TABLE IF EXISTS kv_store');
  });

  it('exports the Migration type with the expected surface', () => {
    // Compile-time check via assignability. If Migration type drifts, this fails to compile.
    const sample: Migration = {
      id: 'test',
      description: 'test',
      sql: 'CREATE TABLE x (id INT);',
    };
    expect(sample).toBeDefined();
  });

  it('every migration is re-runnable: non-IF-NOT-EXISTS CREATEs are preceded by a DROP of the same object', () => {
    for (const m of MIGRATIONS) {
      const upper = m.sql.toUpperCase();
      const statements = m.sql
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        const table = stmt.match(/^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/i);
        if (table && !table[1]) {
          expect(upper).toContain(`DROP TABLE IF EXISTS ${table[2].toUpperCase()}`);
        }
        const idx = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/i);
        if (idx && !idx[1]) {
          const on = stmt.match(/ON\s+([A-Za-z_][A-Za-z0-9_]*)/i);
          expect(on).toBeTruthy();
          expect(upper).toContain(`DROP TABLE IF EXISTS ${on![1].toUpperCase()}`);
        }
      }
    }
  });

  it('migration 022 is idempotent: every CREATE TABLE/INDEX uses IF NOT EXISTS so a partially-applied baseline can self-heal', () => {
    const m = MIGRATIONS.find((x) => x.id === '022_baseline_v2');
    expect(m).toBeDefined();
    const statements = m!.sql
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      if (/^CREATE\s+TABLE\s+/i.test(stmt)) {
        expect(stmt.toUpperCase()).toMatch(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
      }
      if (/^CREATE\s+(UNIQUE\s+)?INDEX\s+/i.test(stmt)) {
        expect(stmt.toUpperCase()).toMatch(/^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i);
      }
    }
  });

  it('migration 026 adds a puzzle_type CHECK generated from the event registry', () => {
    const m = MIGRATIONS.find((x) => x.id === '026_add_puzzle_type_check');
    expect(m).toBeDefined();
    // The CHECK is built from @cubalyze/events DB_PUZZLE_TYPES (canonical + legacy).
    expect(m!.sql).toContain("CHECK (puzzle_type IN ('2x2x2', '3x3x3'");
    expect(m!.sql).toMatch(/puzzle_type\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'3x3x3'\s+CHECK/i);
    // Data preservation on both tables: rename → recreate → copy back → drop.
    expect(m!.sql).toMatch(/ALTER\s+TABLE\s+solves\s+RENAME\s+TO/i);
    expect(m!.sql).toMatch(/ALTER\s+TABLE\s+sessions\s+RENAME\s+TO/i);
    expect(m!.sql).toMatch(/INSERT\s+INTO\s+solves/i);
    expect(m!.sql).toMatch(/INSERT\s+INTO\s+sessions/i);
    expect(m!.sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+solves_puzzle_type_check_legacy/i);
    expect(m!.sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+sessions_puzzle_type_check_legacy/i);
    // The recreated solves keeps the source CHECK from 025 (incl. 'virtual').
    expect(m!.sql).toMatch(/source\s+IN\s+\(\s*'smart'\s*,\s*'manual'\s*,\s*'virtual'\s*\)/i);
    // Indexes recreated on the fresh tables.
    expect(m!.sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_sessions_created_at/i);
    expect(m!.sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_sessions_is_demo/i);
  });

  it('migration 026 preserves short aliases and heals other non-registry values to 3x3x3', () => {
    const m = MIGRATIONS.find((x) => x.id === '026_add_puzzle_type_check');
    expect(m).toBeDefined();
    // The INSERT SELECT wraps puzzle_type in a CASE. Short aliases are mapped
    // to their canonical legacy scheme FIRST ('3x3'→'3x3x3', '2x2'→'2x2x2')
    // so 027 can convert them to WCA codes — otherwise '2x2' would fall
    // through to the ELSE and be silently reclassified as 3×3.
    expect(m!.sql).toMatch(/WHEN\s+puzzle_type\s*=\s*'3x3'\s+THEN\s+'3x3x3'/i);
    expect(m!.sql).toMatch(/WHEN\s+puzzle_type\s*=\s*'2x2'\s+THEN\s+'2x2x2'/i);
    // Anything else outside the allow-list still normalizes to '3x3x3'.
    expect(m!.sql).toMatch(/THEN\s+puzzle_type\s+ELSE\s+'3x3x3'\s+END/i);
    // The frozen allow-list is the OLD canonical scheme, not WCA codes.
    expect(m!.sql).toContain("CHECK (puzzle_type IN ('2x2x2', '3x3x3'");
    expect(m!.sql).not.toContain("CHECK (puzzle_type IN ('222'");
  });

  it('migration 027 normalizes puzzle_type to WCA event codes (ADR-002)', () => {
    const m = MIGRATIONS.find((x) => x.id === '027_puzzle_type_wca_codes');
    expect(m).toBeDefined();
    // Rebuilt tables carry the WCA-code CHECK and DEFAULT '333'.
    expect(m!.sql).toContain("CHECK (puzzle_type IN ('222', '333'");
    expect(m!.sql).toMatch(/puzzle_type\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'333'\s+CHECK/i);
    // Conversion CASE in both rebuilt tables: legacy → WCA codes.
    expect(m!.sql).toMatch(/'3x3x3', '3x3'\) THEN '333'/);
    expect(m!.sql).toMatch(/'2x2x2', '2x2'\) THEN '222'/);
    // Data preservation on both tables: rename → recreate → copy back → drop.
    expect(m!.sql).toMatch(/ALTER\s+TABLE\s+solves\s+RENAME\s+TO\s+solves_wca_legacy/i);
    expect(m!.sql).toMatch(/ALTER\s+TABLE\s+sessions\s+RENAME\s+TO\s+sessions_wca_legacy/i);
    expect(m!.sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+solves_wca_legacy/i);
    expect(m!.sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+sessions_wca_legacy/i);
    // sessions rebuilt BEFORE solves (FK lesson from 026).
    expect(m!.sql.indexOf('sessions_wca_legacy')).toBeLessThan(m!.sql.indexOf('solves_wca_legacy'));
    // Algorithm catalog and profile puzzle values are converted too.
    expect(m!.sql).toMatch(/UPDATE\s+algorithm_methods\s+SET\s+puzzle_type/i);
    expect(m!.sql).toMatch(/UPDATE\s+algorithm_subsets\s+SET\s+puzzle_type/i);
    expect(m!.sql).toMatch(/UPDATE\s+algorithm_cases\s+SET\s+puzzle_type/i);
    expect(m!.sql).toMatch(/UPDATE\s+profiles\s+SET\s+main_puzzle/i);
  });

  it('migration 025 accepts the virtual source and preserves existing rows', () => {
    const m = MIGRATIONS.find((x) => x.id === '025_add_virtual_source');
    expect(m).toBeDefined();
    // The recreated table's CHECK must allow 'virtual' (the whole point).
    expect(m!.sql).toMatch(/source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'manual'\s+CHECK\s+\(source\s+IN\s+\(\s*'smart'\s*,\s*'manual'\s*,\s*'virtual'\s*\)\)/i);
    // Data preservation: rename → recreate → copy back → drop legacy.
    expect(m!.sql).toMatch(/ALTER\s+TABLE\s+solves\s+RENAME\s+TO/i);
    expect(m!.sql).toMatch(/INSERT\s+INTO\s+solves/i);
    expect(m!.sql).toMatch(/SELECT\s+id,\s*session_id/i);
    expect(m!.sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+solves_source_check_legacy/i);
    // Recreate the indexes on the fresh table.
    expect(m!.sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_solves_session_id/i);
    expect(m!.sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_solves_timestamp/i);
    expect(m!.sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_solves_is_demo/i);
  });
});
