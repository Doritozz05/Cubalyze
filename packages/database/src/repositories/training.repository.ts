/**
 * @cubeforge/database — Training Repository
 *
 * Persists training attempts, algorithm progress, and exercise progress.
 * Follows the same pattern as SolvesRepository and SessionsRepository.
 */

import type { CubeMoveEvent } from "@cubeforge/types";
import { buildExerciseCatalog } from "@cubeforge/training";
import type {
  AlgorithmProgressRecord,
  ExerciseProgressRecord,
  MethodProgressBreakdown,
  PhaseStatsRecord,
  QueueCandidateRecord,
  TrainingSessionProgressRecord,
} from "@cubeforge/training";
import { withTransaction } from "./transaction.js";

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
  session_id: string | null;
  metric_kind: string | null;
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
  exec_attempts: number;
  exec_correct: number;
  correct_streak: number;
  recognition_accuracy: number;
  recognition_attempts: number;
  recognition_correct: number;
  recognition_streak: number;
  last_practiced_at: number;
  srs_next_review_at: number;
  srs_interval_days: number;
  srs_ease_factor: number;
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
  exec_attempts: number;
  exec_correct: number;
  best_accuracy: number;
  best_time_ms: number;
  avg_time_ms: number;
  last_practiced_at: number;
}

// ─── Domain Types (camelCase, for consumers) ──────────────────────────────
// Single source of truth: the record shapes come from @cubeforge/training.
// The DB layer only adds its internal row `id` where the domain omits it.
// (TrainingAttempt keeps its DB-only optional fields — subsetId, expectedMoves,
// executedMoves, inspectionMs — which the pure tracker does not model.)

export type AlgorithmProgress = AlgorithmProgressRecord & { id: string };
export type ExerciseProgress = ExerciseProgressRecord & { id: string };
export type TrainingSessionRecord = TrainingSessionProgressRecord;
export type PhaseStats = PhaseStatsRecord;
export type QueueCandidate = QueueCandidateRecord;

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
  /** Whether this attempt measures execution or recognition. */
  metricKind?: "execution" | "recognition";
  /** Logical training session grouping this attempt. */
  sessionId?: string;
  timestamp: number;
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
    metricKind: row.metric_kind === "recognition" ? "recognition" : "execution",
    sessionId: row.session_id ?? undefined,
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
    execAttempts: row.exec_attempts ?? 0,
    execCorrect: row.exec_correct ?? 0,
    correctStreak: row.correct_streak,
    lastPracticedAt: row.last_practiced_at,
    srsNextReviewAt: row.srs_next_review_at,
    srsIntervalDays: row.srs_interval_days,
    srsEaseFactor: row.srs_ease_factor,
    recognitionAccuracy: row.recognition_accuracy ?? 0,
    recognitionAttempts: row.recognition_attempts ?? 0,
    recognitionCorrect: row.recognition_correct ?? 0,
    recognitionStreak: row.recognition_streak ?? 0,
    srsStability: row.srs_stability ?? 0,
    srsDifficulty: row.srs_difficulty ?? 5,
    srsState: (row.srs_state ?? "new") as AlgorithmProgress["srsState"],
    srsLapses: row.srs_lapses ?? 0,
    srsReviewCount: row.srs_review_count ?? 0,
    lastReviewAt: row.last_review_at ?? 0,
  };
}

function rowToTrainingSession(row: Record<string, unknown>): TrainingSessionRecord {
  const startedAt = Number(row.started_at) || 0;
  const completedAt = row.completed_at == null ? undefined : Number(row.completed_at);
  const totalAttempts = Number(row.total_attempts) || 0;
  const correctCount = Number(row.correct_count) || 0;
  return {
    id: String(row.id),
    exerciseId: String(row.exercise_id),
    methodId: String(row.method_id),
    phaseId: row.phase_id == null ? undefined : String(row.phase_id),
    subsetId: row.subset_id == null ? undefined : String(row.subset_id),
    startedAt,
    completedAt,
    durationMs: Number(row.duration_ms) || (completedAt ? completedAt - startedAt : 0),
    smartCubeUsed: Boolean(Number(row.smart_cube_used)),
    status: row.status === "completed" ? "completed" : "active",
    totalAttempts,
    correctCount,
    accuracy: totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0,
    avgTimeMs: Math.round(Number(row.avg_time_ms) || 0),
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
    execAttempts: row.exec_attempts ?? 0,
    execCorrect: row.exec_correct ?? 0,
    bestAccuracy: row.best_accuracy,
    bestTimeMs: row.best_time_ms,
    avgTimeMs: row.avg_time_ms,
    lastPracticedAt: row.last_practiced_at,
  };
}

