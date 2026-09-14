import { describe, it, expect } from "vitest";
import type { SessionStats, Penalty } from "@cubeforge/statistics";
import type { ProfileStats } from "@/hooks/useProfileStats";
import type { Solve as UISolve } from "@/types";
import {
  computeSubBadges,
  formatThresholdLabel,
  puzzleShortLabel,
  SUB_BADGE_FALLBACK_WINDOW,
  SUB_BADGE_WINDOW,
} from "./subBadges";

// ─── Fixtures ───────────────────────────────────────────────────────────────

let nextId = 0;

/** A solve in a fixture history: seconds, or `[seconds, penalty]`. */
type SolveSpec = number | [number, Penalty];

/** Build a newest-first solve history from times in seconds. */
function solvesFrom(specs: SolveSpec[]): UISolve[] {
  return specs.map((spec, i) => {
    const [sec, penalty]: [number, Penalty] =
      typeof spec === "number" ? [spec, "none"] : spec;
    return {
      id: `solve-${nextId++}`,
      time: Math.round(sec * 1000),
      penalty,
      scramble: "",
      timestamp: 1_700_000_000_000 - i * 1000,
      source: "manual" as const,
    };
  });
}

/** `n` solves, all at the same time. */
function repeat(seconds: number, n: number): number[] {
  return Array.from({ length: n }, () => seconds);
}

function makeStats(
  puzzles: Array<{
    puzzle: string;
    times: SolveSpec[];
    /** Current rolling averages as the statistics engine would report them. */
    ao12?: number | null;
    ao100?: number | null;
  }>,
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
      count: p.times.length,
      stats: {
        ...base,
        count: p.times.length,
        total: p.times.length,
        ao12: p.ao12 ?? null,
        ao100: p.ao100 ?? null,
      },
      solves: solvesFrom(p.times),
    })),
    heatmapCounts: [],
    streakDays: 0,
    overall: base,
    totalSolveTimeMs: 0,
  };
}

/** 120 solves at `seconds`, which is ≥ 100 so the ao100 yardstick applies. */
function longHistory(seconds: number): number[] {
  return repeat(seconds, SUB_BADGE_WINDOW + 20);
}

// ─── The consensus rule ─────────────────────────────────────────────────────

