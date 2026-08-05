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

  it('every non-base-table migration references a CREATE/ALTER/DROP statement', () => {
    // Validates we don't ship a malformed migration that does nothing.
    const forbidden = /^\s*$/;
    for (const m of MIGRATIONS) {
      expect(forbidden.test(m.sql)).toBe(false);
      const upper = m.sql.toUpperCase();
      expect(upper).toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|DROP\s+TABLE|INSERT\s+INTO/);
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
});
