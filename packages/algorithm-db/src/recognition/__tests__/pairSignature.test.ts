import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubalyze/math-core';
import { pairSignature } from '../pairSignature';
import { CaseStateGenerator } from '../../caseGenerator';
import { BASIC_F2L_CASES } from '../../seed/cfop-f2l';

describe('pairSignature — Basic F2L catalog', () => {
  it('produces 41 distinct signatures for the 41 Basic F2L cases (FR pair)', () => {
    const sigs = new Set<string>();
    for (const { caseDef } of BASIC_F2L_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      sigs.add(pairSignature(state, 4, 8)); // D-cross FR: corner 4, edge 8
    }
    expect(sigs.size).toBe(41);
  });

  it('is invariant under AUF (U-layer rotations)', () => {
    for (const { caseDef } of BASIC_F2L_CASES.slice(0, 10)) {
      const state = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
      const base = pairSignature(state, 4, 8);
      for (const auf of ['U', 'U2', "U'"]) {
        const t = state.clone();
        t.applySequence(auf);
        expect(pairSignature(t, 4, 8)).toBe(base);
      }
    }
  });

  it('throws when the pair pieces are not in the state', () => {
    const solved = new CubeState();
    expect(() => pairSignature(solved, 0, 3)).not.toThrow(); // U edges exist
    // A piece id of 100 never exists.
    expect(() => pairSignature(solved, 100, 3)).toThrow();
  });
});