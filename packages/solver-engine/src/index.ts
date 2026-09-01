export { Min2PhaseSolver } from './Min2PhaseSolver';
export { RandomStateGenerator } from './RandomStateGenerator';
export type { ISolver } from './RandomStateGenerator';

// 2×2 (Pocket Cube) optimal solver + scrambler
export { TwoByTwoSolver, type TwoByTwoSolution } from './TwoByTwoSolver';
export { TwoByTwoScrambler } from './TwoByTwoScrambler';
export {
  PhaseSolver,
  solveCross,
  crossDepth,
  bestCrossFace,
  invertMoves,
  movesToNotation,
  type PhaseSolution,
  type SolvePhaseOptions,
} from './PhaseSolver';
export {
  CrossScrambleGenerator,
  type CrossScrambleOptions,
  type CrossScrambleResult,
} from './CrossScrambleGenerator';

// Pyraminx random-state solver + scrambler (clean-room implementation of
// the official WCA scramble — see Fase-D2-Pyraminx-Cleanroom.md)
export {
  PYRAMINX_MOVE_NAMES,
  PYRAMINX_TIP_NAMES,
  PYRAMINX_SCRAMBLE_LENGTH,
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
