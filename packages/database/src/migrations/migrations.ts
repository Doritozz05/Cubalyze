export interface Migration {
  id: string;
  description: string;
  sql: string;
}

/**
 * FROZEN snapshots — migrations must be deterministic forever, so they do
 * NOT read the live registry. These lists are the values in force when each
 * migration was written (A2 / ADR-002). Do not edit them.
 */

/** Canonical puzzle_type values BEFORE ADR-002 (used by migration 026). */
const LEGACY_CANONICAL_TYPES: readonly string[] = [
  '2x2x2', '3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7', '333oh', '333bf',
  '333fm', '333mbf', '444bf', '555bf', 'clock', 'minx', 'pyram', 'skewb',
  'sq1', 'fto',
];
const LEGACY_TYPE_LIST_SQL = LEGACY_CANONICAL_TYPES.map((t) => `'${t}'`).join(', ');

/** WCA event codes in force after ADR-002 (used by migration 027). */
const WCA_CODES: readonly string[] = [
  '222', '333', '333oh', '444', '555', '666', '777', '333bf', '444bf',
  '555bf', '333fm', '333mbf', 'clock', 'minx', 'pyram', 'skewb', 'sq1', 'fto',
];
const WCA_CODE_LIST_SQL = WCA_CODES.map((t) => `'${t}'`).join(', ');

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
      CREATE TABLE IF NOT EXISTS solves (
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
      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX idx_solves_date ON solves(date);

      DROP TABLE IF EXISTS sessions;
      CREATE TABLE IF NOT EXISTS sessions (
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
  {
    id: '011_add_puzzle_type_to_solves',
    description: 'Add puzzle_type column to solves table for multi-puzzle support (2x2, 3x3, etc.)',
    sql: `
      ALTER TABLE solves ADD COLUMN puzzle_type TEXT NOT NULL DEFAULT '3x3x3';
    `,
  },
  {
    id: '012_create_training_tasks',
    description: 'Create training_tasks table (calendar tasks) — single source of truth replacing localStorage',
    sql: `
      CREATE TABLE IF NOT EXISTS training_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL,
        repeat TEXT NOT NULL DEFAULT 'none',
        days_of_week TEXT NOT NULL DEFAULT '[]',
        color TEXT NOT NULL DEFAULT 'blue',
        created_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_training_tasks_start_date ON training_tasks(start_date);
    `,
  },
  {
    id: '013_create_skill_progress',
    description: 'Create skill_progress table (skill tree completion) — single source of truth replacing localStorage',
    sql: `
      CREATE TABLE IF NOT EXISTS skill_progress (
        skill_id TEXT PRIMARY KEY,
        completed_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_skill_progress_completed_at ON skill_progress(completed_at);
    `,
  },
  {
    id: '014_add_recognition_and_efficiency',
    description: 'Add recognition accuracy to algorithm_progress and optimal_moves to training_attempts',
    sql: `
      ALTER TABLE algorithm_progress ADD COLUMN recognition_accuracy REAL NOT NULL DEFAULT 0;
      ALTER TABLE algorithm_progress ADD COLUMN recognition_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE training_attempts ADD COLUMN optimal_moves INTEGER;
    `,
  },
  {
    id: '015_add_fsrs_fields',
    description: 'Add FSRS spaced-repetition fields (stability/difficulty/state/lapses/review_count/last_review_at) to algorithm_progress and review_grade to training_attempts',
    sql: `
      ALTER TABLE algorithm_progress ADD COLUMN srs_stability REAL NOT NULL DEFAULT 0;
      ALTER TABLE algorithm_progress ADD COLUMN srs_difficulty REAL NOT NULL DEFAULT 5;
      ALTER TABLE algorithm_progress ADD COLUMN srs_state TEXT NOT NULL DEFAULT 'new';
      ALTER TABLE algorithm_progress ADD COLUMN srs_lapses INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE algorithm_progress ADD COLUMN srs_review_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE algorithm_progress ADD COLUMN last_review_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE training_attempts ADD COLUMN review_grade TEXT;
    `,
  },
  {
    id: '016_reconcile_training_catalog_and_sessions',
    description: 'Complete canonical algorithm relationships and add persisted training sessions',
    sql: `
      ALTER TABLE algorithm_subsets ADD COLUMN parent_id TEXT;

      CREATE TABLE IF NOT EXISTS training_sessions (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        subset_id TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        smart_cube_used INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
      );
      CREATE INDEX IF NOT EXISTS idx_training_sessions_method_phase
        ON training_sessions(method_id, phase_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_training_sessions_completed
        ON training_sessions(completed_at);

      ALTER TABLE training_attempts ADD COLUMN session_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_training_attempts_session
        ON training_attempts(session_id);
    `,
  },
  {
    id: '017_add_training_metric_kind',
    description: 'Persist whether a training attempt measures execution or recognition',
    sql: `
      ALTER TABLE training_attempts ADD COLUMN metric_kind TEXT NOT NULL DEFAULT 'execution';
      CREATE INDEX IF NOT EXISTS idx_training_attempts_metric_kind
        ON training_attempts(metric_kind);
    `,
  },
  {
    id: '018_add_is_demo',
    description: 'Flag demo/seeded data on solves and sessions so it can be isolated and wiped (fix: mock data injected into new users)',
    sql: `
      ALTER TABLE solves ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_demo ON sessions(is_demo);

      -- Data heal: legacy demo rows created by the old seedDemoData live in
      -- sessions named 'Demo Session'. Mark them (and their solves) so they
      -- are hidden from the UI and removable via clearDemoData().
      UPDATE sessions SET is_demo = 1 WHERE name = 'Demo Session';
      UPDATE solves SET is_demo = 1
        WHERE session_id IN (SELECT id FROM sessions WHERE is_demo = 1);
    `,
  },
  {
    id: '019_create_profiles',
    description: 'Create profiles table (user identity: name, handle, bio, avatar, declared methods, main puzzle)',
    sql: `
      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        handle TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        avatar_kind TEXT NOT NULL DEFAULT 'identicon',
        avatar_data TEXT,
        main_puzzle TEXT NOT NULL DEFAULT '3x3x3',
        declared_methods TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    id: '020_create_app_meta',
    description: 'Create app_meta key/value table (replaces the legacy ad-hoc kv_store created in the worker)',
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    id: '021_drop_kv_store',
    description: 'Drop the legacy kv_store table (replaced by app_meta in 020); cleans up databases created before the table moved into migrations',
    sql: `
      DROP TABLE IF EXISTS kv_store;
    `,
  },
  {
    id: '022_baseline_v2',
    description: 'Baseline v2 — recreate the schema clean: INTEGER epoch timestamps everywhere, real FKs, CHECKs, exact exec/rec counters, training_exercises registry, legacy algorithms table removed',
    sql: `
      -- ── Drop legacy / patch-worked tables (no users → safe wipe) ──────────
      -- training_exercises is dropped too: on a wedged DB (a worker killed
      -- mid-migration left the table with no _migrations record) this forces
      -- the canonical registry schema; the catalog re-seed repopulates it.
      DROP TABLE IF EXISTS training_attempts;
      DROP TABLE IF EXISTS algorithm_progress;
      DROP TABLE IF EXISTS exercise_progress;
      DROP TABLE IF EXISTS training_sessions;
      DROP TABLE IF EXISTS algorithms;
      DROP TABLE IF EXISTS solves;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS training_exercises;

      -- ── Sessions (INTEGER ms timestamps) ─────────────────────────────────
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        is_demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_demo ON sessions(is_demo);

      -- ── Solves (single INTEGER timestamp; real FK; CHECKs) ───────────────
      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none' CHECK (penalty IN ('none', '+2', 'dnf', 'DNF')),
        method TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('smart', 'manual')),
        note TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        orientation_timeline TEXT,
        analysis_engine_version TEXT,
        analysis TEXT,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_timestamp ON solves(timestamp);
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);

      -- ── Training exercise registry (seeded from @cubeforge/training in 023) ──
      CREATE TABLE IF NOT EXISTS training_exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'drill' CHECK (kind IN ('drill', 'recognize', 'solve', 'srs', 'efficiency', 'detect')),
        method_id TEXT,
        created_at INTEGER NOT NULL DEFAULT 0
      );

      -- ── Training attempts ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS training_attempts (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        subset_id TEXT,
        case_id TEXT,
        scramble TEXT NOT NULL DEFAULT '',
        time_ms INTEGER NOT NULL,
        verdict TEXT NOT NULL DEFAULT 'correct' CHECK (verdict IN ('correct', 'incorrect', 'skipped', 'dnf')),
        play_mode TEXT NOT NULL DEFAULT 'manual' CHECK (play_mode IN ('manual', 'smart-cube')),
        expected_moves TEXT,
        executed_moves TEXT,
        tps REAL,
        move_count INTEGER,
        optimal_moves INTEGER,
        rotation_count INTEGER,
        inspection_ms INTEGER,
        review_grade TEXT CHECK (review_grade IS NULL OR review_grade IN ('again', 'hard', 'good', 'easy')),
        session_id TEXT,
        metric_kind TEXT NOT NULL DEFAULT 'execution' CHECK (metric_kind IN ('execution', 'recognition')),
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (case_id) REFERENCES algorithm_cases(id)
      );
      CREATE INDEX IF NOT EXISTS idx_training_attempts_exercise ON training_attempts(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_method ON training_attempts(method_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_case ON training_attempts(case_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_session ON training_attempts(session_id);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_metric_kind ON training_attempts(metric_kind);
      CREATE INDEX IF NOT EXISTS idx_training_attempts_timestamp ON training_attempts(timestamp);

      -- ── Algorithm progress (exact exec/rec counters; real FK) ────────────
      CREATE TABLE IF NOT EXISTS algorithm_progress (
        id TEXT PRIMARY KEY,
        algorithm_id TEXT NOT NULL UNIQUE,
        mastery INTEGER NOT NULL DEFAULT 0,
        accuracy REAL NOT NULL DEFAULT 0,
        best_time_ms INTEGER NOT NULL DEFAULT 0,
        avg_time_ms INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        exec_attempts INTEGER NOT NULL DEFAULT 0,
        exec_correct INTEGER NOT NULL DEFAULT 0,
        correct_streak INTEGER NOT NULL DEFAULT 0,
        recognition_accuracy REAL NOT NULL DEFAULT 0,
        recognition_attempts INTEGER NOT NULL DEFAULT 0,
        recognition_correct INTEGER NOT NULL DEFAULT 0,
        recognition_streak INTEGER NOT NULL DEFAULT 0,
        last_practiced_at INTEGER NOT NULL DEFAULT 0,
        srs_next_review_at INTEGER NOT NULL DEFAULT 0,
        srs_interval_days INTEGER NOT NULL DEFAULT 0,
        srs_ease_factor REAL NOT NULL DEFAULT 2.5,
        srs_stability REAL NOT NULL DEFAULT 0,
        srs_difficulty REAL NOT NULL DEFAULT 5,
        srs_state TEXT NOT NULL DEFAULT 'new' CHECK (srs_state IN ('new', 'learning', 'review', 'relearning')),
        srs_lapses INTEGER NOT NULL DEFAULT 0,
        srs_review_count INTEGER NOT NULL DEFAULT 0,
        last_review_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (algorithm_id) REFERENCES algorithm_cases(id)
      );
      CREATE INDEX IF NOT EXISTS idx_algorithm_progress_mastery ON algorithm_progress(mastery);
      CREATE INDEX IF NOT EXISTS idx_algorithm_progress_srs ON algorithm_progress(srs_next_review_at);

      -- ── Exercise progress (exec counters; NULL-safe UNIQUE) ──────────────
      CREATE TABLE IF NOT EXISTS exercise_progress (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        total_sessions INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        exec_attempts INTEGER NOT NULL DEFAULT 0,
        exec_correct INTEGER NOT NULL DEFAULT 0,
        best_accuracy REAL NOT NULL DEFAULT 0,
        best_time_ms INTEGER NOT NULL DEFAULT 0,
        avg_time_ms INTEGER NOT NULL DEFAULT 0,
        last_practiced_at INTEGER NOT NULL DEFAULT 0
      );
      -- Expression index: phase_id NULLs are distinct in plain UNIQUE indexes,
      -- so COALESCE makes the (exercise, method, phase) identity actually unique.
      CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_progress_identity
        ON exercise_progress(exercise_id, method_id, COALESCE(phase_id, ''));
      CREATE INDEX IF NOT EXISTS idx_exercise_progress_method ON exercise_progress(method_id);

      -- ── Training sessions ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS training_sessions (
        id TEXT PRIMARY KEY,
        exercise_id TEXT NOT NULL,
        method_id TEXT NOT NULL,
        phase_id TEXT,
        subset_id TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        smart_cube_used INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed'))
      );
      CREATE INDEX IF NOT EXISTS idx_training_sessions_method_phase
        ON training_sessions(method_id, phase_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_training_sessions_completed
        ON training_sessions(completed_at);
    `,
  },
  {
    id: '023_exercise_exec_time_attempts',
    description: 'Add exec_time_attempts to exercise_progress — the execution-with-timer denominator (including honest "skipped" Full Solve splits) kept separate from exec_attempts (the accuracy denominator, which excludes skipped) so skipped splits feed avg/best time without diluting phase accuracy.',
    sql: `
      ALTER TABLE exercise_progress ADD COLUMN exec_time_attempts INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: '024_add_country_to_profiles',
    description: 'Add country (ISO alpha-2 code, empty = unset) to profiles for the profile identity row',
    sql: `
      ALTER TABLE profiles ADD COLUMN country TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: '025_add_virtual_source',
    description: 'Extend the solves.source CHECK to include "virtual" (Cube tab simulator solves) — SQLite cannot ALTER a CHECK, so the table is rebuilt with data preserved',
    sql: `
      -- Drop the old solves indexes first (they are renamed along with the
      -- table by ALTER TABLE RENAME and would otherwise shadow the fresh
      -- ones we recreate below).
      DROP INDEX IF EXISTS idx_solves_session_id;
      DROP INDEX IF EXISTS idx_solves_timestamp;
      DROP INDEX IF EXISTS idx_solves_is_demo;

      ALTER TABLE solves RENAME TO solves_source_check_legacy;

      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none' CHECK (penalty IN ('none', '+2', 'dnf', 'DNF')),
        method TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('smart', 'manual', 'virtual')),
        note TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        orientation_timeline TEXT,
        analysis_engine_version TEXT,
        analysis TEXT,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3',
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Preserve every existing solve (identical column list, same order as
      -- the INSERT statement in solves.repository.ts).
      INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        SELECT id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at
        FROM solves_source_check_legacy;

      DROP TABLE IF EXISTS solves_source_check_legacy;

      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_timestamp ON solves(timestamp);
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);
    `,
  },
  {
    id: '026_add_puzzle_type_check',
    description: 'Add CHECK constraints on solves.puzzle_type / sessions.puzzle_type so the database itself rejects any puzzle type the WCA event registry does not declare (phase A2). SQLite cannot ALTER a CHECK, so both tables are rebuilt with data preserved, following the 025 pattern.',
    sql: `
      -- FROZEN snapshot: the canonical puzzle_type values in force when this
      -- migration was written (A2). The registry now uses WCA codes; 027
      -- converts this scheme forward. Do not edit this migration.
      --
      --   ${LEGACY_TYPE_LIST_SQL}
      --
      -- ORDER MATTERS: sessions is rebuilt FIRST. Renaming sessions makes
      -- SQLite rewrite solves' FK (REFERENCES sessions → REFERENCES
      -- sessions_puzzle_type_check_legacy); if solves were recreated before
      -- sessions, its FK would point at the dropped legacy table and every
      -- later INSERT would fail with "no such table". Recreating solves
      -- AFTER sessions leaves its FK pointing at the final table.

      -- ── sessions ─────────────────────────────────────────────────────
      DROP INDEX IF EXISTS idx_sessions_created_at;
      DROP INDEX IF EXISTS idx_sessions_is_demo;

      ALTER TABLE sessions RENAME TO sessions_puzzle_type_check_legacy;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3' CHECK (puzzle_type IN (${LEGACY_TYPE_LIST_SQL})),
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      -- Data heal: legacy rows may carry short aliases ('3x3', '2x2') or
      -- other values outside the registry (they were never validated).
      --
      -- ORDER OF THE CASE MATTERS for 2×2 integrity: the short aliases must
      -- be mapped to their CANONICAL legacy scheme ('3x3'→'3x3x3',
      -- '2x2'→'2x2x2') so migration 027 can then convert them to the WCA
      -- codes ('333'/'222'). Mapping '2x2' straight to the ELSE ('3x3x3')
      -- would silently reclassify 2×2 data as 3×3. Unknown values still
      -- normalize to '3x3x3' so the migration never fails on existing data.
      INSERT INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo)
        SELECT
          id, name,
          CASE WHEN puzzle_type = '3x3' THEN '3x3x3'
               WHEN puzzle_type = '2x2' THEN '2x2x2'
               WHEN puzzle_type IN (${LEGACY_TYPE_LIST_SQL}) THEN puzzle_type
               ELSE '3x3x3' END,
          created_at, updated_at, is_demo
        FROM sessions_puzzle_type_check_legacy;

      -- Do NOT drop the legacy sessions table yet: the solves table still
      -- references it (the RENAME above rewrote the FK). Dropping it here
      -- would fire the solves FK's ON DELETE CASCADE and delete every solve.
      -- It is dropped at the very end, after solves has been rebuilt.
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_demo ON sessions(is_demo);

      -- ── solves ───────────────────────────────────────────────────────
      DROP INDEX IF EXISTS idx_solves_session_id;
      DROP INDEX IF EXISTS idx_solves_timestamp;
      DROP INDEX IF EXISTS idx_solves_is_demo;

      ALTER TABLE solves RENAME TO solves_puzzle_type_check_legacy;

      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none' CHECK (penalty IN ('none', '+2', 'dnf', 'DNF')),
        method TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('smart', 'manual', 'virtual')),
        note TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        orientation_timeline TEXT,
        analysis_engine_version TEXT,
        analysis TEXT,
        puzzle_type TEXT NOT NULL DEFAULT '3x3x3' CHECK (puzzle_type IN (${LEGACY_TYPE_LIST_SQL})),
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Same heal as sessions (and same short-alias mapping so 027 can
      -- convert '2x2' → '222' instead of reclassifying it as 3×3).
      INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        SELECT
          id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis,
          CASE WHEN puzzle_type = '3x3' THEN '3x3x3'
               WHEN puzzle_type = '2x2' THEN '2x2x2'
               WHEN puzzle_type IN (${LEGACY_TYPE_LIST_SQL}) THEN puzzle_type
               ELSE '3x3x3' END,
          is_demo, created_at, updated_at
        FROM solves_puzzle_type_check_legacy;

      DROP TABLE IF EXISTS solves_puzzle_type_check_legacy;

      -- Now safe: solves no longer references the legacy sessions table, so
      -- this DROP cannot cascade into any surviving data.
      DROP TABLE IF EXISTS sessions_puzzle_type_check_legacy;

      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_timestamp ON solves(timestamp);
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);
    `,
  },
  {
    id: '027_puzzle_type_wca_codes',
    description: 'Normalize puzzle_type to WCA event codes (ADR-002): rebuild solves/sessions with the WCA-code CHECK and DEFAULT (migration 026 created the old-scheme CHECK, which must be replaced — SQLite cannot ALTER a CHECK), converting legacy values in place ("3x3x3"/"3x3" → "333", "2x2x2"/"2x2" → "222") in solves, sessions, algorithm tables and profiles.main_puzzle. Zero data loss: every row is copied or updated, never dropped.',
    sql: `
      -- ADR-002: puzzle_type = WCA event code. Frozen WCA allow-list:
      --   ${WCA_CODE_LIST_SQL}
      --
      -- Conversion CASE (repeated per table — SQLite has no variables):
      --   '3x3x3'/'3x3' → '333', '2x2x2'/'2x2' → '222',
      --   already-canonical WCA codes pass through, unknown → '333'.
      --
      -- ORDER MATTERS (same lesson as 026): sessions rebuilt FIRST so
      -- solves' FK points at the final table.

      -- ── sessions ─────────────────────────────────────────────────────
      DROP INDEX IF EXISTS idx_sessions_created_at;
      DROP INDEX IF EXISTS idx_sessions_is_demo;

      ALTER TABLE sessions RENAME TO sessions_wca_legacy;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        puzzle_type TEXT NOT NULL DEFAULT '333' CHECK (puzzle_type IN (${WCA_CODE_LIST_SQL})),
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO sessions (id, name, puzzle_type, created_at, updated_at, is_demo)
        SELECT
          id, name,
          CASE WHEN puzzle_type IN ('3x3x3', '3x3') THEN '333'
               WHEN puzzle_type IN ('2x2x2', '2x2') THEN '222'
               WHEN puzzle_type IN (${WCA_CODE_LIST_SQL}) THEN puzzle_type
               ELSE '333' END,
          created_at, updated_at, is_demo
        FROM sessions_wca_legacy;

      -- Do NOT drop the legacy sessions table yet: the solves table still
      -- references it (the RENAME above rewrote the FK). Dropping it here
      -- would fire the solves FK's ON DELETE CASCADE and delete every solve.
      -- It is dropped at the very end, after solves has been rebuilt.
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_demo ON sessions(is_demo);

      -- ── solves ───────────────────────────────────────────────────────
      DROP INDEX IF EXISTS idx_solves_session_id;
      DROP INDEX IF EXISTS idx_solves_timestamp;
      DROP INDEX IF EXISTS idx_solves_is_demo;

      ALTER TABLE solves RENAME TO solves_wca_legacy;

      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none' CHECK (penalty IN ('none', '+2', 'dnf', 'DNF')),
        method TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('smart', 'manual', 'virtual')),
        note TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        orientation_timeline TEXT,
        analysis_engine_version TEXT,
        analysis TEXT,
        puzzle_type TEXT NOT NULL DEFAULT '333' CHECK (puzzle_type IN (${WCA_CODE_LIST_SQL})),
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        SELECT
          id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis,
          CASE WHEN puzzle_type IN ('3x3x3', '3x3') THEN '333'
               WHEN puzzle_type IN ('2x2x2', '2x2') THEN '222'
               WHEN puzzle_type IN (${WCA_CODE_LIST_SQL}) THEN puzzle_type
               ELSE '333' END,
          is_demo, created_at, updated_at
        FROM solves_wca_legacy;

      DROP TABLE IF EXISTS solves_wca_legacy;

      -- Now safe: solves no longer references the legacy sessions table, so
      -- this DROP cannot cascade into any surviving data.
      DROP TABLE IF EXISTS sessions_wca_legacy;

      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_timestamp ON solves(timestamp);
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);

      -- ── Algorithm catalog (no CHECK on these columns — plain UPDATEs) ──
      UPDATE algorithm_methods SET puzzle_type =
        CASE WHEN puzzle_type IN ('3x3x3', '3x3') THEN '333'
             WHEN puzzle_type IN ('2x2x2', '2x2') THEN '222'
             WHEN puzzle_type IN (${WCA_CODE_LIST_SQL}) THEN puzzle_type
             ELSE '333' END;

      UPDATE algorithm_subsets SET puzzle_type =
        CASE WHEN puzzle_type IN ('3x3x3', '3x3') THEN '333'
             WHEN puzzle_type IN ('2x2x2', '2x2') THEN '222'
             WHEN puzzle_type IN (${WCA_CODE_LIST_SQL}) THEN puzzle_type
             ELSE '333' END;

      UPDATE algorithm_cases SET puzzle_type =
        CASE WHEN puzzle_type IN ('3x3x3', '3x3') THEN '333'
             WHEN puzzle_type IN ('2x2x2', '2x2') THEN '222'
             WHEN puzzle_type IN (${WCA_CODE_LIST_SQL}) THEN puzzle_type
             ELSE '333' END;

      -- ── Profile main puzzle ──────────────────────────────────────────
      UPDATE profiles SET main_puzzle =
        CASE WHEN main_puzzle IN ('3x3x3', '3x3') THEN '333'
             WHEN main_puzzle IN ('2x2x2', '2x2') THEN '222'
             WHEN main_puzzle IN (${WCA_CODE_LIST_SQL}) THEN main_puzzle
             ELSE '333' END;
    `,
  },
  {
    id: '028_sync_infrastructure',
    description: 'Cloud-sync infrastructure: sync_tombstones table, DELETE triggers on every syncable table (captures all delete paths), updated_at columns on training_tasks/training_sessions (LWW watermarks), and sync-dirty triggers that flag the sync engine whenever a syncable row is written',
    sql: `
      -- ── Tombstones ──────────────────────────────────────────────────
      -- One row per hard-deleted syncable entity. The sync engine pushes
      -- these to the cloud and applies remote ones locally. Echo suppression
      -- happens at the app layer (the engine deletes the local tombstone it
      -- just created while applying a remote one) so deletes never loop.
      CREATE TABLE IF NOT EXISTS sync_tombstones (
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        deleted_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (entity, entity_id)
      );

      -- ── LWW watermarks for tables that can be edited after creation ──
      -- training_attempts too: the SRS review flow stamps review_grade AFTER
      -- the attempt row exists, so the row must carry an edit timestamp or
      -- grade changes would never leave the device.
      ALTER TABLE training_attempts ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE training_tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE training_sessions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

      -- Backfill: pre-028 rows default to 0, which the sync engine's
      -- "strictly greater than watermark" cursor would never pick up.
      -- Seed the watermark from each row's creation time instead.
      UPDATE training_attempts SET updated_at = timestamp WHERE updated_at = 0;
      UPDATE training_tasks SET updated_at = created_at WHERE updated_at = 0;
      UPDATE training_sessions SET updated_at = started_at WHERE updated_at = 0;

      -- ── DELETE triggers → tombstones ────────────────────────────────
      -- Capture EVERY delete path (UI, cascade, dev helpers) so a deleted
      -- solve/session/task/skill never resurfaces from the cloud on another
      -- device. Cascade deletes of child rows (solves of a deleted session)
      -- do NOT fire row triggers in SQLite, so the app layer tombstones the
      -- children explicitly when it deletes a session (see deleteSession).
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_solves AFTER DELETE ON solves BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('solves', OLD.id, CAST(strftime('%s','now') AS INTEGER) * 1000);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_sessions AFTER DELETE ON sessions BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('sessions', OLD.id, CAST(strftime('%s','now') AS INTEGER) * 1000);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_tasks AFTER DELETE ON training_tasks BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('training_tasks', OLD.id, CAST(strftime('%s','now') AS INTEGER) * 1000);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_skill_progress AFTER DELETE ON skill_progress BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('skill_progress', OLD.skill_id, CAST(strftime('%s','now') AS INTEGER) * 1000);
      END;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_sessions AFTER DELETE ON training_sessions BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('training_sessions', OLD.id, CAST(strftime('%s','now') AS INTEGER) * 1000);
      END;

      -- ── Dirty flags (catch-all change notification) ──────────────────
      -- Any INSERT/UPDATE on a syncable table marks the sync engine dirty so
      -- a change is never missed even if a future write path forgets to call
      -- scheduleSync() explicitly. The engine clears the flag when a sync run
      -- observes no concurrent writes, and re-runs if a write landed mid-run.
      --
      -- NOTE: DELETE is intentionally absent here — deletes are already
      -- captured by the tombstones above (a tombstone is itself a change).
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves AFTER INSERT ON solves BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves_upd AFTER UPDATE ON solves BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions AFTER INSERT ON sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions_upd AFTER UPDATE ON sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_attempts AFTER INSERT ON training_attempts BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_attempts_upd AFTER UPDATE ON training_attempts BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_tasks AFTER INSERT ON training_tasks BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_tasks_upd AFTER UPDATE ON training_tasks BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_skill_progress AFTER INSERT ON skill_progress BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_skill_progress_upd AFTER UPDATE ON skill_progress BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_sessions AFTER INSERT ON training_sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_sessions_upd AFTER UPDATE ON training_sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_profiles AFTER INSERT ON profiles BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_profiles_upd AFTER UPDATE ON profiles BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
    `,
  },
  {
    id: '029_tombstone_lww',
    description: 'Tombstone LWW: re-create the DELETE triggers with millisecond-precision deleted_at so a tombstone can be compared exactly against row updated_at (the sync engine now applies deletes conditionally — a delete only wins when the row was not edited after it, and the cloud row is physically removed when the delete wins)',
    sql: `
      -- Millisecond-precision delete timestamps: strftime('%s','now')*1000
      -- truncates to the second, which would make a delete look older than an
      -- edit that happened in the same second (breaking LWW). julianday gives
      -- ms since the Unix epoch.
      DROP TRIGGER IF EXISTS trg_tombstone_solves;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_solves AFTER DELETE ON solves BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('solves', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
      DROP TRIGGER IF EXISTS trg_tombstone_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_sessions AFTER DELETE ON sessions BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('sessions', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
      DROP TRIGGER IF EXISTS trg_tombstone_training_tasks;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_tasks AFTER DELETE ON training_tasks BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('training_tasks', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
      DROP TRIGGER IF EXISTS trg_tombstone_skill_progress;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_skill_progress AFTER DELETE ON skill_progress BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('skill_progress', OLD.skill_id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
      DROP TRIGGER IF EXISTS trg_tombstone_training_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_sessions AFTER DELETE ON training_sessions BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('training_sessions', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
    `,
  },
  {
    id: '030_no_demo_tombstones',
    description: 'Demo rows never tombstone: solves/sessions DELETE triggers now skip is_demo=1 rows so clearDemoData() and demo-session deletes cannot fabricate tombstones that get pushed to the cloud (demo rows are never pushed, so their tombstones are pure noise + unbounded cloud growth)',
    sql: `
      -- A demo solve/session never existed in the cloud (demo rows are
      -- excluded from every push cursor), so deleting one must not create a
      -- tombstone: the tombstone would be pushed, inserted into
      -- sync_tombstones forever (the target row never exists → no-op) and
      -- count against the user's unbounded tombstone accumulation (M7).
      DROP TRIGGER IF EXISTS trg_tombstone_solves;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_solves
      AFTER DELETE ON solves
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('solves', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
      DROP TRIGGER IF EXISTS trg_tombstone_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_sessions
      AFTER DELETE ON sessions
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES ('sessions', OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
      END;
    `,
  },
  {
    id: '031_tombstone_clock_floor',
    description:
      'Tombstone LWW clock fix: re-create the DELETE triggers so deleted_at is MAX(wall_clock_ms, OLD.updated_at + 1). The monotonic write clock (local-clock.ts) can advance updated_at PAST the wall-clock (each write in a burst takes prev+1), so a tombstone stamped with bare julianday(now) can be OLDER than the row it deletes. When that tombstone reaches another device, deleteIfNotNewer sees updated_at > deleted_at and the tombstone LOSES — the deleted row resurrects in its old session. Flooring deleted_at at OLD.updated_at + 1 guarantees the tombstone always wins LWW against the very row being deleted (the only row whose vote matters — a NEWER edit on another device should still survive, and will, because it carries an even higher updated_at).',
    sql: `
      -- The deleted_at must be strictly greater than the row's own updated_at
      -- so deleteIfNotNewer (WHERE updated_at <= deleted_at) always applies
      -- for the row being deleted. A newer edit made AFTER this delete on
      -- another device carries an even higher updated_at and still survives
      -- (its updated_at > deleted_at) — LWW is preserved for real conflicts.
      DROP TRIGGER IF EXISTS trg_tombstone_solves;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_solves
      AFTER DELETE ON solves
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'solves',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_sessions
      AFTER DELETE ON sessions
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'sessions',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_training_tasks;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_tasks
      AFTER DELETE ON training_tasks
      FOR EACH ROW
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'training_tasks',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_skill_progress;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_skill_progress
      AFTER DELETE ON skill_progress
      FOR EACH ROW
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'skill_progress',
          OLD.skill_id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.completed_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_training_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_training_sessions
      AFTER DELETE ON training_sessions
      FOR EACH ROW
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'training_sessions',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;
    `,
  },
  {
    id: '032_remove_sessions_puzzle_type',
    description: 'Drop sessions.puzzle_type: the column is legacy metadata (ADR-002-era COPY of the per-solve field) that no code reads or filters on — a session can hold solves of several puzzles (per-solve puzzle_type is the source of truth), and the stale column is wrong in most rows. sessions and solves are rebuilt with data preserved so solves\' FK keeps pointing at the final sessions table (SQLite RENAME rewrites the FK to the legacy name; the 026/027 ORDER MATTERS lesson). Zero data loss: every solve row is copied byte-for-byte; sessions merely lose the unused column.',
    sql: `
      -- ── sessions ─────────────────────────────────────────────────────
      DROP INDEX IF EXISTS idx_sessions_created_at;
      DROP INDEX IF EXISTS idx_sessions_is_demo;

      ALTER TABLE sessions RENAME TO sessions_no_puzzle_legacy;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO sessions (id, name, created_at, updated_at, is_demo)
        SELECT id, name, created_at, updated_at, is_demo
        FROM sessions_no_puzzle_legacy;

      -- Do NOT drop the legacy sessions table yet: the solves table still
      -- references it (the RENAME above rewrote the FK). Dropping it here
      -- would fire the solves FK's ON DELETE CASCADE and delete every solve.
      -- It is dropped at the very end, after solves has been rebuilt.
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_demo ON sessions(is_demo);

      -- ── solves (rebuilt only to re-point the FK, schema unchanged) ────
      DROP INDEX IF EXISTS idx_solves_session_id;
      DROP INDEX IF EXISTS idx_solves_timestamp;
      DROP INDEX IF EXISTS idx_solves_is_demo;

      ALTER TABLE solves RENAME TO solves_no_puzzle_legacy;

      CREATE TABLE IF NOT EXISTS solves (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        scramble TEXT NOT NULL DEFAULT '',
        penalty TEXT NOT NULL DEFAULT 'none' CHECK (penalty IN ('none', '+2', 'dnf', 'DNF')),
        method TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('smart', 'manual', 'virtual')),
        note TEXT,
        moves TEXT NOT NULL DEFAULT '[]',
        orientation_timeline TEXT,
        analysis_engine_version TEXT,
        analysis TEXT,
        puzzle_type TEXT NOT NULL DEFAULT '333' CHECK (puzzle_type IN (${WCA_CODE_LIST_SQL})),
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Byte-for-byte copy: every solve column is preserved unchanged
      -- (including per-solve puzzle_type — the real source of truth).
      INSERT INTO solves (id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        SELECT id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at
        FROM solves_no_puzzle_legacy;

      DROP TABLE IF EXISTS solves_no_puzzle_legacy;

      -- Now safe: solves no longer references the legacy sessions table, so
      -- this DROP cannot cascade into any surviving data.
      DROP TABLE IF EXISTS sessions_no_puzzle_legacy;

      CREATE INDEX IF NOT EXISTS idx_solves_session_id ON solves(session_id);
      CREATE INDEX IF NOT EXISTS idx_solves_timestamp ON solves(timestamp);
      CREATE INDEX IF NOT EXISTS idx_solves_is_demo ON solves(is_demo);

      -- Triggers do NOT survive ALTER TABLE RENAME (SQLite re-points them at
      -- the legacy table), so every trigger on the two rebuilt tables is
      -- re-created here, using the latest versions from migrations 028/031
      -- (DROP IF EXISTS + CREATE forces the current shape).

      -- ── Tombstone triggers (031: ms precision, MAX(wall, updated_at+1)) ──
      DROP TRIGGER IF EXISTS trg_tombstone_solves;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_solves
      AFTER DELETE ON solves
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'solves',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_sessions
      AFTER DELETE ON sessions
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'sessions',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      -- ── Dirty flags (028: any write marks the sync engine dirty) ──────
      DROP TRIGGER IF EXISTS trg_dirty_solves;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves AFTER INSERT ON solves BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      DROP TRIGGER IF EXISTS trg_dirty_solves_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves_upd AFTER UPDATE ON solves BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      DROP TRIGGER IF EXISTS trg_dirty_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions AFTER INSERT ON sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
      DROP TRIGGER IF EXISTS trg_dirty_sessions_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions_upd AFTER UPDATE ON sessions BEGIN
        INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sync_dirty', '1');
      END;
    `,
  },
  {
    id: '033_repair_method_scope',
    description:
      'Data repair: solves.method held a copy of the global method preference, so every event persisted "CFOP" — including the ones with no method concept at all (2×2, Pyraminx, and every non-3×3 event the registry declares). Only the events whose spec declares analysis methods (333, 333oh) keep a method; the rest are cleared. The rewritten rows take a monotonic stamp (floored at their own updated_at + 1, exactly the lesson of 031) so the correction actually LEAVES the device: push selects rows with updated_at > watermark, and a correction without a new stamp would sit in local storage forever. local_clock_solves is then advanced past the highest stamp, otherwise the next local edit of a repaired row would be born BELOW its own updated_at and lose the cloud LWW guard (excluded.updated_at >= solves.updated_at). What is rewritten is a provably false label — time, scramble, penalty, moves, orientation and analysis are untouched — so no backup table is kept (the migration is idempotent, and re-running it is a no-op).',
    sql: `
      UPDATE solves
         SET method = NULL,
             updated_at = MAX(
               updated_at + 1,
               CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
             )
       WHERE method IS NOT NULL
         AND puzzle_type NOT IN ('333', '333oh');

      -- Keep the per-table monotonic write clock (repositories/local-clock.ts)
      -- ahead of every repair stamp so later local edits of these rows stay
      -- "newer" than the repair itself.
      INSERT OR REPLACE INTO app_meta (key, value)
      VALUES (
        'local_clock_solves',
        CAST(
          MAX(
            COALESCE(
              (SELECT CAST(value AS INTEGER) FROM app_meta WHERE key = 'local_clock_solves'),
              0
            ),
            COALESCE((SELECT MAX(updated_at) FROM solves), 0)
          ) AS TEXT
        )
      );
    `,
  },
  {
    id: '034_gear_collection',
    description:
      'The Locker (gear collection) becomes real database rows: gear_categories → gear_types → gear_items, matching the model in apps/web/src/views/Collection/collectionModel.ts (two levels, types optionally mirroring an app puzzle category, "main" per item). It replaces the single localStorage JSON blob (`cubeforge-locker`), which capped the whole collection at a handful of photos and could not be queried, backed up or synced. Photos are NOT stored here: the row keeps references (id + natural size) and the bytes live as blobs in IndexedDB — the same split the app already uses for background media — because base64 in a row costs ~2× and would travel to the cloud. Shape is sync-ready (id/updated_at/is_demo + dirty/tombstone triggers come with the sync step) so adding it to the engine later is a pull/push registration, not a rebuild. Cascades mirror the model exactly: deleting a category takes its types and items, deleting a type re-homes its items in the category (type_id ⇒ NULL).',
    sql: `
      CREATE TABLE IF NOT EXISTS gear_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'gear' CHECK (kind IN ('cube', 'gear')),
        icon TEXT NOT NULL DEFAULT 'Box',
        accent TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_gear_categories_created ON gear_categories(created_at);
      CREATE INDEX IF NOT EXISTS idx_gear_categories_updated ON gear_categories(updated_at);

      CREATE TABLE IF NOT EXISTS gear_types (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        puzzle_category TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES gear_categories(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_gear_types_category ON gear_types(category_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_gear_types_updated ON gear_types(updated_at);

      CREATE TABLE IF NOT EXISTS gear_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        type_id TEXT,
        name TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        finish TEXT,
        serial TEXT,
        palette TEXT NOT NULL DEFAULT '[]',
        acquired_at TEXT,
        price_amount REAL,
        price_currency TEXT,
        notes TEXT,
        links TEXT NOT NULL DEFAULT '[]',
        photos TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'wishlist', 'sold', 'lent')),
        condition TEXT CHECK (condition IS NULL OR condition IN ('mint', 'good', 'used', 'broken')),
        is_primary INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        rating REAL,
        quantity INTEGER NOT NULL DEFAULT 1,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES gear_categories(id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES gear_types(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gear_items_category ON gear_items(category_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_gear_items_type ON gear_items(type_id);
      CREATE INDEX IF NOT EXISTS idx_gear_items_status ON gear_items(status);
      CREATE INDEX IF NOT EXISTS idx_gear_items_updated ON gear_items(updated_at);
    `,
  },
  {
    id: '035_solve_cube',
    description:
      'A solve can say WHICH cube it was done with: solves.cube_id (a gear_items.id, no FK on purpose — deleting a cube from the Locker must never rewrite solve history) plus cube_label, the denormalised name shown in the history, the exports and the per-cube stats (so a renamed or deleted item does not turn past solves into "unknown"). Indexed by cube_id for the per-cube queries of the stats phase. Both columns are nullable: virtual solves have no physical cube, and a manual or imported solve may predate the field. The cloud table gets the same two columns (supabase migration 20260912000009) so the attribution travels with the solve instead of being a local-only detail.',
    sql: `
      ALTER TABLE solves ADD COLUMN cube_id TEXT;
      ALTER TABLE solves ADD COLUMN cube_label TEXT;
      CREATE INDEX IF NOT EXISTS idx_solves_cube ON solves(cube_id);
    `,
  },
  {
    id: '036_gear_smart_id',
    description:
      'A Locker item can carry the Bluetooth address of the physical cube it IS: gear_items.smart_id, stored in the canonical form (12 hex digits, no separators — see smart-cube-id.ts). It is the key the smart-cube link resolves against, so a connected cube turns into "this item" without the user picking one from a list. Kept apart from `serial` on purpose: the printed serial number and the hardware address are two different facts, and the automatic link must never be able to overwrite something a person typed by hand. Nullable (only smart cubes have one) and indexed, because every connection looks an item up by it. Local-only for now: the gear tables are not registered with the sync engine yet (that is phase 6), so there is no cloud counterpart to add here.',
    sql: `
      ALTER TABLE gear_items ADD COLUMN smart_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_gear_items_smart ON gear_items(smart_id);
    `,
  },
  {
    id: '037_gear_sync',
    description:
      'The Locker joins the sync engine (Fase 6). Two pieces: (a) the same infrastructure the other synced tables got in 028/029/030/031 — DELETE triggers that write a millisecond-precision tombstone (floored at OLD.updated_at + 1 so the delete always wins LWW against the row it removes) and INSERT/UPDATE triggers that flag sync_dirty, on gear_categories / gear_types / gear_items; and (b) a DEVICE-LOCAL ledger (gear_photo_sync) that tracks whether each photo blob is already in Supabase Storage. The ledger must NOT be a synced column: writing "uploaded" into gear_items.photos would bump updated_at, which would trigger a push, then a pull on the other device, then another write — an endless loop. It has no FKs and no tombstone/dirty triggers on purpose (it is cache, not data).',
    sql: `
      -- ── Photo-upload ledger (device-local; never synced) ──────────────
      CREATE TABLE IF NOT EXISTS gear_photo_sync (
        photo_key       TEXT PRIMARY KEY,
        item_id         TEXT NOT NULL,
        photo_id        TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        content_hash    TEXT NOT NULL DEFAULT '',
        full_bytes      INTEGER NOT NULL DEFAULT 0,
        thumb_bytes     INTEGER NOT NULL DEFAULT 0,
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER NOT NULL DEFAULT 0,
        uploaded_at     INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_gear_photo_sync_status
        ON gear_photo_sync(status, last_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_gear_photo_sync_item
        ON gear_photo_sync(item_id);

      -- ── DELETE triggers → tombstones (idiom of 031: ms + floor) ───────
      -- SQLite does NOT fire row triggers for rows removed by an FK cascade
      -- (recursive_triggers defaults to OFF), so the repository must delete
      -- children explicitly before their parent; these triggers are what
      -- turn those explicit deletes into tombstones. Demo rows never
      -- tombstone (M7): a demo item never existed in the cloud.
      DROP TRIGGER IF EXISTS trg_tombstone_gear_items;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_gear_items
      AFTER DELETE ON gear_items
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'gear_items',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_gear_types;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_gear_types
      AFTER DELETE ON gear_types
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'gear_types',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      DROP TRIGGER IF EXISTS trg_tombstone_gear_categories;
      CREATE TRIGGER IF NOT EXISTS trg_tombstone_gear_categories
      AFTER DELETE ON gear_categories
      FOR EACH ROW
      WHEN (OLD.is_demo = 0)
      BEGIN
        INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
        VALUES (
          'gear_categories',
          OLD.id,
          MAX(
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER),
            OLD.updated_at + 1
          )
        );
      END;

      -- ── Dirty flags (catch-all change notification) ───────────────────
      -- DELETE is intentionally absent: the tombstones above already are a
      -- change. Same contract as every other synced table (028) — but NOT the
      -- same statement, and the difference is load-bearing:
      --
      --   INSERT OR REPLACE INTO app_meta CANNOT be used here. The gear
      --   repositories upsert with INSERT … ON CONFLICT(id) DO UPDATE
      --   (upsertCategory/Type/Item), and SQLite refuses to resolve ANY
      --   constraint conflict inside a trigger fired by the DO UPDATE arm of
      --   an UPSERT — including one the sub-statement would have resolved
      --   itself with OR REPLACE or OR IGNORE. The result is a bogus
      --   SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key,
      --   raised by the OUTER insert, on the second write to the same row,
      --   once sync_dirty already exists. The explicit
      --   ON CONFLICT(key) DO UPDATE form is the one spelling SQLite accepts
      --   there. Migration 038 applies the same repair to the pre-existing
      --   triggers of 028/031, which had the identical latent bug on every
      --   table whose repository upserts through a conflict clause.
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_categories
      AFTER INSERT ON gear_categories
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_categories_upd
      AFTER UPDATE ON gear_categories
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_types
      AFTER INSERT ON gear_types
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_types_upd
      AFTER UPDATE ON gear_types
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_items
      AFTER INSERT ON gear_items
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_items_upd
      AFTER UPDATE ON gear_items
      BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
    `,
  },
  {
    id: '038_upsert_safe_dirty_triggers',
    description:
      'Recreates the sync_dirty triggers of 028/031/033 with the UPSERT-safe statement. The original form — INSERT OR REPLACE INTO app_meta — is silently fatal when the trigger fires from the DO UPDATE arm of an UPSERT: SQLite refuses to resolve any conflict inside such a trigger (even one the sub-statement would resolve itself with OR REPLACE/OR IGNORE) and aborts the OUTER statement with "SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key". That is not theoretical: CalendarRepository.upsert uses INSERT … ON CONFLICT(id) DO UPDATE on training_tasks, so editing any calendar task a SECOND time threw and the edit never reached the database or the cloud. Same for the Locker repositories added in 037. The fix is to spell the flag write as an explicit INSERT … ON CONFLICT(key) DO UPDATE, which SQLite allows from any context. Only the statement changes; the trigger names, the tables and the dirty semantics are identical, so no data or watermark is affected.',
    sql: `
      DROP TRIGGER IF EXISTS trg_dirty_solves;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves AFTER INSERT ON solves BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_solves_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_solves_upd AFTER UPDATE ON solves BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions AFTER INSERT ON sessions BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_sessions_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_sessions_upd AFTER UPDATE ON sessions BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_attempts;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_attempts AFTER INSERT ON training_attempts BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_attempts_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_attempts_upd AFTER UPDATE ON training_attempts BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_tasks;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_tasks AFTER INSERT ON training_tasks BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_tasks_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_tasks_upd AFTER UPDATE ON training_tasks BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_skill_progress;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_skill_progress AFTER INSERT ON skill_progress BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_skill_progress_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_skill_progress_upd AFTER UPDATE ON skill_progress BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_sessions;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_sessions AFTER INSERT ON training_sessions BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_training_sessions_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_training_sessions_upd AFTER UPDATE ON training_sessions BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_profiles;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_profiles AFTER INSERT ON profiles BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_profiles_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_profiles_upd AFTER UPDATE ON profiles BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
    `,
  },
  {
    id: '039_gear_trigger_self_heal',
    description:
      'Re-applies the six Locker dirty-flag triggers (037) with the UPSERT-safe statement. 037 shipped them in the safe form and 038 repaired every other table — but a device whose local database carries stale bodies under these same trigger names (e.g. created by a pre-release build) throws SQLITE_CONSTRAINT_PRIMARYKEY on the SECOND upsert of any gear row: SQLite refuses to resolve any conflict inside a trigger fired by the DO UPDATE arm of an UPSERT, even one the sub-statement would resolve itself. The outer statement aborts, the pull watermark never advances, and the whole sync fails on the same rows every cycle — the Locker on that device freezes with no rows, no refs and no photos, and the only evidence is a bare 1555. DROP + CREATE is idempotent: on a healthy database this migration is a no-op rewrite of identical triggers; on a stale one it heals the pull on next boot, and the stuck watermark re-fetches the missed rows by itself.',
    sql: `
      DROP TRIGGER IF EXISTS trg_dirty_gear_categories;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_categories AFTER INSERT ON gear_categories BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_gear_categories_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_categories_upd AFTER UPDATE ON gear_categories BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_gear_types;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_types AFTER INSERT ON gear_types BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_gear_types_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_types_upd AFTER UPDATE ON gear_types BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_gear_items;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_items AFTER INSERT ON gear_items BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
      DROP TRIGGER IF EXISTS trg_dirty_gear_items_upd;
      CREATE TRIGGER IF NOT EXISTS trg_dirty_gear_items_upd AFTER UPDATE ON gear_items BEGIN
        INSERT INTO app_meta (key, value) VALUES ('sync_dirty', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      END;
    `,
  },
];
