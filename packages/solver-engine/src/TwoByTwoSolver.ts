/**
 * @cubalyze/solver-engine — TwoByTwoSolver
 *
 * Optimal solver for the 2×2×2 (Pocket Cube) using a combined pruning
 * table and IDA* search with exact heuristic.
 *
 * ## Professional approach (Kociemba / cubing.js / WCA standard)
 *
 * The **DBL corner (position 6) is held fixed**. This is the standard
 * approach used by WCA scramblers (WCA regulation 4b3b) and professional
 * solvers. By fixing one corner:
 *
 *   • Only 7 corners need to be tracked → 7! = **5,040** permutations
 *   • Only 6 orientations need to be stored → 3⁶ = **729** twists
 *   • Combined state space: 5,040 × 729 = **3,674,160 states** (vs 88M)
 *   • Combined pruning table: **3.67 MB** (vs 84 MB for 8-corners)
 *   • Only **3 faces (U, R, F)** are needed = **9 moves total**
 *
 * ## Algorithm
 *
 *   1. Build coordinate move tables for all 9 moves (U,R,F).
 *   2. BFS from the solved state builds a **combined** pruning table
 *      `dist[permIdx × 729 + twistIdx]` with exact distances (0-11).
 *   3. IDA* uses the combined table as an **exact heuristic**,
 *      exploring only the optimal path **(<1 ms per solve)**.
 *
 * ## God's number for 2×2 = 11 HTM (half-turn metric)
 *
 * @see {@link https://github.com/hkociemba/Rubiks2x2x2-OptimalSolver}
 *      Reference implementation by Herbert Kociemba
 */

import {
  Cube2x2State,
  Move2x2,
  MOVE_2X2_NOTATION,
} from '@cubalyze/math-core';

// ── Constants ────────────────────────────────────────────────────────────
// DBL corner (index 6) is fixed. 7 corners move among 7 positions.
// 7 corners → 7! = 5040 permutations, 3⁶ = 729 orientations.

const NUM_CORNERS = 8;         // Total corners in the physical cube
const NUM_MOVES = 9;           // U,R,F × 3 powers (DBL fixed → 3 faces only)
const N_PERM = 5040;           // 7!
const N_TWIST = 729;           // 3⁶
const N_STATES = N_PERM * N_TWIST;  // 3,674,160
const MAX_DEPTH = 11;          // God's number for 2×2

/** Positions we track (all except DBL = index 6). */
const TRACKED: readonly number[] = [0, 1, 2, 3, 4, 5, 7];

/** Maps each full 8-corner position to its tracked index (0..6), or -1 for DBL. */
const POS_TO_TRACKED: number[] = (() => {
  const map = new Array(8).fill(-1);
  for (let t = 0; t < TRACKED.length; t++) map[TRACKED[t]] = t;
  return map;
})();

/** Face index for each of the 9 moves (U=R0, R=R1, F=F2). */
const MOVE_FACE = [0, 0, 0, 1, 1, 1, 2, 2, 2];
const FACE_NAMES = ['U', 'R', 'F'];

/** Fisher-Yates shuffle in-place over an array of move indices. */
function fisherYatesShuffle(arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// ── 7-corner coordinate encoding ─────────────────────────────────────────
//
// Permutation: Lehmer code over 7 tracked positions.
// Twist:       Base-3 number over the first 6 tracked corners (7th is derived).

/** Encode a full 8-element cp array into a 7-permutation index (0..5039). */
function permToIndex(cp: Uint8Array): number {
  const tcp = new Uint8Array(7);
  for (let i = 0; i < 7; i++) tcp[i] = cp[TRACKED[i]];

  let idx = 0;
  for (let i = 0; i < 6; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 7; j++) {
      if (tcp[j] < tcp[i]) smaller++;
    }
    idx = idx * (7 - i) + smaller;
  }
  return idx;
}

/** Decode a 7-permutation index back into a full 8-element cp array. */
function indexToPerm(idx: number, out: Uint8Array): void {
  // Lehmer digits — the encoding multiplies by 7,6,5,4,3,2 in that order.
  // To decode we divide in REVERSE order: 2,3,4,5,6,7.
  const lehmer = new Array(6);
  let temp = idx;
  for (let i = 0; i < 6; i++) {
    lehmer[5 - i] = temp % (2 + i);
    temp = Math.floor(temp / (2 + i));
  }

  // Build tracked permutation from Lehmer
  const available = [0, 1, 2, 3, 4, 5, 7]; // IDs of the 7 tracked corners
  const tcp = new Uint8Array(7);
  for (let i = 0; i < 6; i++) {
    tcp[i] = available[lehmer[i]];
    available.splice(lehmer[i], 1);
  }
  tcp[6] = available[0];

  // Map back to full cp
  out[6] = 6; // DBL fixed
  for (let i = 0; i < 7; i++) out[TRACKED[i]] = tcp[i];
}

