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
];
