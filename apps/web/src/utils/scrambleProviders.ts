import {
  MIN2PHASE_PROVIDER,
  PYRAMINX_PROVIDER,
  TWO_BY_TWO_PROVIDER,
  getScrambleProvider,
  registerScrambleProvider,
  type ScrambleProvider,
} from "@cubeforge/events";
import { Cube2x2State, CubeState } from "@cubeforge/math-core";
import {
  RandomStateGenerator,
  applyPyraminxSequence,
  generatePyraminxScramble,
  isPyraminxSolved,
  solvedPyraminx,
} from "@cubeforge/solver-engine";
import { getMin2PhaseSolver, getTwoByTwoScrambler } from "./puzzleUtils";

/**
 * Concrete ScrambleProvider implementations (TDD A4).
 *
 * The @cubeforge/events package only declares the contract; the real 2×2/3×3
 * scramblers live here, wrapping the lazy solver singletons from puzzleUtils
 * so scramble output is byte-identical to the previous direct calls. The
 * module self-registers on import so the registry is ready before the first
 * scramble is generated (the scramble state initializer runs during render).
 */

function countMoves(scramble: string): number {
  const trimmed = scramble.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function validate3x3(scramble: string): boolean {
  // WCA: no scramble may be solvable in fewer than 2 moves.
  if (countMoves(scramble) < 2) return false;
  try {
    const state = new CubeState();
    state.applySequence(scramble);
    return !state.isSolved();
  } catch {
    return false;
  }
}

function validate2x2(scramble: string): boolean {
  if (countMoves(scramble) < 2) return false;
  try {
    const state = new Cube2x2State();
    state.applySequence(scramble);
    return !state.isSolved();
  } catch {
    return false;
  }
}

function validatePyraminx(scramble: string): boolean {
  // WCA 4b3 spirit: parses, leaves the puzzle scrambled, ≥ 2 moves.
  if (countMoves(scramble) < 2) return false;
  try {
    const applied = applyPyraminxSequence(solvedPyraminx(), scramble);
    if (!applied) return false; // unknown/invalid move token
    return !isPyraminxSolved(applied);
  } catch {
    return false;
  }
}

const min2PhaseProvider: ScrambleProvider = {
  id: MIN2PHASE_PROVIDER,
  generate: () => RandomStateGenerator.generateScramble(getMin2PhaseSolver()),
  validate: (_event, scramble) => validate3x3(scramble),
};

const twoByTwoProvider: ScrambleProvider = {
  id: TWO_BY_TWO_PROVIDER,
  generate: () => getTwoByTwoScrambler().generateScramble(),
  validate: (_event, scramble) => validate2x2(scramble),
};

/**
 * Pyraminx random-state scrambler (phase D2) — clean-room implementation of
 * the official WCA scramble (see Fase-D2-Pyraminx-Cleanroom.md). Tables are
 * tiny (~7.5K entries, built once lazily), so no singleton/preload is needed.
 */
const pyraminxProvider: ScrambleProvider = {
  id: PYRAMINX_PROVIDER,
  generate: () => generatePyraminxScramble(),
  validate: (_event, scramble) => validatePyraminx(scramble),
};

/** Register all providers (idempotent — safe under HMR/double imports). */
export function registerScrambleProviders(): void {
  if (getScrambleProvider(MIN2PHASE_PROVIDER)) return;
  registerScrambleProvider(min2PhaseProvider);
  registerScrambleProvider(twoByTwoProvider);
  registerScrambleProvider(pyraminxProvider);
}

// Self-register on import: App.tsx imports this module before rendering, so
// the registry is populated before useScrambleState generates the first
// scramble.
registerScrambleProviders();