/** Encode a full 8-element co array into a twist index (0..728). */
function twistToIndex(co: Uint8Array): number {
  let idx = 0;
  for (let i = 0; i < 6; i++) {
    idx = idx * 3 + co[TRACKED[i]];
  }
  return idx;
}

/** Decode a twist index back into a full 8-element co array. */
function indexToTwist(idx: number, out: Uint8Array): void {
  out[6] = 0; // DBL fixed orientation
  let sum = 0;
  let temp = idx;
  // Decode 6 base-3 digits into TRACKED positions 0..5 (index 5 is last digit)
  for (let i = 5; i >= 0; i--) {
    const val = temp % 3;
    out[TRACKED[i]] = val;
    sum += val;
    temp = Math.floor(temp / 3);
  }
  // Derive the 7th tracked orientation (position 7) from sum % 3
  out[TRACKED[6]] = (3 - (sum % 3)) % 3;
}

// ── Coordinate move tables ───────────────────────────────────────────────

interface MoveTables {
  permMove: Uint16Array[];   // 9 moves × 5040 entries
  twistMove: Uint16Array[];  // 9 moves × 729 entries
}

function buildMoveTables(): MoveTables {
  const tables = Cube2x2State.getMoveTables(); // 18 tables (8-corner)

  const permMove: Uint16Array[] = [];
  const twistMove: Uint16Array[] = [];

  const tempCp = new Uint8Array(NUM_CORNERS);
  const tempCo = new Uint8Array(NUM_CORNERS);
  const scratch = new Uint8Array(NUM_CORNERS);

  for (let m = 0; m < NUM_MOVES; m++) {
    const tbl = tables[m];

    // Permutation table
    const pTable = new Uint16Array(N_PERM);
    for (let pi = 0; pi < N_PERM; pi++) {
      indexToPerm(pi, tempCp);
      for (let i = 0; i < NUM_CORNERS; i++) scratch[i] = tempCp[tbl.src[i]];
      pTable[pi] = permToIndex(scratch);
    }

    // Twist table
    const tTable = new Uint16Array(N_TWIST);
    for (let ti = 0; ti < N_TWIST; ti++) {
      indexToTwist(ti, tempCo);
      for (let i = 0; i < NUM_CORNERS; i++) {
        scratch[i] = (tempCo[tbl.src[i]] + tbl.twist[i] + 3) % 3;
      }
      tTable[ti] = twistToIndex(scratch);
    }

    permMove.push(pTable);
    twistMove.push(tTable);
  }

  return { permMove, twistMove };
}

// ── Combined pruning table ───────────────────────────────────────────────
// 3.67 MB array: dist[perm × 729 + twist] = exact distance (0-11, or 255).

let tables: MoveTables | null = null;
let combinedDist: Uint8Array | null = null;

function ensureInitialized(): void {
  if (combinedDist) return;

  const currentTables = buildMoveTables();
  tables = currentTables;

  const dist = new Uint8Array(N_STATES).fill(255);
  dist[0] = 0;

  // BFS over all 3.67M valid states
  const queue = new Int32Array(N_STATES);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;

  while (head < tail) {
    const cur = queue[head++];
    const curDist = dist[cur];
    const nextDist = curDist + 1;
    if (nextDist > MAX_DEPTH) continue;

    const curPerm = (cur / N_TWIST) | 0;
    const curTwist = cur % N_TWIST;

    const pm = currentTables.permMove;
    const tm = currentTables.twistMove;

    for (let m = 0; m < NUM_MOVES; m++) {
      const next = pm[m][curPerm] * N_TWIST + tm[m][curTwist];
      if (dist[next] === 255) {
        dist[next] = nextDist;
        queue[tail++] = next;
      }
    }
  }

  combinedDist = dist;
}

// ── IDA* search ──────────────────────────────────────────────────────────
// With exact heuristic, IDA* explores only the optimal path.

