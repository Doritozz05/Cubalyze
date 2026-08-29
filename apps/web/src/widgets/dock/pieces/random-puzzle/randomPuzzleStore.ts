import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PuzzleCategory } from "@/types";
import { PUZZLE_SELECTOR, SELECTABLE_PUZZLE_CATEGORIES } from "@/utils/puzzleUtils";

export interface RandomPuzzleState {
  /** List of puzzle categories currently enabled in the roulette pool. */
  enabledPuzzles: PuzzleCategory[];
  /** Toggle a puzzle category on/off. Keeps at least one puzzle enabled. */
  togglePuzzle: (puzzle: PuzzleCategory) => void;
  /** Select all playable puzzles. */
  selectAll: () => void;
  /** Deselect all puzzles except the first playable one (maintains valid pool). */
  deselectAll: () => void;
  /** Set custom list of enabled puzzles. */
  setEnabledPuzzles: (puzzles: PuzzleCategory[]) => void;
  /** Check if a puzzle is enabled. */
  isPuzzleEnabled: (puzzle: PuzzleCategory) => boolean;
}

const DEFAULT_ENABLED: PuzzleCategory[] = [...SELECTABLE_PUZZLE_CATEGORIES];

export const useRandomPuzzleStore = create<RandomPuzzleState>()(
  persist(
    (set, get) => ({
      enabledPuzzles: DEFAULT_ENABLED,

      togglePuzzle: (puzzle: PuzzleCategory) => {
        const current = get().enabledPuzzles;
        const exists = current.includes(puzzle);

        if (exists) {
          // Do not allow unchecking the very last item
          if (current.length <= 1) return;
          set({ enabledPuzzles: current.filter((p) => p !== puzzle) });
        } else {
          set({ enabledPuzzles: [...current, puzzle] });
        }
      },

      selectAll: () => {
        const allPlayable = PUZZLE_SELECTOR.filter((p) => p.playable).map((p) => p.category);
        set({ enabledPuzzles: allPlayable });
      },

      deselectAll: () => {
        // Keep only the default or first playable puzzle so roulette is always functional
        const firstPlayable = PUZZLE_SELECTOR.find((p) => p.playable)?.category ?? "3x3";
        set({ enabledPuzzles: [firstPlayable] });
      },

      setEnabledPuzzles: (puzzles: PuzzleCategory[]) => {
        if (puzzles.length === 0) {
          const firstPlayable = PUZZLE_SELECTOR.find((p) => p.playable)?.category ?? "3x3";
          set({ enabledPuzzles: [firstPlayable] });
          return;
        }
        set({ enabledPuzzles: puzzles });
      },

      isPuzzleEnabled: (puzzle: PuzzleCategory) => {
        return get().enabledPuzzles.includes(puzzle);
      },
    }),
    {
      name: "cubeforge_random_puzzle_pool",
      version: 1,
    },
  ),
);
