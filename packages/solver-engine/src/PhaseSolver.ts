/**
 * @cubeforge/solver-engine — PhaseSolver
 *
 * Generic partial-goal solver that finds the SHORTEST move sequence(s) to
 * reach any target state described by a {@link PhaseMask}. Built on top of
 * the existing {@link CubeState} bit-level engine and
 * {@link StateMatcher.matchesMask}.
 *
 * Algorithm: Iterative Deepening Depth-First Search (IDDFS) with:
 *   • A pruning-table (pattern database) fast path for the cross sub-goal
 *     (pre-computed BFS distances of the 4 cross edges per face, built with
 *     a lightweight mini-state — no full CubeState cloning).
 *   • A generic {@link StateMatcher.matchesMask} fallback for arbitrary
 *     masks (xcross, xxcross, eocross, …).
 *   • Move-restriction pruning (only allow a subset of the 18 face turns).
 *   • Skip consecutive moves on the same face (R R' = identity, R R = R2).
 *   • Collect up to `maxSolutions` distinct solutions at the OPTIMAL depth.
 *
 * Reused by:
 *   • CrossScrambleGenerator (way-to-cross: verify a scramble's optimal
 *     cross depth equals the requested N).
 *   • The Cross Trainer UI (compute N optimal cross solutions to display +
 *     replay in 3D).
 *   • Future xcross / xxcross / eocross trainers (same code, different mask).
 */

import { CubeState, Move } from '@cubeforge/math-core';
import { StateMatcher, type PhaseMask } from '@cubeforge/math-core';
import { Edge } from '@cubeforge/math-core';

// ── Move tables ────────────────────────────────────────────────────────────

/** All 18 face turns (no slice / rotation) in canonical order. */
const ALL_FACE_MOVES: Move[] = [
  Move.U1, Move.U2, Move.U3,
  Move.R1, Move.R2, Move.R3,
  Move.F1, Move.F2, Move.F3,
  Move.D1, Move.D2, Move.D3,
  Move.L1, Move.L2, Move.L3,
  Move.B1, Move.B2, Move.B3,
];

/** Face index 0–5 for each face move (U,R,F,D,L,B). Used to skip same-face
 *  consecutive moves (e.g. R then R' is wasted). */
const MOVE_FACE_INDEX = [
  0, 0, 0, // U1 U2 U3
  1, 1, 1, // R1 R2 R3
  2, 2, 2, // F1 F2 F3
  3, 3, 3, // D1 D2 D3
  4, 4, 4, // L1 L2 L3
  5, 5, 5, // B1 B2 B3
];

/** Opposite-face pairs — never useful to do R then L (or D then U) in a row
 *  because the order is commutative; pick one canonical order. */
const OPPOSITE_FACE = [3, 4, 5, 0, 1, 2]; // U↔D, R↔L, F↔B

/** Inverse move index (U1↔U3, U2↔U2). Used for solution inversion. */
const INVERSE_MOVE: Move[] = [
  Move.U3, Move.U2, Move.U1,
  Move.R3, Move.R2, Move.R1,
  Move.F3, Move.F2, Move.F1,
  Move.D3, Move.D2, Move.D1,
  Move.L3, Move.L2, Move.L1,
  Move.B3, Move.B2, Move.B1,
];

/** Notation for each face turn (matches `StringToMove` keys). */
const MOVE_NOTATION: string[] = [
  'U', 'U2', "U'",
  'R', 'R2', "R'",
  'F', 'F2', "F'",
  'D', 'D2', "D'",
  'L', 'L2', "L'",
  'B', 'B2', "B'",
];

// ── Edge move tables (for fast mini-state PDB) ─────────────────────────────

/**
 * Pre-computed per-move edge permutation + flip tables.
 *
 * For each of the 18 face moves, `dest[p]` = the destination position of
 * the piece currently at source position `p`, and `flip[p]` = the
 * orientation change (XOR) for the piece at source `p`.
 *
 * Derived by applying each move to a solved CubeState and reading the
 * resulting ep/eo arrays. Computed once at module load.
 */
interface EdgeMoveTable {
  dest: Int8Array; // length 12
  flip: Int8Array; // length 12
}

