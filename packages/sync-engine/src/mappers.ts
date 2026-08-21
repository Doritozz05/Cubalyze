/**
 * Mappers between the local domain types and the cloud table rows.
 *
 * Cloud tables mirror the local SQL columns 1:1 (snake_case) plus a
 * `user_id` partition column. PostgREST serializes bigint columns as JSON
 * strings, so every reader coerces with Number()/String() defensively.
 */

import type { Profile, Session, Solve } from "@cubeforge/models";
import type { TrainingAttempt, TrainingTask } from "@cubeforge/database";
import type { TrainingSessionProgressRecord } from "@cubeforge/training";

export type CloudRow = Record<string, unknown>;

export interface SkillCloudRow {
  user_id: string;
  skill_id: string;
  completed_at: number;
}

/**
 * Cloud bigint columns reject floats (StackMat times arrive as 112.729…ms),
 * so every value mapped onto a bigint column is rounded to a whole number
 * here. Null is preserved (nullable bigint columns like inspection_ms).
 * Local SQLite keeps the full float precision; only the cloud copy rounds.
 */
const b = (v: unknown): number | null =>
  v == null ? null : Math.round(Number(v));

// ─── Solves ───────────────────────────────────────────────────────────────

export function solveToCloudRow(solve: Solve, userId: string): CloudRow {
  return {
    user_id: userId,
    id: solve.id,
    session_id: solve.sessionId,
    time_ms: b(solve.timeMs) ?? 0,
    timestamp: b(solve.timestamp) ?? 0,
    scramble: solve.scramble ?? "",
    penalty: solve.penalty ?? "none",
    method: solve.method ?? null,
    source: solve.source ?? "manual",
    note: solve.note ?? null,
    moves: JSON.stringify(solve.moves ?? []),
    orientation_timeline: solve.orientationTimeline
      ? JSON.stringify(solve.orientationTimeline)
      : null,
    analysis_engine_version: solve.analysisEngineVersion ?? null,
    analysis: solve.analysis ?? null,
    puzzle_type: solve.puzzleType ?? "333",
    is_demo: 0,
    created_at: b(solve.createdAt ?? solve.timestamp) ?? 0,
    updated_at: b(solve.updatedAt ?? solve.createdAt ?? solve.timestamp) ?? 0,
  };
}

