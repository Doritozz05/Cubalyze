"use client";

import { useCallback, useEffect, useState } from "react";
import { initDB, AlgorithmsRepository, TrainingRepository } from "@cubeforge/database";
import { seedIfEmpty } from "@cubeforge/algorithm-db";
import type { ITrainingProgressRepo, AlgorithmProgressRecord, ExerciseProgressRecord, PhaseStatsRecord, MetricKind, QueueItem, SRSGrade, SRSInsights, TrainingSessionProgressRecord } from "@cubeforge/training";
import type { TrainingAttempt } from "@cubeforge/database";
import { ProgressTracker, normalizeAlgorithmProgress, DEFAULT_EASE_FACTOR, FSRS_DEFAULTS } from "@cubeforge/training";
import type { AttemptVerdict, PlayMode } from "@cubeforge/training";

// ─── Adapter: wraps TrainingRepository into ITrainingProgressRepo ──────────

async function ensureTrainingCatalog(dbExecutor: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>): Promise<void> {
  // Seeding is idempotent. Do not cache this promise globally: closeDB() can
  // replace the underlying SQLite database during the lifetime of the app, and
  // a resolved module-level promise would then leave the new DB unseeded.
  const algorithmsRepo = new AlgorithmsRepository(dbExecutor);
  await seedIfEmpty(algorithmsRepo);
  // Seed the canonical exercise registry (idempotent, batched) so the UI can
  // discover real exercise ids instead of hardcoding them.
  await new TrainingRepository(dbExecutor).seedExercises();
}

function createRepoAdapter(repo: TrainingRepository): ITrainingProgressRepo {
  return {
    insertAttempt: async (attempt) => {
      const result = await repo.insertAttempt(attempt);
      return result;
    },
    getAttemptsByCase: (caseId: string, limit?: number) => repo.getAttemptsByCase(caseId, limit),
    getAttemptsByExercise: (exerciseId: string, limit?: number) => repo.getAttemptsByExercise(exerciseId, limit),
    getAttemptsByMethod: (methodId: string, limit?: number) => repo.getAttemptsByMethod(methodId, limit),
    getAlgorithmProgress: (algorithmId: string) => repo.getAlgorithmProgress(algorithmId),
    upsertAlgorithmProgress: (p: AlgorithmProgressRecord) => repo.upsertAlgorithmProgress(p),
    getAlgorithmProgressBySubset: (subsetId: string) => repo.getAlgorithmProgressBySubset(subsetId),
    getWeakestAlgorithms: (subsetId: string, limit?: number) => repo.getWeakestAlgorithms(subsetId, limit),
    getDueForReview: (limit?: number) => repo.getDueForReview(limit),
    getQueueCandidates: (methodId?: string) => repo.getQueueCandidates(methodId),
    getExerciseProgress: (exerciseId: string, methodId: string, phaseId?: string) =>
      repo.getExerciseProgress(exerciseId, methodId, phaseId),
    upsertExerciseProgress: (p: ExerciseProgressRecord) => repo.upsertExerciseProgress(p),
    getMethodExerciseProgress: (methodId: string) => repo.getMethodExerciseProgress(methodId),
    getMethodMastery: (methodId: string) => repo.getMethodMastery(methodId),
    getMethodProgress: (methodId: string) => repo.getMethodProgress(methodId),
    getPhaseStats: (methodId: string, phaseId: string) => repo.getPhaseStats(methodId, phaseId),
    createTrainingSession: (session) => repo.createTrainingSession(session),
    completeTrainingSession: (id: string, completedAt?: number) => repo.completeTrainingSession(id, completedAt),
    getTrainingSessions: (methodId: string, phaseId?: string, limit?: number) => repo.getTrainingSessions(methodId, phaseId, limit),
    updateAttemptReviewGrade: (caseId: string, reviewGrade: SRSGrade) => repo.updateAttemptReviewGrade(caseId, reviewGrade),
    clearAllData: () => repo.clearAllData(),
  };
}

// ─── Dev console helper (module scope — always attached) ────────────────────
// Training progress lives in tables nothing else clears (algorithm_progress,
// training_attempts, exercise_progress, training_sessions), so this is the
// only way to reset the SRS/progress from scratch.
//
// Attached at MODULE scope, not inside getSharedTracker(), so it exists from
// app boot even before any training view mounts (views only initialize the
// tracker lazily). The helper boots the shared tracker on first use.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).clearTrainingData = () => {
    void getSharedTracker()
      .then((tracker) => tracker.clearAllData())
      .then(() => {
        console.log("[clearTrainingData] All training progress deleted. Reload to refresh the dashboard.");
      })
      .catch((err) => {
        console.error("[clearTrainingData] Failed:", err);
      });
  };
}

