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
 */

import type { PuzzleCategory } from "@/types";
import {
  RandomStateGenerator,
  Min2PhaseSolver,
  TwoByTwoScrambler,
  TwoByTwoSolver,
} from "@cubeforge/solver-engine";

// ── Mappings ─────────────────────────────────────────────────────────────

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

// ── Lazy singleton scramblers (tables built once) ────────────────────────

let min2phaseSolver: Min2PhaseSolver | null = null;
let twoByTwoScrambler: TwoByTwoScrambler | null = null;

function getMin2PhaseSolver(): Min2PhaseSolver {
  if (!min2phaseSolver) min2phaseSolver = new Min2PhaseSolver();
  return min2phaseSolver;
}

function getTwoByTwoScrambler(): TwoByTwoScrambler {
  if (!twoByTwoScrambler) {
    twoByTwoScrambler = new TwoByTwoScrambler(new TwoByTwoSolver());
  }
  return twoByTwoScrambler;
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
