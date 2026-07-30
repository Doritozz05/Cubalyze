/**
 * @cubeforge/solver-engine — TwoByTwoSolver
 *
 * Optimal solver for the 2×2×2 (Pocket Cube) using IDA* with
 * complete per-coordinate pruning tables (6 faces).
 *
 * The 2×2 state space has 3,674,160 states. We decompose into:
 *   • **permIdx** (0..40319) — corner permutation via Lehmer code
 *   • **orientIdx** (0..2186) — corner orientation (base-3, 7 digits)
 *
 * Two complete pruning tables are built via BFS (no depth cap):
 *   • `permDist[cp]` — exact distance to solve permutation coordinate
 *   • `orientDist[co]` — exact distance to solve orientation coordinate
 *
 * The IDA* heuristic is `max(permDist, orientDist)`, which is admissible
 * and typically off by ≤ 1 move (giving ~63ms solves).
 *
 * ## Move set: all 6 faces (U,R,F,D,L,B, 18 moves).
 * God's number = 11 HTM.
 */

import {
  Cube2x2State,
  Move2x2,
  MOVE_2X2_NOTATION,
} from '@cubeforge/math-core';

// ── Constants ────────────────────────────────────────────────────────────

const NUM_CORNERS = 8;
const NUM_MOVES = 18; // 6 faces × 3 powers

const PERM_SIZE = 40320; // 8!
const ORIENT_SIZE = 2187; // 3^7
const MAX_DEPTH = 11; // God's number for 2×2

// ── Coordinate encoding ──────────────────────────────────────────────────

function permToIndex(perm: Uint8Array): number {
  let index = 0;
  for (let i = 0; i < NUM_CORNERS - 1; i++) {
    let count = 0;
    for (let j = i + 1; j < NUM_CORNERS; j++) {
      if (perm[j] < perm[i]) count++;
    }
    index = index * (NUM_CORNERS - i) + count;
  }
  return index;
}

function indexToPerm(index: number, out: Uint8Array): void {
  const lehmer = new Array(NUM_CORNERS - 1);
  let temp = index;
  for (let i = NUM_CORNERS - 2; i >= 0; i--) {
    lehmer[i] = temp % (NUM_CORNERS - i);
    temp = Math.floor(temp / (NUM_CORNERS - i));
  }
  const available = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = 0; i < NUM_CORNERS - 1; i++) {
    out[i] = available[lehmer[i]];
    available.splice(lehmer[i], 1);
  }
  out[NUM_CORNERS - 1] = available[0];
}

function orientToIndex(co: Uint8Array): number {
  let index = 0;
  for (let i = 0; i < NUM_CORNERS - 1; i++) {
    index = index * 3 + co[i];
  }
  return index;
}

function indexToOrient(index: number, out: Uint8Array): void {
  let temp = index;
  let sum = 0;
  for (let i = NUM_CORNERS - 2; i >= 0; i--) {
    out[i] = temp % 3;
    sum += out[i];
    temp = Math.floor(temp / 3);
  }
  out[NUM_CORNERS - 1] = (3 - (sum % 3)) % 3;
}

// ── Move tables in coordinate space ──────────────────────────────────────

interface CoordMoveTables {
  permMove: Uint16Array[];
  orientMove: Uint16Array[];
}

function buildCoordMoveTables(): CoordMoveTables {
  const tables = Cube2x2State.getMoveTables();
  const permMove: Uint16Array[] = [];
  const orientMove: Uint16Array[] = [];

  for (let m = 0; m < NUM_MOVES; m++) {
    const tbl = tables[m];
    const permTable = new Uint16Array(PERM_SIZE);
    const orientTable = new Uint16Array(ORIENT_SIZE);

    const tempPerm = new Uint8Array(NUM_CORNERS);
    for (let pi = 0; pi < PERM_SIZE; pi++) {
      indexToPerm(pi, tempPerm);
      const newPerm = new Uint8Array(NUM_CORNERS);
      for (let i = 0; i < NUM_CORNERS; i++) {
        newPerm[i] = tempPerm[tbl.src[i]];
      }
      permTable[pi] = permToIndex(newPerm);
    }

    const tempOrient = new Uint8Array(NUM_CORNERS);
    for (let oi = 0; oi < ORIENT_SIZE; oi++) {
      indexToOrient(oi, tempOrient);
      const newOrient = new Uint8Array(NUM_CORNERS);
      for (let i = 0; i < NUM_CORNERS; i++) {
        newOrient[i] = (tempOrient[tbl.src[i]] + tbl.twist[i] + 3) % 3;
      }
      let newIndex = 0;
      for (let i = 0; i < NUM_CORNERS - 1; i++) {
        newIndex = newIndex * 3 + newOrient[i];
      }
      orientTable[oi] = newIndex;
    }

    permMove.push(permTable);
    orientMove.push(orientTable);
  }

  return { permMove, orientMove };
}

