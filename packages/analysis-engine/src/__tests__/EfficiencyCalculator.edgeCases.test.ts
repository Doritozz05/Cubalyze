/**
 * Nivel 2 — Edge cases para EfficiencyCalculator
 *
 * Casos frontera:
 * • compute con timeline vacío → defaults
 * • solveOptimal con scramble inválido/vacío → ''
 * • Redundancy & cancellation: secuencias límite
 * • computeForwardDriftFast: sin entries, solved state, sin progreso
 * • overturns: siempre 0 (documentado como limitación)
 */
import { describe, it, expect } from 'vitest';
import { EfficiencyCalculator } from '../metrics/EfficiencyCalculator';
import type { SolveTimeline, TimelineEntry, CubeMoveEvent } from '@cubeforge/types';

/** Build a minimal SolveTimeline from an array of moves. */
function makeTimeline(moves: Array<{ face: string; direction: number }>): SolveTimeline {
  const entries: TimelineEntry[] = moves.map((m, i) => ({
    index: i,
    move: { face: m.face as any, direction: m.direction as 1 | -1 | 2, cubeTimestamp: i * 100, hostTimestamp: i * 100 },
    displayMove: { face: m.face as any, direction: m.direction as 1 | -1 | 2, cubeTimestamp: i * 100, hostTimestamp: i * 100 },
    hostTimestamp: i * 100,
    state: {
      cp: [0, 1, 2, 3, 4, 5, 6, 7],
      co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    phaseId: 0,
  }));
  return { entries, solveId: 'test', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: moves.length * 100 };
}

describe('EfficiencyCalculator — Nivel 2 Edge Cases', () => {
  // ── compute: timeline vacío ────────────────────────────────────────

  it('compute con timeline vacío devuelve valores por defecto', async () => {
    const timeline: SolveTimeline = { entries: [], solveId: 'empty', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 };
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result).toEqual({
      moveEfficiencyRatio: 1,
      optimalMoveCount: 0,
      redundancies: 0,
      cancellations: 0,
      overturns: 0,
      forwardDrift: 1,
    });
  });

  it('compute con timeline vacío y scramble vacío devuelve defaults', async () => {
    const timeline: SolveTimeline = { entries: [], solveId: 'empty', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 };
    const result = await EfficiencyCalculator.compute(timeline, '');
    expect(result.optimalMoveCount).toBe(0);
    expect(result.moveEfficiencyRatio).toBe(1);
  });

  // ── solveOptimal ───────────────────────────────────────────────────

  it('solveOptimal con scramble vacío devuelve string vacío', async () => {
    const result = await EfficiencyCalculator.solveOptimal('');
    expect(result).toBe('');
  });

  it('solveOptimal con scramble inválido no lanza (catch → "")', async () => {
    const result = await EfficiencyCalculator.solveOptimal('INVALID SCRAMBLE X Y Z');
    expect(result).toBe('');
  });

  // ── Redundancy & cancellation ──────────────────────────────────────

  it('detección: U seguido de U\' es cancellation (no redundancy)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: -1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.cancellations).toBe(1);
    expect(result.redundancies).toBe(0);
  });

  it('detección: U seguido de U es redundancy (no cancellation)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(1);
    expect(result.cancellations).toBe(0);
  });

  it('detección: R2 no es cancellation ni redundancy', async () => {
    const timeline = makeTimeline([
      { face: 'R', direction: 2 },
      { face: 'R', direction: 2 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  it('detección: caras diferentes no cuentan', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  it('múltiples redundancias: U U R U U = 2 redundancias', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
      { face: 'U', direction: 1 },
      { face: 'U', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(2);
  });

  it('secuencia larga sin redundancias ni cancellations', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: -1 },
      { face: 'F', direction: 1 },
      { face: 'D', direction: 2 },
      { face: 'L', direction: -1 },
      { face: 'B', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.redundancies).toBe(0);
    expect(result.cancellations).toBe(0);
  });

  // ── forwardDrift ───────────────────────────────────────────────────

  it('computeForwardDriftFast con timeline vacío devuelve 1', () => {
    const result = EfficiencyCalculator.computeForwardDriftFast({ entries: [], solveId: 'test', method: 'CFOP', phases: [], startTimestamp: 0, endTimestamp: 0 });
    expect(result).toBe(1);
  });

  it('computeForwardDriftFast con 1 entry y estado solved devuelve...', () => {
    // Con un solo entry y estado solved, no hay entries previos para comparar
    // así que progressSteps = 0 (ningún entry tiene menos unsolved que el anterior)
    // forwardDrift = 0/1 = 0
    const timeline = makeTimeline([{ face: 'U', direction: 1 }]);
    // El estado del entry es solved (cp=identity, co=0, etc.), así que unsolved=0
    // previousUnsolved empieza en 20, unsolved=0 < 20 → progressSteps++ = 1
    // forwardDrift = 1/1 = 1
    const result = EfficiencyCalculator.computeForwardDriftFast(timeline);
    expect(result).toBe(1);
  });

  it('computeForwardDriftFast con todos los estados en solved = 0.5 (2 entries, 1 progresa)', () => {
    // buildTimeline con solved state produce unsolved=0 para cada entry
    // primer entry: 0 < 20 → progress++, prev=0
    // segundo entry: 0 < 0? No → no progress
    // Así que progress=1, entries.length=2, forwardDrift=0.5
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = EfficiencyCalculator.computeForwardDriftFast(timeline);
    // Ambos entradas tienen estado solved (unsolved=0)
    // Primera: 0 < 20 → progress++ (1)
    // Segunda: 0 < 0 → no progress
    // forwardDrift = 1/2 = 0.5
    expect(result).toBe(0.5);
  });

  // ── overturns ──────────────────────────────────────────────────────

  it('overturns siempre es 0 (limitación documentada)', async () => {
    const timeline = makeTimeline([
      { face: 'U', direction: 1 },
      { face: 'R', direction: 1 },
    ]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.overturns).toBe(0);
  });

  // ── forwardDrift con 0 entries (vía compute) ───────────────────────

  it('compute con entries.length=1 no da error', async () => {
    const timeline = makeTimeline([{ face: 'U', direction: 1 }]);
    const result = await EfficiencyCalculator.compute(timeline, 'R U R\'');
    expect(result.forwardDrift).toBeGreaterThanOrEqual(0);
    expect(result.forwardDrift).toBeLessThanOrEqual(1);
  });
});
