/**
 * Pyraminx random-state solver and WCA scramble generator.
 *
 * CLEAN-ROOM IMPLEMENTATION — ORIGINAL WORK, NO THIRD-PARTY CODE
 * -------------------------------------------------------------
 * This module is written from the public specification in
 * `docs/01-roadmap/Fase-D2-Pyraminx-Cleanroom.md` (§3), which describes the
 * puzzle model, the coordinate encodings, the move semantics, the pruning
 * tables and the IDA* search in mathematical terms. Its sources are public
 * facts about the puzzle (Jaap's Puzzle Page depth table, the geometry of
 * the tetrahedron) and the WCA regulations (scramble length, minimum
 * distance, notation).
 *
 * It deliberately contains NO code, structure or naming derived from
 * TNoodle-lib (GPL-3.0) or from any other third-party scrambler, and
 * carries no GPL obligations. Its behaviour is equivalent to the official
 * WCA scrambler and is validated by the acceptance suite in
 * `src/__tests__/PyraminxSolver.test.ts` — most notably by the exact
 * reproduction of Jaap's published depth distribution, an independent and
 * implementation-agnostic correctness criterion.
 *
 * ## Model (public facts)
 *
 * The Pyraminx is a regular tetrahedron with 14 movable pieces:
 *   • 4 tips — 1 sticker each, 3 orientations, trivial and independent.
 *   • 4 corners (face centres) — 3 stickers, FIXED positions, rotate only.
 *   • 6 edges — 2 stickers, permute and flip (2 orientations each).
 *
 * Reachable states without tips: 6!/2 × 2⁴ × 3⁴ = 933,120 (only even edge
 * permutations; the 6th edge orientation derives from the other five).
 * God's number: 11 turns. Depth distribution (Jaap, tips ignored):
 *   1, 8, 48, 288, 1728, 9896, 51808, 220111, 480467, 166276, 2457, 32.
 *
 * ## Moves (WCA notation)
 *
 *   U L R B        — full layer turn at a vertex (±)
 *   u l r b        — tip-only turn (±)
 *
 * Every turn has order 3; the "prime" move is the 120° turn applied twice.
 * A full turn cycles the 3 edges meeting at the vertex (two get flipped),
 * rotates the vertex's own corner, and turns the tip.
 *
 * ## Scramble algorithm (official behaviour)
 *
 *   1. Uniform random reachable state (tips included).
 *   2. WCA Reg 4b3 filter: the state must require at least 6 turns.
 *   3. Solve in EXACTLY 11 turns (God's number — every reachable state has
 *      such a solution; the exact-length-11 layer covers all 933,120 states).
 *   4. The scramble is the inverse of that solution, with the tip turns
 *      appended (lowercase, one per unsolved tip).
 */

// ── Model constants (public facts) ──────────────────────────────────────────
const EDGE_PERMUTATION_COUNT = 720; // 6!
const EDGE_ORIENTATION_COUNT = 32; // 2⁵ — the 6th edge orientation is derived
const CORNER_ORIENTATION_COUNT = 81; // 3⁴
const TIP_ORIENTATION_COUNT = 81; // 3⁴
const ORIENTATION_STATE_COUNT = EDGE_ORIENTATION_COUNT * CORNER_ORIENTATION_COUNT; // 2,592
const MOVE_COUNT = 8; // 4 faces × 2 directions
const REACHABLE_PERMUTATIONS = 360; // even half of 720
const REACHABLE_STATES = REACHABLE_PERMUTATIONS * ORIENTATION_STATE_COUNT; // 933,120
const MAX_SOLUTION_LENGTH = 20; // safety bound; God's number is 11
const UNREACHABLE = 255; // sentinel in the pruning tables

/** Official scramble length of the main puzzle (WCA: 11 = God's number). */
export const PYRAMINX_SCRAMBLE_LENGTH = 11;
/** WCA Regulation 4b3: the random state must require at least this many turns. */
export const PYRAMINX_MIN_DISTANCE = 6;