function idaSearch(
  permIdx: number,
  twistIdx: number,
  depth: number,
  depthLimit: number,
  path: number[],
  lastFace: number,
  moveOrder: number[],
): number[] | null {
  if (permIdx === 0 && twistIdx === 0) {
    return path.slice();
  }

  const h = combinedDist![permIdx * N_TWIST + twistIdx];
  if (depth + h > depthLimit) return null;

  for (let mi = 0; mi < NUM_MOVES; mi++) {
    const m = moveOrder[mi];
    const face = MOVE_FACE[m];
    if (face === lastFace) continue;

    const nextPerm = tables!.permMove[m][permIdx];
    const nextTwist = tables!.twistMove[m][twistIdx];

    path.push(m);
    const result = idaSearch(nextPerm, nextTwist, depth + 1, depthLimit, path, face, moveOrder);
    if (result !== null) return result;
    path.pop();
  }

  return null;
}

/**
 * Exact-length IDA* search (TNoodle `generateExactly` equivalent).
 *
 * Finds a solution of EXACTLY `targetLength` moves for the given state,
 * mirroring the official scramble program (see `TwoByTwoCubePuzzle` in
 * tnoodle-lib, which generates 2×2 scrambles of exactly 11 moves via
 * `twoSolver.generateExactly(state, 11)`).
 *
 * Differences from `idaSearch`:
 *   • The search only succeeds when the state is solved AND the path is
 *     exactly `targetLength` moves long (it may pass through solved and
 *     "waste" moves coming back, as long as the length is exact).
 *   • Pruning is safe because the combined table gives the exact distance
 *     `h`: if `depth + h > targetLength`, no path can reach solved within
 *     the remaining budget.
 *   • Same-face pruning is kept, so the resulting scramble never contains
 *     consecutive moves of the same face (matches TNoodle's `search`, which
 *     skips `move / 3 == last_move / 3`).
 *
 * @returns The move-index path of exactly `targetLength` moves, or null if
 *          no such solution exists within the search budget.
 */
function idaSearchExact(
  permIdx: number,
  twistIdx: number,
  depth: number,
  targetLength: number,
  path: number[],
  lastFace: number,
  moveOrder: number[],
): number[] | null {
  // Solved with exactly `targetLength` moves → done.
  if (permIdx === 0 && twistIdx === 0) {
    return depth === targetLength ? path.slice() : null;
  }

  // No budget left to reach solved.
  if (depth >= targetLength) return null;

  const h = combinedDist![permIdx * N_TWIST + twistIdx];
  if (depth + h > targetLength) return null;

  for (let mi = 0; mi < NUM_MOVES; mi++) {
    const m = moveOrder[mi];
    const face = MOVE_FACE[m];
    if (face === lastFace) continue;

    const nextPerm = tables!.permMove[m][permIdx];
    const nextTwist = tables!.twistMove[m][twistIdx];

    path.push(m);
    const result = idaSearchExact(nextPerm, nextTwist, depth + 1, targetLength, path, face, moveOrder);
    if (result !== null) return result;
    path.pop();
  }

  return null;
}

// ── Public solver class ──────────────────────────────────────────────────

export interface TwoByTwoSolution {
  /** Space-separated move notation (e.g. "U R' F2"). */
  notation: string;
  /** Number of moves. */
  moveCount: number;
  /** The Move2x2[] sequence. */
  moves: Move2x2[];
}

export class TwoByTwoSolver {
  private initialized = false;

  /** Debug counter: how many IDA* nodes were explored in the last solve. */
  public lastSearchNodes = 0;

  constructor() {
    // Lazy initialization
  }

  /**
   * Build the combined pruning table. Called automatically on first solve,
   * but can be called explicitly to front-load the ~800ms build time.
   */
  public init(): void {
    if (this.initialized) return;
    ensureInitialized();
    this.initialized = true;
  }

  /**
   * Solve a 2×2 cube state optimally (≤ 11 moves).
   *
   * @param state The scrambled Cube2x2State. Must have the DBL corner
   *              (position 6) in its home position (WCA standard).
   * @returns Space-separated move notation (e.g. "U R' F2"). Returns
   *          empty string on invalid input or no solution.
   */
  public solve(state: Cube2x2State): string {
    const solution = this.solveDetailed(state);
    return solution ? solution.notation : '';
  }

