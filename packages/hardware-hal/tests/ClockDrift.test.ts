import { describe, it, expect } from 'vitest';
import { ClockDriftReconciler } from '../src/sync/ClockDrift';

describe('ClockDriftReconciler', () => {
  it('should fallback to linear offset if only one point', () => {
    const r = new ClockDriftReconciler();
    r.addDataPoint(100, 1000);
    // Diff is +900
    expect(r.reconcile(150)).toBe(1050);
  });

  it('should perform perfect linear regression on perfect data', () => {
    const r = new ClockDriftReconciler();
    // Cube clock is 10% faster than host clock
    // x = cube, y = host
    r.addDataPoint(100, 1000);
    r.addDataPoint(110, 1009); // slope = 0.9
    r.addDataPoint(120, 1018); 
    r.addDataPoint(130, 1027);

    // predict at x=140. It should be 1036
    expect(r.reconcile(140)).toBeCloseTo(1036, 1);
  });

  it('should limit history to windowSize', () => {
    const r = new ClockDriftReconciler(3);
    r.addDataPoint(10, 100);
    r.addDataPoint(20, 110);
    r.addDataPoint(30, 120);
    // Now window has 3 points.
    // Let's add a drastically different point
    r.addDataPoint(1000, 2000); 
    // The history should be [20:110, 30:120, 1000:2000]
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r as any).history.length).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r as any).history[0].cubeTs).toBe(20);
  });
});
