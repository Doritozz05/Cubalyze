import { describe, it, expect } from 'vitest';
import { isRotation, tokenize } from '@cubalyze/math-core';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

/**
 * Fase 2 — analyzeSolveText: raw reconstruction text → standard timeline +
 * semantic reconstruction, rebuilt on the stats pipeline.
 *
 * Fixtures are REAL records from the reconstruction chunks (CubeRoot /
 * reco.nz crawls) whose phase labels declare the technique.
 */

function textFromPhases(phases: { label: string; moves: string }[]): string {
  return phases.map((p) => `${p.moves} // ${p.label}`).join('\n');
}

describe('analyzeSolveText — the 2510 record (your original example)', () => {
  const input = {
    setup: "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2",
    inspection: 'z y',
    solution: textFromPhases([
      { label: 'W Cross', moves: "D2 L U R' U'" },
      { label: 'F2L 1 (BO)', moves: "x' D' L' U L U' L' U L D" },
      { label: 'F2L 2 (GR)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
      { label: 'F2L 3 (BR)', moves: "U2 U L U' L'" },
      { label: 'F2L 4 (GO)', moves: "y' R' U2 R U R' U' R" },
      { label: 'OLL', moves: "R' U' R' F R F' U R" },
      { label: 'PLL Gd', moves: "U' R U R' U'D R2 U' R U' R' U R' U R2 D'" },
    ]),
  };

  it('reproduces the exact smartcube-style phase split', () => {
    const { timeline, reconstruction } = analyzeSolveText(input);

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.cross.type).toBe('plain');
    expect(reconstruction.cross.moves.length).toBeGreaterThan(0);
    expect(reconstruction.pairs.length).toBe(4);
    expect(reconstruction.oll).not.toBeNull();
    expect(reconstruction.pll).not.toBeNull();
    expect(reconstruction.oll!.skipped).toBe(false);
    expect(reconstruction.pll!.skipped).toBe(false);
    expect(reconstruction.rawPhases.length).toBe(7);
    expect(reconstruction.rawPhases[0].label).toBe('W Cross');
    expect(timeline.entries.length).toBe(
      reconstruction.cross.moves.length +
        reconstruction.pairs.reduce((s, p) => s + p.moves.length, 0) +
        (reconstruction.oll?.moves.length ?? 0) +
        (reconstruction.pll?.moves.length ?? 0),
    );
  });

  it('detects the exact same phase boundaries as the splitter (Cross 5 moves)', () => {
    const { timeline, reconstruction } = analyzeSolveText(input);
    const crossPhase = timeline.phases.find((p) => p.phaseName === 'Cross');
    expect(crossPhase?.endIndex).toBe(reconstruction.cross.moves.length - 1);
    expect(reconstruction.cross.moves).toHaveLength(5);
  });

  it('is deterministic', () => {
    const a = analyzeSolveText(input).reconstruction;
    const b = analyzeSolveText(input).reconstruction;
    expect(a.cross.type).toBe(b.cross.type);
    expect(a.pairs).toEqual(b.pairs);
    expect(a.oll?.moves).toEqual(b.oll?.moves);
  });
});

describe('analyzeSolveText — XCross record (reconz-11413)', () => {
  it('detects crossType xcross with one pair', () => {
    const { reconstruction } = analyzeSolveText({
      setup: "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'",
      inspection: '',
      solution: textFromPhases([
        { label: 'xcross', moves: "F R U' D' L U R U' D" },
        { label: '2nd pair', moves: "y' L' U L" },
        { label: '3rd pair', moves: "y L' U L U' D' L' U L U' D" },
        { label: '4th pair/WVLS', moves: "U' L' U' L U L' U L" },
        { label: 'AUF', moves: 'U' },
      ]),
    });

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.cross.type).toBe('xcross');
    expect(reconstruction.cross.xcrossPair).toBeDefined();
    expect(reconstruction.pairs.length).toBeGreaterThanOrEqual(3);
  });
});

describe('analyzeSolveText — OLL skip record (cuberoot-1851)', () => {
  it('reports the OLL skip explicitly', () => {
    const { reconstruction } = analyzeSolveText({
      setup: "L' U B2 L2 U2 B2 L2 U B F U F' L2 R D2 U F2 R2",
      inspection: 'y z2',
      solution: textFromPhases([
        { label: 'W xcross', moves: "F' U F' R' U' F R B' R'" },
        { label: 'RG', moves: "y L'...U L U' L' U L" },
        { label: 'BR', moves: "U R U' R' L U' L'" },
        { label: 'GO /OLL Skip', moves: "U2 R U' R' F R' F' R" },
        { label: 'PLL-Ra', moves: "U R U' R' U'R U R D R' U' R D' R' U2 R'" },
      ]),
    });

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.cross.type).toBe('xcross');
    expect(reconstruction.oll?.skipped).toBe(true);
  });
});

