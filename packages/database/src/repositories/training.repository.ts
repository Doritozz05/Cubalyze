/**
 * @cubeforge/database — Training Repository
 *
 * Persists training attempts, algorithm progress, and exercise progress.
 * Follows the same pattern as SolvesRepository and SessionsRepository.
 */

import type { CubeMoveEvent } from "@cubeforge/types";

/** Generate a unique ID without external dependencies */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Row Types (snake_case, matching SQL schema) ──────────────────────────

export interface TrainingAttemptRow {
  id: string;
  exercise_id: string;
  method_id: string;
  phase_id: string | null;
  subset_id: string | null;
  case_id: string | null;
  scramble: string;
  time_ms: number;
  verdict: string;
  play_mode: string;
  expected_moves: string | null;
  executed_moves: string | null;
  tps: number | null;
  move_count: number | null;
  optimal_moves: number | null;
  rotation_count: number | null;
  inspection_ms: number | null;
  review_grade: string | null;
  timestamp: number;
}

export interface AlgorithmProgressRow {
  id: string;
  algorithm_id: string;
  mastery: number;
  accuracy: number;
  best_time_ms: number;
  avg_time_ms: number;
  total_attempts: number;
  correct_streak: number;
  last_practiced_at: number;
  srs_next_review_at: number;
  srs_interval_days: number;
  srs_ease_factor: number;
  recognition_accuracy: number;
  recognition_attempts: number;
  srs_stability: number;
  srs_difficulty: number;
  srs_state: string;
  srs_lapses: number;
  srs_review_count: number;
  last_review_at: number;
}

export interface ExerciseProgressRow {
  id: string;
  exercise_id: string;
  method_id: string;
  phase_id: string | null;
  total_sessions: number;
  total_attempts: number;
  best_accuracy: number;
  best_time_ms: number;
  avg_time_ms: number;
  last_practiced_at: number;
}

// ─── Domain Types (camelCase, for consumers) ──────────────────────────────

export interface TrainingAttempt {
  id: string;
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  caseId?: string;
  scramble: string;
  timeMs: number;
  verdict: "correct" | "incorrect" | "skipped" | "dnf";
  playMode: "manual" | "smart-cube";
  expectedMoves?: string[];
  executedMoves?: CubeMoveEvent[];
  tps?: number;
  moveCount?: number;
  optimalMoves?: number;
  rotationCount?: number;
  inspectionMs?: number;
  /** FSRS review grade (again|hard|good|easy) — set only by the review flow. */
  reviewGrade?: string;
  timestamp: number;
}

export interface AlgorithmProgress {
  id: string;
  algorithmId: string;
  mastery: number;
  accuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  totalAttempts: number;
  correctStreak: number;
  lastPracticedAt: number;
  srsNextReviewAt: number;
  srsIntervalDays: number;
  srsEaseFactor: number;
  recognitionAccuracy: number;
  recognitionAttempts: number;
  /** FSRS-lite: memory stability in days (0 = not yet FSRS-tracked). */
  srsStability: number;
  /** FSRS-lite: intrinsic difficulty 1-10. */
  srsDifficulty: number;
  /** FSRS-lite: new | learning | review | relearning. */
  srsState: "new" | "learning" | "review" | "relearning";
  /** FSRS-lite: total forgotten reviews. */
  srsLapses: number;
  /** FSRS-lite: total graded reviews. */
  srsReviewCount: number;
  /** Epoch ms of the last SRS review (≠ last_practiced_at). */
  lastReviewAt: number;
}

export interface ExerciseProgress {
  id: string;
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  totalSessions: number;
  totalAttempts: number;
  bestAccuracy: number;
  bestTimeMs: number;
  avgTimeMs: number;
  lastPracticedAt: number;
}