export const PYRAMINX_MOVE_NAMES = ["U", "U'", "L", "L'", "R", "R'", "B", "B'"] as const;
export const PYRAMINX_TIP_NAMES = ["u", "u'", "l", "l'", "r", "r'", "b", "b'"] as const;
/** Inverse of each move: an even index (single turn) ↔ its odd twin (double turn). */
const INVERSE_MOVE_NAMES = ["U'", "U", "L'", "L", "R'", "R", "B'", "B"] as const;

const FACES = ["U", "L", "R", "B"] as const;
type FaceName = (typeof FACES)[number];

/**
 * Random state of the Pyraminx (packed coordinates, §3.2 of the spec).
 *
 *   • edgePerm     — factoradic rank of the edge permutation [0, 720)
 *   • edgeOrient   — orientations of edges 0..4 packed as 5 bits [0, 32)
 *   • cornerOrient — orientations of the 4 corners in base 3 [0, 81)
 *   • tips         — orientations of the 4 tips in base 3 [0, 81)
 */
export interface PyraminxState {
  edgePerm: number;
  edgeOrient: number;
  cornerOrient: number;
  tips: number;
}

/** The solved state. */
export function solvedPyraminx(): PyraminxState {
  return { edgePerm: 0, edgeOrient: 0, cornerOrient: 0, tips: 0 };
}

/** Whether the state is the solved state. */
export function isPyraminxSolved(state: PyraminxState): boolean {
  return (
    state.edgePerm === 0 &&
    state.edgeOrient === 0 &&
    state.cornerOrient === 0 &&
    state.tips === 0
  );
}

// ── Coordinate encodings (§3.2) ─────────────────────────────────────────────
// All encodings are mixed-radix ranks of the respective coordinate — standard
// combinatorial techniques, implemented here with plain arrays.

const FACTORIALS = [1, 1, 2, 6, 24, 120, 720];

/** Factoradic rank of a permutation given as the piece at each position. */
function rankPermutation(piecesAtPositions: readonly number[]): number {
  const remaining = [0, 1, 2, 3, 4, 5];
  let rank = 0;
  for (let i = 0; i < 5; i++) {
    const offset = remaining.indexOf(piecesAtPositions[i]);
    rank = rank * (6 - i) + offset;
    remaining.splice(offset, 1);
  }
  return rank;
}

/** Inverse of {@link rankPermutation}: the piece at each position for a rank. */
function unrankPermutation(rank: number): number[] {
  const pieces = new Array<number>(6);
  const available = [0, 1, 2, 3, 4, 5];
  let r = rank;
  for (let i = 0; i < 5; i++) {
    const offset = Math.floor(r / FACTORIALS[5 - i]);
    r %= FACTORIALS[5 - i];
    pieces[i] = available[offset];
    available.splice(offset, 1);
  }
  pieces[5] = available[0];
  return pieces;
}

/** Pack the orientations of edges 0..4 into 5 bits (the 6th is derived). */
function encodeEdgeOrientations(orientations: readonly number[]): number {
  let code = 0;
  for (let i = 0; i < 5; i++) code = (code << 1) | orientations[i];
  return code;
}

/** Inverse of {@link encodeEdgeOrientations}: 6 orientations, the last derived by XOR. */
function decodeEdgeOrientations(code: number): number[] {
  const orientations = new Array<number>(6);
  let derived = 0;
  for (let i = 4; i >= 0; i--) {
    const bit = (code >> i) & 1;
    orientations[4 - i] = bit;
    derived ^= bit;
  }
  orientations[5] = derived;
  return orientations;
}

/** Pack 4 base-3 values (corners or tips) into [0, 81). */
function encodeBase3(values: readonly number[]): number {
  let code = 0;
  for (const value of values) code = code * 3 + value;
  return code;
}

/** Inverse of {@link encodeBase3}: 4 base-3 values from a code. */
function decodeBase3(code: number): number[] {
  const values = new Array<number>(4);
  let c = code;
  for (let i = 3; i >= 0; i--) {
    values[i] = c % 3;
    c = Math.floor(c / 3);
  }
  return values;
}

// ── A₄ Rotational Symmetries & Multi-Orientation Solved States ──────────────

