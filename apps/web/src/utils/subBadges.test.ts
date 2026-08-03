import { describe, it, expect } from "vitest";
import type { SessionStats } from "@cubeforge/statistics";
import type { ProfileStats } from "@/hooks/useProfileStats";
import {
  computeSubBadges,
  formatThresholdLabel,
  puzzleShortLabel,
} from "./subBadges";

function makeStats(
  puzzles: Array<{ puzzle: string; best: number | null; count: number }>,
): ProfileStats {
  const base: SessionStats = {
    count: 0,
    total: 0,
    best: null,
    worst: null,
    mean: null,
    ao5: null,
    ao12: null,
    ao100: null,
    sessionTime: 0,
  };
  return {
    solves: [],
    byPuzzle: puzzles.map((p) => ({
      puzzle: p.puzzle,
      count: p.count,
      stats: { ...base, best: p.best, count: p.count, total: p.count },
      solves: [],
    })),
    heatmapCounts: [],
    streakDays: 0,
    overall: base,
  };
}

describe("computeSubBadges", () => {
  it("returns [] for null stats", () => {
    expect(computeSubBadges(null)).toEqual([]);
  });

  it("returns [] when there are no solves", () => {
    expect(computeSubBadges(makeStats([]))).toEqual([]);
  });

  it("ignores puzzles without a finite best (no solves / all DNF)", () => {
    const stats = makeStats([
      { puzzle: "3x3x3", best: null, count: 0 },
      { puzzle: "2x2x2", best: Number.POSITIVE_INFINITY, count: 3 },
    ]);
    expect(computeSubBadges(stats)).toEqual([]);
  });

  it("derives the fastest milestone strictly above the PB", () => {
    // PB 4.32s → beats Sub 5 (and everything slower), so Sub 5.
    const stats = makeStats([{ puzzle: "3x3x3", best: 4320, count: 10 }]);
    const badges = computeSubBadges(stats);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({
      puzzle: "3x3x3",
      puzzleLabel: "3×3",
      seconds: 5,
      thresholdLabel: "5",
      mainPuzzle: false,
    });
  });

  it("assigns a stable rainbow phase token per puzzle", () => {
    const stats = makeStats([
      { puzzle: "3x3x3", best: 8200, count: 4 },
      { puzzle: "2x2x2", best: 1900, count: 20 },
    ]);
    const badges = computeSubBadges(stats, "2x2x2");
    expect(badges.find((b) => b.puzzle === "3x3x3")?.color).toBe("phase-emerald");
    expect(badges.find((b) => b.puzzle === "2x2x2")?.color).toBe("phase-blue");
  });

  it("falls back deterministically for unknown puzzles", () => {
    const a = computeSubBadges(
      makeStats([{ puzzle: "mystery", best: 40_000, count: 2 }]),
    );
    const b = computeSubBadges(
      makeStats([{ puzzle: "mystery", best: 40_000, count: 2 }]),
    );
    expect(a[0].color).toBe(b[0].color);
    expect(a[0].color).toMatch(/^phase-/);
  });

  it("uses the 2x2 ladder (Sub 1 / Sub 2 / Sub 3)", () => {
    const sub3 = computeSubBadges(
      makeStats([{ puzzle: "2x2x2", best: 2900, count: 5 }]),
    );
    expect(sub3[0].seconds).toBe(3);
    expect(sub3[0].puzzleLabel).toBe("2×2");

    const sub1 = computeSubBadges(
      makeStats([{ puzzle: "2x2x2", best: 990, count: 5 }]),
    );
    expect(sub1[0].seconds).toBe(1);
  });

  it("returns no badge when the PB is slower than the slowest milestone", () => {
    const stats = makeStats([{ puzzle: "3x3x3", best: 45_000, count: 5 }]); // 45s
    expect(computeSubBadges(stats)).toEqual([]);
  });

  it("ranks the declared main puzzle first, then most-solved", () => {
    const stats = makeStats([
      { puzzle: "3x3x3", best: 8200, count: 4 }, // Sub 10
      { puzzle: "2x2x2", best: 1900, count: 20 }, // Sub 2
    ]);
    const badges = computeSubBadges(stats, "2x2x2");
    expect(badges.map((b) => b.puzzle)).toEqual(["2x2x2", "3x3x3"]);
    expect(badges[0].mainPuzzle).toBe(true);
    expect(badges[1].mainPuzzle).toBe(false);
  });

  it("formats one-minute thresholds as m:ss", () => {
    const stats = makeStats([{ puzzle: "4x4x4", best: 55_000, count: 5 }]);
    expect(stats.byPuzzle[0].stats.best).toBe(55_000);
    const badges = computeSubBadges(stats);
    // 55s < 60s → Sub 60 ("1:00").
    expect(badges[0].thresholdLabel).toBe("1:00");
  });
});

describe("helpers", () => {
  it("puzzleShortLabel maps known keys and falls back raw", () => {
    expect(puzzleShortLabel("3x3x3")).toBe("3×3");
    expect(puzzleShortLabel("2x2x2")).toBe("2×2");
    expect(puzzleShortLabel("mystery")).toBe("mystery");
  });

  it("formatThresholdLabel formats under and over a minute", () => {
    expect(formatThresholdLabel(5)).toBe("5");
    expect(formatThresholdLabel(60)).toBe("1:00");
    expect(formatThresholdLabel(90)).toBe("1:30");
  });
});
