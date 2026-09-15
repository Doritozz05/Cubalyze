import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubalyze/math-core';
import { CaseDetector } from '../caseDetector';
import {
  BASIC_F2L_SUBSET_MANIFEST,
  loadBasicF2LCases,
} from '../loaders/basicF2L';
import { CaseStateGenerator } from '../../caseGenerator';
import { BASIC_F2L_CASES } from '../../seed/cfop-f2l';
import { solverStateForCase } from './helpers';

function makeDetector(crossFaces: string[]): CaseDetector {
  return CaseDetector.create(
    [{ ...BASIC_F2L_SUBSET_MANIFEST, crossFaces }],
    loadBasicF2LCases,
  );
}

const D_SLOTS = ['FR', 'BR', 'BL', 'FL'];

/**
 * Build the state a solver with cross on D faces for a given catalog case,
 * with the pair in `slotName`. Uses the faithful conjugated-setup
 * construction (see helpers.ts): solved ∘ r ∘ setup ∘ r⁻¹ — a real,
 * reachable solver state with the slot's own pieces in the pair config.
 * No relabeling, no orientation repair: the detector's relational
 * signature must recognize it directly.
 */
// (imported from ./helpers)

describe('caseCatalog — Basic F2L across crossFaces', () => {
  it('recognizes every case in the D-cross frame at its own slot', () => {
    const detector = makeDetector(['D']);
    for (const { caseDef } of BASIC_F2L_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      const result = detector.detect(state, 'D', 'FR');
      expect(result.confidence).toBe('exact');
      expect(result.entry?.caseName).toBe(caseDef.name);
      expect(result.entry?.caseNumber).toBe(caseDef.caseNumber);
    }
  });

  it('recognizes every case in every slot of the D-cross frame (faithful fixtures)', () => {
    const detector = makeDetector(['D']);
    let checked = 0;
    for (const { caseDef } of BASIC_F2L_CASES) {
      for (const slot of D_SLOTS) {
        const state = solverStateForCase(
          caseDef.setupScramble,
          'D',
          slot,
        );
        const result = detector.detect(state, 'D', slot);
        expect(
          result.confidence,
          `${caseDef.name} in D/${slot}`,
        ).toBe('exact');
        expect(result.entry?.caseName, `${caseDef.name} in D/${slot}`).toBe(caseDef.name);
        checked++;
      }
    }
    // 41 cases × 4 slots
    expect(checked).toBe(41 * 4);
  });

  it('does not crash and returns a DetectionResult for any cross face / slot', () => {
    // The catalog is D-cross-native: the relational signature keys on the
    // D-cross geometry, so non-D frames may report 'unknown' — but the
    // detector must never throw and must stay deterministic.
    const detector = makeDetector(['D', 'U', 'F', 'B', 'R', 'L']);
    const SLOTS: Record<string, string[]> = {
      D: ['FR', 'BR', 'BL', 'FL'],
      U: ['FR', 'BR', 'BL', 'FL'],
      F: ['UR', 'UL', 'DR', 'DL'],
      B: ['UR', 'UL', 'DR', 'DL'],
      R: ['UF', 'UB', 'DF', 'DB'],
      L: ['UF', 'UB', 'DF', 'DB'],
    };
    for (const { caseDef } of BASIC_F2L_CASES.slice(0, 5)) {
      for (const crossFace of ['D', 'U', 'F', 'B', 'R', 'L']) {
        for (const slot of SLOTS[crossFace]) {
          const state = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
          const result = detector.detect(state, crossFace, slot);
          expect(['exact', 'unknown']).toContain(result.confidence);
        }
      }
    }
  });

  it('returns unknown for an empty slot / solved pair', () => {
    const detector = makeDetector(['D']);
    const solved = new CubeState();
    const result = detector.detect(solved, 'D', 'FR');
    expect(result.confidence).toBe('unknown');
  });

  it('handles unrecognized crossFace and slot gracefully', () => {
    const detector = makeDetector(['D']);
    const solved = new CubeState();
    expect(detector.detect(solved, 'X', 'FR').confidence).toBe('unknown');
    expect(detector.detect(solved, 'D', 'XX').confidence).toBe('unknown');
  });
});