/** The 12 even permutations of [0, 1, 2, 3] forming the tetrahedral rotation group A₄. */
export const PYRAMINX_A4_PERMUTATIONS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], // 0: Identity
  [0, 2, 3, 1], // 1: Rot +120° around U (L->R->B)
  [0, 3, 1, 2], // 2: Rot -120° around U (L->B->R)
  [1, 0, 3, 2], // 3: C2 swap (U<->L, R<->B)
  [1, 2, 0, 3], // 4: Rot around B
  [1, 3, 2, 0], // 5: Rot around R
  [2, 0, 1, 3], // 6: Rot around B
  [2, 1, 3, 0], // 7: Rot around L
  [2, 3, 0, 1], // 8: C2 swap (U<->R, L<->B)
  [3, 0, 2, 1], // 9: Rot around L
  [3, 1, 0, 2], // 10: Rot around R
  [3, 2, 1, 0], // 11: C2 swap (U<->B, L<->R) — UI tilt axis
] as const;

/** Edge slot vertex pairs: 0=LR, 1=UL, 2=LB, 3=UR, 4=RB, 5=UB. */
const EDGE_VERTEX_PAIRS: readonly (readonly [number, number])[] = [
  [1, 2], // 0: LR
  [0, 1], // 1: UL
  [1, 3], // 2: LB
  [0, 2], // 3: UR
  [2, 3], // 4: RB
  [0, 3], // 5: UB
];

/** Edge slot face pairs (opposite vertex convention, lower index first). */
const EDGE_FACE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 3], // 0: LR has faces U(0), B(3)
  [2, 3], // 1: UL has faces R(2), B(3)
  [0, 2], // 2: LB has faces U(0), R(2)
  [1, 3], // 3: UR has faces L(1), B(3)
  [0, 1], // 4: RB has faces U(0), L(1)
  [1, 2], // 5: UB has faces L(1), R(2)
];

/** Cyclic order of neighbouring vertices around each vertex (clockwise from outside). */
const VERTEX_CYCLIC_NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 3, 2], // Around 0(U): 1(L) -> 3(B) -> 2(R)
  [2, 3, 0], // Around 1(L): 2(R) -> 3(B) -> 0(U)
  [1, 0, 3], // Around 2(R): 1(L) -> 0(U) -> 3(B)
  [1, 2, 0], // Around 3(B): 1(L) -> 2(R) -> 0(U)
];

function findEdgeSlotByVertices(u: number, v: number): number {
  for (let i = 0; i < 6; i++) {
    const [a, b] = EDGE_VERTEX_PAIRS[i];
    if ((a === u && b === v) || (a === v && b === u)) return i;
  }
  return -1;
}

function getCornerTwistOffset(v: number, g: readonly [number, number, number, number]): number {
  const vPrime = g[v];
  const cyc = VERTEX_CYCLIC_NEIGHBOURS[v];
  const mapped0 = g[cyc[0]];
  const cycPrime = VERTEX_CYCLIC_NEIGHBOURS[vPrime];
  return cycPrime.indexOf(mapped0);
}

/**
 * Relabel a PyraminxState by an even vertex relabeling g ∈ A₄.
 *
 *   • edges: slot {g(u), g(v)} receives the piece from {u, v}
 *   • corners / tips: slot g(v) receives piece from v
 *   • flips / twists: transformed according to the 3D rotation g
 */
