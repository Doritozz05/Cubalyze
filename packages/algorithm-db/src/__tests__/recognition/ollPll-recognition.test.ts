/**
 * OLL / PLL recognition self-consistency:
 *
 *   - Every OLL case is recovered from its own setup state, in every AUF
 *     variant, and no two OLL cases share a signature.
 *   - Same for PLL (case numbers like Aa, Ab, ..., Gd).
 *
 * This is the "oracle" for the LL detectors: if a case cannot be recovered
 * from its own setup, the signature/index is broken — no reconstruction can
 * ever match it.
 */
import { describe, expect, it } from 'vitest';
import { OLL_CASES } from '../../seed/cfop-oll';
import { PLL_CASES } from '../../seed/cfop-pll';
import { CaseStateGenerator } from '../../caseGenerator';
import { ollSignatureWithAuf, pllSignatureWithAuf } from '../../recognition/signatures';
import { CATALOG_CONVENTION } from '../../recognition/conventions';

const AUFS = ['', 'U', 'U2', "U'"];

describe('OLL recognition', () => {
  it('recovers every OLL case from its own setup (all AUF variants)', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const caseData of OLL_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const base = ollSignatureWithAuf(state, CATALOG_CONVENTION.crossEdges);
      if (base === null) {
        failures.push(`${caseData.caseDef.caseNumber}: null signature`);
        continue;
      }
      for (const auf of AUFS) {
        const variant = state.clone();
        if (auf) variant.applySequence(auf);
        const sig = ollSignatureWithAuf(variant, CATALOG_CONVENTION.crossEdges);
        checked++;
        if (sig === null || sig.sig !== base.sig) {
          failures.push(`${caseData.caseDef.caseNumber} + ${auf || '∅'}: signature mismatch`);
        }
      }
    }
    expect(checked).toBe(OLL_CASES.length * 4);
    expect(failures).toEqual([]);
  });

  it('has no collisions between different OLL cases', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const caseData of OLL_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const sig = ollSignatureWithAuf(state, CATALOG_CONVENTION.crossEdges);
      if (sig === null) continue;
      const prev = seen.get(sig.sig);
      if (prev !== undefined) collisions.push(`${prev} collides with ${caseData.caseDef.caseNumber}`);
      else seen.set(sig.sig, caseData.caseDef.caseNumber);
    }
    expect(collisions).toEqual([]);
    expect(seen.size).toBe(OLL_CASES.length);
  });
});

describe('PLL recognition', () => {
  it('recovers every PLL case from its own setup (all AUF variants)', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const caseData of PLL_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const base = pllSignatureWithAuf(state, CATALOG_CONVENTION.crossEdges);
      if (base === null) {
        failures.push(`${caseData.caseDef.caseNumber}: null signature`);
        continue;
      }
      for (const auf of AUFS) {
        const variant = state.clone();
        if (auf) variant.applySequence(auf);
        const sig = pllSignatureWithAuf(variant, CATALOG_CONVENTION.crossEdges);
        checked++;
        if (sig === null || sig.sig !== base.sig) {
          failures.push(`${caseData.caseDef.caseNumber} + ${auf || '∅'}: signature mismatch`);
        }
      }
    }
    expect(checked).toBe(PLL_CASES.length * 4);
    expect(failures).toEqual([]);
  });

  it('has no collisions between different PLL cases', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const caseData of PLL_CASES) {
      const state = CaseStateGenerator.generateFromScramble(caseData.caseDef.setupScramble);
      const sig = pllSignatureWithAuf(state, CATALOG_CONVENTION.crossEdges);
      if (sig === null) continue;
      const prev = seen.get(sig.sig);
      if (prev !== undefined) collisions.push(`${prev} collides with ${caseData.caseDef.caseNumber}`);
      else seen.set(sig.sig, caseData.caseDef.caseNumber);
    }
    expect(collisions).toEqual([]);
    expect(seen.size).toBe(PLL_CASES.length);
  });
});