/** Per-phase aggregate stats derived from training_attempts. */
export interface PhaseStats {
  methodId: string;
  phaseId: string;
  totalAttempts: number;
  accuracy: number;      // 0-100
  avgTimeMs: number;
  bestTimeMs: number;
  failRate: number;      // 0-1
  efficiency: number;    // 0-1 (optimal_moves / move_count), 0 when unavailable
  lastPracticedAt: number;
}

// ─── Row ↔ Domain converters ──────────────────────────────────────────────

type DBExecutor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToAttempt(row: TrainingAttemptRow): TrainingAttempt {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    methodId: row.method_id,
    phaseId: row.phase_id ?? undefined,
    subsetId: row.subset_id ?? undefined,
    caseId: row.case_id ?? undefined,
    scramble: row.scramble,
    timeMs: row.time_ms,
    verdict: row.verdict as TrainingAttempt["verdict"],
    playMode: row.play_mode as TrainingAttempt["playMode"],
    expectedMoves: row.expected_moves ? JSON.parse(row.expected_moves) : undefined,
    executedMoves: row.executed_moves ? JSON.parse(row.executed_moves) : undefined,
    tps: row.tps ?? undefined,
    moveCount: row.move_count ?? undefined,
    optimalMoves: row.optimal_moves ?? undefined,
    rotationCount: row.rotation_count ?? undefined,
    inspectionMs: row.inspection_ms ?? undefined,
    reviewGrade: row.review_grade ?? undefined,
    timestamp: row.timestamp,
  };
}

function rowToAlgorithmProgress(row: AlgorithmProgressRow): AlgorithmProgress {
  return {
    id: row.id,
    algorithmId: row.algorithm_id,
    mastery: row.mastery,
    accuracy: row.accuracy,
    bestTimeMs: row.best_time_ms,
    avgTimeMs: row.avg_time_ms,
    totalAttempts: row.total_attempts,
    correctStreak: row.correct_streak,
    lastPracticedAt: row.last_practiced_at,
    srsNextReviewAt: row.srs_next_review_at,
    srsIntervalDays: row.srs_interval_days,
    srsEaseFactor: row.srs_ease_factor,
    recognitionAccuracy: row.recognition_accuracy ?? 0,
    recognitionAttempts: row.recognition_attempts ?? 0,
    srsStability: row.srs_stability ?? 0,
    srsDifficulty: row.srs_difficulty ?? 5,
    srsState: (row.srs_state ?? "new") as AlgorithmProgress["srsState"],
    srsLapses: row.srs_lapses ?? 0,
    srsReviewCount: row.srs_review_count ?? 0,
    lastReviewAt: row.last_review_at ?? 0,
  };
}

