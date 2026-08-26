import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * Case detection integration tests — the modular CaseDetector wired into
 * analyzeSolveText. The solve 2510 fixture is the same one used during the
 * POC: pair 1 (BL) is a recognized Basic F2L case.
 */
const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const SOLUTION = [
  'z y // Inspection',
  "D2 L U R' U' // Cross (W)",
  "x' D' L' U L U' L' U L D // F2L 1 (BL · Pj)",
  "U2 y' L' U L U' L' U L U2 L' U L // F2L 2 (FR · Jm)",
  "U2 U L U' L' // F2L 3 (BR · Jb)",
  "y' R' U2 R U R' U' R // F2L 4 (BR · Ci)",
  "R' U' R' F R F' U R // OLL",
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D' // PLL",
].join('\n');

describe('case detection — analyzeSolveText', () => {
  it('detects the first pair of solve 2510 as F2L 39 (Pj)', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      inspection: 'z y',
      solution: SOLUTION,
      method: 'CFOP',
    });

    expect(reconstruction.pairs).toHaveLength(4);

    const first = reconstruction.pairs[0];
    // The relational (color-relative) signature reads the BL pair as
    // "pieces in slot" (corner twisted at home, edge at home) — exactly
    // the Pj arrangement the human annotation called out. The old
    // position-anchored signature misread it as Jj (and its y2 frame
    // rotation never mapped the U-cross frame onto the D-cross catalog).
    expect(first.detectedCase?.confidence).toBe('exact');
    expect(first.detectedCase?.caseName).toBe('Pj');
    expect(first.detectedCase?.caseNumber).toBe('F2L 39');
  });

  it('detects all four pairs of solve 2510, matching the annotations', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SCRAMBLE,
      inspection: 'z y',
      solution: SOLUTION,
      method: 'CFOP',
    });

    // With the slot/piece-agnostic color signature, all four pairs resolve
    // to Basic F2L cases — matching the human annotations (Pj, Jm, Jb, Ci).
    // The old detector left pairs 2-4 unrecognized.
    const cases = reconstruction.pairs.map((p) => p.detectedCase?.caseName);
    expect(cases).toEqual(['Pj', 'Jm', 'Jb', 'Ci']);
  });

/** Solve 8521 (reconz) — red cross on R, slots UF/UB/DB. This is the
 * regression that motivated the 6-face extension: previously every pair
 * came back unknown because slotToFRRotation only knew D and U. */
const R_SCRAMBLE = "D' B2 U2 R B2 L F' R F2 U2 B2 R2 U' L2 U2 R2 B2 U' F2 B";
const R_SOLUTION = [
  'z // inspection',
  "L R' F R U' D U R U' R' F' // xcross",
  "R U' R' // 2nd pair",
  "y U' R U' R' U R U R' // 3rd pair",
  "U2' R' U R U' R' U' R // 4th pair",
  "U l' U2 L U L' U l // OLL(CP)",
].join('\n');

describe('case detection — R-cross (solve 8521)', () => {
  it('detects the three F2L pairs of the red-R-cross solve', () => {
    const { reconstruction } = analyzeSolveText({
      setup: R_SCRAMBLE,
      inspection: 'z',
      solution: R_SOLUTION,
      method: 'CFOP',
      relaxedCross: true,
    });

    expect(reconstruction.pairs.length).toBeGreaterThanOrEqual(3);

    // Pair order follows the solve: UF, UB, DB.
    const [uf, ub, db] = reconstruction.pairs;

    // Ground truth is the FULL sticker arrangement compared against every
    // seed under cross-face-preserving rotations: UF ≡ Jb (z y'), UB ≡ Mb
    // (z y), DB ≡ Ji (z y'). The cross color is 'R' (identity scheme), so
    // the relational signature finds the cross by the R-cross color and
    // the frame rotation maps R onto the D-cross anchor.
    expect(uf.slot).toBe('UF');
    expect(uf.detectedCase?.confidence).toBe('exact');
    expect(uf.detectedCase?.caseName).toBe('Jb');

    expect(ub.slot).toBe('UB');
    expect(ub.detectedCase?.confidence).toBe('exact');
    expect(ub.detectedCase?.caseName).toBe('Mb');

    expect(db.slot).toBe('DB');
    expect(db.detectedCase?.confidence).toBe('exact');
    expect(db.detectedCase?.caseName).toBe('Ji');
  });
});

  it('never throws when the timeline has no F2L phase', () => {
    const result = analyzeSolveText({
      setup: SCRAMBLE,
      solution: "R U R' U' // not a real solve",
      method: 'CFOP',
    });
    expect(result).not.toBeNull();
  });
});

