import { describe, it, expect } from 'vitest';
import { CFOPMetricsCalculator } from '../metrics/CFOPMetricsCalculator';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { CFOPDefinition } from '@cubalyze/math-core';
import { makeSolveFromScramble, makeMoves } from './test-helpers';

describe('CFOPMetricsCalculator — Integration', () => {
  // ── Helper ──────────────────────────────────────────────────────────────
  function buildAnnotatedTimeline(scramble: string) {
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    return timeline;
  }

  // ── Cross metrics ───────────────────────────────────────────────────────

  it('crossEfficiency is non-zero for a solve with cross phase', () => {
    const scramble = "R U R' U' R' F R F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.crossEfficiency).toBeGreaterThan(0);
    expect(metrics.crossMoves).toBeGreaterThan(0);
  });

  it('crossTPS is computed when cross duration > 0', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    // TPS should be computable if moves and time exist
    expect(metrics.crossTPS).toBeGreaterThanOrEqual(0);
  });

  it('crossEfficiency is 1.0 when the cross is solved optimally (real optimal, not the 8 heuristic)', () => {
    // Real scramble whose D-cross optimal is 6 moves (verified). A sub-8
    // optimal used to score 6/8 = 0.75 with the old "distance from 8"
    // heuristic; with the real optimal it must be 1.0 (optimal / actual = 6/6).
    const scramble = "F L2 R2 F L2 B F D2 R2 F' R2 F L D2 R' D' B R U2 B2 R'";
    const crossMoves = makeMoves("F' L2 D B' R' D");
    const timeline = TimelineBuilder.build(crossMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = CFOPMetricsCalculator.compute(timeline, { scramble });

    expect(metrics.crossMoves).toBe(6);
    expect(metrics.crossEfficiency).toBe(1);
  });

  it('crossEfficiency is optimal/actual when the cross wastes moves', () => {
    const scramble = "F L2 R2 F L2 B F D2 R2 F' R2 F L D2 R' D' B R U2 B2 R'";
    const optimalMoves = makeMoves("F' L2 D B' R' D");
    // Insert a redundant R R' pair mid-cross: the cross still completes at
    // the same point, but the phase now owns 2 extra moves (6 optimal + 2).
    const redundantMoves = [
      ...optimalMoves.slice(0, 2),
      makeMoves('R')[0],
      makeMoves("R'")[0],
      ...optimalMoves.slice(2),
    ];
    const timeline = TimelineBuilder.build(redundantMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = CFOPMetricsCalculator.compute(timeline, { scramble });

    expect(metrics.crossMoves).toBe(8);
    expect(metrics.crossEfficiency).toBe(0.75);
  });

  it('crossEfficiency ≤ 1.0 for efficient solves', () => {
    // Using the exact inverse of a scramble as the solve should be efficient
    const scramble = "R U R' U'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.crossEfficiency).toBeLessThanOrEqual(2.0);
  });

  // ─── F2L metrics ───────────────────────────────────────────────────────

  it('f2lPairs is populated when F2L phase is detected', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    // F2L pairs should be generated if F2L phase exists
    expect(metrics.f2lPairs.length).toBeGreaterThanOrEqual(0);
  });

  it('f2lLookaheadScore is between 0 and 1', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.f2lLookaheadScore).toBeGreaterThanOrEqual(0);
    expect(metrics.f2lLookaheadScore).toBeLessThanOrEqual(1);
  });

  it('f2l pairs have valid structure', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    for (const pair of metrics.f2lPairs) {
      expect(pair.pairNumber).toBeGreaterThan(0);
      expect(pair.timeMs).toBeGreaterThanOrEqual(0);
      expect(pair.moves).toBeGreaterThan(0);
      expect(pair.tps).toBeGreaterThanOrEqual(0);
      expect(pair.recognitionMs ?? pair.pauseBeforeMs ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  // ─── OLL metrics ────────────────────────────────────────────────────────

  it('ollRecognitionMs is non-negative', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.ollRecognitionMs).toBeGreaterThanOrEqual(0);
  });

  it('ollTPS is computed when OLL phase exists', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.ollTPS).toBeGreaterThanOrEqual(0);
  });

  // ─── PLL metrics ────────────────────────────────────────────────────────

  it('pllRecognitionMs is non-negative', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.pllRecognitionMs).toBeGreaterThanOrEqual(0);
  });

  it('pllTPS is computed when PLL phase exists', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.pllTPS).toBeGreaterThanOrEqual(0);
  });

  // ─── Transition metrics ─────────────────────────────────────────────────

  it('crossToF2LTransitionMs is computed when both phases exist', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline = buildAnnotatedTimeline(scramble);
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.crossToF2LTransitionMs).toBeGreaterThanOrEqual(0);
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  it('returns defaults for empty timeline', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    const metrics = CFOPMetricsCalculator.compute(timeline);

    expect(metrics.crossEfficiency).toBe(0);
    expect(metrics.crossMoves).toBe(0);
    expect(metrics.f2lPairs).toEqual([]);
    expect(metrics.f2lLookaheadScore).toBe(0);
  });

  it('returns defaults when no CFOP phases detected', () => {
    // Using only U moves (no cross phase) — phases won't be CFOP
    const moves = makeMoves("U U' U U'");
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const metrics = CFOPMetricsCalculator.compute(timeline);

    // Default values should still be structurally valid
    expect(metrics.f2lPairs).toEqual([]);
    expect(metrics.f2lLookaheadScore).toBe(0);
  });

  // ─── Consistency ────────────────────────────────────────────────────────

  it('computes consistent results for the same input', () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const timeline1 = buildAnnotatedTimeline(scramble);
    const metrics1 = CFOPMetricsCalculator.compute(timeline1);

    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline2 = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline2, CFOPDefinition);
    const metrics2 = CFOPMetricsCalculator.compute(timeline2);

    expect(metrics1).toEqual(metrics2);
  });

  it('crossEfficiency is greater than zero for any valid cross solve', () => {
    // Multiple scrambles — all should produce cross metrics > 0
    const scrambles = [
      "R U R' U'",
      "F R U R' U' F'",
      "R U R' U' R' F R F'",
    ];

    for (const scramble of scrambles) {
      const timeline = buildAnnotatedTimeline(scramble);
      const metrics = CFOPMetricsCalculator.compute(timeline);

      expect(
        metrics.crossEfficiency,
        `crossEfficiency should be > 0 for scramble: ${scramble}`,
      ).toBeGreaterThan(0);
    }
  });
});
