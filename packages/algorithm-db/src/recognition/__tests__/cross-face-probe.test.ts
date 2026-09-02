import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../../caseGenerator';
import {
  createPLLDetector,
  createOLLDetector,
} from '../loaders/lastLayer';

const JB_SETUP = "R U R2 F' R U R U' R' F R U' R'";
const OLL6_SETUP = "r U R' U R U2' r'";

const CROSS_FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;
const D_TO_CROSS: Record<string, string> = {
  D: '',
  U: 'x2',
  F: 'x',
  B: "x'",
  R: "z'",
  L: 'z',
};

describe('last-layer probes across cross faces', () => {
  const pllDetector = createPLLDetector();
  const ollDetector = createOLLDetector();

  it('recognizes Jb from every cross face (rotated frames)', () => {
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    for (const face of CROSS_FACES) {
      const rotated = dCross.clone();
      rotated.applySequence(D_TO_CROSS[face]);
      const res = pllDetector.detectWith(rotated, {
        probe: 'last-layer-permutation',
        crossFace: face,
      });
      expect(res.entry?.caseNumber, `crossFace=${face}`).toBe('Jb');
      expect(res.confidence).toBe('exact');
    }
  });

  it('recognizes OLL 6 from every cross face (rotated frames)', () => {
    const dCross = CaseStateGenerator.generateFromScramble(OLL6_SETUP);
    for (const face of CROSS_FACES) {
      const rotated = dCross.clone();
      rotated.applySequence(D_TO_CROSS[face]);
      const res = ollDetector.detectWith(rotated, {
        probe: 'last-layer-orientation',
        crossFace: face,
      });
      expect(res.entry?.caseNumber, `crossFace=${face}`).toBe('OLL 6');
      expect(res.confidence).toBe('exact');
    }
  });

  it('recognizes Jb with AUF folded into the rotation (left/right U turns)', () => {
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    const rotated = dCross.clone();
    rotated.applySequence('x2'); // U-cross frame: LL now on D
    for (const auf of ['', 'D', 'D2', "D'", 'U', 'U2', "U'"]) {
      const st = rotated.clone();
      st.applySequence(auf);
      const res = pllDetector.detectWith(st, {
        probe: 'last-layer-permutation',
        crossFace: 'U',
      });
      expect(res.entry?.caseNumber, `crossFace=U auf=${auf}`).toBe('Jb');
    }
  });

  it('detects the exact observed AUF face for a U-cross state', () => {
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    const rotated = dCross.clone();
    rotated.applySequence('x2');
    const st = rotated.clone();
    st.applySequence('D'); // a D turn = AUF of the D-layer (LL) case
    const res = pllDetector.detectWith(st, {
      probe: 'last-layer-permutation',
      crossFace: 'U',
    });
    expect(res.entry?.caseNumber).toBe('Jb');
    expect(res.aufFace).toBeDefined();
  });

  it('rejects a mixed LL (not assembled) instead of aliasing a PLL', () => {
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    const cp = Array.from(dCross.cp);
    [cp[0], cp[4]] = [cp[4], cp[0]];
    const broken = new CubeState(
      cp,
      Array.from(dCross.co),
      Array.from(dCross.ep),
      Array.from(dCross.eo),
    );
    const res = pllDetector.detectWith(broken, {
      probe: 'last-layer-permutation',
      crossFace: 'D',
    });
    expect(res.confidence).toBe('unknown');
  });
});