const EDGE_MOVE_TABLES: EdgeMoveTable[] = ALL_FACE_MOVES.map((move) => {
  const s = new CubeState();
  s.applyMove(move);
  const dest = new Int8Array(12);
  const flip = new Int8Array(12);
  for (let d = 0; d < 12; d++) {
    const src = s.ep[d]; // piece at dest d came from source src
    dest[src] = d;
    flip[src] = s.eo[d];
  }
  return { dest, flip };
});

// ── Cross mini-state + Pattern Database ────────────────────────────────────

/**
 * The 4 cross edge PIECES for each of the 6 cross faces (matches
 * `FACE_LAYERS[face].crossEdges` in cfopMasks.ts).
 *
 * Index = face index 0–5 in the canonical U,R,F,D,L,B order.
 */
const CROSS_PIECES_BY_FACE: Edge[][] = [
  [Edge.UF, Edge.UR, Edge.UB, Edge.UL], // U
  [Edge.UR, Edge.DR, Edge.FR, Edge.BR], // R
  [Edge.UF, Edge.DF, Edge.FR, Edge.FL], // F
  [Edge.DF, Edge.DR, Edge.DB, Edge.DL], // D
  [Edge.UL, Edge.DL, Edge.FL, Edge.BL], // L
  [Edge.UB, Edge.DB, Edge.BR, Edge.BL], // B
];

/** Face name → index in our canonical U,R,F,D,L,B order. */
const FACE_NAME_TO_INDEX: Record<string, number> = {
  U: 0, R: 1, F: 2, D: 3, L: 4, B: 5,
};

/**
 * Encode a cross mini-state (4 piece positions + 4 orientations) into a
 * 20-bit key.
 *
 * Each position (0–11) uses 4 bits, each orientation (0–1) uses 1 bit.
 * Layout: [pos0|or0<<4] << 0  |  [pos1|or1<<4] << 5  |  [pos2|or2<<4] << 10  |  [pos3|or3<<4] << 15
 *
 * Key range: [0, 2^20) = [0, 1,048,576). The PDB is a Uint8Array of this size
 * (~1 MB per face). Only ~190K entries are reachable; the rest stay 255.
 */
function encodeMiniKey(pos: number[], or: number[]): number {
  let key = 0;
  for (let k = 0; k < 4; k++) {
    key |= (pos[k] | (or[k] << 4)) << (k * 5);
  }
  return key;
}

/**
 * Hoisted reverse-lookup buffer — reused across calls to avoid per-node
 * allocation. CubeStateToMiniKey is called at every IDDFS node (hot path).
 */
const _posOfPiece = new Int8Array(12);

/**
 * Extract the cross mini-state key from a full CubeState.
 *
 * Hot path — bypasses the CubeState Proxy adapters and reads the internal
 * `_edges` bigint directly, extracting piece (bits 0–3) and orientation
 * (bit 4) with bitwise ops. ~10–50× faster than `state.ep[p]` Proxy access.
 */
function cubeStateToMiniKey(state: CubeState, crossPieces: Edge[]): number {
  const edges = state._edges;
  _posOfPiece.fill(-1);
  for (let p = 0; p < 12; p++) {
    const entry = Number((edges >> (BigInt(p) * 5n)) & 0x1Fn);
    _posOfPiece[entry & 0xf] = p; // piece → position
  }
  let key = 0;
  for (let k = 0; k < 4; k++) {
    const piece = crossPieces[k];
    const pos = _posOfPiece[piece];
    // orientation = bit 4 of the entry at position `pos`
    const or = Number((edges >> (BigInt(pos) * 5n + 4n)) & 1n);
    key |= (pos | (or << 4)) << (k * 5);
  }
  return key;
}

interface CrossPDB {
  /** The 4 cross edge piece IDs for this face. */
  crossPieces: Edge[];
  /** Uint8Array indexed by mini-state key. 0 = solved, 255 = unreachable. */
  distance: Uint8Array;
}

const crossPDBCache = new Map<string, CrossPDB>();

/**
 * Build (or fetch from cache) the cross pattern database for a face.
 *
 * Runs a BFS from the solved cross mini-state, applying all 18 edge move
 * tables at each level. Because the mini-state is just 4 positions + 4
 * orientations (no full CubeState cloning), BFS completes in ~50ms per
 * face and uses ~1 MB of memory.
 *
 * The BFS caps at depth 8 (the theoretical maximum for any cross).
 */