// ─── Shared tracker singleton ──────────────────────────────────────────────
// Every training view (and useTrainingSession, which wraps this hook) used to
// spawn its own initDB() + full catalog re-seed on mount — hundreds of
// INSERT OR IGNORE round-trips per screen, repeated by every hook instance and
// again by StrictMode. Share one tracker per live DB client instead.
let sharedInit: { client: unknown; promise: Promise<ProgressTracker> } | null = null;

async function getSharedTracker(): Promise<ProgressTracker> {
  const dbClient = await initDB();
  if (sharedInit && sharedInit.client === dbClient) return sharedInit.promise;
  const promise = (async () => {
    const dbExecutor = async (sql: string, bind?: unknown[]) => {
      return await dbClient.execute(sql, bind);
    };
    // Seeding is idempotent (INSERT OR IGNORE) and keyed to this DB client,
    // so closeDB() + re-init naturally produces a fresh, correctly seeded DB.
    await ensureTrainingCatalog(dbExecutor);
    const repo = new TrainingRepository(dbExecutor);
    return new ProgressTracker(createRepoAdapter(repo));
  })();
  sharedInit = { client: dbClient, promise };
  // If seeding/init fails, drop the cache so a later mount can retry instead
  // of being stuck with a permanently rejected promise.
  void promise.catch(() => {
    if (sharedInit?.promise === promise) sharedInit = null;
  });
  return promise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export interface UseTrainingProgressResult {
  ready: boolean;
  error: string | null;
  recordAttempt: (params: {
    exerciseId: string;
    methodId: string;
    phaseId?: string;
    caseId?: string;
    sessionId?: string;
    timeMs: number;
    verdict: AttemptVerdict;
    playMode: PlayMode;
    scramble: string;
    metricKind?: MetricKind;
    advanceSRS?: boolean;
    moveCount?: number;
    optimalMoves?: number;
    tps?: number;
    rotationCount?: number;
    reviewGrade?: SRSGrade;
  }) => Promise<AlgorithmProgressRecord | null>;
  recordReview: (params: { caseId: string; grade: SRSGrade; now?: number }) => Promise<AlgorithmProgressRecord>;
  getCaseProgress: (algorithmId: string) => Promise<AlgorithmProgressRecord>;
  getSubsetProgress: (subsetId: string) => Promise<AlgorithmProgressRecord[]>;
  getMethodMastery: (methodId: string) => Promise<number>;
  getDueForReview: (limit?: number) => Promise<AlgorithmProgressRecord[]>;
  getAttemptsByExercise: (exerciseId: string, limit?: number) => Promise<TrainingAttempt[]>;
  getTodayQueue: (options?: { methodId?: string; limit?: number }) => Promise<QueueItem[]>;
  getSRSInsights: (methodId?: string) => Promise<SRSInsights>;
  getMethodExerciseProgress: (methodId: string) => Promise<ExerciseProgressRecord[]>;
  getPhaseStats: (methodId: string, phaseId: string) => Promise<PhaseStatsRecord | null>;
  createTrainingSession: (session: Omit<TrainingSessionProgressRecord, "completedAt" | "durationMs" | "status" | "totalAttempts" | "correctCount" | "accuracy" | "avgTimeMs">) => Promise<TrainingSessionProgressRecord>;
  completeTrainingSession: (id: string, completedAt?: number) => Promise<TrainingSessionProgressRecord | null>;
  getTrainingSessions: (methodId: string, phaseId?: string, limit?: number) => Promise<TrainingSessionProgressRecord[]>;
  updateAttemptReviewGrade: (caseId: string, reviewGrade: SRSGrade) => Promise<void>;
}

export function useTrainingProgress(): UseTrainingProgressResult {
  const [tracker, setTracker] = useState<ProgressTracker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSharedTracker()
      .then((tracker) => {
        if (!cancelled) {
          setTracker(tracker);
          setError(null);
          setReady(true);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Training database initialization failed";
        console.error("[useTrainingProgress] Failed to initialize:", err);
        if (!cancelled) {
          setError(message);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recordAttempt = useCallback(
    async (params: {
      exerciseId: string;
      methodId: string;
      phaseId?: string;
      caseId?: string;
      sessionId?: string;
      timeMs: number;
      verdict: AttemptVerdict;
      playMode: PlayMode;
      scramble: string;
      metricKind?: MetricKind;
      advanceSRS?: boolean;
      moveCount?: number;
      optimalMoves?: number;
      tps?: number;
      rotationCount?: number;
      reviewGrade?: SRSGrade;
    }) => {
      if (!tracker) {
        throw new Error(error ?? "Training database is not ready");
      }
      return tracker.recordAttempt(params);
    },
    [tracker, error],
  );

  const recordReview = useCallback(
    async (params: { caseId: string; grade: SRSGrade; now?: number }) => {
      if (!tracker) {
        throw new Error("[useTrainingProgress] recordReview called before DB ready");
      }
      return tracker.recordReview(params);
    },
    [tracker],
  );

  const getCaseProgress = useCallback(
    async (algorithmId: string) => {
      if (!tracker) {
        return normalizeAlgorithmProgress({
          algorithmId,
          mastery: 0,
          accuracy: 0,
          bestTimeMs: 0,
          avgTimeMs: 0,
          totalAttempts: 0,
          execAttempts: 0,
          execCorrect: 0,
          recognitionCorrect: 0,
          recognitionStreak: 0,
          correctStreak: 0,
          lastPracticedAt: 0,
          srsNextReviewAt: 0,
          srsIntervalDays: 0,
          srsEaseFactor: DEFAULT_EASE_FACTOR,
          srsStability: FSRS_DEFAULTS.stability,
          srsDifficulty: FSRS_DEFAULTS.difficulty,
          srsState: "new",
          srsLapses: 0,
          srsReviewCount: 0,
          lastReviewAt: 0,
        } as AlgorithmProgressRecord);
      }
      return tracker.getCaseProgress(algorithmId);
    },
    [tracker],
  );

  const getSubsetProgress = useCallback(
    async (subsetId: string) => {
      if (!tracker) return [] as AlgorithmProgressRecord[];
      return tracker.getSubsetProgress(subsetId);
    },
    [tracker],
  );

  const getMethodMastery = useCallback(
    async (methodId: string) => {
      if (!tracker) return 0;
      return tracker.getMethodMastery(methodId);
    },
    [tracker],
  );

  const getDueForReview = useCallback(
    async (limit: number = 20) => {
      if (!tracker) return [] as AlgorithmProgressRecord[];
      return tracker.getDueForReview(limit);
    },
    [tracker],
  );

  const getAttemptsByExercise = useCallback(
    async (exerciseId: string, limit?: number): Promise<TrainingAttempt[]> => {
      if (!tracker) return [];
      // The DB rows carry the rich per-attempt metadata (moveCount, optimalMoves,
      // phaseId) the phase-target views render; the package's pure record type
      // omits those DB-only columns, so cast across the boundary.
      return (await tracker.getAttemptsByExercise(exerciseId, limit)) as unknown as TrainingAttempt[];
    },
    [tracker],
  );

  const getTodayQueue = useCallback(
    async (options: { methodId?: string; limit?: number } = {}) => {
      if (!tracker) return [] as QueueItem[];
      return tracker.getTodayQueue(options);
    },
    [tracker],
  );

  const getSRSInsights = useCallback(
    async (methodId?: string) => {
      if (!tracker) {
        return {
          totalCases: 0,
          reviewed: 0,
          stateCounts: { new: 0, learning: 0, review: 0, relearning: 0 },
          totalLapses: 0,
          totalReviews: 0,
          avgMastery: 0,
          retention: { average: 0, buckets: [] },
          intervalGrowth: [],
          dueProjection: [],
        } as SRSInsights;
      }
      return tracker.getSRSInsights(methodId);
    },
    [tracker],
  );

  const getMethodExerciseProgress = useCallback(
    async (methodId: string) => {
      if (!tracker) return [] as ExerciseProgressRecord[];
      return tracker.getMethodExerciseProgress(methodId);
    },
    [tracker],
  );

  const getPhaseStats = useCallback(
    async (methodId: string, phaseId: string) => {
      if (!tracker) return null;
      return tracker.getPhaseStats(methodId, phaseId);
    },
    [tracker],
  );

  const createTrainingSession = useCallback(
    (session: Omit<TrainingSessionProgressRecord, "completedAt" | "durationMs" | "status" | "totalAttempts" | "correctCount" | "accuracy" | "avgTimeMs">) => {
      if (!tracker) return Promise.reject(new Error("Training database is not ready"));
      return tracker.createTrainingSession(session);
    },
    [tracker],
  );

  const completeTrainingSession = useCallback(
    (id: string, completedAt?: number) => {
      if (!tracker) return Promise.reject(new Error("Training database is not ready"));
      return tracker.completeTrainingSession(id, completedAt);
    },
    [tracker],
  );

  const getTrainingSessions = useCallback(
    (methodId: string, phaseId?: string, limit?: number) => {
      if (!tracker) return Promise.resolve([] as TrainingSessionProgressRecord[]);
      return tracker.getTrainingSessions(methodId, phaseId, limit);
    },
    [tracker],
  );

  const updateAttemptReviewGrade = useCallback(
    async (caseId: string, reviewGrade: SRSGrade) => {
      if (!tracker) throw new Error("Training database is not ready");
      return tracker.updateAttemptReviewGrade(caseId, reviewGrade);
    },
    [tracker],
  );

  return {
    ready,
    error,
    recordAttempt,
    recordReview,
    getCaseProgress,
    getSubsetProgress,
    getMethodMastery,
    getDueForReview,
    getAttemptsByExercise,
    getTodayQueue,
    getSRSInsights,
    getMethodExerciseProgress,
    getPhaseStats,
    createTrainingSession,
    completeTrainingSession,
    getTrainingSessions,
    updateAttemptReviewGrade,
  };
}
