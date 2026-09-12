import { describe, expect, it } from "vitest";
import {
  cubeStatsFor,
  effectiveMs,
  formatLastUsed,
  isCubeStatsEmpty,
  toStatPenalty,
  type CubeSolveRow,
} from "../cubeStats";

const T0 = Date.UTC(2026, 0, 1);

/** A solve row: `n` seconds, `offset` minutes after the first one. */
function row(seconds: number, offset = 0, extra: Partial<CubeSolveRow> = {}): CubeSolveRow {
  return {
    id: `s${offset}`,
    timeMs: Math.round(seconds * 1000),
    timestamp: T0 + offset * 60_000,
    ...extra,
  };
}

/** History of `count` solves, `i`-th one being `first + i` seconds. */
function ramp(first: number, count: number): CubeSolveRow[] {
  return Array.from({ length: count }, (_, i) => row(first + i, i));
}

describe("cubeStatsFor — the empty and degenerate cases", () => {
  it("returns nothing for a cube that was never used", () => {
    const stats = cubeStatsFor([]);
    expect(stats).toEqual({
      count: 0,
      valid: 0,
      best: null,
      mean: null,
      bestAo5: null,
      bestAo12: null,
      lastUsedAt: null,
    });
    expect(isCubeStatsEmpty(stats)).toBe(true);
  });

  it("counts DNFs but never lets them win the best single", () => {
    const stats = cubeStatsFor([row(10, 0), row(0, 1, { penalty: "DNF" }), row(12, 2)]);
    expect(stats.count).toBe(3);
    expect(stats.valid).toBe(2);
    expect(stats.best?.timeMs).toBe(10_000);
    expect(stats.mean).toBe(11_000);
    expect(isCubeStatsEmpty(stats)).toBe(false);
  });

  it("reports no best and no mean when every solve is a DNF", () => {
    const stats = cubeStatsFor([row(10, 0, { penalty: "DNF" }), row(11, 1, { penalty: "dnf" })]);
    expect(stats.count).toBe(2);
    expect(stats.valid).toBe(0);
    expect(stats.best).toBeNull();
    expect(stats.mean).toBeNull();
    // A rolling average of nothing but DNFs can never be a best.
    expect(stats.bestAo5).toBeNull();
    expect(stats.lastUsedAt).toBe(T0 + 60_000);
  });

  it("needs a full window before reporting an average", () => {
    const four = cubeStatsFor(ramp(10, 4));
    expect(four.bestAo5).toBeNull();

    const five = cubeStatsFor(ramp(10, 5));
    // 10,11,12,13,14 → trim 10 and 14 → 12
    expect(five.bestAo5).toBe(12_000);
  });
});

describe("cubeStatsFor — best single and mean", () => {
  it("finds the fastest effective time and says which solve it was", () => {
    const solves = [row(10, 0), row(8.5, 1), row(11, 2)];
    const stats = cubeStatsFor(solves);
    expect(stats.best).toEqual({ timeMs: 8500, solveId: "s1", timestamp: T0 + 60_000 });
  });

  it("applies the +2 penalty to both the best single and the mean", () => {
    // 9.8 + 2 = 11.8, which is slower than the raw 10.0 next to it.
    const stats = cubeStatsFor([
      row(9.8, 0, { penalty: "+2" }),
      row(10, 1),
    ]);
    expect(stats.best?.timeMs).toBe(10_000);
    // (9.8 + 2) and 10.0 → 21.8s over 2 solves = 10.9s
    expect(stats.mean).toBe(10_900);
  });

  it("is order-independent (newest-first input gives the same numbers)", () => {
    const chronological = ramp(10, 14);
    const newestFirst = [...chronological].reverse();
    expect(cubeStatsFor(newestFirst)).toEqual(cubeStatsFor(chronological));
  });
});

