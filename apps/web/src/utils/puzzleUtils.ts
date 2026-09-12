/**
 * Puzzle utility helpers.
 *
 * Maps the UI {@link PuzzleCategory} to:
 *   • `puzzleType` — the database identifier (the WCA event code, ADR-002:
 *     '333', '222', '333oh', …)
 *   • `order` — the cube dimension for the 3D engine (2 or 3)
 *   • scramble generation — delegates to the registered ScrambleProvider
 *
 * Only events with a real provider are functional (2×2, 3×3, 3×3 OH and
 * Pyraminx as of phase D2); the others return "" — never a silent 3×3
 * fallback.
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
  EVENT_REGISTRY,
  generateScramble,
  getEvent,
  isPuzzleType,
  type PuzzleType,
} from "@cubeforge/events";
import { Min2PhaseSolver, TwoByTwoScrambler, TwoByTwoSolver } from "@cubeforge/solver-engine";

// ── Mappings ─────────────────────────────────────────────────────────────

/** Map a UI PuzzleCategory to the canonical database puzzle_type (WCA code, ADR-002). */
export function puzzleCategoryToType(category: PuzzleCategory): PuzzleType {
  switch (category) {
    case "2x2":
      return "222";
    case "3x3":
      return "333";
    case "3x3 OH":
      return "333oh"; // OH is its own event — never mixed with 333
    case "Pyraminx":
      return "pyram"; // phase D2 — real random-state provider
    case "FTO":
      return "fto";
    // Categories without a real implementation keep the safe storage
    // default; the SELECTOR no longer offers them (phase A6) and
    // generateScrambleFor never lies.
    default:
      return "333";
  }
}

/** UI category → WCA event code (the registry id = the puzzle_type, ADR-002). */
const CATEGORY_TO_EVENT_CODE: Record<PuzzleCategory, PuzzleType> = {
  "2x2": "222",
  "3x3": "333",
  "3x3 OH": "333oh",
  "4x4": "444",
  "5x5": "555",
  "6x6": "666",
  "7x7": "777",
  Megaminx: "minx",
  Pyraminx: "pyram",
  Skewb: "skewb",
  FTO: "fto",
};

/**
 * WCA event code → UI category, for the categories the UI exposes today.
 * Events without a UI category (sq1, bld×3, fm, mbf, clock) are simply not
 * rendered — they are declared in the registry and appear once implemented.
 */
const EVENT_TO_CATEGORY: Partial<Record<PuzzleType, PuzzleCategory>> = Object.fromEntries(
  (Object.entries(CATEGORY_TO_EVENT_CODE) as [PuzzleCategory, PuzzleType][]).map(([c, t]) => [t, c]),
);

/** One entry of the data-driven puzzle selector (phase A6). */
export interface PuzzleSelectorItem {
  /** The UI category shown to the user. */
  category: PuzzleCategory;
  /** True when a real scramble provider is registered (playable today). */
  playable: boolean;
  /** True when the event is on the WCA calendar but not yet official/available (e.g. FTO). */
  planned: boolean;
}

/**
 * The puzzle selector, generated FROM THE REGISTRY (phase A6).
 *
 * Only two kinds of events appear:
 *   • events with a real scramble provider (playable) — 2×2, 3×3, 3×3 OH,
 *     Pyraminx (phase D2)
 *   • events marked "planned" on the WCA calendar (disabled, e.g. FTO)
 *
 * The ghost puzzles (4×4–7×7, Megaminx, Skewb, …) have NO provider and are
 * NOT shown — they never were functional, the selector was lying.
 */
export const PUZZLE_SELECTOR: readonly PuzzleSelectorItem[] = EVENT_REGISTRY.filter(
  (e) => (e.scrambleProvider !== null && e.status === "available") || e.status === "planned",
)
  .map((e) => {
    const category = EVENT_TO_CATEGORY[e.id];
    if (!category) return null;
    return {
      category,
      playable: e.scrambleProvider !== null,
      planned: e.status === "planned",
    };
  })
  .filter((x): x is PuzzleSelectorItem => x !== null);

/** Categories with a real provider — the enabled entries of the selector. */
export const SELECTABLE_PUZZLE_CATEGORIES: readonly PuzzleCategory[] = PUZZLE_SELECTOR.filter(
  (i) => i.playable,
).map((i) => i.category);

/** Resolve the event spec behind a UI category. */
export function getEventForCategory(category: PuzzleCategory) {
  return getEvent(CATEGORY_TO_EVENT_CODE[category]);
}

// ── Solving-method scope (one rule, one place) ───────────────────────────────
//
// `solves.method` used to be a blind copy of the global
// `preferencesStore.method`, so EVERY event persisted "CFOP" — including the
// ones that have no method at all (2×2, Pyraminx, and whatever comes next).
// The registry already declares, per event, which methods the ANALYSIS engine
// can detect (`EventSpec.analysis.methods`: `["CFOP", "Roux"]` for 3×3 and
// 3×3 OH, `[]` for every other event), and that is the only honest rule
// available:
//
//   • event declares methods (333, 333oh) → persist the user's method;
//   • event declares none                  → persist nothing (undefined).
//
// It is deliberately NOT "is this method allowed here": the registry describes
// analysis capability, not what the user may solve with. Someone solving 3×3
// with ZZ has a fact worth storing even though the phase detector only knows
// CFOP/Roux.

/**
 * The method to persist for a solve of `puzzleType`, or `undefined` when the
 * event has no method concept at all.
 *
 * Used by every writer of `solves.method` (timer, manual entry, import) so the
 * rule cannot drift between them.
 */
export function methodForEvent<M extends string>(
  puzzleType: string,
  preferred: M,
): M | undefined {
  // Unknown/legacy codes carry no method either: the DB never accepts them,
  // and guessing "333" here would resurrect the exact bug this fixes.
  if (!isPuzzleType(puzzleType)) return undefined;
  const spec = getEvent(puzzleType);
  return (spec?.analysis.methods.length ?? 0) > 0 ? preferred : undefined;
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
 * Generate a scramble for the given UI category.
 *
 * Resolves the category to its event spec and delegates to the registered
 * ScrambleProvider (phase A4). Events without a provider (4×4–7×7, Megaminx,
 * Skewb, …) return "" — there is NO silent 3×3 fallback; the selector gates
 * those categories in phase A6.
 */
export function generateScrambleFor(category: PuzzleCategory): string {
  const event = getEventForCategory(category);
  if (!event) return "";
  return generateScramble(event) ?? "";
}

