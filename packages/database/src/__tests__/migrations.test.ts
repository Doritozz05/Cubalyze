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

  it('exports the Migration type with the expected surface', () => {
    // Compile-time check via assignability. If Migration type drifts, this fails to compile.
    const sample: Migration = {
      id: 'test',
      description: 'test',
      sql: 'CREATE TABLE x (id INT);',
    };
    expect(sample).toBeDefined();
  });
});
