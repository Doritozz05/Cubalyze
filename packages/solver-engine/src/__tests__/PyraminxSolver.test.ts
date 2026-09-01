import { describe, expect, it } from "vitest";
import {
  PYRAMINX_MIN_DISTANCE,
  PYRAMINX_SCRAMBLE_LENGTH,
  PYRAMINX_A4_PERMUTATIONS,
  PYRAMINX_SOLVED_STATES,
  applyPyraminxMove,
  applyPyraminxSequence,
  applyPyraminxTip,
  generatePyraminxScramble,
  isPyraminxReachable,
  isPyraminxSolved,
  isPyraminxSolvedAnyOrientation,
  isValidPyraminxScramble,
  pyraminxDistance,
  randomPyraminxState,
  relabelPyraminxState,
  solvedPyraminx,
  type PyraminxState,
} from "../PyraminxSolver";

/**
 * Deterministic LCG (Numerical Recipes constants) so the whole suite is
 * reproducible — the official scrambler is random, ours must be too, but
 * tests never rely on "luck".
 */
function lcg(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0x100000000) * n;
  };
}

/**
 * Depth distribution of the Pyraminx (tips ignored), from Jaap's Puzzle Page
 * (jaapsch.net/puzzles/pyraminx.htm). This is the authoritative check for the
 * whole move model: if any cycle, flip or orientation rule were wrong, the
 * BFS reachable set or its distances would differ.
 */
const JAAP_DEPTH_COUNTS = [1, 8, 48, 288, 1728, 9896, 51808, 220111, 480467, 166276, 2457, 32];

const N_EDGE_PERM = 720;
const N_EDGE_ORIENT = 32;
const N_CORNER_ORIENT = 81;

function bfsDepthCounts(): number[] {
  const total = N_EDGE_PERM * N_EDGE_ORIENT * N_CORNER_ORIENT; // 1,866,240 full product
  const dist = new Uint8Array(total);
  dist.fill(255);
  const idx = (p: number, o: number, c: number) => (p * N_EDGE_ORIENT + o) * N_CORNER_ORIENT + c;

  dist[idx(0, 0, 0)] = 0;
  let frontier = [idx(0, 0, 0)];
  const counts = [1];
  let depth = 0;

  while (frontier.length > 0) {
    const next: number[] = [];
    for (const i of frontier) {
      const c = i % N_CORNER_ORIENT;
      const rest = (i - c) / N_CORNER_ORIENT;
      const o = rest % N_EDGE_ORIENT;
      const p = (rest - o) / N_EDGE_ORIENT;
      const state: PyraminxState = { edgePerm: p, edgeOrient: o, cornerOrient: c, tips: 0 };
      for (let m = 0; m < 8; m++) {
        const s2 = applyPyraminxMove(state, m);
        const j = idx(s2.edgePerm, s2.edgeOrient, s2.cornerOrient);
        if (dist[j] === 255) {
          dist[j] = depth + 1;
          next.push(j);
        }
      }
    }
    frontier = next;
    if (frontier.length > 0) counts[depth + 1] = frontier.length;
    depth++;
    if (depth > 20) break; // safety — should never trigger (God's number is 11)
  }
  return counts;
}

const INVERSE_TOKEN: Record<string, string> = {
  U: "U'", "U'": "U", L: "L'", "L'": "L", R: "R'", "R'": "R", B: "B'", "B'": "B",
  u: "u'", "u'": "u", l: "l'", "l'": "l", r: "r'", "r'": "r", b: "b'", "b'": "b",
};

