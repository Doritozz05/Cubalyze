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
 * Schedule a callback during browser idle time, falling back to a short
 * timeout when requestIdleCallback is unavailable (SSR, older browsers).
 */
type IdleCallbackWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
};

function scheduleIdle(fn: () => void): void {
  const w = typeof window !== 'undefined' ? (window as IdleCallbackWindow) : null;
  if (w?.requestIdleCallback) {
    w.requestIdleCallback(fn, { timeout: 4000 });
  } else if (w) {
    w.setTimeout(fn, 200);
  }
}

/**
 * Pre-initialise all solvers at app startup — without blocking the main
 * thread.
 *
 * The combined 2×2 table takes ~800 ms and Min2Phase WASM ~150-350 ms. Running
 * them synchronously on mount janks the first paint, so this version:
 *  1. Defers the heavy work to browser idle time (requestIdleCallback).
 *  2. Splits the two heavy inits across two idle slots so the main thread
 *     breathes between them.
 *
 * The getters remain lazy, so a scramble generated before the idle work
 * completes still works (it just pays the init cost at that moment).
 *
 * Safe to call multiple times (idempotent).
 */
export function preloadSolvers(): void {
  if (preloaded) return;
  preloaded = true;

  // Warm up the 3×3 Min2Phase WASM tables (~150-350 ms)
  scheduleIdle(() => {
    getMin2PhaseSolver().init();
  });

  // Warm up the 2×2 combined BFS table (~800 ms) in a separate idle slot.
  // We need to init the solver before wrapping it in the scrambler.
  scheduleIdle(() => {
    if (twoByTwoScrambler) return; // already created lazily
    const solver = new TwoByTwoSolver();
    solver.init();
    twoByTwoScrambler = new TwoByTwoScrambler(solver);
  });
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