describe("computeSubBadges — sub-X comes from a trimmed average", () => {
  it("returns [] for null stats", () => {
    expect(computeSubBadges(null)).toEqual([]);
  });

  it("returns [] when there are no solves", () => {
    expect(computeSubBadges(makeStats([]))).toEqual([]);
  });

  it("earns the badge from the ao100, not from the best single", () => {
    // 120 solves at 19.5 → the best 100-window average is 19.5 → Sub 20.
    const stats = makeStats([{ puzzle: "333", times: longHistory(19.5), ao100: 19_500 }]);
    const badges = computeSubBadges(stats);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({
      puzzle: "333",
      puzzleLabel: "3×3",
      seconds: 20,
      thresholdLabel: "20",
      windowSize: SUB_BADGE_WINDOW,
      solveCount: 120,
      averageMs: 19_500,
      mainPuzzle: false,
    });
  });

  it("does NOT hand out a badge for one lucky single (the old bug)", () => {
    // A 19.4 single in a sea of 28s. The old PB-based rule said "Sub 20"
    // forever; the community would call that a fluke, not a rank.
    const times = [19.4, ...repeat(28, 119)];
    const stats = makeStats([{ puzzle: "333", times, ao100: 28_000 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0].seconds).toBe(30);
    expect(badges[0].averageMs).toBeGreaterThan(27_000);
  });

  it("refuses to claim anything below 12 solves", () => {
    // Fast singles, but not enough history to support a trimmed average.
    const stats = makeStats([{ puzzle: "333", times: [19.5, 19.8, 20.1, 19.9] }]);
    expect(computeSubBadges(stats)).toEqual([]);
  });

  it("falls back to the ao12 between 12 and 99 solves, and says so", () => {
    const times = repeat(19.5, 40);
    const stats = makeStats([{ puzzle: "333", times, ao12: 19_500 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0]).toMatchObject({
      seconds: 20,
      windowSize: SUB_BADGE_FALLBACK_WINDOW,
      solveCount: 40,
    });
  });

  it("prefers the durable ao100 over a flashier ao12", () => {
    // 12 recent blitz solves at 14s inside a 20.5s history: the ao12 would
    // claim Sub 15, but the typical average — the real rank — is 19.6.
    const times = [...repeat(14, 12), ...repeat(20.5, 88)];
    const stats = makeStats([{ puzzle: "333", times, ao12: 14_000 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0].windowSize).toBe(SUB_BADGE_WINDOW);
    expect(badges[0].seconds).toBe(20);
  });

  it("keeps the peak you earned, and reports today's average separately", () => {
    // Newest 100 solves at 25s, an older 100-solve stretch at 18s: the badge
    // is the achievement, `currentMs` is the current form.
    const times = [...repeat(25, 100), ...repeat(18, 100)];
    const stats = makeStats([{ puzzle: "333", times, ao100: 25_000 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0].averageMs).toBe(18_000);
    expect(badges[0].seconds).toBe(20);
    expect(badges[0].currentMs).toBe(25_000);
  });

  it("names the next faster milestone", () => {
    const stats = makeStats([{ puzzle: "333", times: longHistory(19.5) }]);
    const badges = computeSubBadges(stats);
    expect(badges[0].nextSeconds).toBe(17);
    expect(badges[0].nextThresholdLabel).toBe("17");
  });

  it("hands a slow-but-improving history its FIRST badge", () => {
    // The old ladder stopped at Sub 30, so a 34s ao100 earned nothing at all —
    // the worst possible answer for someone who is actively getting faster.
    const stats = makeStats([{ puzzle: "333", times: longHistory(34), ao100: 34_000 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0]).toMatchObject({
      seconds: 35,
      thresholdLabel: "35",
      windowSize: SUB_BADGE_WINDOW,
      nextThresholdLabel: "30",
    });
  });

  it("claims a provisional ao12 badge when the ao100 crosses no rung", () => {
    // 96 solves at 70s with a hot last session at 26s: the typical average is
    // 66s (slower than the last rung, Sub 1:00), so the durable window says
    // nothing — but the provisional one does, and the badge says it is
    // provisional instead of hiding the improvement.
    const times = [...repeat(26, 12), ...repeat(70, 96)];
    const stats = makeStats([{ puzzle: "333", times, ao12: 26_000 }]);
    const badges = computeSubBadges(stats);
    expect(badges[0]).toMatchObject({
      seconds: 30,
      windowSize: SUB_BADGE_FALLBACK_WINDOW,
      averageMs: 26_000,
      currentMs: 26_000,
    });
  });

  it("returns no badge when BOTH windows are slower than the slowest rung", () => {
    // 75s is past Sub 1:00, and the ao12 (same 75s) adds nothing: no claim.
    const stats = makeStats([{ puzzle: "333", times: longHistory(75) }]);
    expect(computeSubBadges(stats)).toEqual([]);
  });

  it("tolerates DNFs inside the ao100 trim", () => {
    // The ao100 drops 5 from each end, so 5 DNFs (the worst solves) fall
    // inside the trim and the average still stands.
    const dnfs: SolveSpec[] = Array.from({ length: 5 }, () => [0, "DNF"] as [number, Penalty]);
    const stats = makeStats([
      { puzzle: "333", times: [...dnfs, ...repeat(19.5, 100)] },
    ]);
    expect(computeSubBadges(stats)[0]?.seconds).toBe(20);
  });

  it("returns [] for a puzzle with no usable history", () => {
    expect(computeSubBadges(makeStats([{ puzzle: "333", times: [] }]))).toEqual([]);
  });
});

// ─── Presentation helpers ───────────────────────────────────────────────────

describe("computeSubBadges — presentation", () => {
  it("uses the 2x2 ladder (Sub 1 / Sub 2 / Sub 3)", () => {
    const sub3 = computeSubBadges(makeStats([{ puzzle: "222", times: repeat(2.9, 20) }]));
    expect(sub3[0].seconds).toBe(3);
    expect(sub3[0].puzzleLabel).toBe("2×2");

    const sub1 = computeSubBadges(makeStats([{ puzzle: "222", times: repeat(0.99, 20) }]));
    expect(sub1[0].seconds).toBe(1);
  });

  it("ranks the declared main puzzle first, then most-solved", () => {
    const stats = makeStats([
      { puzzle: "333", times: repeat(8.2, 20) },
      { puzzle: "222", times: repeat(1.9, 40) },
    ]);
    const badges = computeSubBadges(stats, "222");
    expect(badges.map((b) => b.puzzle)).toEqual(["222", "333"]);
    expect(badges[0].mainPuzzle).toBe(true);
    expect(badges[1].mainPuzzle).toBe(false);
  });

  it("formats one-minute thresholds as m:ss", () => {
    const stats = makeStats([{ puzzle: "444", times: repeat(55, 20) }]);
    const badges = computeSubBadges(stats);
    expect(badges[0].thresholdLabel).toBe("1:00");
  });
});

describe("helpers", () => {
  it("puzzleShortLabel maps known keys and falls back raw", () => {
    expect(puzzleShortLabel("333")).toBe("3×3");
    expect(puzzleShortLabel("222")).toBe("2×2");
    expect(puzzleShortLabel("mystery")).toBe("mystery");
  });

  it("formatThresholdLabel formats under and over a minute", () => {
    expect(formatThresholdLabel(5)).toBe("5");
    expect(formatThresholdLabel(60)).toBe("1:00");
    expect(formatThresholdLabel(90)).toBe("1:30");
  });
});
