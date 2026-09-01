/**
 * Pyraminx-only entry point — `@cubeforge/solver-engine/pyraminx`.
 *
 * Re-exports the clean-room WCA scrambler WITHOUT the min2phase WASM solver
 * (which lives in the main index). The main index loads min2phase.js at
 * import time (WASM), which is heavy for consumers that only need the
 * Pyraminx state model and scrambles — e.g. the 3D engine's tests and
 * PyraminxState bridge.
 */
export {
  PYRAMINX_MOVE_NAMES,
  PYRAMINX_TIP_NAMES,
  PYRAMINX_SCRAMBLE_LENGTH,
  PYRAMINX_MIN_DISTANCE,
  PYRAMINX_A4_PERMUTATIONS,
  PYRAMINX_SOLVED_STATES,
  solvedPyraminx,
  isPyraminxSolved,
  isPyraminxSolvedAnyOrientation,
  relabelPyraminxState,
  computePyraminxSolvedStates,
  isPyraminxReachable,
  randomPyraminxState,
  applyPyraminxMove,
  applyPyraminxTip,
  applyPyraminxSequence,
  generatePyraminxScramble,
  isValidPyraminxScramble,
  pyraminxDistance,
  pyraminxDistanceBound,
  type PyraminxState,
  type Rng,
} from './PyraminxSolver';