function rowToExerciseProgress(row: ExerciseProgressRow): ExerciseProgress {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    methodId: row.method_id,
    phaseId: row.phase_id ?? undefined,
    totalSessions: row.total_sessions,
    totalAttempts: row.total_attempts,
    bestAccuracy: row.best_accuracy,
    bestTimeMs: row.best_time_ms,
    avgTimeMs: row.avg_time_ms,
    lastPracticedAt: row.last_practiced_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────

export class TrainingRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  // ── Attempts ───────────────────────────────────────────────────────

  async insertAttempt(attempt: Omit<TrainingAttempt, "id">): Promise<TrainingAttempt> {
    const id = generateId();
    const row: TrainingAttemptRow = {
      id,
      exercise_id: attempt.exerciseId,
      method_id: attempt.methodId,
      phase_id: attempt.phaseId ?? null,
      subset_id: attempt.subsetId ?? null,
      case_id: attempt.caseId ?? null,
      scramble: attempt.scramble,
      time_ms: attempt.timeMs,
      verdict: attempt.verdict,
      play_mode: attempt.playMode,
      expected_moves: attempt.expectedMoves ? JSON.stringify(attempt.expectedMoves) : null,
      executed_moves: attempt.executedMoves ? JSON.stringify(attempt.executedMoves) : null,
      tps: attempt.tps ?? null,
      move_count: attempt.moveCount ?? null,
      optimal_moves: attempt.optimalMoves ?? null,
      rotation_count: attempt.rotationCount ?? null,
      inspection_ms: attempt.inspectionMs ?? null,
      review_grade: attempt.reviewGrade ?? null,
      timestamp: attempt.timestamp || Date.now(),
    };

    await this.db(
      `INSERT INTO training_attempts (id, exercise_id, method_id, phase_id, subset_id, case_id, scramble, time_ms, verdict, play_mode, expected_moves, executed_moves, tps, move_count, optimal_moves, rotation_count, inspection_ms, review_grade, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.exercise_id, row.method_id, row.phase_id, row.subset_id,
        row.case_id, row.scramble, row.time_ms, row.verdict, row.play_mode,
        row.expected_moves, row.executed_moves, row.tps, row.move_count,
        row.optimal_moves, row.rotation_count, row.inspection_ms, row.review_grade,
        row.timestamp,
      ],
    );

    return { ...attempt, id };
  }

  async getAttemptsByCase(caseId: string, limit = 50): Promise<TrainingAttempt[]> {
    const rows = await this.db(
      "SELECT * FROM training_attempts WHERE case_id = ? ORDER BY timestamp DESC LIMIT ?",
      [caseId, limit],
    );
    return rows.map((r) => rowToAttempt(r as unknown as TrainingAttemptRow));
  }

  async getAttemptsByExercise(exerciseId: string, limit = 50): Promise<TrainingAttempt[]> {
    const rows = await this.db(
      "SELECT * FROM training_attempts WHERE exercise_id = ? ORDER BY timestamp DESC LIMIT ?",
      [exerciseId, limit],
    );
    return rows.map((r) => rowToAttempt(r as unknown as TrainingAttemptRow));
  }

  async getAttemptsByMethod(methodId: string, limit = 200): Promise<TrainingAttempt[]> {
    const rows = await this.db(
      "SELECT * FROM training_attempts WHERE method_id = ? ORDER BY timestamp DESC LIMIT ?",
      [methodId, limit],
    );
    return rows.map((r) => rowToAttempt(r as unknown as TrainingAttemptRow));
  }

  async getAttemptsInRange(startTimestamp: number, endTimestamp: number): Promise<TrainingAttempt[]> {
    const rows = await this.db(
      "SELECT * FROM training_attempts WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
      [startTimestamp, endTimestamp],
    );
    return rows.map((r) => rowToAttempt(r as unknown as TrainingAttemptRow));
  }

  // ── Algorithm Progress ─────────────────────────────────────────────

  async getAlgorithmProgress(algorithmId: string): Promise<AlgorithmProgress | null> {
    const rows = await this.db(
      "SELECT * FROM algorithm_progress WHERE algorithm_id = ?",
      [algorithmId],
    );
    if (rows.length === 0) return null;
    return rowToAlgorithmProgress(rows[0] as unknown as AlgorithmProgressRow);
  }

  async upsertAlgorithmProgress(progress: Omit<AlgorithmProgress, "id">): Promise<AlgorithmProgress> {
    const existing = await this.getAlgorithmProgress(progress.algorithmId);
    if (existing) {
      await this.db(
        `UPDATE algorithm_progress SET mastery = ?, accuracy = ?, best_time_ms = ?, avg_time_ms = ?,
         total_attempts = ?, correct_streak = ?, last_practiced_at = ?,
         srs_next_review_at = ?, srs_interval_days = ?, srs_ease_factor = ?,
         recognition_accuracy = ?, recognition_attempts = ?,
         srs_stability = ?, srs_difficulty = ?, srs_state = ?, srs_lapses = ?,
         srs_review_count = ?, last_review_at = ?
         WHERE algorithm_id = ?`,
        [
          progress.mastery, progress.accuracy, progress.bestTimeMs, progress.avgTimeMs,
          progress.totalAttempts, progress.correctStreak, progress.lastPracticedAt,
          progress.srsNextReviewAt, progress.srsIntervalDays, progress.srsEaseFactor,
          progress.recognitionAccuracy, progress.recognitionAttempts,
          progress.srsStability, progress.srsDifficulty, progress.srsState,
          progress.srsLapses, progress.srsReviewCount, progress.lastReviewAt,
          progress.algorithmId,
        ],
      );
      return { ...progress, id: existing.id };
    } else {
      const id = generateId();
      await this.db(
        `INSERT INTO algorithm_progress (id, algorithm_id, mastery, accuracy, best_time_ms, avg_time_ms,
         total_attempts, correct_streak, last_practiced_at, srs_next_review_at, srs_interval_days, srs_ease_factor,
         recognition_accuracy, recognition_attempts, srs_stability, srs_difficulty, srs_state,
         srs_lapses, srs_review_count, last_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, progress.algorithmId, progress.mastery, progress.accuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.totalAttempts,
          progress.correctStreak, progress.lastPracticedAt,
          progress.srsNextReviewAt, progress.srsIntervalDays, progress.srsEaseFactor,
          progress.recognitionAccuracy, progress.recognitionAttempts,
          progress.srsStability, progress.srsDifficulty, progress.srsState,
          progress.srsLapses, progress.srsReviewCount, progress.lastReviewAt,
        ],
      );
      return { ...progress, id };
    }
  }

  async getAlgorithmProgressBySubset(subsetId: string): Promise<AlgorithmProgress[]> {
    // Join with algorithm DB data — simpler approach: get all progress and filter
    const rows = await this.db(
      `SELECT ap.* FROM algorithm_progress ap
       INNER JOIN algorithm_cases ac ON ap.algorithm_id = ac.id
       WHERE ac.subset_id = ?
       ORDER BY ap.mastery ASC`,
      [subsetId],
    );
    return rows.map((r) => rowToAlgorithmProgress(r as unknown as AlgorithmProgressRow));
  }

  async getWeakestAlgorithms(subsetId: string, limit = 5): Promise<AlgorithmProgress[]> {
    const rows = await this.db(
      `SELECT ap.* FROM algorithm_progress ap
       INNER JOIN algorithm_cases ac ON ap.algorithm_id = ac.id
       WHERE ac.subset_id = ?
       ORDER BY ap.mastery ASC, ap.last_practiced_at ASC
       LIMIT ?`,
      [subsetId, limit],
    );
    return rows.map((r) => rowToAlgorithmProgress(r as unknown as AlgorithmProgressRow));
  }

  async getDueForReview(limit = 20): Promise<AlgorithmProgress[]> {
    const now = Date.now();
    const rows = await this.db(
      "SELECT * FROM algorithm_progress WHERE srs_next_review_at > 0 AND srs_next_review_at <= ? ORDER BY mastery ASC LIMIT ?",
      [now, limit],
    );
    return rows.map((r) => rowToAlgorithmProgress(r as unknown as AlgorithmProgressRow));
  }

  // ── Exercise Progress ──────────────────────────────────────────────

  async getExerciseProgress(
    exerciseId: string,
    methodId: string,
    phaseId?: string,
  ): Promise<ExerciseProgress | null> {
    let sql = "SELECT * FROM exercise_progress WHERE exercise_id = ? AND method_id = ?";
    const bind: unknown[] = [exerciseId, methodId];
    if (phaseId) {
      sql += " AND phase_id = ?";
      bind.push(phaseId);
    } else {
      sql += " AND phase_id IS NULL";
    }
    const rows = await this.db(sql, bind);
    if (rows.length === 0) return null;
    return rowToExerciseProgress(rows[0] as unknown as ExerciseProgressRow);
  }

  async upsertExerciseProgress(progress: Omit<ExerciseProgress, "id">): Promise<ExerciseProgress> {
    const existing = await this.getExerciseProgress(
      progress.exerciseId,
      progress.methodId,
      progress.phaseId,
    );
    if (existing) {
      await this.db(
        `UPDATE exercise_progress SET total_sessions = ?, total_attempts = ?, best_accuracy = ?,
         best_time_ms = ?, avg_time_ms = ?, last_practiced_at = ?
         WHERE id = ?`,
        [
          progress.totalSessions, progress.totalAttempts, progress.bestAccuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.lastPracticedAt,
          existing.id,
        ],
      );
      return { ...progress, id: existing.id };
    } else {
      const id = generateId();
      await this.db(
        `INSERT INTO exercise_progress (id, exercise_id, method_id, phase_id, total_sessions,
         total_attempts, best_accuracy, best_time_ms, avg_time_ms, last_practiced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, progress.exerciseId, progress.methodId, progress.phaseId ?? null,
          progress.totalSessions, progress.totalAttempts, progress.bestAccuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.lastPracticedAt,
        ],
      );
      return { ...progress, id };
    }
  }

  async getMethodExerciseProgress(methodId: string): Promise<ExerciseProgress[]> {
    const rows = await this.db(
      "SELECT * FROM exercise_progress WHERE method_id = ? ORDER BY last_practiced_at DESC",
      [methodId],
    );
    return rows.map((r) => rowToExerciseProgress(r as unknown as ExerciseProgressRow));
  }

  // ── Aggregates ─────────────────────────────────────────────────────

  async getMethodMastery(methodId: string): Promise<number> {
    const rows = await this.db(
      `SELECT COALESCE(AVG(mastery), 0) as avg_mastery FROM algorithm_progress ap
       INNER JOIN algorithm_cases ac ON ap.algorithm_id = ac.id
       INNER JOIN algorithm_subsets as2 ON ac.subset_id = as2.id
       WHERE as2.method_id = ?`,
      [methodId],
    );
    return Math.round((rows[0] as { avg_mastery: number }).avg_mastery);
  }

  async getMethodBestTime(methodId: string): Promise<number> {
    // Best full solve time from solves table for this method
    const rows = await this.db(
      "SELECT MIN(time_ms) as best FROM solves WHERE method = ? AND penalty = 'none'",
      [methodId],
    );
    return (rows[0] as { best: number | null }).best ?? 0;
  }

  // ── Phase Stats ────────────────────────────────────────────────────

  /**
   * Aggregate per-phase stats from training_attempts. Used for
   * phase-level weakness detection (avg time, accuracy, efficiency).
   */
  async getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStats | null> {
    const rows = await this.db(
      `SELECT
         COUNT(*) as total_attempts,
         AVG(CASE WHEN verdict = 'correct' THEN 1.0 ELSE 0 END) as accuracy,
         AVG(CASE WHEN time_ms > 0 THEN time_ms END) as avg_time_ms,
         MIN(CASE WHEN time_ms > 0 THEN time_ms END) as best_time_ms,
         AVG(CASE WHEN verdict IN ('incorrect', 'dnf') THEN 1.0 ELSE 0 END) as fail_rate,
         AVG(CASE WHEN optimal_moves > 0 AND move_count > 0 THEN optimal_moves * 1.0 / move_count END) as efficiency,
         MAX(timestamp) as last_practiced_at
       FROM training_attempts
       WHERE method_id = ? AND phase_id = ?`,
      [methodId, phaseId],
    );
    const r = rows[0] as Record<string, unknown>;
    if (!r || Number(r.total_attempts) === 0) return null;
    return {
      methodId,
      phaseId,
      totalAttempts: Number(r.total_attempts),
      accuracy: Math.round((Number(r.accuracy) || 0) * 100),
      avgTimeMs: Math.round(Number(r.avg_time_ms) || 0),
      bestTimeMs: Math.round(Number(r.best_time_ms) || 0),
      failRate: Number(r.fail_rate) || 0,
      efficiency: Number(r.efficiency) || 0,
      lastPracticedAt: Number(r.last_practiced_at) || 0,
    };
  }
}
