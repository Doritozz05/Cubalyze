/**
 * Nivel 3 — Category 9: Determinism / Reproducibility Tests (Analysis Engine)
 *
 * Same solves/inputs MUST produce identical analysis results. Always.
 */
import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CFOPDefinition } from '@cubeforge/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import { makeMoves } from './test-helpers';

// ═══════════════════════════════════════════════════════════════════════
//  DT2: Same solve → same CFOPMetricsCalculator result (10 runs)
// ═══════════════════════════════════════════════════════════════════════

describe('DT2 — CFOPMetricsCalculator determinism', { timeout: 30000 }, () => {
  const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const solveMoves = makeMoves(
    "U R U' R' U' F' U F R U R' U R U2 R' U R U' L' U R' U' L U",
    1000,
    100,
  );

  it('same solve produces identical CFOP metrics 10 times', async () => {
    const results: string[] = [];

    for (let i = 0; i < 10; i++) {
      const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      const metrics = await MetricsAggregator.computeAll(timeline, scramble);

      // Serialize key fields to compare
      const json = JSON.stringify({
        totalMoves: metrics.totalMoves,
        totalTimeMs: metrics.totalTimeMs,
        tps: metrics.tps.global,
        phases: metrics.phases.map((p) => ({
          name: p.phaseName,
          durationMs: p.durationMs,
          moveCount: p.moveCount,
        })),
      });
      results.push(json);
    }

    // All 10 results must be identical
    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it('TimelineBuilder.build is deterministic for same inputs', () => {
    const timeline1 = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const timeline2 = TimelineBuilder.build([...solveMoves], 'CFOP', undefined, scramble);

    expect(timeline1.entries.length).toBe(timeline2.entries.length);
    expect(timeline1.method).toBe(timeline2.method);

    // Each entry should have identical move/state data
    for (let i = 0; i < timeline1.entries.length; i++) {
      expect(timeline1.entries[i].move).toEqual(timeline2.entries[i].move);
    }
  });

  it('PhaseSplitter.splitAndAnnotate is deterministic', () => {
    const timeline1 = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const timeline2 = TimelineBuilder.build([...solveMoves], 'CFOP', undefined, scramble);

    PhaseSplitter.splitAndAnnotate(timeline1, CFOPDefinition);
    PhaseSplitter.splitAndAnnotate(timeline2, CFOPDefinition);

    expect(timeline1.phases.length).toBe(timeline2.phases.length);
    for (let i = 0; i < timeline1.phases.length; i++) {
      expect(timeline1.phases[i].phaseName).toBe(timeline2.phases[i].phaseName);
      expect(timeline1.phases[i].startIndex).toBe(timeline2.phases[i].startIndex);
      expect(timeline1.phases[i].endIndex).toBe(timeline2.phases[i].endIndex);
    }
  });
});