describe("cubeStatsFor — best rolling averages", () => {
  it("takes the best window anywhere in the history, not the latest one", () => {
    // 10,12,11,13,9 → 11 · 12,11,13,9,20 → 12 · 11,13,9,20,21 → 14.67
    const stats = cubeStatsFor([
      row(10, 0),
      row(12, 1),
      row(11, 2),
      row(13, 3),
      row(9, 4),
      row(20, 5),
      row(21, 6),
    ]);
    expect(stats.bestAo5).toBe(11_000);
  });

  it("computes a best Ao12 when there are at least twelve solves", () => {
    // 10..21 → trim 10 and 21 → mean(11..20) = 15.5
    const stats = cubeStatsFor(ramp(10, 12));
    expect(stats.bestAo12).toBe(15_500);
  });

  it("skips a window whose average is a DNF", () => {
    // DNF, DNF, clean repeating: every 5-window holds at least three DNFs (more
    // than the single one the trim can absorb), so no window is a real average.
    // The answer is "no best", never Infinity.
    const dnf = (offset: number) => row(10 + offset, offset, { penalty: "DNF" });
    const solves = [
      dnf(0),
      dnf(1),
      row(12, 2),
      dnf(3),
      dnf(4),
      row(15, 5),
      dnf(6),
      dnf(7),
      row(18, 8),
      dnf(9),
    ];
    expect(cubeStatsFor(solves).bestAo5).toBeNull();
    // The single and the count are unaffected: they do not need a window.
    expect(cubeStatsFor(solves).best?.timeMs).toBe(12_000);
    expect(cubeStatsFor(solves).count).toBe(10);
  });

  it("tolerates ONE DNF in the window, because it is trimmed away", () => {
    // 10,11,12,13,DNF → the DNF is the worst and is discarded → (11+12+13)/3
    const stats = cubeStatsFor([
      row(10, 0),
      row(11, 1),
      row(12, 2),
      row(13, 3),
      row(0, 4, { penalty: "DNF" }),
    ]);
    expect(stats.bestAo5).toBe(12_000);
  });
});

describe("cubeStatsFor — last used", () => {
  it("reports the newest solve, whatever order it arrived in", () => {
    const stats = cubeStatsFor([row(20, 5), row(10, 0), row(15, 2)]);
    expect(stats.lastUsedAt).toBe(T0 + 5 * 60_000);
  });
});

describe("penalty helpers", () => {
  it("maps every stored penalty spelling", () => {
    expect(toStatPenalty(undefined)).toBe("none");
    expect(toStatPenalty("none")).toBe("none");
    expect(toStatPenalty("+2")).toBe("+2");
    expect(toStatPenalty("dnf")).toBe("DNF");
    expect(toStatPenalty("DNF")).toBe("DNF");
    // Anything unexpected is treated as a clean solve rather than a DNF.
    expect(toStatPenalty("weird")).toBe("none");
  });

  it("computes effective milliseconds", () => {
    expect(effectiveMs(row(10))).toBe(10_000);
    expect(effectiveMs(row(10, 0, { penalty: "+2" }))).toBe(12_000);
    expect(effectiveMs(row(10, 0, { penalty: "DNF" }))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("formatLastUsed", () => {
  const now = T0 + 10 * 24 * 60 * 60 * 1000;

  it("returns null when the cube was never used", () => {
    expect(formatLastUsed(null, now, "en")).toBeNull();
  });

  it("speaks the user's language instead of hardcoded strings", () => {
    expect(formatLastUsed(now - 30_000, now, "en")).toBe("this minute");
    expect(formatLastUsed(now - 5 * 60_000, now, "en")).toBe("5 minutes ago");
    expect(formatLastUsed(now - 3 * 24 * 60 * 60_000, now, "en")).toBe("3 days ago");
    // Same instant, another locale — no translation key involved.
    expect(formatLastUsed(now - 3 * 24 * 60 * 60_000, now, "es")).toBe("hace 3 días");
  });

  it("says \"yesterday\" rather than \"1 day ago\"", () => {
    expect(formatLastUsed(now - 30 * 60 * 60_000, now, "en")).toBe("yesterday");
  });

  it("never reports a future time, even if the clock moved backwards", () => {
    expect(formatLastUsed(now + 60_000, now, "en")).toBe("this minute");
  });
});