describe('analyzeSolveText — wide-move record (reconz-7856)', () => {
  // Real record with an x2 inspection, wide moves (r, l) and an explicit M'
  // slice. The slice half of wide moves must be applied to the state (not
  // dropped) for the reconstruction to be exact — previously finalSolved was
  // false for any solve containing M/E/S or wide moves.
  const input = {
    setup: "R2 U' R2 F2 R2 D' U L2 B2 U B' D F2 D2 B U R D' U R' U2",
    solution: textFromPhases([
      { label: 'inspection', moves: 'x2' },
      { label: 'xcross', moves: "D' r U2 L l D" },
      { label: '2nd pair', moves: "U L' U' L" },
      { label: '3rd pair', moves: "U' R U' R' U R U' R'" },
      { label: '4th pair/VLS', moves: "U' R' U' R r' U' R U M'" },
      { label: 'AUF', moves: 'U' },
    ]),
  };

  it('reconstructs the exact state (slices applied) and ends solved', () => {
    const { reconstruction } = analyzeSolveText(input);

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.inspection).toBe('x2');
    // The white cross completes after "D' r U2 L l" (5 moves — the 'l' wide's
    // slice half completes it at entry 4, verified: the cross persists from
    // entry 4 onward). The written trailing "D" is an alignment move that
    // keeps the cross complete, so it belongs to F2L (the first pair's moves).
    expect(reconstruction.cross.moves).toEqual(["D'", 'r', 'U2', 'L', 'l']);
    expect(reconstruction.cross.type).toBe('xcross');
  });

  it('keeps timeline entries in face-move space despite the slices', () => {
    const { timeline, reconstruction } = analyzeSolveText(input);
    const faceTotal =
      reconstruction.cross.moves.length +
      reconstruction.pairs.reduce((s, p) => s + p.moves.length, 0) +
      (reconstruction.oll?.moves.length ?? 0) +
      (reconstruction.pll?.moves.length ?? 0);
    expect(timeline.entries.length).toBe(faceTotal);
  });
});

describe("analyzeSolveText — the `2'` suffix quirk (reco.nz / CubeRoot)", () => {
  // REAL records that threw "display token walk misaligned" before the fix:
  // tokenize's display path keeps the raw `2'` suffix (U2', r2', y2', D2')…
  // while the conjugated stream normalizes it to `2`. The walk must classify
  // rotations / wides on the normalized form or every subsequent entry drifts.
  const records: { key: string; setup: string; text: string }[] = [
    {
      key: 'reconz-1508',
      setup: "B' L2 F D2 U2 F2 U2 B' U2 R2 F U' L2 D B' R D F' L' R D",
      text: [
        "y' x // inspection",
        "U x' U' r' R U' x' D L' D2' // cross",
        "y L' U L U' L' U' L // 1st pair",
        "L U2' L' U L U' L' // 2nd pair",
        "U' R U2' R2' U' R // 3rd pair",
        "U2' R U R' U2' R U R' U' R U R' // 4th pair",
        "U2' l U' l2' U l2 U l2' U' l // OLL",
        "U2' R2 u' R U' R U R' u R2 y R U' R' U' // PLL",
      ].join('\n'),
    },
    {
      key: 'cuberoot-1296',
      setup: "F2 L B R D R' F2 U' D2 L2 F2 B D2 L2 B' L2 F U2 F",
      text: [
        "x' z' // insp",
        "U' r' D' F2 R D2 // W cross",
        "R (U' R' R U') R2' U R // GO",
        "(U R' R U') R U' R' d' L U' L' // RB",
        "(U' U') d R U' R' U d R' U' R // GR",
        "y' (U' U') R' F' R U R U' R' F // BO",
        "r U' r2' U r2 U r2' U' r // OLL-R+",
        "(U' U') R' U L' U2 R U' R' U2 R L U' // PLL-L",
      ].join('\n'),
    },
  ];

  for (const { key, setup, text } of records) {
    it(`${key} no longer throws and keeps the walk aligned`, () => {
      const { timeline, reconstruction } = analyzeSolveText({
        setup,
        solution: text,
        method: 'CFOP',
      });

      const faceTotal =
        reconstruction.cross.moves.length +
        reconstruction.pairs.reduce((s, p) => s + p.moves.length, 0) +
        (reconstruction.oll?.moves.length ?? 0) +
        (reconstruction.pll?.moves.length ?? 0);
      // The invariant that failed before the fix: every conjugated face
      // token maps to exactly one raw display token.
      expect(timeline.entries.length).toBe(faceTotal);
      expect(reconstruction.finalSolved).toBe(true);
      expect(reconstruction.pairs.length).toBe(4);
    });
  }

  it("keeps the raw `2'` form in the displayed moves (display fidelity)", () => {
    const { reconstruction } = analyzeSolveText({
      setup: "B' L2 F D2 U2 F2 U2 B' U2 R2 F U' L2 D B' R D F' L' R D",
      solution:
        "y' x // inspection\n" +
        "U x' U' r' R U' x' D L' D2' // cross\n" +
        "y L' U L U' L' U' L // 1st pair\n" +
        "L U2' L' U L U' L' // 2nd pair\n" +
        "U' R U2' R2' U' R // 3rd pair\n" +
        "U2' R U R' U2' R U R' U' R U R' // 4th pair\n" +
        "U2' l U' l2' U l2 U l2' U' l // OLL\n" +
        "U2' R2 u' R U' R U R' u R2 y R U' R' U' // PLL",
      method: 'CFOP',
    });

    // The D2' token survives as written in the displayed moves (the state
    // splitter may push the trailing alignment moves into the first pair, so
    // scan every phase); rotations are reported separately, never counted.
    const allMoves = [
      ...reconstruction.cross.moves,
      ...reconstruction.pairs.flatMap((p) => p.moves),
      ...(reconstruction.oll?.moves ?? []),
      ...(reconstruction.pll?.moves ?? []),
    ];
    expect(allMoves).toContain("D2'");
    expect(reconstruction.rotations.map((r) => r.token)).toEqual([
      "y'", "x", "x'", "x'", "y", "y",
    ]);
  });
});

