"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import { preferencesStore } from "@cubeforge/state";
import type { Penalty, PuzzleCategory, SolveMethod } from "@/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { UsePersistentSessionResult } from "@/hooks/usePersistentSession";

export interface ManualSolvesDeps {
  addSolve: UsePersistentSessionResult["addSolve"];
  currentScramble: string;
  puzzle: PuzzleCategory;
  resetScramble: () => void;
}

/**
 * Manual solve entry (extracted from App.tsx):
 *  - inline manual time input on the timer stage,
 *  - the "+" manual solve sheet in the header.
 * Reads the display preferences (method / scramble display) from the store.
 */
export function useManualSolves(deps: ManualSolvesDeps) {
  const { addSolve, currentScramble, puzzle, resetScramble } = deps;
  const methodPref = useStore(preferencesStore, (s) => s.method);
  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);

  const handleManualSubmit = useCallback(
    async (time: number, penalty: Penalty) => {
      await addSolve({
        time,
        penalty,
        scramble: scrambleDisplay ? currentScramble : "",
        method: methodPref,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
      const label =
        penalty === "DNF"
          ? "DNF"
          : penalty === "+2"
            ? `${(time / 1000).toFixed(2)}s+2`
            : `${(time / 1000).toFixed(2)}s`;
      toast.success(`Logged: ${label}`);
      resetScramble();
    },
    [addSolve, currentScramble, puzzle, resetScramble, methodPref, scrambleDisplay],
  );

  const handleAddManual = useCallback(
    async (input: {
      time: number;
      scramble: string;
      method: SolveMethod;
      notes: string;
      penalty: Penalty;
    }) => {
      await addSolve({
        time: input.time,
        penalty: input.penalty,
        scramble: input.scramble,
        method: input.method,
        // Persist the manual-sheet notes — the sheet sends `notes.trim()`.
        note: input.notes.trim() ? input.notes.trim() : undefined,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
    },
    [addSolve, puzzle],
  );

  return { handleManualSubmit, handleAddManual };
}
