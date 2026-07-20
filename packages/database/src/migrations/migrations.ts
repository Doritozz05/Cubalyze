export interface Migration {
  id: string;
  description: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_create_solves',
    description: 'Create solves table',
    sql: `
      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        date TEXT NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none',
        method TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_date ON solves(date);
    `,
  },
  {
    id: '002_create_sessions',
    description: 'Create sessions table',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },
  {
    id: '003_create_algorithms',
    description: 'Create algorithms table',
    sql: `
      CREATE TABLE IF NOT EXISTS algorithms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        moves TEXT NOT NULL,
        subset TEXT NOT NULL DEFAULT '',
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_algorithms_subset ON algorithms(subset);
    `,
  },
  {
    id: '004_update_models',
    description: 'Update models with new schema fields (recreate tables)',
    sql: `
      DROP TABLE IF EXISTS solves;
      CREATE TABLE solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        date TEXT NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none',
        method TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        analysis_engine_version TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_solves_session_id ON solves(session_id);
      CREATE INDEX idx_solves_date ON solves(date);

      DROP TABLE IF EXISTS sessions;
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      DROP TABLE IF EXISTS algorithms;
      CREATE TABLE algorithms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        moves TEXT NOT NULL DEFAULT '[]',
        alternatives TEXT NOT NULL DEFAULT '[]',
        subset TEXT NOT NULL DEFAULT '',
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_algorithms_subset ON algorithms(subset);
    `,
  },
  {
    id: '005_add_analysis_column',
    description: 'Add analysis JSON column to solves table',
    sql: `
      ALTER TABLE solves ADD COLUMN analysis TEXT;
    `,
  },
  {
    id: '006_add_source_column',
    description: 'Add source column to solves table ("smart" | "manual")',
    sql: `
      ALTER TABLE solves ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
    `,
  },
];