describe('analyzeSolveText — raw parsing edge cases', () => {
  it('tolerates CubeRoot separators and glued tokens (the user example)', () => {
    // Your original example: glued U'D / DU tokens inside the solve must be
    // split by tokenize and still resolve the cube exactly.
    const { reconstruction } = analyzeSolveText({
      setup: "B' R2 D' L2 D L2 R2 U F2 U' B2 U' B' L F2 U' F' U' B R' U2",
      inspection: "x2 y'",
      solution:
        "R' D R // W Cross\n" +
        "U L' U L U' L' U' L // F2L 1 (GO)\n" +
        "U' R' U2 R U y R' U R // F2L 2 (GR)\n" +
        "L' U' L U R U' R' // F2L 3 (BR)\n" +
        "L' U' L U' L' U L // F2L 4 (BO)\n" +
        "R' U' R' F R F' R' F R F' U R // OLL\n" +
        "U R' U' R UD' R2 U R' U R U' R U' R2 D U // PLL",
    });
    expect(reconstruction.rawPhases.length).toBe(7);
    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.pairs.length).toBe(4);
  });

  it('handles a solution without any // comments (flat)', () => {
    const { reconstruction } = analyzeSolveText({
      setup: "R U R' U'",
      inspection: '',
      solution: "R' U R U'",
    });
    expect(reconstruction.rawPhases.length).toBe(1);
    expect(reconstruction.rawPhases[0].label).toBe('');
  });

  it('keeps a multi-line flat solution as a SINGLE phase', () => {
    const { reconstruction } = analyzeSolveText({
      setup: "R U R' U'",
      inspection: '',
      solution: "R' U\nR U'",
    });
    expect(reconstruction.rawPhases.length).toBe(1);
  });

  it('does not apply the embedded // Inspection phase twice', () => {
    // CubeRoot text embeds the inspection; the explicit param must win and
    // the embedded phase must not rotate the grip a second time.
    const { reconstruction } = analyzeSolveText({
      setup: "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2",
      inspection: 'z y',
      solution:
        "z y // Inspection\n" +
        "D2 L U R' U' // W Cross\n" +
        "x' D' L' U L U' L' U L D // F2L 1 (BO)\n" +
        "U2 y' L' U L U' L' U L U2 L' U L // F2L 2 (GR)\n" +
        "U2 U L U' L' // F2L 3 (BR)\n" +
        "y' R' U2 R U R' U' R // F2L 4 (GO)\n" +
        "R' U' R' F R F' U R // OLL\n" +
        "U' R U R' U'D R2 U' R U' R' U R' U R2 D' // PLL Gd",
    });
    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.cross.type).toBe('plain');
    // The embedded inspection phase is consumed, not listed as a solve phase.
    expect(reconstruction.rawPhases.some((p) => /inspect/i.test(p.label))).toBe(false);
  });

  it('reports an incoherent setup honestly (finalSolved false)', () => {
    const { reconstruction } = analyzeSolveText({
      setup: "R U R' U'",
      inspection: '',
      solution: "R U R' U' R U R' U'",
    });
    expect(reconstruction.finalSolved).toBe(false);
  });

  it('tolerates stray garbage tokens (dropped, never throws)', () => {
    // Q / bare 2 are not valid moves; the state path must drop them instead
    // of crashing CubeState.applySequence. The valid part U R U' R' is the
    // exact inverse of the setup R U R' U'.
    const { reconstruction } = analyzeSolveText({
      setup: "R U R' U'",
      inspection: '',
      solution: "U Q R U' R' 2",
    });
    expect(reconstruction.finalSolved).toBe(true);
  });
});