function getCrossPDB(face: string): CrossPDB {
  const cached = crossPDBCache.get(face);
  if (cached) return cached;

  const faceIdx = FACE_NAME_TO_INDEX[face];
  if (faceIdx === undefined) throw new Error(`Unknown cross face: ${face}`);
  const crossPieces = CROSS_PIECES_BY_FACE[faceIdx];

  const tableSize = 1 << 20; // 2^20 = 1,048,576
  const distance = new Uint8Array(tableSize).fill(255);

  // BFS from solved cross (all 4 pieces at home, oriented).
  const solvedPos = crossPieces.slice();
  const solvedOr = [0, 0, 0, 0];
  const solvedKey = encodeMiniKey(solvedPos, solvedOr);
  distance[solvedKey] = 0;

  // Queue stores mini-states as flat arrays: [pos0,pos1,pos2,pos3, or0,or1,or2,or3, key]
  // Using a flat number queue avoids object allocation overhead.
  const queue: number[] = [];
  queue.push(...solvedPos, ...solvedOr, solvedKey);
  let head = 0;

  while (head < queue.length) {
    const pos0 = queue[head];
    const pos1 = queue[head + 1];
    const pos2 = queue[head + 2];
    const pos3 = queue[head + 3];
    const or0 = queue[head + 4];
    const or1 = queue[head + 5];
    const or2 = queue[head + 6];
    const or3 = queue[head + 7];
    const curKey = queue[head + 8];
    head += 9;

    const curDist = distance[curKey];
    if (curDist >= 8) continue; // cross max = 8, stop BFS here

    const nextDist = curDist + 1;
    const pos = [pos0, pos1, pos2, pos3];
    const or = [or0, or1, or2, or3];

    for (let mi = 0; mi < EDGE_MOVE_TABLES.length; mi++) {
      const mt = EDGE_MOVE_TABLES[mi];
      const np0 = mt.dest[pos0], np1 = mt.dest[pos1], np2 = mt.dest[pos2], np3 = mt.dest[pos3];
      const no0 = or0 ^ mt.flip[pos0], no1 = or1 ^ mt.flip[pos1], no2 = or2 ^ mt.flip[pos2], no3 = or3 ^ mt.flip[pos3];
      const nKey = (np0 | (no0 << 4)) | ((np1 | (no1 << 4)) << 5) | ((np2 | (no2 << 4)) << 10) | ((np3 | (no3 << 4)) << 15);
      if (distance[nKey] === 255) {
        distance[nKey] = nextDist;
        queue.push(np0, np1, np2, np3, no0, no1, no2, no3, nKey);
      }
    }
  }

  const pdb: CrossPDB = { crossPieces, distance };
  crossPDBCache.set(face, pdb);
  return pdb;
}

// ── Solution helpers ───────────────────────────────────────────────────────

/** Convert a sequence of `Move` values into space-separated notation. */
function movesToNotation(moves: Move[]): string {
  return moves.map((m) => MOVE_NOTATION[m]).join(' ');
}

/** Invert a move sequence (used to convert a solve into a scramble). */
function invertMoves(moves: Move[]): Move[] {
  const out: Move[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    out.push(INVERSE_MOVE[moves[i]]);
  }
  return out;
}

// ── PhaseSolver ────────────────────────────────────────────────────────────

export interface SolvePhaseOptions {
  /** Minimum search depth (move count). Default 0. */
  minDepth?: number;
  /** Maximum search depth (move count). Default 8. */
  maxDepth?: number;
  /** Maximum number of solutions to collect at the optimal depth. Default 1. */
  maxSolutions?: number;
  /** Optional set of allowed move notations (e.g. {"U","R","F","D","L","B"}).
   *  Defaults to all 18 face turns. */
  allowedMoves?: Set<string>;
  /** Optional pre-move applied before searching (for rotation / setup).
   *  Not included in the returned solution. */
  preMove?: string;
}

export interface PhaseSolution {
  /** Space-separated move notation (e.g. "R U R' F2"). */
  notation: string;
  /** Number of moves ( == notation.split(' ').length ). */
  moveCount: number;
  /** The Move[] sequence. */
  moves: Move[];
}

