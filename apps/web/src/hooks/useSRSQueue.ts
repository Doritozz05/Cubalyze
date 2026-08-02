"use client";

/**
 * useSRSQueue — daily spaced-repetition review queue session.
 *
 * Wraps useTrainingProgress to expose:
 *  - getTodayQueue()  → the prioritized SRS queue (FSRS priority + new-cases cap)
 *  - startSession()   → load the queue into an active session (current item tracking)
 *  - grade()          → apply an FSRS grade to the current item and advance
 *  - skip()           → move to the next item without grading
 *  - endSession()     → clear the session state
 *
 * The review UI (Phase E) composes each item as:
 *   recordAttempt({ ...execution/recognition }) → metrics + attempt history
 *   grade(grade)                                → the FSRS schedule via recordReview
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlgorithmProgressRecord, QueueItem, SRSGrade } from "@cubeforge/training";
import { useTrainingProgress, type UseTrainingProgressResult } from "./useTrainingProgress";

export interface SRSReviewResult {
  algorithmId: string;
  caseNumber: string;
  grade: SRSGrade;
  timestamp: number;
  /** New FSRS state after the grade (for the session summary). */
  srsState: AlgorithmProgressRecord["srsState"];
  /** New interval in days (for the session summary). */
  intervalDays: number;
}

export interface SRSQueueSession {
  /** True while a session is active (queue loaded, items remain). */
  active: boolean;
  items: QueueItem[];
  /** 0-based position in `items`. */
  index: number;
  /** Current item to review (null when the session is empty/finished). */
  current: QueueItem | null;
  total: number;
  results: SRSReviewResult[];
}

export interface UseSRSQueueResult {
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** The full prioritized queue (available before/after a session). */
  queue: QueueItem[];
  session: SRSQueueSession;
  getTodayQueue: (options?: { methodId?: string; limit?: number }) => Promise<QueueItem[]>;
  refresh: () => Promise<QueueItem[]>;
  startSession: (options?: { methodId?: string; limit?: number }) => Promise<QueueItem[]>;
  /** Records practice metrics (recognition/execution) for the current review. */
  recordAttempt: UseTrainingProgressResult["recordAttempt"];
  /** Tags the most recent attempt of a case with the FSRS grade (links history ↔ schedule). */
  updateAttemptReviewGrade: UseTrainingProgressResult["updateAttemptReviewGrade"];
  grade: (grade: SRSGrade) => Promise<AlgorithmProgressRecord | null>;
  skip: () => void;
  endSession: () => void;
}

export function useSRSQueue(): UseSRSQueueResult {
  const { ready, getTodayQueue, recordAttempt, recordReview, updateAttemptReviewGrade } = useTrainingProgress();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<SRSQueueSession>({
    active: false,
    items: [],
    index: 0,
    current: null,
    total: 0,
    results: [],
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Re-entrancy guard: overlapping grade() calls (possible while the first is
  // awaiting recordReview) would otherwise both grade the same item.
  const gradingRef = useRef(false);

  const loadQueue = useCallback(
    async (options?: { methodId?: string; limit?: number }): Promise<QueueItem[]> => {
      if (!ready) return [];
      setLoading(true);
      setError(null);
      try {
        const items = await getTodayQueue(options);
        setQueue(items);
        return items;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load the review queue");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [ready, getTodayQueue],
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const startSession = useCallback(
    async (options?: { methodId?: string; limit?: number }): Promise<QueueItem[]> => {
      const items = await loadQueue(options);
      setSession({
        active: items.length > 0,
        items,
        index: 0,
        current: items[0] ?? null,
        total: items.length,
        results: [],
      });
      return items;
    },
    [loadQueue],
  );

  const grade = useCallback(
    async (grade: SRSGrade): Promise<AlgorithmProgressRecord | null> => {
      const s = sessionRef.current;
      const item = s.items[s.index];
      if (!item) return null;
      // Re-entrancy guard: overlapping grade() calls (possible while the first is
      // awaiting recordReview) would otherwise both grade the same item. A
      // second click while saving is harmless — ignore it instead of failing.
      if (gradingRef.current) return null;
      gradingRef.current = true;
      try {
        const updated = await recordReview({ caseId: item.algorithmId, grade });
        setSession((prev) => {
          const nextIndex = Math.min(prev.index + 1, prev.items.length);
          const result: SRSReviewResult = {
            algorithmId: item.algorithmId,
            caseNumber: item.caseNumber,
            grade,
            timestamp: Date.now(),
            srsState: updated?.srsState ?? "new",
            intervalDays: updated?.srsIntervalDays ?? 0,
          };
          return {
            active: nextIndex < prev.items.length,
            items: prev.items,
            index: nextIndex,
            current: prev.items[nextIndex] ?? null,
            total: prev.items.length,
            results: [...prev.results, result],
          };
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to record review grade";
        // Surface the error so the caller can show an inline, non-destructive
        // message — the review session must stay usable for a retry.
        throw err instanceof Error ? err : new Error(message);
      } finally {
        gradingRef.current = false;
      }
    },
    [recordReview],
  );

  const skip = useCallback(() => {
    setSession((prev) => {
      const nextIndex = Math.min(prev.index + 1, prev.items.length);
      return {
        ...prev,
        active: nextIndex < prev.items.length,
        index: nextIndex,
        current: prev.items[nextIndex] ?? null,
      };
    });
  }, []);

  const endSession = useCallback(() => {
    setSession({ active: false, items: [], index: 0, current: null, total: 0, results: [] });
  }, []);

  return {
    ready,
    loading,
    error,
    queue,
    session,
    getTodayQueue: loadQueue,
    refresh: () => loadQueue(),
    startSession,
    recordAttempt,
    grade,
    skip,
    endSession,
    updateAttemptReviewGrade,
  };
}
