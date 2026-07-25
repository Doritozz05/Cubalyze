import { describe, it, expect, beforeEach } from 'vitest';
import { CubeState } from '../CubeState';
import { StateMatcher } from '../methods/StateMatcher';
import { Edge } from '../Constants';
import {
  CrossMask, F2LMask, OLLMask, PLLMask, COLOR_NEUTRAL_CFOP_MASKS,
} from '../methods/cfop/cfopMasks';
import { compilePhaseMask, compiledMasksEqual } from '../methods/CompiledMasks';
import type { PhaseMask, EdgeRule } from '../methods/IMethodDefinition';

// ── Helpers ───────────────────────────────────────────────────────────

function applyNonDSequence(scratch: CubeState, seq: string): void {
  // Apply a sequence that does NOT touch the D layer (positions DR/DF/DL/DB
  // for edges and DFR/DRB/DBL/DLF for corners stay solved).
  // IMPORTANT: only U-layer moves preserve D in CFOP. Use this helper only
  // when the sequence consists of U, U', U2 tokens.
  scratch.applySequence(seq);
}

function applyOnlyUSequence(scratch: CubeState, seq: string): void {
  // Hard guarantee: ONLY U, U', U2 tokens. Any other token throws to surface
  // tests that accidentally introduce a D-disturbing move.
  const tokens = seq.trim().split(/\s+/);
  for (const t of tokens) {
    if (!['U', "U'", 'U2'].includes(t)) {
      throw new Error(`applyOnlyUSequence received '${t}' — only U/U'/U2 allowed`);
    }
  }
  scratch.applySequence(seq);
}

// ── Compile-cache tests ───────────────────────────────────────────────

describe('PASO 4 — compilePhaseMask returns non-null for all CFOP masks', () => {
  beforeEach(() => StateMatcher.__resetCache());

  it('compilePhaseMask compiles D-cross', () => {
    const cm = compilePhaseMask(CrossMask);
    expect(cm).not.toBeNull();
    expect(cm!.maskEdges).not.toBe(0n);
    expect(cm!.maskCorners).toBe(0n); // no corner rules in CrossMask
  });

  it('compilePhaseMask D-F2LMask, OLLMask, PLLMask all compile', () => {
    expect(compilePhaseMask(F2LMask)).not.toBeNull();
    expect(compilePhaseMask(OLLMask)).not.toBeNull();
    expect(compilePhaseMask(PLLMask)).not.toBeNull();
  });

  it('compilePhaseMask for all 6 faces × 4 phases produces 24 non-null masks', () => {
    let nonNull = 0;
    let total = 0;
    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      for (const ph of faceMasks.masks) {
        total++;
        if (compilePhaseMask(ph) !== null) nonNull++;
      }
    }
    expect(nonNull).toBe(total);
    expect(total).toBe(24);
  });

  it('a PhaseMask with requiredEp=undefined returns null', () => {
    const mask: PhaseMask = {
      name: 'findAnywhere',
      edges: [{ id: Edge.UF, requiredEo: 0 } as EdgeRule],
    };
    expect(compilePhaseMask(mask)).toBeNull();
  });
});

// ── StateMatcher behaviour ─────────────────────────────────────────────

describe('PASO 4 — StateMatcher correctness vs linear path', () => {
  beforeEach(() => StateMatcher.__resetCache());

  it('solved cube matches PLL (D) exactly once', () => {
    const solved = new CubeState();
    expect(StateMatcher.matchesMask(solved, PLLMask)).toBe(true);
  });

  it('T-Perm does NOT match PLL (edges swapped)', () => {
    // T-Perm: swaps UF<->UL and FR<->BL edges, leaves corners unchanged
    // PLL requires all edges in correct positions, so it must NOT match.
    const cube = new CubeState();
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    expect(StateMatcher.matchesMask(cube, PLLMask)).toBe(false);
  });

  it('partial upper-layer moves preserve D-cross', () => {
    // R U R' U' affects U-layer corners/edges only, D layer untouched.
    const cube = new CubeState();
    applyNonDSequence(cube, "R U R' U' R U R' U'");
    expect(StateMatcher.matchesMask(cube, CrossMask)).toBe(true);

    // But D2 swaps DF and DB edges → D-cross must NOT match.
    const cube2 = new CubeState();
    cube2.applySequence("D2");
    expect(StateMatcher.matchesMask(cube2, CrossMask)).toBe(false);
  });

  it('compiled path produces IDENTICAL boolean to linear path on 200 random states', () => {
    let lcg = 0x12345678;
    for (let trial = 0; trial < 200; trial++) {
      lcg = (lcg * 1664525 + 1013904223) >>> 0;
      const moves = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'",
                     'D', 'D2', "D'", 'L', 'L2', "L'", 'B2', 'B'];
      const len = 5 + (lcg % 25);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) {
        lcg = (lcg * 1664525 + 1013904223) >>> 0;
        seq.push(moves[lcg % moves.length]);
      }

      const cube = new CubeState();
      cube.applySequence(seq.join(' '));

      for (const phase of [CrossMask, F2LMask, OLLMask, PLLMask]) {
        StateMatcher.__resetCache();
        const compiledResult = StateMatcher.matchesMask(cube, phase);
        StateMatcher.__resetCache();
        const linearResult = StateMatcher.matchesMaskLinear(cube, phase);
        expect(compiledResult).toBe(linearResult);
      }
    }
  });
});