  /**
   * Solve a 2×2 cube state optimally, returning detailed solution info.
   *
   * @param state The scrambled Cube2x2State.
   * @returns A {@link TwoByTwoSolution} or null if invalid / unsolvable.
   */
  public solveDetailed(state: Cube2x2State): TwoByTwoSolution | null {
    this.init();

    // The DBL corner (position 6) must be in its home position (WCA standard)
    if (state.cp[6] !== 6) return null;
    if (state.co[6] !== 0) return null;

    const permIdx = permToIndex(state.cp);
    const twistIdx = twistToIndex(state.co);

    // Already solved
    if (permIdx === 0 && twistIdx === 0) {
      return { notation: '', moveCount: 0, moves: [] };
    }

    // Validate state is in the combined table
    if (combinedDist![permIdx * N_TWIST + twistIdx] === 255) {
      return null; // Unreachable from solved via U,R,F (invalid state)
    }

    // IDA*: depthLimit climbs until we find the optimal solution.
    // With exact heuristic, the first success at depthLimit = optimal distance.
    this.lastSearchNodes = 0;
    const path: number[] = [];
    const moveOrder: number[] = Array.from({ length: NUM_MOVES }, (_, i) => i);
    fisherYatesShuffle(moveOrder);
    for (let d = 1; d <= MAX_DEPTH; d++) {
      const result = idaSearch(permIdx, twistIdx, 0, d, path, -1, moveOrder);
      if (result !== null) {
        const moves = result.map((m) => m as Move2x2);
        const notation = moves.map((m) => MOVE_2X2_NOTATION[m]).join(' ');
        return { notation, moveCount: moves.length, moves };
      }
    }

    return null; // Should never happen for a valid state
  }

  /**
   * Solve a 2×2 cube state in EXACTLY `length` moves (TNoodle `generateExactly`).
   *
   * The official scramble program writes 2×2 scrambles of exactly 11 moves
   * (`TWO_BY_TWO_MIN_SCRAMBLE_LENGTH = 11`, God's number for the 2×2) so
   * scrambles cannot be distinguished by length. This method finds a
   * (not necessarily optimal) solution of exactly `length` moves; invert it
   * to obtain the scramble. The resulting solution never repeats the same
   * face consecutively.
   *
   * @param state  The scrambled Cube2x2State (DBL corner fixed).
   * @param length Exact number of moves the solution must have.
   * @returns A {@link TwoByTwoSolution} with `moveCount === length`, or null
   *          if the state is invalid or no exact-length solution exists.
   */
  public solveDetailedExact(state: Cube2x2State, length: number): TwoByTwoSolution | null {
    this.init();

    // The DBL corner (position 6) must be in its home position (WCA standard)
    if (state.cp[6] !== 6) return null;
    if (state.co[6] !== 0) return null;

    const permIdx = permToIndex(state.cp);
    const twistIdx = twistToIndex(state.co);

    if (combinedDist![permIdx * N_TWIST + twistIdx] === 255) {
      return null; // Unreachable from solved via U,R,F (invalid state)
    }

    // Solved with length 0 is the only exact-length solution at length 0.
    if (length === 0) {
      return permIdx === 0 && twistIdx === 0
        ? { notation: '', moveCount: 0, moves: [] }
        : null;
    }

    // Invalid target: below the state's optimal depth, or beyond what the
    // search supports (God's number is 11; anything longer is a waste detour
    // that the search can still express, so cap at a sane maximum).
    if (length < 1 || length > 32) return null;

    const path: number[] = [];
    const moveOrder: number[] = Array.from({ length: NUM_MOVES }, (_, i) => i);
    fisherYatesShuffle(moveOrder);
    const result = idaSearchExact(permIdx, twistIdx, 0, length, path, -1, moveOrder);
    if (result === null) return null;

    const moves = result.map((m) => m as Move2x2);
    const notation = moves.map((m) => MOVE_2X2_NOTATION[m]).join(' ');
    return { notation, moveCount: moves.length, moves };
  }

  /**
   * Solve from a notation scramble string (convenience method).
   * Only U, R, F moves are supported (DBL-fixed constraint).
   * Returns null if the scramble contains D, L, B moves.
   */
  public solveFromScramble(scramble: string): TwoByTwoSolution | null {
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const face = token[0];
      if (!FACE_NAMES.includes(face)) return null;
    }

    const state = new Cube2x2State();
    state.applySequence(scramble);
    return this.solveDetailed(state);
  }
}
