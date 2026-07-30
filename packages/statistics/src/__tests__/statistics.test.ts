import { describe, it, expect } from 'vitest';
import { computeBpaWpa, averageOf } from '../index.js';

describe('computeBpaWpa', () => {
  it('returns null when solves count is not N - 1', () => {
    const solves = [
      { time: 10000, penalty: 'none' as const },
      { time: 12000, penalty: 'none' as const },
    ];
    expect(computeBpaWpa(solves, 5)).toBeNull();
  });

  it('calculates BPA and WPA bounds for Ao5 when 4 solves are present', () => {
    const solves = [
      { time: 10000, penalty: 'none' as const }, // 10.00
      { time: 12000, penalty: 'none' as const }, // 12.00
      { time: 11000, penalty: 'none' as const }, // 11.00
      { time: 13000, penalty: 'none' as const }, // 13.00
    ];
    const res = computeBpaWpa(solves, 5);
    expect(res).not.toBeNull();
    expect(res?.targetN).toBe(5);

    // BPA assumes 5th solve is 0s -> solves are [0, 10, 11, 12, 13] -> trim 0 & 13 -> avg of (10+11+12)/3 = 11.00s (11000ms)
    expect(res?.bpa).toBe(11000);

    // WPA assumes 5th solve is DNF (infinity) -> solves are [10, 11, 12, 13, DNF] -> trim 10 & DNF -> avg of (11+12+13)/3 = 12.00s (12000ms)
    expect(res?.wpa).toBe(12000);
  });
});