describe("PyraminxSolver — model", () => {
  it("reachable state space matches the published distribution (Jaap, tips ignored)", () => {
    const counts = bfsDepthCounts();
    expect(counts).toEqual(JAAP_DEPTH_COUNTS);
    // Sanity: the table sums to 6!/2 × 2⁵ × 3⁴
    const sum = counts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(933120);
    // God's number is 11 (the last non-zero depth)
    expect(counts.length - 1).toBe(11);
    expect(counts[11]).toBe(32); // the 32 antipodes
  });

  it("exactly half of the edge permutations are reachable (parity)", () => {
    let reachable = 0;
    for (let p = 0; p < N_EDGE_PERM; p++) {
      if (isPyraminxReachable({ edgePerm: p, edgeOrient: 0, cornerOrient: 0, tips: 0 })) reachable++;
    }
    expect(reachable).toBe(N_EDGE_PERM / 2);
  });

  it("every move inverted returns to solved; moves have order 3; double move == inverse", () => {
    for (let m = 0; m < 8; m++) {
      const inv = m % 2 === 0 ? m + 1 : m - 1;
      const s = applyPyraminxMove(applyPyraminxMove(solvedPyraminx(), m), inv);
      expect(isPyraminxSolved(s)).toBe(true);
    }
    // Order 3: U³ = e and U'³ = e
    let s = solvedPyraminx();
    for (let i = 0; i < 3; i++) s = applyPyraminxMove(s, 0);
    expect(isPyraminxSolved(s)).toBe(true);
    s = solvedPyraminx();
    for (let i = 0; i < 3; i++) s = applyPyraminxMove(s, 1);
    expect(isPyraminxSolved(s)).toBe(true);
    // U twice == U' once (a double turn is the inverse of a single turn)
    const twice = applyPyraminxMove(applyPyraminxMove(solvedPyraminx(), 0), 0);
    expect(twice).toEqual(applyPyraminxMove(solvedPyraminx(), 1));
  });

  it("tip moves only touch the tips coordinate and have order 3", () => {
    for (let t = 0; t < 8; t++) {
      const s = applyPyraminxTip(solvedPyraminx(), t);
      expect(s.edgePerm).toBe(0);
      expect(s.edgeOrient).toBe(0);
      expect(s.cornerOrient).toBe(0);
      expect(s.tips).not.toBe(0);
      const inv = t % 2 === 0 ? t + 1 : t - 1;
      expect(isPyraminxSolved(applyPyraminxTip(s, inv))).toBe(true);
    }
  });

  it("parses official notation and round-trips; rejects invalid tokens", () => {
    const scramble = "U L' R B' u' l r' b";
    const s = applyPyraminxSequence(solvedPyraminx(), scramble);
    expect(s).not.toBeNull();
    expect(isPyraminxSolved(s!)).toBe(false);

    const inverse = scramble.split(" ").map((t) => INVERSE_TOKEN[t]).reverse().join(" ");
    const back = applyPyraminxSequence(s!, inverse);
    expect(back).not.toBeNull();
    expect(isPyraminxSolved(back!)).toBe(true);

    expect(applyPyraminxSequence(solvedPyraminx(), "U X")).toBeNull();
    expect(applyPyraminxSequence(solvedPyraminx(), "R2")).toBeNull();
    expect(applyPyraminxSequence(solvedPyraminx(), "")).toEqual(solvedPyraminx());
  });

  it("computes the true optimal distance", () => {
    expect(pyraminxDistance(solvedPyraminx())).toBe(0);
    expect(pyraminxDistance(applyPyraminxMove(solvedPyraminx(), 3))).toBe(1);
    expect(pyraminxDistance(applyPyraminxMove(solvedPyraminx(), 5))).toBe(1);
  });
});

describe("PyraminxSolver — scrambles", () => {
  it("is deterministic given the same RNG", () => {
    expect(generatePyraminxScramble(lcg(42))).toBe(generatePyraminxScramble(lcg(42)));
  });

  it("random states are always reachable (parity filter works)", () => {
    for (let i = 0; i < 500; i++) {
      expect(isPyraminxReachable(randomPyraminxState(lcg(i + 7)))).toBe(true);
    }
  });

  it(
    "generates 1000 official-style scrambles: exactly 11 moves + tips, distance ≥ 6, invertible",
    () => {
      for (let i = 0; i < 1000; i++) {
        const scramble = generatePyraminxScramble(lcg(i + 1000));
        expect(scramble).not.toBe("");
        expect(isValidPyraminxScramble(scramble)).toBe(true);

        const tokens = scramble.split(" ");
        const tipCount = tokens.filter((t) => t === t.toLowerCase()).length;

        // Official invariant (PyraminxPuzzle.generateRandomMoves): the scramble
        // has EXACTLY the WCA length (11) plus one move per unsolved tip.
        expect(tokens.length).toBe(PYRAMINX_SCRAMBLE_LENGTH + tipCount);

        // Applying the scramble must leave the puzzle genuinely scrambled…
        const scrambled = applyPyraminxSequence(solvedPyraminx(), scramble)!;
        expect(isPyraminxSolved(scrambled)).toBe(false);

        // …and the inverse must restore it (tips included).
        const inverse = tokens.map((t) => INVERSE_TOKEN[t]).reverse().join(" ");
        const back = applyPyraminxSequence(scrambled, inverse)!;
        expect(isPyraminxSolved(back)).toBe(true);

        // WCA Reg 4b3: the state must require at least 6 moves (and at most
        // God's number, 11 — proven by the BFS table above).
        const d = pyraminxDistance(scrambled);
        expect(d).toBeGreaterThanOrEqual(PYRAMINX_MIN_DISTANCE);
        expect(d).toBeLessThanOrEqual(11);
      }
    },
    60_000,
  );
});

