/**
 * Level 2 — Edge cases for ClockDriftReconciler
 *
 * Boundary cases for clock reconciliation between the cube hardware
 * (internal crystal) and the host (performance.now):
 *
 * • No data points, 1 data point (fallback to a simple offset)
 * • Negative drift (cube clock faster than host)
 * • Zero denominator (all cubeTs equal)
 * • NaN, Infinity, negative numbers
 * • Timestamp overflow, very large values
 * • Non-monotonic data points
 * • Full window + new points (shift)
 */
import { describe, it, expect } from 'vitest';
import { ClockDriftReconciler } from '../src/sync/ClockDrift';

describe('ClockDriftReconciler — Level 2 Edge Cases', () => {
  // ── No data ────────────────────────────────────────────────────────

  it('reconcile with no data points returns cubeTs unchanged', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(1000)).toBe(1000);
  });

  it('reconcile with no data points returns 0 when cubeTs=0', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(0)).toBe(0);
  });

  it('reconcile with no data points returns NaN when cubeTs=NaN', () => {
    const r = new ClockDriftReconciler(20);
    expect(r.reconcile(NaN)).toBeNaN();
  });

  // ── 1 data point (fallback to a simple offset) ─────────────────────

  it('1 data point: reconcile uses a direct offset', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050); // offset = 50
    expect(r.reconcile(2000)).toBe(2050); // 2000 + 50
  });

  it('1 data point with a negative offset', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(2000, 1900); // offset = -100
    expect(r.reconcile(3000)).toBe(2900); // 3000 - 100
  });

  it('1 data point: reconcile of the same cubeTs', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    expect(r.reconcile(1000)).toBe(1050);
  });

  // ── 2+ data points with linear drift ───────────────────────────────

  it('perfect linear drift: host = cube + 50', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    r.addDataPoint(3000, 3050);
    expect(r.reconcile(4000)).toBe(4050);
  });

  it('drift with slope: cube faster than host', () => {
    // Cube advances 1000, host only 900 (cube faster)
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 900);
    r.addDataPoint(2000, 1800);
    // Slope = 0.9, intercept = 0
    // reconcile(3000) = 0.9 * 3000 + 0 = 2700
    expect(r.reconcile(3000)).toBe(2700);
  });

  it('drift with slope: cube slower than host (negative drift)', () => {
    // Cube advances 1000, host advances 1100 (cube slower)
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1100);
    r.addDataPoint(2000, 2200);
    // Slope = 1.1, intercept = 0 → reconcile(3000) ≈ 3300
    expect(r.reconcile(3000)).toBeCloseTo(3300, 10);
  });

  // ── Zero denominator (all cubeTs equal) ────────────────────────────

  it('all cubeTs equal → fallback to average offset', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(1000, 1060);
    r.addDataPoint(1000, 1040);
    // Todos x=1000, average offset = (1050+1060+1040)/3 - 1000 = 50
    expect(r.reconcile(2000)).toBe(2050); // 2000 + 50
  });

  it('2 data points with the same cubeTs but different hostTs', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(500, 550);
    r.addDataPoint(500, 560);
    // denominator = 0 → fallback average offset = (550+560)/2 - 500 = 55
    expect(r.reconcile(1000)).toBe(1055);
  });

  // ── NaN and Infinity in data points ────────────────────────────────

  it('addDataPoint with NaN cubeTs is kept (propagates into the regression)', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(NaN, 1000);
    r.addDataPoint(1000, 2000);
    // NaN contaminates sumX, but the function does not filter
    const result = r.reconcile(2000);
    expect(isNaN(result)).toBe(true);
  });

  it('addDataPoint with Infinity hostTs', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, Infinity);
    const result = r.reconcile(2000);
    expect(isFinite(result)).toBe(false);
  });

  // ── Extreme values ────────────────────────────────────────────────

  it('very large timestamps (near Number.MAX_SAFE_INTEGER)', () => {
    const r = new ClockDriftReconciler(20);
    const big = Number.MAX_SAFE_INTEGER / 2;
    r.addDataPoint(big, big + 100);
    r.addDataPoint(big + 1000, big + 1100);
    const result = r.reconcile(big + 2000);
    expect(result).toBe(big + 2100); // big + 2000 + 100 offset
  });

  it('negative timestamps (should not happen, but must not crash)', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(-1000, -900);
    r.addDataPoint(-500, -400);
    const result = r.reconcile(0);
    expect(isFinite(result)).toBe(true);
  });

  it('timestamps cero', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 50);
    r.addDataPoint(1000, 1050);
    expect(r.reconcile(500)).toBe(550);
  });

  // ── Non-monotonic data ─────────────────────────────────────────────

  it('out-of-order (non-monotonic) data points do not crash', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(3000, 3050);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    // Order does not matter for linear regression
    const result = r.reconcile(4000);
    expect(isFinite(result)).toBe(true);
  });

  // ── Full window + rotation ──────────────────────────────────────────

  it('window size 2: only the last 2 count', () => {
    const r = new ClockDriftReconciler(2);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1000);
    r.addDataPoint(2000, 1900); // Pushes (0,0) out
    // Window holds: (1000,1000) and (2000,1900)
    // Slope = (2*1900000 - 3000*2900) / (2*5000000 - 3000^2)
    // = (3800000 - 8700000) / (10000000 - 9000000) = -4900000/1000000 = -4.9? 
    // No, wait: 
    // sumX = 3000, sumY = 2900, sumXY = 1000*1000 + 2000*1900 = 4800000
    // sumXX = 1000^2 + 2000^2 = 5000000, n=2
    // denominator = 2*5000000 - 3000^2 = 10000000 - 9000000 = 1000000
    // m = (2*4800000 - 3000*2900) / 1000000 = (9600000 - 8700000) / 1000000 = 0.9
    // b = (2900 - 0.9*3000) / 2 = (2900-2700)/2 = 100
    // reconcile(3000) = 0.9*3000 + 100 = 2800
    expect(r.reconcile(3000)).toBe(2800);
  });

  it('addDataPoint keeps at most windowSize elements', () => {
    const r = new ClockDriftReconciler(3);
    r.addDataPoint(0, 0);
    r.addDataPoint(100, 100);
    r.addDataPoint(200, 200);
    expect(r['history'].length).toBe(3);
    r.addDataPoint(300, 300); // Pushes (0,0) out
    expect(r['history'].length).toBe(3);
    expect(r['history'][0].cubeTs).toBe(100);
  });

  // ── Drift without offset (synchronized clocks) ─────────────────────

  it('perfectly synchronized clocks: reconcile(x) ≈ x', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(0, 0);
    r.addDataPoint(1000, 1000);
    r.addDataPoint(2000, 2000);
    expect(r.reconcile(3000)).toBe(3000);
  });

  // ── A single data point after many ─────────────────────────────────

  it('after linear regression, 1 data point + reconcile works', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    // 2 data points → linear regression
    expect(r.reconcile(3000)).toBe(3050);
  });

  // ── Reconcile with extreme values after data points ────────────────

  it('reconcile with cubeTs = 0 after positive data points', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    const result = r.reconcile(0);
    // Linear extrapolation backwards
    expect(isFinite(result)).toBe(true);
  });

  // ── NaN resistance in reconcile ────────────────────────────────────

  it('reconcile(NaN) after valid data points returns NaN', () => {
    const r = new ClockDriftReconciler(20);
    r.addDataPoint(1000, 1050);
    r.addDataPoint(2000, 2050);
    expect(r.reconcile(NaN)).toBeNaN();
  });
});
