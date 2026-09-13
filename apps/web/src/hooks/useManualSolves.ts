"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import i18n from "@/i18n";
import { preferencesStore } from "@cubeforge/state";
import { methodForEvent, puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { Penalty, PuzzleCategory, SolveMethod } from "@/types";
import type { UsePersistentSessionResult } from "@/hooks/usePersistentSession";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";
import { hardwareLinkStore } from "@/stores/hardwareLinkStore";
import {
  cubeAttribution,
  cubesForEventWithSmartFallback,
  latestCubeIdForEvent,
  resolveActiveCube,
} from "@/views/Collection/activeCube";

export interface ManualSolvesDeps {
  addSolve: UsePersistentSessionResult["addSolve"];
  currentScramble: string;
  puzzle: PuzzleCategory;
  resetScramble: () => void;
  /** Current solves, newest first — the "last used cube" fallback. */
  solves: readonly UsePersistentSessionResult["solves"][number][];
}

/**
 * Manual solve entry (extracted from App.tsx):
 *  - inline manual time input on the timer stage,
 *  - the "+" manual solve sheet in the header.
 * Reads the display preferences (method / scramble display) from the store.
 */
export function useManualSolves(deps: ManualSolvesDeps) {
  const { addSolve, currentScramble, puzzle, resetScramble, solves } = deps;
  const methodPref = useStore(preferencesStore, (s) => s.method);
  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  // Every manual solve is timestamped and attributed to the event being solved,
  // exactly like a timed one. Read imperatively so a Locker edit does not
  // re-render the timer stage.
  const cubeForEvent = useCallback(
    (eventCode: string) => {
      const chosen = activeCubeStore.getState().byEvent[eventCode];
      const collectionData = useCollectionStore.getState().data;
      const includeLinked333 =
        eventCode === "222" && preferencesStore.getState().use3x3As2x2;
      const candidates = cubesForEventWithSmartFallback(
        collectionData,
        eventCode,
        includeLinked333,
      );
      // Same rule as the timed path: the connected cube wins over the Locker
      // fallbacks — in 2×2 with the opt-in on, the linked smart 3×3.
      const linked = hardwareLinkStore.getState();
      const hardwareItemId = linked.status === "linked" ? linked.itemId : null;
      return cubeAttribution(
        resolveActiveCube(
          collectionData,
          eventCode,
          chosen,
          latestCubeIdForEvent(solves, eventCode),
          candidates,
          hardwareItemId,
        ),
      );
    },
    [solves],
  );

  const handleManualSubmit = useCallback(
    async (time: number, penalty: Penalty, note?: string | null) => {
      await addSolve({
        time,
        penalty,
        scramble: scrambleDisplay ? currentScramble : "",
        // Only events that declare methods (3×3, 3×3 OH) store one.
        method: methodForEvent(puzzleCategoryToType(puzzle), methodPref),
        ...cubeForEvent(puzzleCategoryToType(puzzle)),
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
    [addSolve, currentScramble, puzzle, resetScramble, methodPref, scrambleDisplay, cubeForEvent],
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
        ...cubeForEvent(puzzleCategoryToType(puzzle)),
        // Persist the manual-sheet notes — the sheet sends `notes.trim()`.
        note: input.notes.trim() ? input.notes.trim() : undefined,
        source: "manual",
        puzzleType: puzzleCategoryToType(puzzle),
      });
    },
    [addSolve, puzzle, methodPref, cubeForEvent],
  );

  return { handleManualSubmit, handleAddManual };
}
