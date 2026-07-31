/**
 * Puzzle utility helpers.
 *
 * Maps the UI {@link PuzzleCategory} to:
 *   • `puzzleType` — the database identifier (e.g. '3x3x3', '2x2x2')
 *   • `order` — the cube dimension for the 3D engine (2 or 3)
 *   • scramble generation — delegates to the appropriate solver/scrambler
 *
 * Only 2×2 and 3×3 are fully functional right now; other categories fall
 * back to the 3×3 scramble generator (safe default, no breakage).
 *
 * ## Solver initialisation
 *
 * Both solvers are initialised lazily on first use, but the 2×2 solver
 * needs ~800ms to build its combined pruning table, and Min2Phase needs
 * ~150-350ms for its WASM tables. Call {@link preloadSolvers} at app
 * startup to front-load this cost and make the first scramble instant.
 */

import type { PuzzleCategory } from "@/types";
import {
  RandomStateGenerator,
  Min2PhaseSolver,
  TwoByTwoScrambler,
  TwoByTwoSolver,
} from "@cubeforge/solver-engine";

// ── Mappings ─────────────────────────────────────────────────────────────

/** All puzzle categories selectable in the UI, in display order. */
export const PUZZLE_CATEGORIES: PuzzleCategory[] = [
  "2x2",
  "3x3",
  "4x4",
  "5x5",
  "6x6",
  "7x7",
  "3x3 OH",
  "Megaminx",
  "Pyraminx",
  "Skewb",
];

/** Map a UI PuzzleCategory to the database puzzle_type string. */
export function puzzleCategoryToType(category: PuzzleCategory): string {
  switch (category) {
    case "2x2":
      return "2x2x2";
    case "3x3":
    case "3x3 OH":
      return "3x3x3";
    // Other categories not yet implemented — default to 3×3
    default:
      return "3x3x3";
  }
}

/** Map a UI PuzzleCategory to the 3D engine cube order (2 or 3). */
export function puzzleCategoryToOrder(category: PuzzleCategory): number {
  switch (category) {
    case "2x2":
      return 2;
    default:
      return 3;
  }
}

// ── Singleton solvers / scramblers (tables built once, shared globally) ──

let min2phaseSolver: Min2PhaseSolver | null = null;
let twoByTwoScrambler: TwoByTwoScrambler | null = null;
let preloaded = false;

/** Get or create the singleton Min2Phase solver (3×3). */
export function getMin2PhaseSolver(): Min2PhaseSolver {
  if (!min2phaseSolver) min2phaseSolver = new Min2PhaseSolver();
  return min2phaseSolver;
}

/** Get or create the singleton 2×2 scrambler (includes the combined table). */
export function getTwoByTwoScrambler(): TwoByTwoScrambler {
  if (!twoByTwoScrambler) {
    twoByTwoScrambler = new TwoByTwoScrambler(new TwoByTwoSolver());
  }
  return twoByTwoScrambler;
}

/**
 * Pre-initialise all solvers at app startup.
 *
 * Call once from an App-level effect. After this, the first scramble for
 * either puzzle type is instant (< 1 ms) instead of paying the 150-800 ms
 * initialisation cost at that moment.
 *
 * This is safe to call multiple times (idempotent).
 */
export function preloadSolvers(): void {
  if (preloaded) return;
  preloaded = true;

  // Warm up the 3×3 Min2Phase WASM tables (~150-350 ms)
  getMin2PhaseSolver().init();

  // Warm up the 2×2 combined BFS table (~800 ms)
  // We need to init the solver before wrapping it in the scrambler
  const solver = new TwoByTwoSolver();
  solver.init();
  twoByTwoScrambler = new TwoByTwoScrambler(solver);

  console.log('[puzzleUtils] Solvers preloaded: 3×3 Min2Phase + 2×2 combined table');
}

/**
 * Generate a scramble for the given puzzle category.
 *
 * 2×2: WCA-style random-state scramble via TwoByTwoScrambler (U/R/F only, ≤11 moves).
 * 3×3 (and others): random-state scramble via RandomStateGenerator + Min2Phase.
 */
export function generateScrambleFor(category: PuzzleCategory): string {
  switch (category) {
    case "2x2":
      return getTwoByTwoScrambler().generateScramble();
    default:
      return RandomStateGenerator.generateScramble(getMin2PhaseSolver());
  }
}

/**
 * Check if a solve's puzzleType matches the given category.
 * Falls back to '3x3x3' when puzzleType is undefined (backward compat).
 */
export function solveMatchesCategory(
  solvePuzzleType: string | undefined,
  category: PuzzleCategory,
): boolean {
  const solveType = solvePuzzleType ?? "3x3x3";
  return solveType === puzzleCategoryToType(category);
}