describe('analyzeSolveText — embedded inspection recognized by POSITION, not label', () => {
  // Real CubeRoot record cuberoot-2542: the inspection phase is labeled
  // "insp" (not "inspection"), and the baked `recognition.inspection` field
  // is empty — the old `/inspect/i` label check missed it. The grip ended up
  // in `recon.rotations` at moveIndex 0 while `recon.inspection` stayed
  // empty, so the panel sliced them as SOLVE rotations and interleaved
  // "z2 y'" into the Cross row instead of the Orientation row.
  const setup = "F2 B D2 L' D2 L' F' L2 B2 D B2 R2 U' F2 U' L F2 L2";
  const solution = [
    "z2 y' // insp",
    "D' R' L D' F D' F // cross",
    "R U' R' U' R U R' L U' L' // F2L1",
    "U2 R U' R' // F2L2",
    "L' U L U f R' f' // F2L3",
    "U2 y' U  R U' R' U' R U' R' U R U' R' // F2L4",
    "F  U R U' R' U R U' R' F' // OLL",
    "R U' R' U' R U R D R' U' R D' R' U2 R' U // PLL-Ra",
  ].join('\n');

  it('attributes the leading rotations-only phase to the inspection grip', () => {
    const { reconstruction } = analyzeSolveText({
      setup,
      solution,
      method: 'CFOP',
    });

    expect(reconstruction.finalSolved).toBe(true);
    expect(reconstruction.inspection).toBe("z2 y'");
    // The embedded inspection phase is consumed, never listed as a solve phase.
    expect(reconstruction.rawPhases[0].label).toBe('cross');
    // The cross owns only its face moves — no rotations slipped into them.
    expect(reconstruction.cross.moves).toEqual(["D'", "R'", 'L', "D'", 'F', "D'", 'F']);
  });

  it('keeps the panel slicing contract: leading rotations are inspection', () => {
    const { reconstruction } = analyzeSolveText({
      setup,
      solution,
      method: 'CFOP',
    });

    // Exactly what OurDetectionPanel does: inspection rotations are the
    // FIRST `recon.rotations` (moveIndex 0); the solve rotations are the rest.
    const inspectionRotationCount = tokenize(reconstruction.inspection)
      .filter(isRotation).length;
    const inspectionRotations = reconstruction.rotations.slice(
      0,
      inspectionRotationCount,
    );
    const solveRotations = reconstruction.rotations.slice(inspectionRotationCount);

    expect(inspectionRotationCount).toBe(2);
    expect(inspectionRotations.map((r) => r.token)).toEqual(["z2", "y'"]);
    expect(inspectionRotations.every((r) => r.moveIndex === 0)).toBe(true);
    // The mid-solve y' (F2L4) is the only SOLVE rotation left.
    expect(solveRotations.map((r) => r.token)).toEqual(["y'"]);
    expect(solveRotations.every((r) => r.moveIndex > 0)).toBe(true);
    expect(reconstruction.rotations.map((r) => r.token)).toEqual(["z2", "y'", "y'"]);
  });

  it('does not treat a MID-SOLVE rotations-only phase as inspection', () => {
    // "// regrip" between cross and F2L must stay a solve-phase rotation
    // (moveIndex > 0), never move to the inspection grip at index 0.
    const { reconstruction } = analyzeSolveText({
      setup,
      solution: [
        "z2 // insp",
        "D' R' L D' F D' F // cross",
        "y' // regrip",
        "R U' R' U' R U R' L U' L' // F2L1",
        "U2 R U' R' // F2L2",
        "L' U L U f R' f' // F2L3",
        "U2 U R U' R' U' R U' R' U R U' R' // F2L4",
        "F  U R U' R' U R U' R' F' // OLL",
        "R U' R' U' R U R D R' U' R D' R' U2 R' U // PLL-Ra",
      ].join('\n'),
      method: 'CFOP',
    });

    // The regrip y' stays a solve rotation exactly after the 7 cross moves
    // (the fixture is synthetic — the y' was moved out of F2L4, so the
    // physical stream is no longer a real solve; only the ATTRIBUTION is
    // under test), and the inspection row keeps only the leading grip.
    expect(reconstruction.inspection).toBe('z2');
    const solveRots = reconstruction.rotations.filter((r) => r.moveIndex > 0);
    expect(solveRots.map((r) => [r.token, r.moveIndex])).toEqual([["y'", 7]]);
  });
});
