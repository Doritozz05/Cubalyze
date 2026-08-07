/**
 * The formal property of the F2L pair signature:
 *
 *   "case + slot + AUF" is ONE equivalence class.
 *
 * For every basic F2L case we generate its canonical state from the setup,
 * locate the pair it leaves unsolved, then apply every transformation in
 * {identity, y, y2, y'} × {identity, U, U2, U'} and require the signature to
 * be UNCHANGED. We also require the 41 basic cases to be pairwise DISTINCT
 * (no collisions) — the signature is a complete classifier for the basic set.
 *
 * Pair-only signatures are what make recognition work on real solves: the
 * other three pairs are still scrambled there, so a full-state signature
 * could never match the catalog.
 */
import { describe, expect, it } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { BASIC_F2L_CASES } from '../../seed/cfop-f2l';
import { CaseStateGenerator } from '../../caseGenerator';
import {
  F2L_SLOTS,
  f2lPairSignature,
  pairSolved,
} from '../../recognition/signatures';
import { CATALOG_CONVENTION } from '../../recognition/conventions';

const ROTATIONS = ['', 'y', 'y2', "y'"];
const AUFS = ['', 'U', 'U2', "U'"];

/** The slots the setup leaves unsolved (the case pair(s)). */
function unsolvedSlots(state: CubeState): { cornerHome: number; edgeHome: number }[] {
  return F2L_SLOTS.filter(
    (s) => !pairSolved(state, CATALOG_CONVENTION.crossEdges, s.cornerHome, s.edgeHome),
  );
}

describe('f2lPairSignature — formal invariance', () => {
  it('is invariant under slot rotation × AUF for all 41 basic cases', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const caseData of BASIC_F2L_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const slots = unsolvedSlots(state);
      expect(slots.length).toBeGreaterThan(0);
      const { cornerHome, edgeHome } = slots[0];
      const base = f2lPairSignature(state, CATALOG_CONVENTION.crossEdges, cornerHome, edgeHome);
      if (base === null) {
        failures.push(`${caseData.caseDef.caseNumber}: base signature null`);
        continue;
      }
      for (const rot of ROTATIONS) {
        for (const auf of AUFS) {
          const transformed = state.clone();
          if (rot) transformed.applySequence(rot);
          if (auf) transformed.applySequence(auf);
          const sig = f2lPairSignature(
            transformed,
            CATALOG_CONVENTION.crossEdges,
            cornerHome,
            edgeHome,
          );
          checked++;
          if (sig !== base) {
            failures.push(
              `${caseData.caseDef.caseNumber} + (${rot || '∅'}, ${auf || '∅'}): ${sig} ≠ ${base}`,
            );
          }
        }
      }
    }
    expect(checked).toBe(41 * 16);
    expect(failures).toEqual([]);
  });

  it('is a complete classifier for the 41 basic cases (no collisions)', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const caseData of BASIC_F2L_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const slots = unsolvedSlots(state);
      expect(slots.length).toBeGreaterThan(0);
      const { cornerHome, edgeHome } = slots[0];
      const sig = f2lPairSignature(state, CATALOG_CONVENTION.crossEdges, cornerHome, edgeHome);
      if (sig === null) {
        collisions.push(`${caseData.caseDef.caseNumber}: null signature`);
        continue;
      }
      const prev = seen.get(sig);
      if (prev !== undefined) {
        collisions.push(`${prev} collides with ${caseData.caseDef.caseNumber}`);
      } else {
        seen.set(sig, caseData.caseDef.caseNumber);
      }
    }
    expect(collisions).toEqual([]);
    expect(seen.size).toBe(41);
  });

  it('recovers the same case across all 4 slots (via y rotations)', () => {
    // For Jb (F2L 1): rotate the canonical state by y/y2/y' and require the
    // SAME pair signature (the case is slot-independent).
    const jb = CaseStateGenerator.generateFromScramble('F R\' F\' R');
    const slots = unsolvedSlots(jb);
    expect(slots.length).toBeGreaterThan(0);
    const { cornerHome, edgeHome } = slots[0];
    const base = f2lPairSignature(jb, CATALOG_CONVENTION.crossEdges, cornerHome, edgeHome);
    expect(base).not.toBeNull();
    for (const rot of ['y', 'y2', "y'"]) {
      const rotated = jb.clone();
      rotated.applySequence(rot);
      expect(f2lPairSignature(rotated, CATALOG_CONVENTION.crossEdges, cornerHome, edgeHome)).toBe(
        base,
      );
    }
  });
});
