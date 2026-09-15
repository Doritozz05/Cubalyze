import { describe, it, expect } from 'vitest';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { CFOPDefinition, conjugatePhaseStream, tokenize } from '@cubalyze/math-core';
import { makeMoves } from './test-helpers';

/**
 * Fase 1 — XCross / XXCross + cross color + explicit skips.
 *
 * Fixtures are REAL records from the reconstruction chunks (CubeRoot /
 * reco.nz crawls) whose phase labels declare the technique. The timeline is
 * rebuilt exactly like the production web path: scramble → conjugate each
 * phase (rotations folded into the moves) → PhaseSplitter color-neutral.
 */
const FACE_MOVE_RE = /^[URFDLB][2']?$/;

interface ReconPhase {
  label: string;
  moves: string;
}

function buildTimeline(
  scramble: string,
  grip: string,
  phases: ReconPhase[],
) {
  const { perPhase } = conjugatePhaseStream([
    tokenize(grip),
    ...phases.map((p) => tokenize(p.moves)),
  ]);
  const solveMoves = makeMoves(
    perPhase
      .slice(1)
      .flat()
      .filter((t) => FACE_MOVE_RE.test(t))
      .join(' '),
  );
  return TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
}

describe('PhaseSplitter — XCross detection (real records)', () => {
  it('detects xcross on a record annotated "xcross" (reconz-11413)', () => {
    const timeline = buildTimeline(
      "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'",
      '',
      [
        { label: 'xcross', moves: "F R U' D' L U R U' D" },
        { label: '2nd pair', moves: "y' L' U L" },
        { label: '3rd pair', moves: "y L' U L U' D' L' U L U' D" },
        { label: '4th pair/WVLS', moves: "U' L' U' L U L' U L" },
        { label: 'AUF', moves: 'U' },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    expect(report.crossType).toBe('xcross');
    expect(report.crossFace).toBe('D');
    expect(report.crossColor).toBe('D');
    expect(report.xcrossPairs).toHaveLength(1);
    expect(['FR', 'BR', 'BL', 'FL']).toContain(report.xcrossPairs![0].slot);
    expect(report.xcrossPairs![0].colors).toHaveLength(2);
  });

  it('detects xxcross with two pairs on a record annotated "xxcross" (reconz-13069)', () => {
    const timeline = buildTimeline(
      "R' F2 D2 F' D2 R2 F' D2 F L2 F L2 U' R2 D2 R B D L U'",
      '',
      [
        { label: 'inspection', moves: "x'" },
        { label: 'xxcross', moves: "D B' D2 R D2' R U2' R' y' R" },
        { label: '3rd pair', moves: "y' U' U' R' U' R U' R' U R" },
        { label: '4th pair', moves: "U' R' F R F'" },
        { label: 'AUF', moves: 'U' },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    expect(report.crossType).toBe('xxcross');
    expect(report.xcrossPairs!.length).toBeGreaterThanOrEqual(2);
  });

  it('detects xcross AND an OLL skip on a record annotated "OLL Skip" (cuberoot-1851)', () => {
    const timeline = buildTimeline(
      "L' U B2 L2 U2 B2 L2 U B F U F' L2 R D2 U F2 R2",
      'y z2',
      [
        { label: 'W xcross', moves: "F' U F' R' U' F R B' R'" },
        { label: 'RG', moves: "y L'...U L U' L' U L" },
        { label: 'BR', moves: "U R U' R' L U' L'" },
        { label: 'GO /OLL Skip', moves: "U2 R U' R' F R' F' R" },
        { label: 'PLL-Ra', moves: "U R U' R' U'↓R U R D...R' U' R D' R' U2 R'" },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    expect(report.crossType).toBe('xcross');
    expect(report.skips).toContain('oll');
  });

  it('reports a plain cross when no pair completes with the cross (2510)', () => {
    // The 2510 record: inspection "z y", "R' D R // W Cross" style cross.
    // Cross completes first, every pair is inserted during F2L.
    const timeline = buildTimeline(
      "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2",
      'z y',
      [
        { label: 'W Cross', moves: "D2 L U R' U'" },
        { label: 'F2L 1', moves: "x' D' L' U L U' L' U L D" },
        { label: 'F2L 2', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
        { label: 'F2L 3', moves: 'U2 U L U\' L\'' },
        { label: 'F2L 4', moves: "y' R' U2 R U R' U' R" },
        { label: 'OLL', moves: "R' U' R' F R F' U R" },
        { label: 'PLL Gd', moves: "U' R U R' U'D R2 U' R U' R' U R' U R2 D'" },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    expect(report.crossType).toBe('plain');
    expect(report.xcrossPairs).toBeUndefined();
  });
});

describe('PhaseSplitter — report invariants with the new fields', () => {
  it('keeps an OLL-skip solve warning-free and high-confidence (cuberoot-1851)', () => {
    const timeline = buildTimeline(
      "L' U B2 L2 U2 B2 L2 U B F U F' L2 R D2 U F2 R2",
      'y z2',
      [
        { label: 'W xcross', moves: "F' U F' R' U' F R B' R'" },
        { label: 'RG', moves: "y L'...U L U' L' U L" },
        { label: 'BR', moves: "U R U' R' L U' L'" },
        { label: 'GO /OLL Skip', moves: "U2 R U' R' F R' F' R" },
        { label: 'PLL-Ra', moves: "U R U' R' U'↓R U R D...R' U' R D' R' U2 R'" },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    // The skip is structured data (skips array), not a warning: a skipped OLL
    // is a merit, so it must not demote confidence to medium.
    expect(report.skips).toContain('oll');
    expect(report.warnings).not.toContain('phase-skip');
    expect(report.warnings).not.toContain('advanced-technique-possible');
    expect(report.complete).toBe(true);
    expect(report.finalStateSolved).toBe(true);
    expect(report.confidence).toBe('high');
  });

  it('keeps complete/finalStateSolved/confidence working on an xcross solve', () => {
    const timeline = buildTimeline(
      "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'",
      '',
      [
        { label: 'xcross', moves: "F R U' D' L U R U' D" },
        { label: '2nd pair', moves: "y' L' U L" },
        { label: '3rd pair', moves: "y L' U L U' D' L' U L U' D" },
        { label: '4th pair/WVLS', moves: "U' L' U' L U L' U L" },
        { label: 'AUF', moves: 'U' },
      ],
    );

    const report = PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    expect(report.complete).toBe(true);
    expect(report.finalStateSolved).toBe(true);
    expect(['high', 'medium']).toContain(report.confidence);
    expect(report.phases.length).toBe(4);
  });

  it('is deterministic across runs', () => {
    const build = () =>
      buildTimeline(
        "R' F2 D2 F' D2 R2 F' D2 F L2 F L2 U' R2 D2 R B D L U'",
        '',
        [
          { label: 'inspection', moves: "x'" },
          { label: 'xxcross', moves: "D B' D2 R D2' R U2' R' y' R" },
          { label: '3rd pair', moves: "y' U' U' R' U' R U' R' U R" },
          { label: '4th pair', moves: "U' R' F R F'" },
          { label: 'AUF', moves: 'U' },
        ],
      );

    const a = PhaseSplitter.getDetectionReport(build(), CFOPDefinition, { colorNeutral: true });
    const b = PhaseSplitter.getDetectionReport(build(), CFOPDefinition, { colorNeutral: true });
    expect(a.crossType).toBe(b.crossType);
    expect(a.xcrossPairs).toEqual(b.xcrossPairs);
    expect(a.skips).toEqual(b.skips);
  });
});