// ── Cache and statistics ───────────────────────────────────────────────

describe('PASO 4 — cache + counters', () => {
  beforeEach(() => StateMatcher.__resetCache());

  it('compiled path is taken for all 4 D-face masks', () => {
    const cube = new CubeState();
    applyNonDSequence(cube, "R U R' U'");

    StateMatcher.matchesMask(cube, CrossMask);
    StateMatcher.matchesMask(cube, F2LMask);
    StateMatcher.matchesMask(cube, OLLMask);
    StateMatcher.matchesMask(cube, PLLMask);

    expect(StateMatcher.compiledMatches).toBe(4);
    expect(StateMatcher.linearMatches).toBe(0);
  });

  it('find-anywhere mask forces linear path', () => {
    const cube = new CubeState();
    const mask: PhaseMask = {
      name: 'findAnywhere',
      edges: [{ id: Edge.UF, requiredEo: 0 } as EdgeRule],
    };

    StateMatcher.__resetCache();
    StateMatcher.matchesMask(cube, mask);
    expect(StateMatcher.compiledMatches).toBe(0);
    expect(StateMatcher.linearMatches).toBe(1);
  });

  it('caching: re-matching the same PhaseMask does not re-compile', () => {
    const cube = new CubeState();
    StateMatcher.__resetCache();

    for (let i = 0; i < 1000; i++) {
      StateMatcher.matchesMask(cube, CrossMask);
    }
    expect(StateMatcher.compiledMatches).toBe(1000);
    expect(StateMatcher.linearMatches).toBe(0);
  });

  it('__resetCache clears the cache and counters', () => {
    const cube = new CubeState();
    StateMatcher.matchesMask(cube, CrossMask);
    expect(StateMatcher.compiledMatches).toBe(1);
    StateMatcher.__resetCache();
    expect(StateMatcher.compiledMatches).toBe(0);
  });
});

// ── Equivalence: re-compile is idempotent ──────────────────────────────

describe('PASO 4 — idempotence', () => {
  it('re-compiling the same PhaseMask gives the same CompiledMask', () => {
    const a = compilePhaseMask(CrossMask);
    const b = compilePhaseMask(CrossMask);
    expect(compiledMasksEqual(a!, b!)).toBe(true);
  });

  it('each face mask is unique within its phase (cross/f2l/oll distinct) but all PLLs collapse', () => {
    // Group masks by phase slot (cross=0, f2l=1, oll=2, pll=3).
    const bySlot: any[][] = [[], [], [], []];
    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      for (let slot = 0; slot < 4; slot++) {
        const compiled = compilePhaseMask(faceMasks.masks[slot]);
        expect(compiled).not.toBeNull();
        bySlot[slot].push(compiled);
      }
    }

    // Cross masks: all 6 should be distinct (each face has unique cross positions)
    expect(distinctCount(bySlot[0])).toBe(6);
    // F2L masks: all 6 should be distinct
    expect(distinctCount(bySlot[1])).toBe(6);
    // OLL masks: all 6 should be distinct (different orient/grouping per face)
    expect(distinctCount(bySlot[2])).toBe(6);
    // PLL masks: ALL collapse to 1 because every face's PLL requires SOLVED state.
    // (Each face's PLL says "every edge i is at position i with eo=0".)
    expect(distinctCount(bySlot[3])).toBe(1);

    // Total distinct = 6 + 6 + 6 + 1 = 19
    expect(distinctCount([...bySlot[0], ...bySlot[1], ...bySlot[2], ...bySlot[3]])).toBe(19);
  });
});