export function relabelPyraminxState(
  state: PyraminxState,
  g: readonly [number, number, number, number],
): PyraminxState {
  const oldHomes = unrankPermutation(state.edgePerm);
  const oldOrients = decodeEdgeOrientations(state.edgeOrient);
  const newHomes = new Array<number>(6);
  const newOrients = new Array<number>(6);

  for (let e = 0; e < 6; e++) {
    const [u, v] = EDGE_VERTEX_PAIRS[e];
    const ePrime = findEdgeSlotByVertices(g[u], g[v]);
    const [fa, fb] = EDGE_FACE_PAIRS[e];
    const faPrime = g[fa];
    const fbPrime = g[fb];
    const baseFlip = faPrime > fbPrime ? 1 : 0;

    newHomes[ePrime] = oldHomes[e];
    newOrients[ePrime] = oldOrients[e] ^ baseFlip;
  }

  const oldCorners = decodeBase3(state.cornerOrient);
  const oldTips = decodeBase3(state.tips);
  const newCorners = new Array<number>(4);
  const newTips = new Array<number>(4);

  for (let v = 0; v < 4; v++) {
    const vPrime = g[v];
    const twist = getCornerTwistOffset(v, g);
    newCorners[vPrime] = (oldCorners[v] + twist) % 3;
    newTips[vPrime] = (oldTips[v] + twist) % 3;
  }

  return {
    edgePerm: rankPermutation(newHomes),
    edgeOrient: encodeEdgeOrientations(newOrients.slice(0, 5)),
    cornerOrient: encodeBase3(newCorners),
    tips: encodeBase3(newTips),
  };
}

/** Compute the 12 canonical solved states of the Pyraminx under A₄ rotations. */
export function computePyraminxSolvedStates(): PyraminxState[] {
  const solved = solvedPyraminx();
  return PYRAMINX_A4_PERMUTATIONS.map((g) => relabelPyraminxState(solved, g));
}

/** The 12 canonical solved states (A₄ tetrahedral symmetries) precomputed once. */
export const PYRAMINX_SOLVED_STATES: readonly PyraminxState[] = computePyraminxSolvedStates();

/**
 * Whether the state is solved in ANY of the 12 canonical A₄ orientations.
 * Plain integer compares against the precomputed signatures (sub-microsecond).
 */
export function isPyraminxSolvedAnyOrientation(state: PyraminxState): boolean {
  return PYRAMINX_SOLVED_STATES.some(
    (s) =>
      s.edgePerm === state.edgePerm &&
      s.edgeOrient === state.edgeOrient &&
      s.cornerOrient === state.cornerOrient &&
      s.tips === state.tips,
  );
}

// ── Move semantics (§3.3 — geometric facts) ─────────────────────────────────

interface FaceTurn {
  /** Edge positions of the cycle; the piece at cycle[0] moves to cycle[1], etc. */
  readonly cycle: readonly [number, number, number];
  /** Positions that receive a FLIPPED piece during the cycle. */
  readonly flips: readonly [number, number];
  /** Corner rotated by this face's turn. */
  readonly corner: number;
}

/**
 * Geometry of the four vertex turns, labelled by the faces opposite each
 * vertex (WCA notation). Edges: 0=LR, 1=UL, 2=LB, 3=UR, 4=RB, 5=UB.
 * Corners are indexed by their face (U=0, L=1, R=2, B=3).
 * This table is validated against Jaap's published depth distribution.
 */
const FACE_TURNS: Record<FaceName, FaceTurn> = {
  U: { cycle: [1, 5, 3], flips: [1, 3], corner: 0 },
  L: { cycle: [0, 2, 1], flips: [0, 1], corner: 1 },
  R: { cycle: [0, 3, 4], flips: [3, 4], corner: 2 },
  B: { cycle: [2, 4, 5], flips: [4, 5], corner: 3 },
};

/** Move index → face: moves 0..7 are U, U', L, L', R, R', B, B'. */
const faceOfMove = (move: number): FaceName => FACES[move >> 1];
/** Move index → 120° steps: even = 1 step, odd = 2 steps (the "prime" turn). */
const stepsOfMove = (move: number): number => (move & 1) + 1;

/**
 * Apply one full layer turn to the edge array (piece = home | orientation<<3)
 * and the corner array, for `steps` 120° rotations.
 */
function applyTurn(edges: Uint8Array, corners: Uint8Array, face: FaceName, steps: number): void {
  const turn = FACE_TURNS[face];
  const [a, b, c] = turn.cycle;
  for (let s = 0; s < steps; s++) {
    const pieceA = edges[a];
    const pieceB = edges[b];
    const pieceC = edges[c];
    edges[b] = turn.flips.includes(b) ? pieceA ^ 8 : pieceA;
    edges[c] = turn.flips.includes(c) ? pieceB ^ 8 : pieceB;
    edges[a] = turn.flips.includes(a) ? pieceC ^ 8 : pieceC;
    corners[turn.corner] = (corners[turn.corner] + 1) % 3;
  }
}