/**
 * Find the shortest move sequence(s) that take `state` to a state matching
 * `mask`. Returns solutions sorted by move count (ascending); the first
 * element is always an optimal solution (or the array is empty if none
 * found within `maxDepth`).
 *
 * For the special case of a pure cross mask (4 edges on a single face) the
 * solver uses the precomputed cross pattern database for O(1) pruning,
 * making depth ≤ 8 searches near-instant. For arbitrary masks it falls
 * back to {@link StateMatcher.matchesMask} at each node (slower but
 * generic — used by xcross / xxcross / eocross).
 */
export class PhaseSolver {
  /**
   * Solve a single phase.
   *
   * @param state  The starting CubeState (usually a scrambled state).
   * @param mask   The target PhaseMask (e.g. CrossMask, XCrossMask).
   * @param face   The cross face (required for the PDB fast path; if omitted
   *               and the mask is the standard D-cross, defaults to "D").
   *               For non-cross masks, pass the face the mask was built for
   *               so the PDB can still prune the cross subset.
   * @param opts   Solver options.
   */
  static solvePhase(
    state: CubeState,
    mask: PhaseMask,
    face: string = 'D',
    opts: SolvePhaseOptions = {},
  ): PhaseSolution[] {
    const {
      minDepth = 0,
      maxDepth = 8,
      maxSolutions = 1,
      allowedMoves,
      preMove,
    } = opts;

    // Build the allowed-move list (default = all 18 face turns).
    const moveIndices: number[] = allowedMoves
      ? ALL_FACE_MOVES.map((m, i) => allowedMoves.has(MOVE_NOTATION[m]) ? i : -1).filter((i) => i >= 0)
      : ALL_FACE_MOVES.map((_, i) => i);
    if (moveIndices.length === 0) return [];

    // Apply pre-move (e.g. rotation) before searching; not part of solution.
    const work = state.clone();
    if (preMove) {
      try {
        work.applySequence(preMove);
      } catch {
        return [];
      }
    }

    // Cross PDB fast path: only valid when the mask IS a pure cross mask
    // (exactly 4 edge rules, no corners). Otherwise use matchesMask.
    const pdb = getCrossPDBIfPureCross(mask, face);

    const solutions: PhaseSolution[] = [];
    const foundKeys = new Set<string>();
    const path: Move[] = [];

    // IDDFS: try depth minDepth, … maxDepth. Stop at the FIRST depth that
    // yields solutions (all solutions at that depth are optimal for the depth window).
    for (let depth = minDepth; depth <= maxDepth; depth++) {
      const solutionsBefore = solutions.length;
      iddfsSearch(work, mask, pdb, moveIndices, depth, 0, path, -1, solutions, foundKeys, maxSolutions, minDepth);
      if (solutions.length > solutionsBefore) break; // found solutions at current depth
    }

    return solutions;
  }

  /**
   * Invert a phase solution into a scramble (i.e. the move sequence that,
   * applied to a solved cube, produces a state whose optimal `mask` solve
   * is the original solution). Used by `CrossScrambleGenerator`.
   *
   * Group-theoretic guarantee: if `solution` is an OPTIMAL solve of a
   * partial goal (e.g. cross), then `invert(solution)` applied to a solved
   * cube produces a state whose optimal partial-goal depth is exactly
   * `solution.moveCount`. (Proof: any shorter solution of the inverted
   * state would contradict the optimality of the original solution, since
   * both operate on the same projected sub-goal space.)
   */
  static invertSolution(solution: PhaseSolution): PhaseSolution {
    const inv = invertMoves(solution.moves);
    return {
      notation: movesToNotation(inv),
      moveCount: inv.length,
      moves: inv,
    };
  }
}

// ── IDDFS search (module-private) ──────────────────────────────────────────

/**
 * Detect whether a mask is a pure cross mask (4 edges, no corners) and
 * return its PDB. Returns null for non-cross masks (xcross, eocross, …).
 */
function getCrossPDBIfPureCross(mask: PhaseMask, face: string): CrossPDB | null {
  if (!mask.edges) return null;
  if (mask.corners && mask.corners.length > 0) return null;
  if (mask.edgePositions && mask.edgePositions.length > 0) return null;
  if (mask.cornerPositions && mask.cornerPositions.length > 0) return null;
  if (mask.edges.length !== 4) return null;
  // Only build the PDB if the mask's 4 edges match the cross edges for the
  // requested face. Guards against custom 4-edge masks that aren't a cross.
  const pdb = getCrossPDB(face);
  const maskEdgeIds = new Set(mask.edges.map((r) => r.id));
  for (const e of pdb.crossPieces) {
    if (!maskEdgeIds.has(e)) return null;
  }
  return pdb;
}

