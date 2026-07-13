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
];