// ── Precomputed tables (built once, lazily) ─────────────────────────────────
// Coordinates evolve independently under every move, so each coordinate gets
// its own transition table; the search composes them in one step.

const EDGE_PERM_MOVES = new Uint16Array(EDGE_PERMUTATION_COUNT * MOVE_COUNT);
const EDGE_ORIENT_MOVES = new Uint8Array(EDGE_ORIENTATION_COUNT * MOVE_COUNT);
const CORNER_ORIENT_MOVES = new Uint8Array(CORNER_ORIENTATION_COUNT * MOVE_COUNT);

/** Exact distance to the solved coordinate, per coordinate (BFS); 255 = unreachable. */
const PERM_PRUNING = new Uint8Array(EDGE_PERMUTATION_COUNT);
const ORIENT_PRUNING = new Uint8Array(ORIENTATION_STATE_COUNT);
/** edgePerm → dense id among the 360 reachable permutations (-1 for odd parity). */
const PERMUTATION_INDEX = new Int16Array(EDGE_PERMUTATION_COUNT);

function buildMoveTables(): void {
  const pieces = new Uint8Array(6); // edge cubie: home position | orientation << 3
  const corners = new Uint8Array(4);

  // Edge permutation transitions.
  for (let perm = 0; perm < EDGE_PERMUTATION_COUNT; perm++) {
    const homes = unrankPermutation(perm);
    for (let move = 0; move < MOVE_COUNT; move++) {
      for (let i = 0; i < 6; i++) pieces[i] = homes[i];
      applyTurn(pieces, corners, faceOfMove(move), stepsOfMove(move));
      const after = new Array<number>(6);
      for (let i = 0; i < 6; i++) after[i] = pieces[i] & 7;
      EDGE_PERM_MOVES[perm * MOVE_COUNT + move] = rankPermutation(after);
    }
  }

  // Edge orientation transitions (solved permutation, oriented cubies at home).
  for (let orient = 0; orient < EDGE_ORIENTATION_COUNT; orient++) {
    const orientations = decodeEdgeOrientations(orient);
    for (let move = 0; move < MOVE_COUNT; move++) {
      for (let i = 0; i < 6; i++) pieces[i] = i | (orientations[i] << 3);
      applyTurn(pieces, corners, faceOfMove(move), stepsOfMove(move));
      const after = new Array<number>(5);
      for (let i = 0; i < 5; i++) after[i] = pieces[i] >> 3;
      EDGE_ORIENT_MOVES[orient * MOVE_COUNT + move] = encodeEdgeOrientations(after);
    }
  }

  // Corner orientation transitions.
  for (let orient = 0; orient < CORNER_ORIENTATION_COUNT; orient++) {
    const orientations = decodeBase3(orient);
    for (let move = 0; move < MOVE_COUNT; move++) {
      for (let i = 0; i < 4; i++) corners[i] = orientations[i];
      applyTurn(pieces, corners, faceOfMove(move), stepsOfMove(move));
      const after = new Array<number>(4);
      for (let i = 0; i < 4; i++) after[i] = corners[i];
      CORNER_ORIENT_MOVES[orient * MOVE_COUNT + move] = encodeBase3(after);
    }
  }
}

function buildPermutationPruning(): void {
  PERM_PRUNING.fill(UNREACHABLE);
  PERM_PRUNING[0] = 0;
  let discovered = 1;
  for (let depth = 0; discovered < REACHABLE_PERMUTATIONS; depth++) {
    for (let perm = 0; perm < EDGE_PERMUTATION_COUNT; perm++) {
      if (PERM_PRUNING[perm] !== depth) continue;
      for (let move = 0; move < MOVE_COUNT; move++) {
        const next = EDGE_PERM_MOVES[perm * MOVE_COUNT + move];
        if (PERM_PRUNING[next] === UNREACHABLE) {
          PERM_PRUNING[next] = depth + 1;
          discovered++;
        }
      }
    }
  }
}

