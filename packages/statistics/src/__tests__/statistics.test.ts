import { describe, it, expect } from 'vitest';
import { computeBpaWpa, averageOf, computeStats, type StatSolve } from '../index.js';

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

describe('computeStats', () => {
  it('returns null best/worst (not Infinity) when there are no solves', () => {
    const stats = computeStats([]);
    expect(stats.best).toBeNull();
    expect(stats.worst).toBeNull();
    expect(stats.mean).toBeNull();
    expect(stats.ao5).toBeNull();
    expect(stats.ao12).toBeNull();
    expect(stats.total).toBe(0);
  });
});

describe('averageOf — 5% percentile trim (csTimer convention)', () => {
  const sol = (time: number, penalty: 'none' | '+2' | 'DNF' = 'none'): StatSolve => ({
    time,
    penalty,
  });
  const INF = Number.POSITIVE_INFINITY;

  it('keeps the WCA Ao5/Ao12 behavior: 1 DNF trimmed, 2+ DNFs → DNF', () => {
    // Ao5 with a single DNF: [10, 11, 12, 13, DNF] → trim best (10) & worst (DNF) → (11+12+13)/3
    const oneDnf = [sol(10000), sol(12000), sol(11000), sol(13000), sol(0, 'DNF')];
    expect(averageOf(oneDnf, 5)).toBe(12000);

    // Ao5 with two DNFs → DNF
    const twoDnf = [sol(10000), sol(12000), sol(11000), sol(0, 'DNF'), sol(0, 'DNF')];
    expect(averageOf(twoDnf, 5)).toBe(INF);

    // Ao12 with a single DNF stays valid: trim best (10000) & worst (DNF) → mean of 10001..10010
    const twelve = Array.from({ length: 11 }, (_, i) => sol(10_000 + i)).concat(sol(0, 'DNF'));
    expect(averageOf(twelve, 12)).toBeCloseTo(10005.5, 6);
    const twelve2 = Array.from({ length: 10 }, (_, i) => sol(10_000 + i)).concat(
      sol(0, 'DNF'),
      sol(0, 'DNF'),
    );
    expect(averageOf(twelve2, 12)).toBe(INF);
  });

  it('Ao100 tolerates up to 5 DNFs (trim 5 + 5) and trims them as worst', () => {
    // 95 valid solves (10.000..10.094) + 5 DNFs → best 5 and worst 5 (the DNFs) trimmed,
    // average of the middle 90 (10.005..10.094).
    const solves = [
      ...Array.from({ length: 95 }, (_, i) => sol(10_000 + i)),
      ...Array.from({ length: 5 }, () => sol(0, 'DNF')),
    ];
    const middle = Array.from({ length: 90 }, (_, i) => 10_005 + i);
    const expected = middle.reduce((a, b) => a + b, 0) / middle.length;
    expect(averageOf(solves, 100)).toBeCloseTo(expected, 6);
  });

  it('Ao100 with 6 DNFs → DNF', () => {
    const solves = [
      ...Array.from({ length: 94 }, (_, i) => sol(10_000 + i)),
      ...Array.from({ length: 6 }, () => sol(0, 'DNF')),
    ];
    expect(averageOf(solves, 100)).toBe(INF);
  });

  it('Ao50 tolerates up to 3 DNFs (trim 3 + 3) but not 4', () => {
    const threeDnf = [...Array.from({ length: 47 }, (_, i) => sol(10_000 + i)), ...Array.from({ length: 3 }, () => sol(0, 'DNF'))];
    expect(Number.isFinite(averageOf(threeDnf, 50) as number)).toBe(true);
    const fourDnf = [...Array.from({ length: 46 }, (_, i) => sol(10_000 + i)), ...Array.from({ length: 4 }, () => sol(0, 'DNF'))];
    expect(averageOf(fourDnf, 50)).toBe(INF);
  });

  it('returns null when there is not enough data', () => {
    expect(averageOf([sol(10000), sol(11000)], 5)).toBeNull();
  });
});