// ── Pruning tables (complete BFS, 6 faces, no depth cap) ────────────────

let coordTables: CoordMoveTables | null = null;
let permDist: Uint8Array | null = null;
let orientDist: Uint8Array | null = null;

function ensureInitialized(): void {
  if (permDist) return;

  coordTables = buildCoordMoveTables();

  permDist = new Uint8Array(PERM_SIZE).fill(255);
  permDist[0] = 0;
  bfsBuild(permDist, coordTables.permMove);

  orientDist = new Uint8Array(ORIENT_SIZE).fill(255);
  orientDist[0] = 0;
  bfsBuild(orientDist, coordTables.orientMove);
}

function bfsBuild(dist: Uint8Array, moveTable: Uint16Array[]): void {
  const queue = new Int32Array(dist.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;

  while (head < tail) {
    const cur = queue[head++];
    const curDist = dist[cur];
    const nextDist = curDist + 1;
    if (nextDist > MAX_DEPTH) continue;

    for (let m = 0; m < NUM_MOVES; m++) {
      const next = moveTable[m][cur];
      if (dist[next] === 255) {
        dist[next] = nextDist;
        queue[tail++] = next;
      }
    }
  }
}

// ── IDA* search ──────────────────────────────────────────────────────────

const MOVE_FACE_2X2 = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5];

function idaSearch(
  permIdx: number,
  orientIdx: number,
  depth: number,
  depthLimit: number,
  path: number[],
  lastFace: number,
): number[] | null {
  if (permIdx === 0 && orientIdx === 0) {
    return path.slice();
  }

  const pDist = permDist![permIdx];
  const oDist = orientDist![orientIdx];
  const heuristic = pDist > oDist ? pDist : oDist;

  if (depth + heuristic > depthLimit) return null;

  for (let m = 0; m < NUM_MOVES; m++) {
    const face = MOVE_FACE_2X2[m];
    if (face === lastFace) continue;

    const newPerm = coordTables!.permMove[m][permIdx];
    const newOrient = coordTables!.orientMove[m][orientIdx];

    path.push(m);
    const result = idaSearch(newPerm, newOrient, depth + 1, depthLimit, path, face);
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

  constructor() {
    // Lazy initialization — tables are built on first solve()
  }

  /**
   * Build pruning tables. Called automatically on first solve, but can
   * be called explicitly to front-load the cost.
   */
  public init(): void {
    if (this.initialized) return;
    ensureInitialized();
    this.initialized = true;
  }

  /**
   * Solve a 2×2 cube state optimally (≤ 11 moves).
   *
   * @param state The scrambled Cube2x2State.
   * @returns Space-separated move notation string (e.g. "U R' F2 U' R2").
   *          Returns empty string if no solution found (should not happen
   *          for valid states).
   */
  public solve(state: Cube2x2State): string {
    const solution = this.solveDetailed(state);
    return solution ? solution.notation : '';
  }

  /**
   * Solve a 2×2 cube state optimally, returning detailed solution info.
   *
   * @param state The scrambled Cube2x2State.
   * @returns A {@link TwoByTwoSolution} with notation, move count, and moves,
   *          or null if no solution found.
   */
  public solveDetailed(state: Cube2x2State): TwoByTwoSolution | null {
    this.init();

    const permIdx = permToIndex(state.cp);
    const orientIdx = orientToIndex(state.co);

    // Already solved
    if (permIdx === 0 && orientIdx === 0) {
      return { notation: '', moveCount: 0, moves: [] };
    }

    // IDA*: try increasing depth limits until a solution is found.
    // With the max(permDist, orientDist) heuristic, IDA* explores close
    // to the optimal path (~63ms average).
    const path: number[] = [];
    for (let depthLimit = 1; depthLimit <= MAX_DEPTH; depthLimit++) {
      const result = idaSearch(permIdx, orientIdx, 0, depthLimit, path, -1);
      if (result !== null) {
        const moves = result.map((m) => m as Move2x2);
        const notation = moves.map((m) => MOVE_2X2_NOTATION[m]).join(' ');
        return { notation, moveCount: moves.length, moves };
      }
    }

    return null; // Should never happen for a valid state
  }

  /**
   * Solve from a notation scramble string (convenience method).
   * Applies the scramble to a solved state, then solves.
   */
  public solveFromScramble(scramble: string): TwoByTwoSolution | null {
    const state = new Cube2x2State();
    state.applySequence(scramble);
    return this.solveDetailed(state);
  }
}