// ── Solve 2388 (cuberoot — D-cross with pop) ──────────────────────────────

/** Solve 2388 (cuberoot) — Liam Walton 10.70, D-cross, "Cube pops and 1
 * turn away". This regression covers two fixes:
 *   1. PERSISTENCE_WINDOW=8: FR completes at 30 (end of F2L 3), dips when
 *      F2L 4's insertion passes through, and re-appears. The window must
 *      reach FL's completion at 37 to recognize the displacement and fire
 *      FR at its first home (30) instead of the re-completion (33). Firing
 *      at 33 would shift the pair boundaries, giving F2L 4 a mid-algorithm
 *      cut and a wrong case (Mq instead of Pi).
 *   2. slotFRRotations fallback: F2L 1 (BR) has its corner in the
 *      adjacent DBL slot; the canonical rotation 'y' misses the anchor,
 *      but the 'y2' fallback lands it on a catalog signature.
 *   3. Pb/Pi front-sticker refinement: the fallback signature keys as Pi
 *      (edge flipped in U), but the parked corner's physical twist makes
 *      the edge's and corner's front stickers coincide — the pair does
 *      NOT connect after the up move, which is Pb's defining behavior.
 *      The refinement reads the actual stickers and corrects to Pb. */
const SOLVE_2388 = {
  setup: "R F2 R2 D L2 F2 L2 U B2 D R' B2 R D2 R2 F U R U",
  solution: [
    'y2 // Inspection',
    "D' R' D U2 R2 B L' B' // Y Cross",
    "U' R U R' F U F' // F2L 1 (BR)",
    "U2 U y' R' U' R U R' U' R // F2L 2 (BO)",
    "y' R U R' U' R U R' // F2L 3 (GR)",
    "y' R U R' U' R U R' // F2L 4 (GO)",
    "U Rw U Rw' R U R' U' Rw U' Rw' // OLL",
    "U M2 U' M U2 M' U' M2 // PLL Ub",
  ].join('\n'),
  method: 'CFOP' as const,
};

describe('case detection — solve 2388 (cuberoot, D-cross with pop)', () => {
  it('detects the 4 F2L pairs in the correct order and with correct boundaries', () => {
    const { reconstruction } = analyzeSolveText(SOLVE_2388);
    expect(reconstruction.pairs.length).toBe(4);

    // Pair order: BR, BL, FR, FL (matches the source annotation).
    const [br, bl, fr, fl] = reconstruction.pairs;

    // Segmentation: F2L 1 = 7 moves, F2L 2 = 9, F2L 3 = 7, F2L 4 = 7.
    // FR must complete at the end of F2L 3 (entry 30), NOT later.
    expect(fr.completionIndex).toBe(30);
    expect(fl.completionIndex).toBe(37);

    // Detection results — signature + front-sticker refinement.
    expect(br.detectedCase?.caseName).toBe('Pb');
    expect(bl.detectedCase?.caseName).toBe('Ki');
    expect(fr.detectedCase?.caseName).toBe('Pb');
    // FL is Pb for the same reason as BR: the corner's physical twist in
    // the foreign slot makes the signature read Pi (edge flipped in U),
    // but the edge and corner front stickers coincide → Pb.  Pairs 1, 3
    // and 4 are the same case, as the solver wrote the identical
    // algorithm for 3 and 4.
    expect(fl.detectedCase?.caseName).toBe('Pb');

    for (const p of [br, bl, fr, fl]) {
      expect(p.detectedCase?.confidence).toBe('exact');
    }
  });
});