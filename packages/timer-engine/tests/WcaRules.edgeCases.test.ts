/**
 * Nivel 2 — Edge cases para WcaRules
 *
 * Casos frontera para getInspectionPenalty y calculateFinalTime:
 * • Valores justo en los límites de 15s y 17s (precisión decimal)
 * • Penalizaciones +2 y DNF con solves de 0ms, negativos, Infinity
 * • Overflow de tiempo con +2
 * • Combinaciones penalty × valor extremo
 */
import { describe, it, expect } from 'vitest';
import { getInspectionPenalty, calculateFinalTime, Penalty } from '../src/WcaRules';

describe('WcaRules — Nivel 2 Edge Cases', () => {
  // ── getInspectionPenalty: fronteras ────────────────────────────────

  it('14,999ms → NONE (justo bajo 15s)', () => {
    expect(getInspectionPenalty(14_999)).toBe(Penalty.NONE);
  });

  it('15,000ms → +2 (exactamente 15s)', () => {
    expect(getInspectionPenalty(15_000)).toBe(Penalty.PLUS_TWO);
  });

  it('15,001ms → +2 (1ms después del límite)', () => {
    expect(getInspectionPenalty(15_001)).toBe(Penalty.PLUS_TWO);
  });

  it('16,999ms → +2 (justo bajo DNF)', () => {
    expect(getInspectionPenalty(16_999)).toBe(Penalty.PLUS_TWO);
  });

  it('17,000ms → DNF (exactamente 17s)', () => {
    expect(getInspectionPenalty(17_000)).toBe(Penalty.DNF);
  });

  it('17,001ms → DNF (1ms sobre 17s)', () => {
    expect(getInspectionPenalty(17_001)).toBe(Penalty.DNF);
  });

  it('0ms → NONE (sin inspección)', () => {
    expect(getInspectionPenalty(0)).toBe(Penalty.NONE);
  });

  it('valor negativo → NONE (reloj no iniciado)', () => {
    expect(getInspectionPenalty(-1)).toBe(Penalty.NONE);
  });

  it('100,000ms → DNF (inspección extremadamente larga)', () => {
    expect(getInspectionPenalty(100_000)).toBe(Penalty.DNF);
  });

  // ── calculateFinalTime: valores extremos ───────────────────────────

  it('solve 0ms + NONE → 0', () => {
    expect(calculateFinalTime(0, Penalty.NONE)).toBe(0);
  });

  it('solve 0ms + +2 → 2000', () => {
    expect(calculateFinalTime(0, Penalty.PLUS_TWO)).toBe(2000);
  });

  it('solve 0ms + DNF → Infinity', () => {
    expect(calculateFinalTime(0, Penalty.DNF)).toBe(Infinity);
  });

  it('solve 600,000ms (10min) + +2 → 602,000', () => {
    expect(calculateFinalTime(600_000, Penalty.PLUS_TWO)).toBe(602_000);
  });

  it('solve 1ms + +2 → 2001 (precisión 1ms)', () => {
    expect(calculateFinalTime(1, Penalty.PLUS_TWO)).toBe(2001);
  });

  it('solve máximo seguro (Number.MAX_SAFE_INTEGER) + NONE → no pierde precisión', () => {
    const big = Number.MAX_SAFE_INTEGER;
    expect(calculateFinalTime(big, Penalty.NONE)).toBe(big);
  });

  it('DNF siempre devuelve Infinity independientemente del solveTime', () => {
    expect(calculateFinalTime(12_345, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(-5000, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(Infinity, Penalty.DNF)).toBe(Infinity);
  });

  // ── calculateFinalTime: NaN y valores inválidos ─────────────────────

  it('solve NaN + NONE → NaN (se propaga)', () => {
    expect(calculateFinalTime(NaN, Penalty.NONE)).toBeNaN();
  });

  it('solve NaN + +2 → NaN', () => {
    expect(calculateFinalTime(NaN, Penalty.PLUS_TWO)).toBeNaN();
  });

  it('solve NaN + DNF → Infinity (DNF tiene prioridad)', () => {
    // Nota: DNF tiene prioridad sobre NaN porque chequea penalty primero
    expect(calculateFinalTime(NaN, Penalty.DNF)).toBe(Infinity);
  });

  it('solve negativo + NONE → negativo (se propaga)', () => {
    // Tiempos negativos no deberían ocurrir, pero la función no los rechaza
    expect(calculateFinalTime(-5000, Penalty.NONE)).toBe(-5000);
  });

  it('solve negativo + +2 → tiempo negativo + 2000', () => {
    expect(calculateFinalTime(-5000, Penalty.PLUS_TWO)).toBe(-3000);
  });

  // ── WCA tolerance: precisión decimal ───────────────────────────────

  it('14.999s en ms = 14999 → NONE', () => {
    expect(getInspectionPenalty(Math.floor(14.999 * 1000))).toBe(Penalty.NONE);
  });

  it('15.000s en ms = 15000 → +2', () => {
    expect(getInspectionPenalty(Math.round(15.000 * 1000))).toBe(Penalty.PLUS_TWO);
  });

  it('16.999s en ms = 16999 → +2', () => {
    expect(getInspectionPenalty(Math.floor(16.999 * 1000))).toBe(Penalty.PLUS_TWO);
  });

  it('17.000s en ms = 17000 → DNF', () => {
    expect(getInspectionPenalty(Math.round(17.000 * 1000))).toBe(Penalty.DNF);
  });

  // ── Penalty enum exhaustivo ────────────────────────────────────────

  it('todos los valores de Penalty están definidos', () => {
    expect(Penalty.NONE).toBe('NONE');
    expect(Penalty.PLUS_TWO).toBe('+2');
    expect(Penalty.DNF).toBe('DNF');
  });
});
