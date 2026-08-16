"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import type { Penalty, PuzzleCategory, Solve, SolveSource } from "@/types";
import type { CubeMoveEvent, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import { exportAllSolvesToJSON, downloadFile } from "@/utils/exportSolves";
import type { SessionMeta } from "@/hooks/usePersistentSession";

type ImportInputs = Array<{
  time: number;
  penalty: Penalty;
  scramble: string;
  method?: string;
  timestamp: number;
  note?: string;
  source?: SolveSource;
  puzzleType?: string;
  moves?: CubeMoveEvent[];
  analysis?: SolveMetrics;
  orientationTimeline?: OrientationTimeline;
}>;

export interface SessionActionsDeps {
  updateSolve: (id: string, updates: { penalty?: Penalty; note?: string | null }) => Promise<void>;
  deleteSolve: (id: string) => Promise<void>;
  clearSession: () => Promise<void>;
  importSolves: (inputs: ImportInputs) => Promise<number>;
  newSession: (name?: string, puzzle?: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  sessions: SessionMeta[];
  fetchSessionSolves: (sessionId: string) => Promise<Solve[]>;
  puzzle: PuzzleCategory;
  /** Replace the scramble (called after session ops that regenerate it). */
  resetScramble: () => void;
  /** Reset timer state (clear lastTime and live time). */
  resetTimer?: () => void;
  /** ID of the most recent solve in the session (if any). */
  lastSolveId?: string;
}

/**
 * Session-level actions with toast feedback (extracted from App.tsx):
 * update/delete/clear solves, new/switch sessions, and the full-fidelity
 * JSON export.
 */
export function useSessionActions(deps: SessionActionsDeps) {
  const {
    updateSolve,
    deleteSolve,
    clearSession,
    importSolves,
    newSession,
    switchSession,
    sessions,
    fetchSessionSolves,
    puzzle,
    resetScramble,
    resetTimer,
    lastSolveId,
  } = deps;

  const handleUpdate = useCallback(
    (id: string, updates: { penalty?: Penalty; note?: string | null }) => {
      updateSolve(id, updates).catch(() => toast.error(i18n.t("timer:updateFailed")));
    },
    [updateSolve],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (lastSolveId && id === lastSolveId) {
        resetTimer?.();
      }
      deleteSolve(id).catch(() => toast.error(i18n.t("toast:deleteFailed")));
    },
    [deleteSolve, lastSolveId, resetTimer],
  );

  const handleClear = useCallback(() => {
    resetTimer?.();
    clearSession().catch(() => toast.error(i18n.t("toast:clearSessionFailed")));
  }, [clearSession, resetTimer]);

  const handleNewSession = useCallback(() => {
    newSession(undefined, puzzleCategoryToType(puzzle))
      .then(() => {
        resetScramble();
        resetTimer?.();
        toast.success(i18n.t("toast:sessionStarted"));
      })
      .catch(() => toast.error(i18n.t("toast:createSessionFailed")));
  }, [newSession, puzzle, resetScramble, resetTimer]);

  const handleSwitchSession = useCallback(
    (id: string) => {
      resetTimer?.();
      switchSession(id).catch(() => toast.error(i18n.t("toast:switchSessionFailed")));
    },
    [switchSession, resetTimer],
  );

  const handleImportSolves = useCallback(
    async (inputs: ImportInputs) => {
      await importSolves(inputs);
    },
    [importSolves],
  );

  // Export ALL sessions (JSON, full fidelity) — restores exactly via import.
  const handleExportAllJSON = useCallback(async () => {
    if (sessions.length === 0) return;
    const withSolves: Array<{ sessionName: string; solves: Solve[] }> = [];
    for (const s of sessions) {
      const sessionSolves = await fetchSessionSolves(s.id);
      withSolves.push({ sessionName: s.name, solves: sessionSolves });
    }
    const json = exportAllSolvesToJSON(withSolves);
    downloadFile(json, 'cubeforge-all-sessions.json', 'application/json');
  }, [sessions, fetchSessionSolves]);

  return {
    handleUpdate,
    handleDelete,
    handleClear,
    handleNewSession,
    handleSwitchSession,
    handleImportSolves,
    handleExportAllJSON,
  };
}