function buildOrientationPruning(): void {
  ORIENT_PRUNING.fill(UNREACHABLE);
  ORIENT_PRUNING[0] = 0;
  let discovered = 1;
  for (let depth = 0; discovered < ORIENTATION_STATE_COUNT; depth++) {
    for (let index = 0; index < ORIENTATION_STATE_COUNT; index++) {
      if (ORIENT_PRUNING[index] !== depth) continue;
      const edgeOrient = Math.floor(index / CORNER_ORIENTATION_COUNT);
      const cornerOrient = index % CORNER_ORIENTATION_COUNT;
      for (let move = 0; move < MOVE_COUNT; move++) {
        const nextEdge = EDGE_ORIENT_MOVES[edgeOrient * MOVE_COUNT + move];
        const nextCorner = CORNER_ORIENT_MOVES[cornerOrient * MOVE_COUNT + move];
        const next = nextEdge * CORNER_ORIENTATION_COUNT + nextCorner;
        if (ORIENT_PRUNING[next] === UNREACHABLE) {
          ORIENT_PRUNING[next] = depth + 1;
          discovered++;
        }
      }
    }
  }
}

function buildPermutationIndex(): void {
  let nextId = 0;
  for (let perm = 0; perm < EDGE_PERMUTATION_COUNT; perm++) {
    PERMUTATION_INDEX[perm] = PERM_PRUNING[perm] === UNREACHABLE ? -1 : nextId++;
  }
}

let tablesReady = false;
function ensureTables(): void {
  if (tablesReady) return;
  buildMoveTables();
  buildPermutationPruning();
  buildOrientationPruning();
  buildPermutationIndex();
  tablesReady = true;
}

// ── IDA* search (§3.5) ──────────────────────────────────────────────────────
// Depth-limited DFS with two prunings: the per-coordinate lower bound and a
// transposition set. A naive DFS without the set can degenerate to
// ~8·6¹⁰ ≈ 484M nodes for states with few exact-length solutions; the set
// bounds the search by the state space instead (933,120 × 4 last-faces).

/** Dense index of a (reachable) state, for the transposition set. */
function stateIndex(edgePerm: number, edgeOrient: number, cornerOrient: number): number {
  return (
    (PERMUTATION_INDEX[edgePerm] * EDGE_ORIENTATION_COUNT + edgeOrient) *
      CORNER_ORIENTATION_COUNT +
    cornerOrient
  );
}

// Keyed by (state, last face). The stored value is the MAX remaining depth
// already explored from that key: an arrival with ≤ that depth has all its
// continuations covered, so it can be pruned. (State alone is insufficient —
// the "no two turns on the same face" rule depends on the incoming move — and
// a plain visited flag is unsound in DFS: a deep arrival can precede a
// shallow one.) The buffer is reused across attempts via a touched list.
const TRANSPOSITION_SLOTS = REACHABLE_STATES * 4;
const transpositionVisited = new Uint8Array(TRANSPOSITION_SLOTS);
const transpositionTouched: number[] = [];

/**
 * Depth-limited DFS. Returns true when a solution of exactly `remaining`
 * moves exists, filling `solution` (moves stored at their path depth).
 *
 * @param lastFace - face of the previous move, or -1 at the root.
 */
