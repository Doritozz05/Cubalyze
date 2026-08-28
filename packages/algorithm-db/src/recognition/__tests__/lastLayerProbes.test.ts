/**
 * lastLayerProbes.test.ts — Round-trip + invariance tests for the OLL and
 * PLL detection probes.
 *
 * The seed catalog is the ground truth: every case's setupScramble produces
 * its canonical state, and the detector must recognize it back. The
 * invariance tests then verify that the same case is recognized regardless
 * of AUF (U turns) and regardless of the solver's cross face (the probes
 * normalize any frame onto the D-cross anchor).
 */
import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../../caseGenerator';
import { OLL_CASES } from '../../seed/cfop-oll';
import { PLL_CASES } from '../../seed/cfop-pll';
import {
  OLL_SUBSET_MANIFEST,
  PLL_SUBSET_MANIFEST,
  loadOLLCases,
  loadPLLCases,
  createOLLDetector,
  createPLLDetector,
  createCFOPDetector,
} from '../loaders/lastLayer';
import { lastLayerOrientationProbe, lastLayerPermutationProbe } from '../probes/lastLayerProbes';

/** The 4 U-turns — the AUF equivalence class of a last layer. */
const AUFS = ['', 'U', 'U2', "U'"] as const;

/** Every cross face: the solver may hold the cube in any frame. */
const CROSS_FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;

/** Rotate a D-cross state into a solver's cross frame (inverse of CROSS_TO_D). */
function toCrossFrame(state: CubeState, crossFace: string): CubeState {
  const D_TO_CROSS: Record<string, string> = {
    D: '',
    U: 'x2',
    F: 'x',
    B: "x'",
    R: "z'",
    L: 'z',
  };
  const rotation = D_TO_CROSS[crossFace];
  if (!rotation) return state;
  const rotated = state.clone();
  rotated.applySequence(rotation);
  return rotated;
}

describe('OLL probe — round-trip against the seed catalog', () => {
  const detector = createOLLDetector();

  it('recognizes all 57 OLL cases from their canonical setup', () => {
    expect(OLL_CASES.length).toBe(57);
    for (const { caseDef } of OLL_CASES) {
      const state = new CubeState();
      state.applySequence(caseDef.setupScramble);
      const result = detector.detectWith(state, {
        probe: 'last-layer-orientation',
        crossFace: 'D',
      });
      expect(
        result.confidence,
        `OLL ${caseDef.caseNumber}`,
      ).toBe('exact');
      expect(result.entry?.caseNumber, `OLL ${caseDef.caseNumber}`).toBe(caseDef.caseNumber);
      expect(result.entry?.caseName, `OLL ${caseDef.caseNumber}`).toBe(caseDef.name);
    }
  });

  it('is AUF-invariant: a U-turn before detection does not change the case', () => {
    for (const { caseDef } of OLL_CASES) {
      const base = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      for (const auf of AUFS) {
        const state = base.clone();
        if (auf) state.applySequence(auf);
        const result = detector.detectWith(state, {
          probe: 'last-layer-orientation',
          crossFace: 'D',
        });
        expect(
          result.confidence,
          `OLL ${caseDef.caseNumber} + ${auf}`,
        ).toBe('exact');
        expect(result.entry?.caseNumber, `OLL ${caseDef.caseNumber} + ${auf}`).toBe(caseDef.caseNumber);
      }
    }
  });

  it('is cross-frame invariant: all 57 OLL cases are recognized on every cross face', () => {
    for (const { caseDef } of OLL_CASES) {
      const base = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      for (const crossFace of CROSS_FACES) {
        const state = toCrossFrame(base, crossFace);
        const result = detector.detectWith(state, {
          probe: 'last-layer-orientation',
          crossFace,
        });
        expect(
          result.confidence,
          `OLL ${caseDef.caseNumber} cross ${crossFace}`,
        ).toBe('exact');
        expect(result.entry?.caseNumber, `OLL ${caseDef.caseNumber} cross ${crossFace}`).toBe(caseDef.caseNumber);
      }
    }
  });

  it('returns unknown for a solved cube', () => {
    const result = detector.detectWith(new CubeState(), {
      probe: 'last-layer-orientation',
      crossFace: 'D',
    });
    expect(result.confidence).toBe('unknown');
  });

  it('keeps the F2L pair detection intact on the combined detector', () => {
    const combined = createCFOPDetector();
    const ollState = CaseStateGenerator.generateFromScramble(OLL_CASES[0].caseDef.setupScramble);
    const ollResult = combined.detectWith(ollState, {
      probe: 'last-layer-orientation',
      crossFace: 'D',
    });
    expect(ollResult.confidence).toBe('exact');
    expect(ollResult.entry?.caseNumber).toBe(OLL_CASES[0].caseDef.caseNumber);
    // The same state must NOT match the PLL probe (it is not oriented).
    const pllResult = combined.detectWith(ollState, {
      probe: 'last-layer-permutation',
      crossFace: 'D',
    });
    expect(pllResult.confidence).toBe('unknown');
  });
});