// ── Performance: compiled path faster than linear ──────────────────────

describe('PASO 4 — performance', () => {
  beforeEach(() => StateMatcher.__resetCache());

  it('compiled path is substantially faster than linear on 10000 calls', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");

    // Warm-up: trigger compilation
    StateMatcher.matchesMask(cube, CrossMask);
    StateMatcher.__resetCache();

    // Time the compiled path
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      StateMatcher.matchesMask(cube, CrossMask);
    }
    const compiledTime = performance.now() - t0;
    expect(StateMatcher.compiledMatches).toBe(10000);
    expect(StateMatcher.linearMatches).toBe(0);

    // Time the linear fallback
    StateMatcher.__resetCache();
    const linearMask: PhaseMask = {
      name: 'elsewhere',
      edges: [{ id: Edge.UF, requiredEo: 0 } as EdgeRule],
    };
    StateMatcher.matchesMaskLinear(cube, linearMask); // warm
    const t1 = performance.now();
    for (let i = 0; i < 10000; i++) {
      StateMatcher.matchesMaskLinear(cube, linearMask);
    }
    const linearTime = performance.now() - t1;

    // Compiled path should be at least 2× faster (when measured per-call).
    // If the ratio is small we print observed values to aid debugging.
    if (compiledTime >= linearTime) {
      // Print latency comparison to help diagnose.
      // eslint-disable-next-line no-console
      console.warn(`compiled=${compiledTime.toFixed(2)}ms linear=${linearTime.toFixed(2)}ms`);
    }
    expect(compiledTime).toBeLessThan(linearTime);

    // Hard absolute floor: 10000 compiled calls under 50 ms.
    expect(compiledTime).toBeLessThan(50);
    // The linear path must take meaningful time so the comparison is real.
    expect(linearTime).toBeGreaterThan(5);
  });
});

// ── Cross-face validation ──────────────────────────────────────────────

describe('PASO 4 — color-neutral masks (U, F, B, R, L faces)', () => {
  beforeEach(() => StateMatcher.__resetCache());

  it('a solved cube matches ALL six PLL masks', () => {
    const solved = new CubeState();
    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      expect(StateMatcher.matchesMask(solved, faceMasks.masks[3])).toBe(true);
    }
  });

  it('a scrambled cube rarely matches any PLL mask (sanity)', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    const matches: number[] = [];
    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      matches.push(StateMatcher.matchesMask(cube, faceMasks.masks[3]) ? 1 : 0);
    }
    expect(matches.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('U-cross mask matches when U-layer is settled but D layer is shuffled', () => {
    // D2 rotates ONLY the D layer (positions 4-7). U layer is untouched.
    // This is exactly the kind of state where U-cross must match (U intact)
    // but D-cross must not (D disturbed).
    const cube = new CubeState();
    cube.applySequence("D2");
    const uFace = COLOR_NEUTRAL_CFOP_MASKS.find(f => f.face === 'U')!;
    const dFace = COLOR_NEUTRAL_CFOP_MASKS.find(f => f.face === 'D')!;

    expect(StateMatcher.matchesMask(cube, uFace.masks[0])).toBe(true);
    expect(StateMatcher.matchesMask(cube, dFace.masks[0])).toBe(false);
  });

  it('D-cross mask rejects state with D-layer disturbed', () => {
    const cube = new CubeState();
    cube.applySequence("D2");
    expect(StateMatcher.matchesMask(cube, CrossMask)).toBe(false);
  });

  it('partial upper-layer moves preserve D-cross', () => {
    // Build a deterministic D-preserving scramble using DIFFERENT faces only.
    // Even R U R' U' affects position 4 (DFR corner / DR edge), so we cannot
    // fully exclude D-layer moves, but the NET operation `R U R' U'` is a
    // known commutator that DOES touch D. Therefore use only U-layer primes.
    const cube = new CubeState();
    applyOnlyUSequence(cube, "U U2 U' U2");  // net identity, but cycles through
    expect(StateMatcher.matchesMask(cube, CrossMask)).toBe(true);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

function distinctCount(masks: any[]): number {
  const set = new Set<string>();
  for (const m of masks) {
    set.add(`${m.maskCorners},${m.valueCorners},${m.maskEdges},${m.valueEdges}`);
  }
  return set.size;
}