export function cloudRowToSolve(row: CloudRow): Solve {
  let moves: Solve["moves"] = [];
  if (typeof row.moves === "string") {
    try {
      const parsed = JSON.parse(row.moves);
      if (Array.isArray(parsed)) moves = parsed;
    } catch {
      moves = [];
    }
  }
  let orientationTimeline: Solve["orientationTimeline"];
  if (typeof row.orientation_timeline === "string") {
    try {
      const parsed = JSON.parse(row.orientation_timeline);
      if (Array.isArray(parsed)) orientationTimeline = parsed;
    } catch {
      orientationTimeline = undefined;
    }
  }
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    timeMs: Number(row.time_ms) || 0,
    timestamp: Number(row.timestamp) || 0,
    scramble: String(row.scramble ?? ""),
    penalty: String(row.penalty ?? "none") as Solve["penalty"],
    method: row.method == null ? undefined : String(row.method),
    source: String(row.source ?? "manual") as Solve["source"],
    note: row.note == null ? undefined : String(row.note),
    moves,
    orientationTimeline,
    analysisEngineVersion:
      row.analysis_engine_version == null
        ? undefined
        : String(row.analysis_engine_version),
    analysis: row.analysis == null ? undefined : String(row.analysis),
    puzzleType: row.puzzle_type == null ? undefined : String(row.puzzle_type),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Sessions ─────────────────────────────────────────────────────────────

export function sessionToCloudRow(session: Session, userId: string): CloudRow {
  return {
    user_id: userId,
    id: session.id,
    name: session.name,
    puzzle_type: session.puzzleType,
    created_at: b(session.createdAt) ?? 0,
    updated_at: b(session.updatedAt ?? session.createdAt) ?? 0,
    is_demo: 0,
  };
}

export function cloudRowToSession(row: CloudRow): Session {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    puzzleType: String(row.puzzle_type ?? "333"),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Profiles ─────────────────────────────────────────────────────────────

export function profileToCloudRow(profile: Profile, userId: string): CloudRow {
  return {
    user_id: userId,
    display_name: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    avatar_kind: profile.avatarKind,
    avatar_data: profile.avatarData ?? null,
    main_puzzle: profile.mainPuzzle,
    declared_methods: JSON.stringify(profile.declaredMethods ?? []),
    country: profile.country ?? "",
    created_at: b(profile.createdAt) ?? 0,
    updated_at: b(profile.updatedAt) ?? 0,
  };
}

export function cloudRowToProfile(row: CloudRow): Profile {
  let declaredMethods: string[] = [];
  if (typeof row.declared_methods === "string") {
    try {
      const parsed = JSON.parse(row.declared_methods);
      if (Array.isArray(parsed)) declaredMethods = parsed.map(String);
    } catch {
      declaredMethods = [];
    }
  }
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? ""),
    handle: String(row.handle ?? ""),
    bio: String(row.bio ?? ""),
    avatarKind: row.avatar_kind === "photo" ? "photo" : "identicon",
    avatarData: row.avatar_data == null ? undefined : String(row.avatar_data),
    mainPuzzle: String(row.main_puzzle ?? "333"),
    declaredMethods,
    country: String(row.country ?? ""),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Training attempts ────────────────────────────────────────────────────

export function attemptToCloudRow(
  attempt: TrainingAttempt,
  userId: string,
): CloudRow {
  const ts = attempt.timestamp || Date.now();
  return {
    user_id: userId,
    id: attempt.id,
    exercise_id: attempt.exerciseId,
    method_id: attempt.methodId,
    phase_id: attempt.phaseId ?? null,
    subset_id: attempt.subsetId ?? null,
    case_id: attempt.caseId ?? null,
    scramble: attempt.scramble,
    time_ms: b(attempt.timeMs) ?? 0,
    verdict: attempt.verdict,
    play_mode: attempt.playMode,
    expected_moves: attempt.expectedMoves
      ? JSON.stringify(attempt.expectedMoves)
      : null,
    executed_moves: attempt.executedMoves
      ? JSON.stringify(attempt.executedMoves)
      : null,
    tps: attempt.tps ?? null,
    move_count: attempt.moveCount ?? null,
    optimal_moves: attempt.optimalMoves ?? null,
    rotation_count: attempt.rotationCount ?? null,
    inspection_ms: b(attempt.inspectionMs),
    review_grade: attempt.reviewGrade ?? null,
    session_id: attempt.sessionId ?? null,
    metric_kind: attempt.metricKind ?? "execution",
    timestamp: b(ts) ?? 0,
    updated_at: b(attempt.updatedAt ?? ts) ?? 0,
  };
}

export function cloudRowToAttempt(row: CloudRow): TrainingAttempt {
  const parseJsonArray = (raw: unknown): string[] | undefined => {
    if (typeof raw !== "string") return undefined;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
      return undefined;
    }
  };
  const parseMovesArray = (raw: unknown): TrainingAttempt["executedMoves"] => {
    if (typeof raw !== "string") return undefined;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    id: String(row.id),
    exerciseId: String(row.exercise_id),
    methodId: String(row.method_id),
    phaseId: row.phase_id == null ? undefined : String(row.phase_id),
    subsetId: row.subset_id == null ? undefined : String(row.subset_id),
    caseId: row.case_id == null ? undefined : String(row.case_id),
    scramble: String(row.scramble ?? ""),
    timeMs: Number(row.time_ms) || 0,
    verdict: String(row.verdict ?? "correct") as TrainingAttempt["verdict"],
    playMode: String(row.play_mode ?? "manual") as TrainingAttempt["playMode"],
    expectedMoves: parseJsonArray(row.expected_moves),
    executedMoves: parseMovesArray(row.executed_moves),
    tps: row.tps == null ? undefined : Number(row.tps),
    moveCount: row.move_count == null ? undefined : Number(row.move_count),
    optimalMoves:
      row.optimal_moves == null ? undefined : Number(row.optimal_moves),
    rotationCount:
      row.rotation_count == null ? undefined : Number(row.rotation_count),
    inspectionMs:
      row.inspection_ms == null ? undefined : Number(row.inspection_ms),
    reviewGrade: row.review_grade == null ? undefined : String(row.review_grade),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    metricKind: row.metric_kind === "recognition" ? "recognition" : "execution",
    timestamp: Number(row.timestamp) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Training sessions ────────────────────────────────────────────────────

export function trainingSessionToCloudRow(
  record: TrainingSessionProgressRecord,
  userId: string,
): CloudRow {
  const startedAt = record.startedAt || Date.now();
  return {
    user_id: userId,
    id: record.id,
    exercise_id: record.exerciseId,
    method_id: record.methodId,
    phase_id: record.phaseId ?? null,
    subset_id: record.subsetId ?? null,
    started_at: b(startedAt) ?? 0,
    completed_at: b(record.completedAt),
    duration_ms: b(record.durationMs) ?? 0,
    smart_cube_used: record.smartCubeUsed ? 1 : 0,
    status: record.status,
    updated_at: b(record.updatedAt ?? record.completedAt ?? startedAt) ?? 0,
  };
}

export function cloudRowToTrainingSession(
  row: CloudRow,
): TrainingSessionProgressRecord {
  return {
    id: String(row.id),
    exerciseId: String(row.exercise_id),
    methodId: String(row.method_id),
    phaseId: row.phase_id == null ? undefined : String(row.phase_id),
    subsetId: row.subset_id == null ? undefined : String(row.subset_id),
    startedAt: Number(row.started_at) || 0,
    completedAt:
      row.completed_at == null ? undefined : Number(row.completed_at),
    durationMs: Number(row.duration_ms) || 0,
    smartCubeUsed: Number(row.smart_cube_used) === 1,
    status: row.status === "completed" ? "completed" : "active",
    totalAttempts: 0,
    correctCount: 0,
    accuracy: 0,
    avgTimeMs: 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Training tasks (calendar) ────────────────────────────────────────────

export function taskToCloudRow(task: TrainingTask, userId: string): CloudRow {
  const now = Date.now();
  const createdAt = task.createdAt
    ? new Date(task.createdAt).getTime()
    : now;
  return {
    user_id: userId,
    id: task.id,
    title: task.title,
    description: task.description,
    start_date: task.startDate,
    repeat: task.repeat,
    days_of_week: JSON.stringify(task.daysOfWeek ?? []),
    color: task.color,
    created_at: b(createdAt) ?? 0,
    updated_at: b(task.updatedAt ?? createdAt) ?? 0,
  };
}

export function cloudRowToTask(row: CloudRow): TrainingTask {
  let daysOfWeek: number[] = [];
  if (typeof row.days_of_week === "string") {
    try {
      const parsed = JSON.parse(row.days_of_week);
      if (Array.isArray(parsed)) daysOfWeek = parsed.map(Number);
    } catch {
      daysOfWeek = [];
    }
  }
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    startDate: String(row.start_date ?? ""),
    repeat: String(row.repeat ?? "none") as TrainingTask["repeat"],
    daysOfWeek,
    color: String(row.color ?? "blue") as TrainingTask["color"],
    createdAt:
      Number(row.created_at) > 0
        ? new Date(Number(row.created_at)).toISOString()
        : "",
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Skill progress ───────────────────────────────────────────────────────

export function skillToCloudRow(
  skillId: string,
  completedAt: number,
  userId: string,
): CloudRow {
  return {
    user_id: userId,
    skill_id: skillId,
    completed_at: b(completedAt) ?? 0,
  };
}