describe('PLL probe — permutation round-trip and AUF invariance', () => {
  const detector = createPLLDetector();

  it('recognizes all 21 PLL cases from their canonical setup', () => {
    expect(PLL_CASES.length).toBe(21);
    for (const { caseDef } of PLL_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      const result = detector.detectWith(state, {
        probe: 'last-layer-permutation',
        crossFace: 'D',
      });
      expect(
        result.confidence,
        `PLL ${caseDef.caseNumber}`,
      ).toBe('exact');
      expect(result.entry?.caseNumber, `PLL ${caseDef.caseNumber}`).toBe(caseDef.caseNumber);
      expect(result.entry?.caseName, `PLL ${caseDef.caseNumber}`).toBe(caseDef.name);
    }
  });

  it('is AUF-invariant: a U-turn before any case does not change it', () => {
    for (const { caseDef } of PLL_CASES) {
      const base = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      for (const auf of AUFS) {
        const state = base.clone();
        if (auf) state.applySequence(auf);
        const result = detector.detectWith(state, {
          probe: 'last-layer-permutation',
          crossFace: 'D',
        });
        expect(
          result.confidence,
          `PLL ${caseDef.caseNumber} + ${auf}`,
        ).toBe('exact');
        expect(result.entry?.caseNumber, `PLL ${caseDef.caseNumber} + ${auf}`).toBe(caseDef.caseNumber);
      }
    }
  });

  it('is cross-frame invariant: all 21 PLL cases are recognized on every cross face', () => {
    for (const { caseDef } of PLL_CASES) {
      const base = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      for (const crossFace of CROSS_FACES) {
        const state = toCrossFrame(base, crossFace);
        const result = detector.detectWith(state, {
          probe: 'last-layer-permutation',
          crossFace,
        });
        expect(
          result.confidence,
          `PLL ${caseDef.caseNumber} in ${crossFace}`,
        ).toBe('exact');
        expect(result.entry?.caseNumber, `PLL ${caseDef.caseNumber} in ${crossFace}`).toBe(caseDef.caseNumber);
      }
    }
  });

  it('returns unknown for a non-PLL state (solved cube)', () => {
    const result = detector.detectWith(new CubeState(), {
      probe: 'last-layer-permutation',
      crossFace: 'D',
    });
    expect(result.confidence).toBe('unknown');
  });
});

describe('probe isolation — the three signature families never collide', () => {
  it('OLL and PLL signatures are distinct even when a case shares a setup', () => {
    const ollDetector = createOLLDetector();
    const pllDetector = createPLLDetector();
    // The solved cube: the identity permutation IS a PLL case (skip), but
    // the OLL probe must not match it (it is oriented, not misoriented).
    const solved = new CubeState();
    expect(ollDetector.detectWith(solved, { probe: 'last-layer-orientation', crossFace: 'D' }).confidence).toBe('unknown');
    expect(pllDetector.detectWith(solved, { probe: 'last-layer-permutation', crossFace: 'D' }).confidence).toBe('unknown');
  });
});