function iddfsSearch(
  state: CubeState,
  mask: PhaseMask,
  pdb: CrossPDB | null,
  moveIndices: number[],
  depthLimit: number,
  depth: number,
  path: Move[],
  lastFace: number,
  solutions: PhaseSolution[],
  foundKeys: Set<string>,
  maxSolutions: number,
  minDepth: number = 0,
): void {
  // ── Goal check (at EVERY depth, including 0) ──────────────────────────
  if (matchesGoal(state, mask, pdb)) {
    if (depth >= minDepth) {
      const notation = movesToNotation(path);
      if (!foundKeys.has(notation)) {
        foundKeys.add(notation);
        solutions.push({
          notation,
          moveCount: path.length,
          moves: path.slice(),
        });
      }
    }
    return; // Don't expand from a goal state
  }

  // ── Depth limit ────────────────────────────────────────────────────────
  if (depth >= depthLimit) return;
  if (solutions.length >= maxSolutions) return;

  // ── PDB pruning ────────────────────────────────────────────────────────
  if (pdb) {
    const remaining = pdb.distance[cubeStateToMiniKey(state, pdb.crossPieces)];
    if (remaining === 255 || depth + remaining > depthLimit) return;
  }

  // ── Expand moves ───────────────────────────────────────────────────────
  for (const mi of moveIndices) {
    const move = ALL_FACE_MOVES[mi];
    const faceIdx = MOVE_FACE_INDEX[mi];
    if (faceIdx === lastFace) continue; // never two moves on the same face
    // Opposite-face canonical order (R then L allowed only if R < L index).
    if (lastFace !== -1 && OPPOSITE_FACE[faceIdx] === lastFace && faceIdx < lastFace) {
      continue;
    }

    const next = state.clone();
    next.applyMove(move);
    path.push(move);
    iddfsSearch(next, mask, pdb, moveIndices, depthLimit, depth + 1, path, faceIdx, solutions, foundKeys, maxSolutions, minDepth);
    path.pop();

    if (solutions.length >= maxSolutions) return;
  }
}

function matchesGoal(state: CubeState, mask: PhaseMask, pdb: CrossPDB | null): boolean {
  if (pdb) {
    return pdb.distance[cubeStateToMiniKey(state, pdb.crossPieces)] === 0;
  }
  return StateMatcher.matchesMask(state, mask);
}

// ── Convenience: cross-specific entry points ───────────────────────────────

/**
 * Solve the cross for a given face. Convenience wrapper around
 * {@link PhaseSolver.solvePhase} using the standard CFOP cross mask.
 */
export function solveCross(
  state: CubeState,
  face: string = 'D',
  opts: SolvePhaseOptions = {},
): PhaseSolution[] {
  const faceIdx = FACE_NAME_TO_INDEX[face];
  if (faceIdx === undefined) throw new Error(`Unknown cross face: ${face}`);
  const edges = CROSS_PIECES_BY_FACE[faceIdx];
  const mask: PhaseMask = {
    name: 'Cross',
    edges: edges.map((e) => ({ id: e, requiredEp: e, requiredEo: 0 })),
  };
  return PhaseSolver.solvePhase(state, mask, face, opts);
}

/**
 * Determine the optimal cross depth for a state on a given face (returns
 * the move count of the shortest solution, or -1 if none found within
 * `maxDepth`).
 */
export function crossDepth(
  state: CubeState,
  face: string = 'D',
  maxDepth: number = 8,
): number {
  const sols = solveCross(state, face, { maxDepth, maxSolutions: 1 });
  return sols.length > 0 ? sols[0].moveCount : -1;
}

/**
 * Find the best (lowest-depth) cross across all 6 faces — color-neutral.
 * Returns `{ face, depth }` or null if no cross found within `maxDepth`.
 */
export function bestCrossFace(
  state: CubeState,
  maxDepth: number = 8,
): { face: string; depth: number } | null {
  let best: { face: string; depth: number } | null = null;
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    const d = crossDepth(state, face, maxDepth);
    if (d !== -1 && (best === null || d < best.depth)) {
      best = { face, depth: d };
    }
  }
  return best;
}

// Re-export notation helpers for callers that want to invert manually.
export { invertMoves, movesToNotation };
