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
  {
    id: '007_add_orientation_timeline',
    description: 'Add orientation_timeline JSON column for gyro/IMU replay data',
    sql: `
      ALTER TABLE solves ADD COLUMN orientation_timeline TEXT;
    `,
  },
  {
    id: '008_create_algorithm_tables',
    description: 'Create algorithm_cases, algorithm_records, algorithm_subsets, algorithm_methods tables for new canonical schema',
    sql: `
      CREATE TABLE IF NOT EXISTS algorithm_methods (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3'
      );

      CREATE TABLE IF NOT EXISTS algorithm_subsets (
        id TEXT PRIMARY KEY,
        method_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        FOREIGN KEY (method_id) REFERENCES algorithm_methods(id)
      );

      CREATE TABLE IF NOT EXISTS algorithm_cases (
        id TEXT PRIMARY KEY,
        subset_id TEXT NOT NULL,
        case_number TEXT NOT NULL,
        name TEXT NOT NULL,
        recognition_patterns TEXT NOT NULL DEFAULT '[]',
        setup_scramble TEXT NOT NULL DEFAULT '',
        setup_algorithm TEXT,
        diagram_type TEXT NOT NULL DEFAULT '2d-top',
        diagram_2d TEXT,
        diagram_3d TEXT,
        probability TEXT,
        difficulty TEXT NOT NULL DEFAULT 'intermediate',
        category TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subset_id) REFERENCES algorithm_subsets(id)
      );

      CREATE TABLE IF NOT EXISTS algorithm_records (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        moves TEXT NOT NULL DEFAULT '[]',
        move_count_htm INTEGER NOT NULL DEFAULT 0,
        move_count_qtm INTEGER NOT NULL DEFAULT 0,
        move_count_stm INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        attribution_name TEXT,
        attribution_url TEXT,
        difficulty TEXT NOT NULL DEFAULT 'intermediate',
        triggers TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        is_mirror INTEGER NOT NULL DEFAULT 0,
        mirror_of TEXT,
        is_inverse INTEGER NOT NULL DEFAULT 0,
        votes INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (case_id) REFERENCES algorithm_cases(id)
      );

      CREATE INDEX IF NOT EXISTS idx_algorithm_records_case_id ON algorithm_records(case_id);
      CREATE INDEX IF NOT EXISTS idx_algorithm_cases_subset_id ON algorithm_cases(subset_id);
      CREATE INDEX IF NOT EXISTS idx_algorithm_subsets_method_id ON algorithm_subsets(method_id);
    `,
  },
  {
    id: '009_add_note_column',
    description: 'Add note column to solves table for user annotations',
    sql: `
      ALTER TABLE solves ADD COLUMN note TEXT;
    `,
  },
  {
    id: '011_add_puzzle_type_to_solves',
    description: 'Add puzzle_type column to solves table for multi-puzzle support (2x2, 3x3, etc.)',
    sql: `
      ALTER TABLE solves ADD COLUMN puzzle_type TEXT NOT NULL DEFAULT '3x3x3';
    `,
  },
  {
    id: '010_create_training_tables',
    description: 'Create training_attempts, algorithm_progress, and exercise_progress tables',
    sql: `
      CREATE TABLE IF NOT EXISTS training_attempts (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        subset_id TEXT,
        case_id TEXT,
        scramble TEXT NOT NULL DEFAULT '',
        time_ms INTEGER NOT NULL,
        verdict TEXT NOT NULL DEFAULT 'correct',
        play_mode TEXT NOT NULL DEFAULT 'manual',
        expected_moves TEXT,
        executed_moves TEXT,
        tps REAL,
        move_count INTEGER,
        rotation_count INTEGER,
        inspection_ms INTEGER,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_training_attempts_exercise ON training_attempts(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_method ON training_attempts(method_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_case ON training_attempts(case_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_timestamp ON training_attempts(timestamp);

      CREATE TABLE IF NOT EXISTS algorithm_progress (
        id TEXT PRIMARY KEY,
        algorithm_id TEXT NOT NULL UNIQUE,
        mastery INTEGER NOT NULL DEFAULT 0,
        accuracy REAL NOT NULL DEFAULT 0,
        best_time_ms INTEGER NOT NULL DEFAULT 0,
        avg_time_ms INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        correct_streak INTEGER NOT NULL DEFAULT 0,
        last_practiced_at INTEGER NOT NULL DEFAULT 0,
        srs_next_review_at INTEGER NOT NULL DEFAULT 0,
        srs_interval_days INTEGER NOT NULL DEFAULT 0,
        srs_ease_factor REAL NOT NULL DEFAULT 2.5
      );
      CREATE INDEX IF NOT EXISTS idx_algorithm_progress_mastery ON algorithm_progress(mastery);
      CREATE INDEX IF NOT EXISTS idx_algorithm_progress_srs ON algorithm_progress(srs_next_review_at);

      CREATE TABLE IF NOT EXISTS exercise_progress (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        total_sessions INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        best_accuracy REAL NOT NULL DEFAULT 0,
        best_time_ms INTEGER NOT NULL DEFAULT 0,
        avg_time_ms INTEGER NOT NULL DEFAULT 0,
        last_practiced_at INTEGER NOT NULL DEFAULT 0,
        UNIQUE(exercise_id, method_id, phase_id)
      );
      CREATE INDEX IF NOT EXISTS idx_exercise_progress_method ON exercise_progress(method_id);
    `,
  },
];
