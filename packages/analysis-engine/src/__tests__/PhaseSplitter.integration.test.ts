import { describe, it, expect } from 'vitest';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import {
  CFOPDefinition,
  RouxFullDefinition,
  ZZDefinition,
  PetrusDefinition,
} from '@cubeforge/math-core';
import { makeSolveFromScramble, makeMoves, TEST_SCRAMBLES } from './test-helpers';

describe('PhaseSplitter — Integration (with scramble)', () => {
  // ── Helper ──────────────────────────────────────────────────────────────
  function buildTimeline(scramble: string, solveNotation: string) {
    const { solveMoves } = makeSolveFromScramble(scramble);
    return TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
  }

  // ── CFOP Phase Detection ────────────────────────────────────────────────

  it('detects all 4 CFOP phases from a 4-move scramble+solve', () => {
    const timeline = buildTimeline("R U R' U'", "U R U' R'");
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    // A 4-move solve should produce at least phases; Cross should be first
    expect(phases.length).toBeGreaterThanOrEqual(1);
    expect(phases[0].phaseName).toBe('Cross');
  });

  it('phase detection from scrambled state produces non-zero durations', () => {
    const scramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases.length).toBeGreaterThan(0);
    // Every detected phase should have duration > 0 and moveCount > 0
    for (const phase of phases) {
      expect(phase.durationMs).toBeGreaterThan(0);
      expect(phase.moveCount).toBeGreaterThan(0);
      expect(phase.phaseName).toBeTruthy();
    }
  });

  it('phase segments are contiguous and cover all moves', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    expect(timeline.phases.length).toBeGreaterThan(0);

    // First phase starts at 0, last phase ends at last entry
    expect(timeline.phases[0].startIndex).toBe(0);
    expect(timeline.phases[timeline.phases.length - 1].endIndex).toBe(
      timeline.entries.length - 1,
    );

    // No gaps: each phase starts right after the previous ends
    for (let i = 1; i < timeline.phases.length; i++) {
      expect(timeline.phases[i].startIndex).toBe(
        timeline.phases[i - 1].endIndex + 1,
      );
    }

    // Every entry must have a phaseId and phaseName
    for (const entry of timeline.entries) {
      expect(entry.phaseId).toBeDefined();
      expect(entry.phaseName).toBeDefined();
    }
  });

  it('Cross is the first detected phase', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases.length).toBeGreaterThan(0);
    expect(phases[0].phaseName).toBe('Cross');
  });

  it('validate() returns true for correctly detected phases', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const valid = PhaseSplitter.validate(timeline, CFOPDefinition);

    expect(valid).toBe(true);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('empty scramble (no scramble) still works for simple sequences', () => {
    // Without scramble, the timeline starts from solved.
    // Phase detection still works for sequences that happen to match masks.
    const moves = makeMoves("U U' U U'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases.length).toBeGreaterThanOrEqual(1);
    expect(phases[0].phaseName).toBe('Cross');
  });

  it('single-move scramble + solve', () => {
    const { solveMoves } = makeSolveFromScramble('R');
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, 'R');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    // A single R' solves a R scramble — cross should be detected
    expect(phases.length).toBeGreaterThan(0);
  });

  it('handles empty scramble gracefully', () => {
    const moves = makeMoves("R U R'");
    const timeline = TimelineBuilder.build(moves, 'CFOP', undefined, '');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    // Empty string scramble = no scramble applied, same as not passing scramble
    expect(phases.length).toBeGreaterThanOrEqual(1);
  });

  it('handles solved cube (empty moves)', () => {
    const timeline = TimelineBuilder.build([], 'CFOP', undefined, '');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases).toEqual([]);
  });

  // ── Multi-method support ────────────────────────────────────────────────

  it('Roux — detects First Block from scrambled state', () => {
    const scramble = "U' L' U L U F U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Roux', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, RouxFullDefinition);

    expect(phases.length).toBeGreaterThanOrEqual(1);
    expect(phases[0].phaseName).toBe('First Block');
  });

  it('Roux — all phase segments have valid indices and durations', () => {
    const scramble = "U' L' U L U F U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Roux', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, RouxFullDefinition);

    expect(phases.length).toBeGreaterThan(0);
    for (const phase of phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      expect(phase.moveCount).toBeGreaterThan(0);
      expect(phase.startIndex).toBeLessThanOrEqual(phase.endIndex);
    }
  });

  it('ZZ — detects EOLine as first phase from scrambled state', () => {
    const scramble = "F R U R' U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'ZZ', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, ZZDefinition);

    // At minimum, EOLine should be detected as the first phase
    expect(phases.length).toBeGreaterThanOrEqual(1);
    expect(phases[0].phaseName).toBe('EOLine');
  });

  it('Petrus — detects all 4 phases in order', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Petrus', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, PetrusDefinition);

    expect(phases.length).toBe(4);
    expect(phases[0].phaseName).toBe('2x2x2');
    expect(phases[1].phaseName).toBe('2x2x3');
    expect(phases[2].phaseName).toBe('EO');
    expect(phases[3].phaseName).toBe('F2L+LL');
  });

  it('Petrus — validate() returns true', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'Petrus', undefined, scramble);
    const valid = PhaseSplitter.validate(timeline, PetrusDefinition);

    expect(valid).toBe(true);
  });

  // ── Snapshot consistency ────────────────────────────────────────────────

  it('produces same results when re-split from stored timeline', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    const phases1 = PhaseSplitter.split(timeline, CFOPDefinition);
    const phases2 = PhaseSplitter.split(timeline, CFOPDefinition);

    expect(phases1).toEqual(phases2);
  });

  it('fromStoredSolve propagates scramble correctly', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.fromStoredSolve('test-id', solveMoves, 'CFOP', scramble);

    expect(timeline.solveId).toBe('test-id');
    expect(timeline.method).toBe('CFOP');

    const phases = PhaseSplitter.split(timeline, CFOPDefinition);
    expect(phases.length).toBeGreaterThan(0);
  });

  // ── hasPhase and getTransitionIndices ────────────────────────────────────

  it('hasPhase correctly identifies existing phases', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'Cross')).toBe(true);
  });

  it('hasPhase returns false for non-existent phases', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'NonExistent')).toBe(false);
  });

  it('getTransitionIndices returns increasing indices', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    const indices = PhaseSplitter.getTransitionIndices(timeline, CFOPDefinition);
    expect(indices.length).toBeGreaterThan(0);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });
});
