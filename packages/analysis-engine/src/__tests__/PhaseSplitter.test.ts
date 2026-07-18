import { describe, it, expect } from 'vitest';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { CFOPDefinition, RouxDefinition, ZZDefinition, PetrusDefinition } from '@cubeforge/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { makeMoves } from './test-helpers';

describe('PhaseSplitter', () => {
  function buildTimeline(notation: string) {
    const moves = notation ? makeMoves(notation) : [];
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    return timeline;
  }

  it('returns empty for empty timeline', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);
    expect(phases).toEqual([]);
  });

  it('detects Cross phase for a solved cross', () => {
    // U moves don't affect D-layer edges, so Cross stays solved
    const timeline = buildTimeline("U U' U U'");
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases.length).toBeGreaterThanOrEqual(1);
    expect(phases[0].phaseName).toBe('Cross');
  });

  it('detects Cross, F2L, OLL for a T-Perm double solve', () => {
    // T-Perm only affects U-layer permutation (not orientation)
    // So after first T-Perm: Cross ✓, F2L ✓, OLL ✓ (oriented but permuted)
    // After second T-Perm: PLL ✓ (fully solved)
    // But OLL mask matches at the same move as PLL, so PLL can't be detected
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    // T-Perm double produces 3 detectable phases:
    // Cross (early), F2L (after Cross), OLL (after first T-Perm)
    // PLL is merged because OLL mask matches at the last move
    expect(phases.length).toBeGreaterThanOrEqual(3);
    expect(phases[0].phaseName).toBe('Cross');
    expect(phases[1].phaseName).toBe('F2L');
    expect(phases[2].phaseName).toBe('OLL');
  });

  it('phase segments have non-overlapping indices', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].startIndex).toBeGreaterThanOrEqual(phases[i - 1].endIndex);
    }
  });

  it('phase segments cover all moves', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    // First phase starts at 0, last phase ends at last entry
    expect(phases[0].startIndex).toBe(0);
    expect(phases[phases.length - 1].endIndex).toBe(timeline.entries.length - 1);
  });

  it('splitAndAnnotate modifies timeline in place', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    expect(timeline.phases.length).toBeGreaterThanOrEqual(3);

    // Each entry should have phaseId and phaseName
    for (const entry of timeline.entries) {
      expect(entry.phaseId).toBeDefined();
      expect(entry.phaseName).toBeDefined();
    }
  });

  it('validate returns true for correct splits', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    const valid = PhaseSplitter.validate(timeline, CFOPDefinition);
    expect(valid).toBe(true);
  });

  it('hasPhase detects if a phase exists', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);

    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'Cross')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'F2L')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'OLL')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'ZZ')).toBe(false);
  });

  it('getTransitionIndices returns end indices', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    const indices = PhaseSplitter.getTransitionIndices(timeline, CFOPDefinition);

    expect(indices.length).toBeGreaterThanOrEqual(3);
    // Each index should be <= the next
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });

  it('works with Roux definition', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    timeline.method = 'Roux';
    const phases = PhaseSplitter.split(timeline, RouxDefinition);

    expect(phases.length).toBeGreaterThanOrEqual(2);
    expect(phases[0].phaseName).toBe('First Block');
    expect(phases[1].phaseName).toBe('Second Block');
  });

  it('works with ZZ definition', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    timeline.method = 'ZZ';
    const phases = PhaseSplitter.split(timeline, ZZDefinition);

    expect(phases.length).toBe(3);
    expect(phases[0].phaseName).toBe('EOLine');
    expect(phases[1].phaseName).toBe('F2L');
    expect(phases[2].phaseName).toBe('LL');
  });

  it('works with Petrus definition', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildTimeline(`${tPerm} ${tPerm}`);
    timeline.method = 'Petrus';
    const phases = PhaseSplitter.split(timeline, PetrusDefinition);

    expect(phases.length).toBe(4);
    expect(phases[0].phaseName).toBe('2x2x2');
    expect(phases[1].phaseName).toBe('2x2x3');
    expect(phases[2].phaseName).toBe('EO');
    expect(phases[3].phaseName).toBe('F2L+LL');
  });
});