function depthLimitedSearch(
  edgePerm: number,
  edgeOrient: number,
  cornerOrient: number,
  depth: number,
  remaining: number,
  lastFace: number,
  solution: Uint8Array,
  random: (n: number) => number,
): boolean {
  if (remaining === 0) {
    return edgePerm === 0 && edgeOrient === 0 && cornerOrient === 0;
  }

  // Lower-bound pruning (per-coordinate tables are exact for their coordinate).
  if (
    PERM_PRUNING[edgePerm] > remaining ||
    ORIENT_PRUNING[edgeOrient * CORNER_ORIENTATION_COUNT + cornerOrient] > remaining
  ) {
    return false;
  }

  // Transposition pruning.
  if (lastFace >= 0) {
    const key = (stateIndex(edgePerm, edgeOrient, cornerOrient) << 2) + lastFace;
    const seen = transpositionVisited[key];
    if (seen >= remaining) return false;
    if (seen === 0) transpositionTouched.push(key);
    transpositionVisited[key] = remaining;
  }

  // Randomised branch order (uniform offset per node).
  const offset = Math.floor(random(MOVE_COUNT));
  for (let move = 0; move < MOVE_COUNT; move++) {
    const candidate = (move + offset) % MOVE_COUNT;
    const face = candidate >> 1;
    if (face === lastFace) continue; // never two turns on the same face
    if (
      depthLimitedSearch(
        EDGE_PERM_MOVES[edgePerm * MOVE_COUNT + candidate],
        EDGE_ORIENT_MOVES[edgeOrient * MOVE_COUNT + candidate],
        CORNER_ORIENT_MOVES[cornerOrient * MOVE_COUNT + candidate],
        depth + 1,
        remaining - 1,
        face,
        solution,
        random,
      )
    ) {
      solution[depth] = candidate;
      return true;
    }
  }
  return false;
}

/**
 * Uniform random value in [0, n) — injectable for deterministic tests. The
 * default scales Math.random by n (Math.random itself takes no arguments).
 */
export type Rng = (n: number) => number;

const defaultRandom: Rng = (n) => Math.random() * n;

/**
 * Find a solution for the state's main-puzzle coordinates.
 *
 * With `exactLength` the search tries only `maxLength` turns (used for the
 * official exact-11 scramble); otherwise it tries 0..maxLength and the first
 * success is an OPTIMAL solution (used for distances and the WCA filter).
 * Returns the solution as move indices, or null.
 */
