"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import i18n from "@/i18n";
import { preferencesStore } from "@cubeforge/state";
import { methodForEvent, puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { Penalty, PuzzleCategory, SolveMethod } from "@/types";
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
    async (time: number, penalty: Penalty, note?: string | null) => {
      await addSolve({
        time,
        penalty,
        scramble: scrambleDisplay ? currentScramble : "",
        // Only events that declare methods (3×3, 3×3 OH) store one.
        method: methodForEvent(puzzleCategoryToType(puzzle), methodPref),
        note: note ? note.trim() || undefined : undefined,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
      const label =
        penalty === "DNF"
          ? "DNF"
          : penalty === "+2"
            ? `${(time / 1000).toFixed(2)}s+2`
            : `${(time / 1000).toFixed(2)}s`;
      toast.success(i18n.t("toast:solveLogged", { label }));
      resetScramble();
    },
    [addSolve, currentScramble, puzzle, resetScramble, methodPref, scrambleDisplay],
  );

  const handleAddManual = useCallback(
    async (input: {
      time: number;
      scramble: string;
      /** Absent when the active event has no method concept (2×2, Pyraminx…). */
      method?: SolveMethod;
      notes: string;
      penalty: Penalty;
    }) => {
      await addSolve({
        time: input.time,
        penalty: input.penalty,
        scramble: input.scramble,
        // The sheet hides the picker on events without methods, so this is
        // `undefined` there; the rule is re-applied anyway so no caller can
        // smuggle a method into an event that does not hold one.
        method: methodForEvent(puzzleCategoryToType(puzzle), input.method ?? methodPref),
        // Persist the manual-sheet notes — the sheet sends `notes.trim()`.
        note: input.notes.trim() ? input.notes.trim() : undefined,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
    },
    [addSolve, puzzle, methodPref],
  );

  return { handleManualSubmit, handleAddManual };
}