function rowToQueueCandidate(row: Record<string, unknown>): QueueCandidate {
  const hasProgress = row.algorithm_id !== undefined && row.algorithm_id !== null;
  return {
    caseId: String(row.case_id),
    subsetId: String(row.subset_id),
    caseNumber: String(row.case_number),
    caseName: String(row.case_name ?? ""),
    methodId: String(row.method_id ?? ""),
    subsetName: String(row.subset_name ?? ""),
    progress: hasProgress ? rowToAlgorithmProgress(row as unknown as AlgorithmProgressRow) : null,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────

export class TrainingRepository {
  private db: DBExecutor;

  constructor(db: DBExecutor) {
    this.db = db;
  }

  // ── Exercise catalog registry ─────────────────────────────────────

  /**
   * Seed `training_exercises` from the canonical catalog in
   * @cubeforge/training (idempotent INSERT OR IGNORE, batched so the
   * worker boundary is crossed a handful of times, mirroring
   * AlgorithmsRepository.seedAll).
   *
   * The table is informational (the baseline v2 schema deliberately kept
   * training_attempts.exercise_id FK-free so legacy/edge ids can't crash
   * writes) but it is the canonical registry the UI can query to discover
   * the real exercise ids instead of hardcoding them.
   */
  async seedExercises(): Promise<number> {
    const defs = buildExerciseCatalog();
    const now = Date.now();
    const BATCH = 40; // 6 cols × 40 rows = 240 bind vars, well under SQLite's 999
    for (let i = 0; i < defs.length; i += BATCH) {
      const rows = defs.slice(i, i + BATCH);
      const values = rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const bind: unknown[] = [];
      for (const d of rows) {
        bind.push(d.id, d.name, d.description, d.kind, d.methodId ?? null, now);
      }
      await this.db(
        `INSERT OR IGNORE INTO training_exercises (id, name, description, kind, method_id, created_at)
         VALUES ${values}`,
        bind,
      );
    }
    return defs.length;
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
      session_id: attempt.sessionId ?? null,
      metric_kind: attempt.metricKind ?? "execution",
      timestamp: attempt.timestamp || Date.now(),
    };

    await this.db(
      `INSERT INTO training_attempts (id, exercise_id, method_id, phase_id, subset_id, case_id, scramble, time_ms, verdict, play_mode, expected_moves, executed_moves, tps, move_count, optimal_moves, rotation_count, inspection_ms, review_grade, session_id, metric_kind, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.exercise_id, row.method_id, row.phase_id, row.subset_id,
        row.case_id, row.scramble, row.time_ms, row.verdict, row.play_mode,
        row.expected_moves, row.executed_moves, row.tps, row.move_count,
        row.optimal_moves, row.rotation_count, row.inspection_ms, row.review_grade,
        row.session_id, row.metric_kind, row.timestamp,
      ],
    );

    return { ...attempt, id };
  }

  /**
   * Stamp the FSRS review grade onto the most recent attempt for a case.
   * The SRS review flow records recognition/execution attempts *before* the
   * user picks a grade, so the grade is attached afterwards to link the
   * attempt history to the FSRS schedule that recordReview computed.
   */
  async updateAttemptReviewGrade(caseId: string, reviewGrade: string): Promise<void> {
    await this.db(
      `UPDATE training_attempts SET review_grade = ?
       WHERE id = (SELECT id FROM training_attempts WHERE case_id = ? ORDER BY timestamp DESC LIMIT 1)`,
      [reviewGrade, caseId],
    );
  }

  async createTrainingSession(session: Omit<TrainingSessionRecord, "completedAt" | "durationMs" | "status" | "totalAttempts" | "correctCount" | "accuracy" | "avgTimeMs">): Promise<TrainingSessionRecord> {
    const record: TrainingSessionRecord = {
      ...session,
      durationMs: 0,
      status: "active",
      totalAttempts: 0,
      correctCount: 0,
      accuracy: 0,
      avgTimeMs: 0,
    };
    await this.db(
      `INSERT OR IGNORE INTO training_sessions (id, exercise_id, method_id, phase_id, subset_id, started_at, smart_cube_used, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.exerciseId, record.methodId, record.phaseId ?? null, record.subsetId ?? null, record.startedAt, record.smartCubeUsed ? 1 : 0, record.status],
    );
    return record;
  }

  async completeTrainingSession(id: string, completedAt = Date.now()): Promise<TrainingSessionRecord | null> {
    // The close (UPDATE) and the derived-aggregate read (SELECT) are atomic
    // so a session can never be closed without its final stats.
    return withTransaction(this.db, async () => {
      await this.db(
        `UPDATE training_sessions SET completed_at = ?, duration_ms = ? - started_at, status = 'completed' WHERE id = ?`,
        [completedAt, completedAt, id],
      );
      const rows = await this.db(
        `SELECT ts.*, COUNT(ta.id) AS total_attempts,
           SUM(CASE WHEN ta.verdict = 'correct' THEN 1 ELSE 0 END) AS correct_count,
           AVG(CASE WHEN ta.time_ms > 0 THEN ta.time_ms END) AS avg_time_ms
         FROM training_sessions ts LEFT JOIN training_attempts ta ON ta.session_id = ts.id
         WHERE ts.id = ? GROUP BY ts.id`,
        [id],
      );
      if (rows.length === 0) return null;
      return rowToTrainingSession(rows[0]);
    });
  }

  async getTrainingSessions(methodId: string, phaseId?: string, limit = 50): Promise<TrainingSessionRecord[]> {
    // SRS started from the global queue uses method_id = 'all', while each
    // attempt still carries its real method. Include those sessions but only
    // aggregate attempts for the requested method, avoiding cross-method
    // history duplication.
    const where = phaseId
      ? "(ts.method_id = ? OR ts.method_id = 'all') AND ts.phase_id = ?"
      : "(ts.method_id = ? OR ts.method_id = 'all')";
    const bind: unknown[] = phaseId
      ? [methodId, methodId, phaseId, limit]
      : [methodId, methodId, limit];
    const rows = await this.db(
      `SELECT ts.*, COUNT(ta.id) AS total_attempts,
         SUM(CASE WHEN ta.verdict = 'correct' THEN 1 ELSE 0 END) AS correct_count,
         AVG(CASE WHEN ta.time_ms > 0 THEN ta.time_ms END) AS avg_time_ms
       FROM training_sessions ts LEFT JOIN training_attempts ta
         ON ta.session_id = ts.id AND ta.method_id = ?
       WHERE ${where} AND ts.status = 'completed'
       GROUP BY ts.id ORDER BY ts.started_at DESC LIMIT ?`,
      bind,
    );
    return rows.map(rowToTrainingSession);
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

  async upsertAlgorithmProgress(progress: AlgorithmProgressRecord): Promise<AlgorithmProgress> {
    // Read-modify-write is atomic: the read and the write share one
    // transaction, so a concurrent attempt can never be lost between them.
    return withTransaction(this.db, async () => {
    const existing = await this.getAlgorithmProgress(progress.algorithmId);
    if (existing) {
      await this.db(
        `UPDATE algorithm_progress SET mastery = ?, accuracy = ?, best_time_ms = ?, avg_time_ms = ?,
         total_attempts = ?, exec_attempts = ?, exec_correct = ?, correct_streak = ?,
         last_practiced_at = ?,
         srs_next_review_at = ?, srs_interval_days = ?, srs_ease_factor = ?,
         recognition_accuracy = ?, recognition_attempts = ?, recognition_correct = ?,
         recognition_streak = ?,
         srs_stability = ?, srs_difficulty = ?, srs_state = ?, srs_lapses = ?,
         srs_review_count = ?, last_review_at = ?
         WHERE algorithm_id = ?`,
        [
          progress.mastery, progress.accuracy, progress.bestTimeMs, progress.avgTimeMs,
          progress.totalAttempts, progress.execAttempts, progress.execCorrect,
          progress.correctStreak, progress.lastPracticedAt,
          progress.srsNextReviewAt, progress.srsIntervalDays, progress.srsEaseFactor,
          progress.recognitionAccuracy, progress.recognitionAttempts,
          progress.recognitionCorrect, progress.recognitionStreak,
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
         total_attempts, exec_attempts, exec_correct, correct_streak, last_practiced_at,
         srs_next_review_at, srs_interval_days, srs_ease_factor,
         recognition_accuracy, recognition_attempts, recognition_correct, recognition_streak,
         srs_stability, srs_difficulty, srs_state,
         srs_lapses, srs_review_count, last_review_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, progress.algorithmId, progress.mastery, progress.accuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.totalAttempts,
          progress.execAttempts, progress.execCorrect, progress.correctStreak,
          progress.lastPracticedAt,
          progress.srsNextReviewAt, progress.srsIntervalDays, progress.srsEaseFactor,
          progress.recognitionAccuracy, progress.recognitionAttempts,
          progress.recognitionCorrect, progress.recognitionStreak,
          progress.srsStability, progress.srsDifficulty, progress.srsState,
          progress.srsLapses, progress.srsReviewCount, progress.lastReviewAt,
        ],
      );
      return { ...progress, id };
    }
    });
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
      "SELECT * FROM algorithm_progress WHERE srs_next_review_at > 0 AND srs_next_review_at <= ? ORDER BY srs_next_review_at ASC LIMIT ?",
      [now, limit],
    );
    return rows.map((r) => rowToAlgorithmProgress(r as unknown as AlgorithmProgressRow));
  }

  /**
   * Enumerate every algorithm case in the catalog (optionally filtered by
   * method) with its FSRS progress LEFT JOINed.
   *
   * Never-practiced cases come back with `progress === null` — this is the
   * H1 fix that lets the SRS queue include brand-new cases, not only the ones
   * that already have an algorithm_progress row.
   */
  async getQueueCandidates(methodId?: string): Promise<QueueCandidate[]> {
    const sql = `
      SELECT
        ac.id AS case_id,
        ac.subset_id,
        ac.case_number,
        ac.name AS case_name,
        as2.method_id,
        as2.name AS subset_name,
        ap.id AS id,
        ap.algorithm_id,
        ap.mastery,
        ap.accuracy,
        ap.best_time_ms,
        ap.avg_time_ms,
        ap.total_attempts,
        ap.exec_attempts,
        ap.exec_correct,
        ap.correct_streak,
        ap.last_practiced_at,
        ap.srs_next_review_at,
        ap.srs_interval_days,
        ap.srs_ease_factor,
        ap.recognition_accuracy,
        ap.recognition_attempts,
        ap.recognition_correct,
        ap.recognition_streak,
        ap.srs_stability,
        ap.srs_difficulty,
        ap.srs_state,
        ap.srs_lapses,
        ap.srs_review_count,
        ap.last_review_at
      FROM algorithm_cases ac
      INNER JOIN algorithm_subsets as2 ON ac.subset_id = as2.id
      LEFT JOIN algorithm_progress ap ON ap.algorithm_id = ac.id
      ${methodId ? "WHERE as2.method_id = ?" : ""}
      ORDER BY ac.case_number ASC
    `;
    const rows = await this.db(sql, methodId ? [methodId] : []);
    return rows.map((r) => rowToQueueCandidate(r as unknown as Record<string, unknown>));
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

  async upsertExerciseProgress(progress: ExerciseProgressRecord): Promise<ExerciseProgress> {
    return withTransaction(this.db, async () => {
    const existing = await this.getExerciseProgress(
      progress.exerciseId,
      progress.methodId,
      progress.phaseId,
    );
    if (existing) {
      await this.db(
        `UPDATE exercise_progress SET total_sessions = ?, total_attempts = ?, exec_attempts = ?,
         exec_correct = ?, best_accuracy = ?,
         best_time_ms = ?, avg_time_ms = ?, last_practiced_at = ?
         WHERE id = ?`,
        [
          progress.totalSessions, progress.totalAttempts, progress.execAttempts,
          progress.execCorrect, progress.bestAccuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.lastPracticedAt,
          existing.id,
        ],
      );
      return { ...progress, id: existing.id };
    } else {
      const id = generateId();
      await this.db(
        `INSERT INTO exercise_progress (id, exercise_id, method_id, phase_id, total_sessions,
         total_attempts, exec_attempts, exec_correct, best_accuracy, best_time_ms, avg_time_ms,
         last_practiced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, progress.exerciseId, progress.methodId, progress.phaseId ?? null,
          progress.totalSessions, progress.totalAttempts, progress.execAttempts,
          progress.execCorrect, progress.bestAccuracy,
          progress.bestTimeMs, progress.avgTimeMs, progress.lastPracticedAt,
        ],
      );
      return { ...progress, id };
    }
    });
  }

  async getMethodExerciseProgress(methodId: string): Promise<ExerciseProgress[]> {
    const rows = await this.db(
      "SELECT * FROM exercise_progress WHERE method_id = ? ORDER BY last_practiced_at DESC",
      [methodId],
    );
    return rows.map((r) => rowToExerciseProgress(r as unknown as ExerciseProgressRow));
  }

  // ── Aggregates ─────────────────────────────────────────────────────

  /**
   * Method mastery with an explicit coverage × performance breakdown:
   *   - coverage: practiced cases / total cases (breadth)
   *   - performance: average mastery of PRACTICED cases (depth)
   *   - mastery = round(performance × coverage) — identical to the historical
   *     AVG(COALESCE(mastery, 0)) over all cases, now computed explicitly so
   *     the UI can display breadth and depth separately.
   */
  async getMethodProgress(methodId: string): Promise<MethodProgressBreakdown | null> {
    const rows = await this.db(
      `SELECT
         COUNT(*) AS total_cases,
         SUM(CASE WHEN ap.algorithm_id IS NOT NULL THEN 1 ELSE 0 END) AS practiced_cases,
         COALESCE(AVG(CASE WHEN ap.algorithm_id IS NOT NULL THEN ap.mastery END), 0) AS performance
       FROM algorithm_cases ac
       INNER JOIN algorithm_subsets as2 ON ac.subset_id = as2.id
       LEFT JOIN algorithm_progress ap ON ap.algorithm_id = ac.id
       WHERE as2.method_id = ?`,
      [methodId],
    );
    const r = rows[0] as Record<string, unknown>;
    if (!r) return null;
    const totalCases = Number(r.total_cases) || 0;
    const practicedCases = Number(r.practiced_cases) || 0;
    const performance = Number(r.performance) || 0;
    const coverage = totalCases > 0 ? practicedCases / totalCases : 0;
    return {
      methodId,
      mastery: Math.round(performance * coverage),
      coverage,
      performance: Math.round(performance),
      totalCases,
      practicedCases,
    };
  }

  async getMethodMastery(methodId: string): Promise<number> {
    const progress = await this.getMethodProgress(methodId);
    return progress?.mastery ?? 0;
  }

  // ── Reset / Maintenance ────────────────────────────────────────────

  /**
   * Delete ALL training progress data: attempts, per-case SRS/progress rows,
   * exercise aggregates and training sessions. Nothing else in the app clears
   * these tables, so this is the only way to reset the SRS from scratch
   * (exposed as the `window.clearTrainingData()` dev console helper).
   * Solves/sessions are intentionally left untouched.
   */
  async clearAllData(): Promise<void> {
    await this.db('DELETE FROM training_attempts');
    await this.db('DELETE FROM algorithm_progress');
    await this.db('DELETE FROM exercise_progress');
    await this.db('DELETE FROM training_sessions');
  }

  // ── Phase Stats ────────────────────────────────────────────────────

  /**
   * Aggregate per-phase stats from training_attempts. Used for
   * phase-level weakness detection (avg time, accuracy, efficiency).
   *
   * Execution and recognition are counted SEPARATELY: `accuracy` (and
   * `execAccuracy`) is execution-only, so recognition quizzes can never
   * dilute the drill % a user sees. Recognition attempts still count toward
   * `totalAttempts`/`recAttempts`/`recAccuracy`. Rows with verdict
   * 'skipped' (e.g. honest Full Solve phase splits — real timing, no
   * correctness verdict) are EXCLUDED from the exec/rec denominators so
   * they can never dilute accuracy or fail rate. Time and efficiency
   * aggregates are guarded (time_ms > 0 / optimal_moves > 0) so recognition
   * rows with time_ms=0 never corrupt them.
   */
  async getPhaseStats(methodId: string, phaseId: string): Promise<PhaseStats | null> {
    const rows = await this.db(
      `SELECT
         COUNT(*) as total_attempts,
         SUM(CASE WHEN metric_kind = 'execution' AND verdict != 'skipped' THEN 1 ELSE 0 END) as exec_attempts,
         SUM(CASE WHEN metric_kind = 'execution' AND verdict = 'correct' THEN 1 ELSE 0 END) as exec_correct,
         SUM(CASE WHEN metric_kind = 'recognition' AND verdict != 'skipped' THEN 1 ELSE 0 END) as rec_attempts,
         SUM(CASE WHEN metric_kind = 'recognition' AND verdict = 'correct' THEN 1 ELSE 0 END) as rec_correct,
         AVG(CASE WHEN time_ms > 0 THEN time_ms END) as avg_time_ms,
         MIN(CASE WHEN time_ms > 0 THEN time_ms END) as best_time_ms,
         SUM(CASE WHEN metric_kind = 'execution' AND verdict IN ('incorrect', 'dnf') THEN 1 ELSE 0 END) as exec_failures,
         AVG(CASE WHEN optimal_moves > 0 AND move_count > 0 THEN optimal_moves * 1.0 / move_count END) as efficiency,
         MAX(timestamp) as last_practiced_at
       FROM training_attempts
       WHERE method_id = ? AND phase_id = ?`,
      [methodId, phaseId],
    );
    const r = rows[0] as Record<string, unknown>;
    if (!r || Number(r.total_attempts) === 0) return null;
    const execAttempts = Number(r.exec_attempts) || 0;
    const execCorrect = Number(r.exec_correct) || 0;
    const recAttempts = Number(r.rec_attempts) || 0;
    const recCorrect = Number(r.rec_correct) || 0;
    const execAccuracy = execAttempts > 0 ? Math.round((execCorrect / execAttempts) * 100) : 0;
    const recAccuracy = recAttempts > 0 ? Math.round((recCorrect / recAttempts) * 100) : 0;
    return {
      methodId,
      phaseId,
      totalAttempts: Number(r.total_attempts),
      accuracy: execAccuracy,
      execAttempts,
      execAccuracy,
      recAttempts,
      recAccuracy,
      avgTimeMs: Math.round(Number(r.avg_time_ms) || 0),
      bestTimeMs: Math.round(Number(r.best_time_ms) || 0),
      // Fail rate is execution-only: failures / execution attempts. Recognition
      // rows (all correct, no time) must never dilute the drill failure signal.
      failRate: execAttempts > 0 ? (Number(r.exec_failures) || 0) / execAttempts : 0,
      efficiency: Number(r.efficiency) || 0,
      lastPracticedAt: Number(r.last_practiced_at) || 0,
    };
  }
}