function findSolution(
  state: PyraminxState,
  maxLength: number,
  exactLength: boolean,
  random: (n: number) => number,
): number[] | null {
  const solution = new Uint8Array(MAX_SOLUTION_LENGTH);
  let length = exactLength ? maxLength : 0;
  while (length <= maxLength) {
    const found = depthLimitedSearch(
      state.edgePerm,
      state.edgeOrient,
      state.cornerOrient,
      0,
      length,
      -1,
      solution,
      random,
    );
    // Reset only the entries the previous attempt touched.
    for (const key of transpositionTouched) transpositionVisited[key] = 0;
    transpositionTouched.length = 0;
    if (found) return Array.from(solution.subarray(0, length));
    length++;
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Lower bound on the state's true solution distance (per-coordinate pruning). */
export function pyraminxDistanceBound(state: PyraminxState): number {
  ensureTables();
  return Math.max(
    PERM_PRUNING[state.edgePerm],
    ORIENT_PRUNING[state.edgeOrient * CORNER_ORIENTATION_COUNT + state.cornerOrient],
  );
}

/** Whether the state is a legal, reachable Pyraminx position (even edge permutation). */
export function isPyraminxReachable(state: PyraminxState): boolean {
  ensureTables();
  return PERM_PRUNING[state.edgePerm] !== UNREACHABLE;
}

/**
 * True (optimal) solution distance of a state, or -1 if unsolvable within the
 * search bound (never happens: God's number is 11).
 */
export function pyraminxDistance(
  state: PyraminxState,
  pick: (n: number) => number = defaultRandom,
): number {
  ensureTables();
  const solution = findSolution(state, MAX_SOLUTION_LENGTH, false, pick);
  return solution ? solution.length : -1;
}

/**
 * Uniform random reachable state (tips included). Odd-parity edge
 * permutations are rejected using the pruning table.
 */
export function randomPyraminxState(pick: (n: number) => number = defaultRandom): PyraminxState {
  ensureTables();
  let edgePerm: number;
  do {
    edgePerm = Math.floor(pick(EDGE_PERMUTATION_COUNT));
  } while (PERM_PRUNING[edgePerm] === UNREACHABLE);
  return {
    edgePerm,
    edgeOrient: Math.floor(pick(EDGE_ORIENTATION_COUNT)),
    cornerOrient: Math.floor(pick(CORNER_ORIENTATION_COUNT)),
    tips: Math.floor(pick(TIP_ORIENTATION_COUNT)),
  };
}

/** Apply one of the 8 layer turns (index 0..7: U, U', L, L', R, R', B, B'). */
export function applyPyraminxMove(state: PyraminxState, move: number): PyraminxState {
  ensureTables();
  return {
    edgePerm: EDGE_PERM_MOVES[state.edgePerm * MOVE_COUNT + move],
    edgeOrient: EDGE_ORIENT_MOVES[state.edgeOrient * MOVE_COUNT + move],
    cornerOrient: CORNER_ORIENT_MOVES[state.cornerOrient * MOVE_COUNT + move],
    tips: state.tips,
  };
}

/** Apply one tip-only turn (index 0..7: u, u', l, l', r, r', b, b'). */
export function applyPyraminxTip(state: PyraminxState, tipMove: number): PyraminxState {
  const tip = Math.floor(tipMove / 2);
  const direction = (tipMove % 2) + 1;
  const orientations = decodeBase3(state.tips);
  orientations[tip] = (orientations[tip] + direction) % 3;
  return { ...state, tips: encodeBase3(orientations) };
}

const MOVE_INDEX: Record<string, number> = Object.fromEntries(
  PYRAMINX_MOVE_NAMES.map((name, index) => [name, index]),
);
const TIP_MOVE_INDEX: Record<string, number> = Object.fromEntries(
  PYRAMINX_TIP_NAMES.map((name, index) => [name, index]),
);

/**
 * Apply a WCA-notation scramble string to a state (layer + tip turns).
 * Returns the resulting state, or null when a token is invalid.
 */
export function applyPyraminxSequence(state: PyraminxState, scramble: string): PyraminxState | null {
  let current = state;
  for (const token of scramble.trim().split(/\s+/)) {
    if (token === "") continue;
    const bigMove = MOVE_INDEX[token];
    if (bigMove !== undefined) {
      current = applyPyraminxMove(current, bigMove);
      continue;
    }
    const tipMove = TIP_MOVE_INDEX[token];
    if (tipMove !== undefined) {
      current = applyPyraminxTip(current, tipMove);
      continue;
    }
    return null; // unknown move token
  }
  return current;
}

/** Whether a string is syntactically valid WCA Pyraminx notation. */
export function isValidPyraminxScramble(scramble: string): boolean {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => MOVE_INDEX[t] !== undefined || TIP_MOVE_INDEX[t] !== undefined);
}

/**
 * Generate a random-state WCA scramble for the Pyraminx (§3.6).
 *
 * Uniform random reachable state → WCA 4b3 filter (distance ≥ 6) → solve in
 * EXACTLY 11 turns (always exists: God's number is 11) → the scramble is the
 * inverse of that solution with the direct tip turns appended. Returns "" only
 * in the impossible case that no solution is found.
 */
export function generatePyraminxScramble(
  pick: (n: number) => number = defaultRandom,
): string {
  ensureTables();

  // 1–2. Random state + WCA distance filter (Reg 4b3: ≥ 6 turns).
  let state: PyraminxState;
  let tooEasy: number[] | null;
  do {
    state = randomPyraminxState(pick);
    tooEasy = findSolution(state, PYRAMINX_MIN_DISTANCE - 1, false, pick);
  } while (tooEasy !== null);

  // 3. Solve in exactly 11 turns; the fallback is defensive only.
  let solution = findSolution(state, PYRAMINX_SCRAMBLE_LENGTH, true, pick);
  if (!solution) solution = findSolution(state, MAX_SOLUTION_LENGTH, false, pick);
  if (!solution) return "";

  // 4. Scramble = inverse of the solution (last move first, each inverted)…
  const tokens: string[] = [];
  for (let i = solution.length - 1; i >= 0; i--) {
    tokens.push(INVERSE_MOVE_NAMES[solution[i]]);
  }
  // …then the direct tip turns that reach the sampled tip state.
  const tipOrientations = decodeBase3(state.tips);
  for (let tip = 0; tip < 4; tip++) {
    const value = tipOrientations[tip];
    if (value > 0) tokens.push(PYRAMINX_TIP_NAMES[tip * 2 + value - 1]);
  }
  return tokens.join(" ");
}
