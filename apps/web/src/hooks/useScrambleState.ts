"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import type { PuzzleCategory } from "@/types";
import { generateScrambleFor, SELECTABLE_PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";

/**
 * Owns the puzzle selection + current scramble + scramble counter (extracted
 * from App.tsx). The puzzle choice persists to localStorage; every scramble
 * mutation funnels through here so the stage and the completion pipeline
 * always see the same scramble.
 */
export function useScrambleState() {
  const [puzzle, setPuzzle] = useState<PuzzleCategory>(() => {
    if (typeof window !== "undefined") {
      // Phase A6: only categories with a real provider are restorable.
      // A pre-A6 saved ghost (e.g. '4x4') falls back to 3×3 — honest.
      const saved = localStorage.getItem("cubeforge_puzzle");
      if (saved && SELECTABLE_PUZZLE_CATEGORIES.includes(saved as PuzzleCategory)) {
        return saved as PuzzleCategory;
      }
    }
    return "3x3";
  });
  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [currentScramble, setCurrentScramble] = useState(() =>
    generateScrambleFor(puzzle),
  );

  const handlePuzzleChange = useCallback((newPuzzle: PuzzleCategory) => {
    setPuzzle(newPuzzle);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cubeforge_puzzle", newPuzzle);
      } catch (e) {
        console.warn("[App] Failed to save puzzle to localStorage", e);
      }
    }
    setCurrentScramble(generateScrambleFor(newPuzzle));
    setScrambleIndex(0);
    toast.success(i18n.t("toast:puzzleSwitched", { puzzle: newPuzzle }));
  }, []);

  const handleRegenerate = useCallback(() => {
    setCurrentScramble(generateScrambleFor(puzzle));
    setScrambleIndex((i) => i + 1);
    toast.success(i18n.t("toast:newScramble"));
  }, [puzzle]);

  /** Replace the scramble without bumping the toast (used after session ops). */
  const resetScramble = useCallback(
    (target?: PuzzleCategory) => {
      setCurrentScramble(generateScrambleFor(target ?? puzzle));
      setScrambleIndex(0);
    },
    [puzzle],
  );

  return {
    puzzle,
    scrambleIndex,
    currentScramble,
    handlePuzzleChange,
    handleRegenerate,
    resetScramble,
  };
}
