"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTrainingProgress } from "./useTrainingProgress";
import type { TrainingSessionProgressRecord } from "@cubeforge/training";

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `training-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UseTrainingSessionParams {
  exerciseId: string;
  methodId: string;
  phaseId?: string;
  subsetId?: string;
  smartCubeUsed?: boolean;
  /** Changes this value to start a new persisted session without unmounting the view. */
  sessionKey?: string | number;
}

export interface UseTrainingSessionResult {
  sessionId: string | null;
  session: TrainingSessionProgressRecord | null;
  /** Completes the current session immediately; safe to call more than once. */
  completeSession: (completedAt?: number) => Promise<TrainingSessionProgressRecord | null>;
}

/**
 * Groups attempts made while a Training view is mounted into one persisted
 * logical session. Empty sessions are harmless and are excluded from history
 * by the UI; attempts remain the source of truth for phase metrics.
 */
export function useTrainingSession({
  exerciseId,
  methodId,
  phaseId,
  subsetId,
  smartCubeUsed = false,
  sessionKey,
}: UseTrainingSessionParams): UseTrainingSessionResult {
  const { ready, createTrainingSession, completeTrainingSession } = useTrainingProgress();
  const sessionId = useMemo(
    createSessionId,
    [exerciseId, methodId, phaseId, subsetId, sessionKey],
  );
  const [session, setSession] = useState<TrainingSessionProgressRecord | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedIdsRef = useRef<Set<string>>(new Set());
  const createPromiseRef = useRef<Promise<TrainingSessionProgressRecord> | null>(null);

  const completeSession = useCallback(async (completedAt?: number) => {
    if (!ready || completedIdsRef.current.has(sessionId)) return null;
    completedIdsRef.current.add(sessionId);
    try {
      // A fast navigation can unmount before INSERT finishes. Await it so the
      // UPDATE cannot race ahead and leave an active orphaned session.
      await createPromiseRef.current;
      const completed = await completeTrainingSession(sessionId, completedAt);
      if (completed) setSession(completed);
      return completed;
    } catch (error) {
      completedIdsRef.current.delete(sessionId);
      throw error;
    }
  }, [ready, sessionId, completeTrainingSession]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    const createPromise = createTrainingSession({
      id: sessionId,
      exerciseId,
      methodId,
      phaseId,
      subsetId,
      startedAt: Date.now(),
      smartCubeUsed,
    });
    createPromiseRef.current = createPromise;
    const completedIds = completedIdsRef.current;
    void createPromise.then((created) => {
      if (!cancelled) setSession(created);
    }).catch((error) => {
      console.error("[useTrainingSession] Failed to create session:", error);
    });

    return () => {
      cancelled = true;
      // Capture this effect's INSERT promise. A prop/sessionKey change may
      // start another effect before this cleanup timer runs; using a shared
      // ref there could complete the newer session instead of this one.
      const completeThisSession = async () => {
        if (completedIds.has(sessionId)) return;
        completedIds.add(sessionId);
        try {
          await createPromise;
          await completeTrainingSession(sessionId);
        } catch (error) {
          completedIds.delete(sessionId);
          throw error;
        }
      };
      // React Strict Mode performs an immediate cleanup/remount probe. Delay
      // completion by one task so that probe is canceled, while a real view
      // exit still closes the session and makes it visible in History.
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        void completeThisSession().catch((error) => {
          console.error("[useTrainingSession] Failed to complete session:", error);
        });
      }, 0);
    };
    // smartCubeUsed intentionally does not restart a logical session when the
    // device connects/disconnects during a drill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sessionId, exerciseId, methodId, phaseId, subsetId, createTrainingSession, completeSession]);

  return {
    sessionId: ready ? sessionId : null,
    session,
    completeSession,
  };
}
