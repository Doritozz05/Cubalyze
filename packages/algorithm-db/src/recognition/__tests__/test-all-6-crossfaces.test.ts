import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { PLL_CASES } from '../../seed/cfop-pll';
import { OLL_CASES } from '../../seed/cfop-oll';
import { CaseStateGenerator } from '../../caseGenerator';
import { CROSS_TO_D, D_TO_CROSS } from '../crossFaceAdapter';

const LOWER_CORNER_MAP: Record<number, number> = { 7: 0, 6: 1, 5: 2, 4: 3 };
const LOWER_EDGE_MAP: Record<number, number> = { 4: 0, 7: 1, 6: 2, 5: 3 };

function relabelLowerAnchor(anchor: CubeState): CubeState {
  const cp = Array.from(anchor.cp);
  const ep = Array.from(anchor.ep);
  for (let i = 0; i < 4; i++) {
    cp[i] = LOWER_CORNER_MAP[cp[i]] ?? cp[i];
    ep[i] = LOWER_EDGE_MAP[ep[i]] ?? ep[i];
  }
  return new CubeState(cp, anchor.co, ep, anchor.eo);
}

const Y_ROTATIONS = ['', 'y', 'y2', "y'"] as const;
const U_AUFS = ['', 'U', 'U2', "U'"] as const;

function minimizeOverY(
  state: CubeState,
  build: (rotated: CubeState) => string,
): string {
  let best: string | null = null;
  for (const y of Y_ROTATIONS) {
    const rotated = y
      ? (() => {
          const t = state.clone();
          t.applySequence(y);
          return t;
        })()
      : state;
    const sig = build(rotated);
    if (best === null || sig < best) best = sig;
  }
  return best ?? '';
}

function minimizeOverTwoSidedU(
  state: CubeState,
  build: (rotated: CubeState) => string,
): string {
  let best: string | null = null;
  for (const left of U_AUFS) {
    const leftState = left
      ? (() => {
          const u = new CubeState();
          u.applySequence(left);
          u.multiply(state);
          return u;
        })()
      : state;
    for (const right of U_AUFS) {
      const cand = right
        ? (() => {
            const t = leftState.clone();
            t.applySequence(right);
            return t;
          })()
        : leftState;
      const sig = build(cand);
      if (best === null || sig < best) best = sig;
    }
  }
  return best ?? '';
}

function computeOLL(state: CubeState, crossFace: string): string {
  const rot = CROSS_TO_D[crossFace];
  const anchor = state.clone();
  if (rot) anchor.applySequence(rot);
  return minimizeOverY(anchor, (t) => {
    const eo = t.eo;
    const co = t.co;
    return `O:${eo[0]}${eo[1]}${eo[2]}${eo[3]}|${co[0]}${co[1]}${co[2]}${co[3]}`;
  });
}

function computePLL(state: CubeState, crossFace: string): string {
  const rot = CROSS_TO_D[crossFace];
  const anchor = state.clone();
  if (rot) anchor.applySequence(rot);
  const isLower = anchor.cp[0] >= 4;
  const work = isLower ? relabelLowerAnchor(anchor) : anchor;
  return minimizeOverTwoSidedU(work, (t) => {
    const cp = t.cp;
    const ep = t.ep;
    return `P:${cp[0]}${cp[1]}${cp[2]}${cp[3]}|${ep[0]}${ep[1]}${ep[2]}${ep[3]}`;
  });
}

describe('Test All 6 Cross Faces on Full Catalog (57 OLL + 21 PLL)', () => {
  it('tests 57 OLL cases across all 6 cross faces', () => {
    for (const c of OLL_CASES) {
      const canonical = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
      const canonicalSig = computeOLL(canonical, 'D');

      for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
        const toCross = D_TO_CROSS[face];
        const state = canonical.clone();
        if (toCross) state.applySequence(toCross);

        const sig = computeOLL(state, face);
        expect(sig).toBe(canonicalSig);
      }
    }
    console.log('57 OLL cases x 6 cross faces (342 tests) PASSED 100%!');
  });

  it('tests 21 PLL cases across all 6 cross faces', () => {
    for (const c of PLL_CASES) {
      const canonical = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
      const canonicalSig = computePLL(canonical, 'D');

      for (const face of ['D', 'U', 'F', 'B', 'R', 'L']) {
        const toCross = D_TO_CROSS[face];
        const state = canonical.clone();
        if (toCross) state.applySequence(toCross);

        const sig = computePLL(state, face);
        expect(sig).toBe(canonicalSig);
      }
    }
    console.log('21 PLL cases x 6 cross faces (126 tests) PASSED 100%!');
  });
});