describe("PyraminxSolver — Phase 1: Solved-state mathematics (A₄ symmetries)", () => {
  function invertPerm(
    p: readonly [number, number, number, number],
  ): [number, number, number, number] {
    const inv = [0, 0, 0, 0] as [number, number, number, number];
    for (let i = 0; i < 4; i++) inv[p[i]] = i;
    return inv;
  }

  it("1. The 12 signatures are distinct, all reachable (isPyraminxReachable)", () => {
    expect(PYRAMINX_SOLVED_STATES).toHaveLength(12);
    const edgePerms = new Set(PYRAMINX_SOLVED_STATES.map((s) => s.edgePerm));
    expect(edgePerms.size).toBe(12);

    for (const state of PYRAMINX_SOLVED_STATES) {
      expect(isPyraminxReachable(state)).toBe(true);
    }
  });

  it("2. Each signature is detected by isPyraminxSolvedAnyOrientation; identity is signature #0", () => {
    expect(PYRAMINX_SOLVED_STATES[0]).toEqual(solvedPyraminx());
    expect(isPyraminxSolved(PYRAMINX_SOLVED_STATES[0])).toBe(true);

    for (let i = 0; i < 12; i++) {
      const s = PYRAMINX_SOLVED_STATES[i];
      expect(isPyraminxSolvedAnyOrientation(s)).toBe(true);
      if (i > 0) {
        expect(isPyraminxSolved(s)).toBe(false);
      }
    }
  });

  it("3. Negative probes in every orientation (12 × 4 = 48 cases): single defect -> false", () => {
    for (const s of PYRAMINX_SOLVED_STATES) {
      // 3a. Single flipped edge
      const flippedEdge = { ...s, edgeOrient: s.edgeOrient ^ 1 };
      expect(isPyraminxSolvedAnyOrientation(flippedEdge)).toBe(false);

      // 3b. Single twisted corner
      const twistedCorner = { ...s, cornerOrient: (s.cornerOrient + 1) % 81 };
      expect(isPyraminxSolvedAnyOrientation(twistedCorner)).toBe(false);

      // 3c. Single twisted tip
      const twistedTip = { ...s, tips: (s.tips + 1) % 81 };
      expect(isPyraminxSolvedAnyOrientation(twistedTip)).toBe(false);

      // 3d. Transposition / different permutation
      const swappedEdges = { ...s, edgePerm: (s.edgePerm + 1) % 720 };
      expect(isPyraminxSolvedAnyOrientation(swappedEdges)).toBe(false);
    }
  });

  it("4. Relabeling round-trip: relabel(g⁻¹, relabel(g, s)) === s for all g", () => {
    const testState = applyPyraminxSequence(solvedPyraminx(), "U L R' B u l'")!;
    expect(testState).not.toBeNull();

    for (const g of PYRAMINX_A4_PERMUTATIONS) {
      const gInv = invertPerm(g);
      const forward = relabelPyraminxState(testState, g);
      const back = relabelPyraminxState(forward, gInv);
      expect(back).toEqual(testState);
    }
  });

  it("5. Closure: signatures closed under composition with the 6 UI-pose relabelings (and all of A₄)", () => {
    for (const s of PYRAMINX_SOLVED_STATES) {
      for (const g of PYRAMINX_A4_PERMUTATIONS) {
        const next = relabelPyraminxState(s, g);
        expect(isPyraminxSolvedAnyOrientation(next)).toBe(true);
      }
    }
  });
});
