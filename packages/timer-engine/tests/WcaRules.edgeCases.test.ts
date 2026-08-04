/**
 * Level 2 — Edge cases for WcaRules
 *
 * Boundary cases for getInspectionPenalty and calculateFinalTime:
 * • Values right at the 15s and 17s limits (decimal precision)
 * • +2 and DNF penalties with 0ms, negative, Infinity solves
 * • Time overflow with +2
 * • Penalty × extreme value combinations
 */
import { describe, it, expect } from 'vitest';
import { getInspectionPenalty, calculateFinalTime, Penalty } from '../src/WcaRules';

describe('WcaRules — Level 2 Edge Cases', () => {
  // ── getInspectionPenalty: boundaries ───────────────────────────────

  it('14,999ms → NONE (just under 15s)', () => {
    expect(getInspectionPenalty(14_999)).toBe(Penalty.NONE);
  });

  it('15,000ms → +2 (exactly 15s)', () => {
    expect(getInspectionPenalty(15_000)).toBe(Penalty.PLUS_TWO);
  });

  it('15,001ms → +2 (1ms past the limit)', () => {
    expect(getInspectionPenalty(15_001)).toBe(Penalty.PLUS_TWO);
  });

  it('16,999ms → +2 (just under DNF)', () => {
    expect(getInspectionPenalty(16_999)).toBe(Penalty.PLUS_TWO);
  });

  it('17,000ms → DNF (exactly 17s)', () => {
    expect(getInspectionPenalty(17_000)).toBe(Penalty.DNF);
  });

  it('17,001ms → DNF (1ms over 17s)', () => {
    expect(getInspectionPenalty(17_001)).toBe(Penalty.DNF);
  });

  it('0ms → NONE (no inspection)', () => {
    expect(getInspectionPenalty(0)).toBe(Penalty.NONE);
  });

  it('negative value → NONE (clock not started)', () => {
    expect(getInspectionPenalty(-1)).toBe(Penalty.NONE);
  });

  it('100,000ms → DNF (extremely long inspection)', () => {
    expect(getInspectionPenalty(100_000)).toBe(Penalty.DNF);
  });

  // ── calculateFinalTime: extreme values ────────────────────────────

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

  it('solve 1ms + +2 → 2001 (1ms precision)', () => {
    expect(calculateFinalTime(1, Penalty.PLUS_TWO)).toBe(2001);
  });

  it('max safe solve (Number.MAX_SAFE_INTEGER) + NONE → no precision loss', () => {
    const big = Number.MAX_SAFE_INTEGER;
    expect(calculateFinalTime(big, Penalty.NONE)).toBe(big);
  });

  it('DNF siempre devuelve Infinity independientemente del solveTime', () => {
    expect(calculateFinalTime(12_345, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(-5000, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(Infinity, Penalty.DNF)).toBe(Infinity);
  });

  // ── calculateFinalTime: NaN and invalid values ─────────────────────

  it('solve NaN + NONE → NaN (propagates)', () => {
    expect(calculateFinalTime(NaN, Penalty.NONE)).toBeNaN();
  });

  it('solve NaN + +2 → NaN', () => {
    expect(calculateFinalTime(NaN, Penalty.PLUS_TWO)).toBeNaN();
  });

  it('solve NaN + DNF → Infinity (DNF takes priority)', () => {
    // Note: DNF takes priority over NaN because it checks the penalty first
    expect(calculateFinalTime(NaN, Penalty.DNF)).toBe(Infinity);
  });

  it('negative solve + NONE → negative (propagates)', () => {
    // Negative times should never occur, but the function does not reject them
    expect(calculateFinalTime(-5000, Penalty.NONE)).toBe(-5000);
  });

  it('negative solve + +2 → negative time + 2000', () => {
    expect(calculateFinalTime(-5000, Penalty.PLUS_TWO)).toBe(-3000);
  });

  // ── WCA tolerance: decimal precision ──────────────────────────────

  it('14.999s in ms = 14999 → NONE', () => {
    expect(getInspectionPenalty(Math.floor(14.999 * 1000))).toBe(Penalty.NONE);
  });

  it('15.000s in ms = 15000 → +2', () => {
    expect(getInspectionPenalty(Math.round(15.000 * 1000))).toBe(Penalty.PLUS_TWO);
  });

  it('16.999s in ms = 16999 → +2', () => {
    expect(getInspectionPenalty(Math.floor(16.999 * 1000))).toBe(Penalty.PLUS_TWO);
  });

  it('17.000s in ms = 17000 → DNF', () => {
    expect(getInspectionPenalty(Math.round(17.000 * 1000))).toBe(Penalty.DNF);
  });

  // ── Exhaustive Penalty enum ───────────────────────────────────────

  it('all Penalty values are defined', () => {
    expect(Penalty.NONE).toBe('NONE');
    expect(Penalty.PLUS_TWO).toBe('+2');
    expect(Penalty.DNF).toBe('DNF');
  });
});
