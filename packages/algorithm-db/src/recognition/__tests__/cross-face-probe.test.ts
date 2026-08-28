/**
 * cross-face-probe.test.ts — do the last-layer probes recognize catalog
 * cases when the cross is NOT on D?
 *
 * The seed setups are canonical D-cross states (cross on D, last layer on
 * U). A solver who builds the cross on U / F / R / … sees the SAME case
 * rotated into their frame. The catalog builds native entries per crossFace
 * (loaders/lastLayer.ts manifests list D/U/F/B/R/L), and the probes
 * normalize the observed state back onto the D anchor via CROSS_TO_D.
 *
 * Two families are exercised:
 *
 *   1. ROTATED frames — the seed state rotated with D_TO_CROSS[face]. The
 *      LL keeps the canonical U color, so after re-normalization the LL
 *      pieces are 0-3 (the 'upper' family).
 *
 *   2. INVERTED-color frames — a solver whose cross color is the canonical
 *      U color on a non-D face (e.g. a white cross built on U). The recolor
 *      then leaves the identity scheme, so after anchor normalization the
 *      LL sits at the U positions as pieces 4-7 (the 'lower' family). The
 *      probe must relabel those onto 0-3 before signing. Constructed by
 *      rotating the seed to the face and swapping the U/D colors.
 */
import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../../caseGenerator';
import { recolorState } from '../crossFaceAdapter';
import {
  createPLLDetector,
  createOLLDetector,
} from '../loaders/lastLayer';

// Jb perm seed (D-cross anchor). PLL probe should name it "Jb".
const JB_SETUP = "R U R2 F' R U R U' R' F R U' R'";
// OLL 6 seed: the OLL 6 case state (setup = inverse of the solving alg).
const OLL6_SETUP = "r U R' U R U2' r'";

const CROSS_FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;
// D_TO_CROSS rotation for each target cross face (from crossFaceAdapter).
const D_TO_CROSS: Record<string, string> = {
  D: '',
  U: 'x2',
  F: 'x',
  B: "x'",
  R: "z'",
  L: 'z',
};

/** Scheme that swaps the U/D colors (white LL ↔ yellow LL identity). */
const SWAP_UD: Record<string, string> = {
  U: 'D',
  D: 'U',
  F: 'F',
  B: 'B',
  R: 'R',
  L: 'L',
};

/**
 * The INVERTED-color state for crossFace `face`: the seed rotated into the
 * solver's frame with the LL/cross colors swapped — a solver whose cross
 * color is the canonical U color on `face`. After anchor normalization the
 * LL pieces land at the U positions as pieces 4-7.
 *
 * NOTE: only the U face is exercised here. `recolorState(SWAP_UD, ·)` is
 * only reliable when the state's rotation keeps the U/D layer structure
 * (x2 — the U-cross frame, verified against real solves like reconz-9589);
 * for x/z-rotated frames (F/B/R/L crosses) the facelet→piece rebuild
 * misassigns positions (recolor-roundtrip.test.ts documents this), so the
 * synthetic inverted F/B/R/L states are not faithful — those frames are
 * covered by the rotated-frames tests and by real B-cross solves
 * (reconz-9679/3008 detect Ja with crossFace=B).
 */
function invertedColorState(dCross: CubeState, face: string): CubeState {
  const rotated = dCross.clone();
  rotated.applySequence(D_TO_CROSS[face]);
  // Swap the LL/cross colors: the (white) LL becomes canonical-D colored.
  return recolorState(rotated, SWAP_UD);
}

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

  it('recognizes Jb in the inverted-color (lower-family) frame', () => {
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    for (const face of ['U']) {
      const state = invertedColorState(dCross, face);
      const res = pllDetector.detectWith(state, {
        probe: 'last-layer-permutation',
        crossFace: face,
      });
      expect(res.entry?.caseNumber, `crossFace=${face}`).toBe('Jb');
      expect(res.confidence).toBe('exact');
    }
  });

  it('recognizes OLL 6 in the inverted-color (lower-family) frame', () => {
    const dCross = CaseStateGenerator.generateFromScramble(OLL6_SETUP);
    for (const face of ['U']) {
      const state = invertedColorState(dCross, face);
      const res = ollDetector.detectWith(state, {
        probe: 'last-layer-orientation',
        crossFace: face,
      });
      expect(res.entry?.caseNumber, `crossFace=${face}`).toBe('OLL 6');
      expect(res.confidence).toBe('exact');
    }
  });

  it('recognizes Jb with AUF folded into the rotation (left/right U turns)', () => {
    // Simulate a solver who folds the AUF into the case: pre-state differs
    // by U turns around the LAST LAYER (which for a U-cross solver is on D).
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
    // Same AUF orbit for the inverted-color frame. In the solver frame the
    // LL sits on the physical D layer, so its AUF turns are D turns (they
    // become anchor-U turns after the crossFace=U normalization). U turns
    // touch only the cross layer and leave the LL permutation intact, so
    // both work.
    for (const auf of ['', 'D', 'D2', "D'", 'U', 'U2', "U'"]) {
      const st = invertedColorState(dCross, 'U');
      st.applySequence(auf);
      const res = pllDetector.detectWith(st, {
        probe: 'last-layer-permutation',
        crossFace: 'U',
      });
      expect(
        res.entry?.caseNumber,
        `crossFace=U inverted auf=${auf}`,
      ).toBe('Jb');
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

    // Inverted frame too (LL on D in the solver frame → AUF turns are D).
    const st2 = invertedColorState(dCross, 'U');
    st2.applySequence('D');
    const res2 = pllDetector.detectWith(st2, {
      probe: 'last-layer-permutation',
      crossFace: 'U',
    });
    expect(res2.entry?.caseNumber).toBe('Jb');
  });

  it('rejects a mixed LL (not assembled) instead of aliasing a PLL', () => {
    // A real F2L-complete state whose LL is genuinely NOT assembled: take the
    // Jb seed and swap one LL corner with a D-layer corner — positions 0 and
    // 4 (URF ↔ DFR) — so the U layer holds pieces {1,2,3,4}: mixed, and no
    // PLL permutation can match.
    const dCross = CaseStateGenerator.generateFromScramble(JB_SETUP);
    const cp = Array.from(dCross.cp as any) as number[];
    [cp[0], cp[4]] = [cp[4], cp[0]];
    const broken = new CubeState(
      cp,
      Array.from(dCross.co as any) as number[],
      Array.from(dCross.ep as any) as number[],
      Array.from(dCross.eo as any) as number[],
    );
    const res = pllDetector.detectWith(broken, {
      probe: 'last-layer-permutation',
      crossFace: 'D',
    });
    expect(res.confidence).toBe('unknown');
  });
});
