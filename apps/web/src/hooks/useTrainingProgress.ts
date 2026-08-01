"use client";

import { useCallback, useEffect, useState } from "react";
import { initDB, TrainingRepository } from "@cubeforge/database";
import type { ITrainingProgressRepo, AlgorithmProgressRecord, ExerciseProgressRecord, PhaseStatsRecord, MetricKind } from "@cubeforge/training";
import { ProgressTracker } from "@cubeforge/training";
import type { AttemptVerdict, PlayMode } from "@cubeforge/training";

// ─── Adapter: wraps TrainingRepository into ITrainingProgressRepo ──────────

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
    upsertAlgorithmProgress: async (p: AlgorithmProgressRecord) => repo.upsertAlgorithmProgress(p),
    getAlgorithmProgressBySubset: (subsetId: string) => repo.getAlgorithmProgressBySubset(subsetId),
    getWeakestAlgorithms: (subsetId: string, limit?: number) => repo.getWeakestAlgorithms(subsetId, limit),
    getDueForReview: (limit?: number) => repo.getDueForReview(limit),
    getExerciseProgress: (exerciseId: string, methodId: string, phaseId?: string) =>
      repo.getExerciseProgress(exerciseId, methodId, phaseId),
    upsertExerciseProgress: async (p: ExerciseProgressRecord) => repo.upsertExerciseProgress(p),
    getMethodExerciseProgress: (methodId: string) => repo.getMethodExerciseProgress(methodId),
    getMethodMastery: (methodId: string) => repo.getMethodMastery(methodId),
    getPhaseStats: (methodId: string, phaseId: string) => repo.getPhaseStats(methodId, phaseId),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export interface UseTrainingProgressResult {
  ready: boolean;
  recordAttempt: (params: {
    exerciseId: string;
    methodId: string;
    phaseId?: string;
    caseId?: string;
    timeMs: number;
    verdict: AttemptVerdict;
    playMode: PlayMode;
    scramble: string;
    metricKind?: MetricKind;
    moveCount?: number;
    optimalMoves?: number;
    tps?: number;
    rotationCount?: number;
  }) => Promise<AlgorithmProgressRecord | null>;
  getCaseProgress: (algorithmId: string) => Promise<AlgorithmProgressRecord>;
  getSubsetProgress: (subsetId: string) => Promise<AlgorithmProgressRecord[]>;
  getMethodMastery: (methodId: string) => Promise<number>;
  getDueForReview: (limit?: number) => Promise<AlgorithmProgressRecord[]>;
  getMethodExerciseProgress: (methodId: string) => Promise<ExerciseProgressRecord[]>;
  getPhaseStats: (methodId: string, phaseId: string) => Promise<PhaseStatsRecord | null>;
}

export function useTrainingProgress(): UseTrainingProgressResult {
  const [tracker, setTracker] = useState<ProgressTracker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const dbClient = await initDB();
        const dbExecutor = async (sql: string, bind?: unknown[]) => {
          return await dbClient.execute(sql, bind);
        };
        const repo = new TrainingRepository(dbExecutor);
        const adapter = createRepoAdapter(repo);
        if (!cancelled) {
          setTracker(new ProgressTracker(adapter));
          setReady(true);
        }
      } catch (err) {
        console.error("[useTrainingProgress] Failed to initialize:", err);
        if (!cancelled) setReady(true);
      }
    }

    init();
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
      timeMs: number;
      verdict: AttemptVerdict;
      playMode: PlayMode;
      scramble: string;
      metricKind?: MetricKind;
      moveCount?: number;
      optimalMoves?: number;
      tps?: number;
      rotationCount?: number;
    }) => {
      if (!tracker) return null;
      return tracker.recordAttempt(params);
    },
    [tracker],
  );

  const getCaseProgress = useCallback(
    async (algorithmId: string) => {
      if (!tracker) {
        return {
          algorithmId,
          mastery: 0,
          accuracy: 0,
          bestTimeMs: 0,
          avgTimeMs: 0,
          totalAttempts: 0,
          correctStreak: 0,
          lastPracticedAt: 0,
          srsNextReviewAt: 0,
          srsIntervalDays: 0,
          srsEaseFactor: 2.5,
          srsStability: 0,
          srsDifficulty: 5,
          srsState: "new",
          srsLapses: 0,
          srsReviewCount: 0,
          lastReviewAt: 0,
        } as AlgorithmProgressRecord;
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

  return {
    ready,
    recordAttempt,
    getCaseProgress,
    getSubsetProgress,
    getMethodMastery,
    getDueForReview,
    getMethodExerciseProgress,
    getPhaseStats,
  };
}
