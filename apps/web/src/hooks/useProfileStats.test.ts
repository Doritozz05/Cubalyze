import { describe, it, expect } from "vitest";
import {
  normalizePuzzleKey,
  computeStreak,
  buildHeatmapCounts,
  aggregateByPuzzle,
  bestEffectiveTime,
} from "./useProfileStats";
import type { Solve as UISolve } from "@/types";

function solve(overrides: Partial<UISolve> & { time: number }): UISolve {
  return {
    id: Math.random().toString(36).slice(2),
    penalty: "none",
    scramble: "",
    timestamp: Date.now(),
    puzzleType: "333",
    ...overrides,
  };
}

describe("normalizePuzzleKey", () => {
  it("normalizes 3x3 variants (incl. the pre-ADR-002 '3x3x3') to '333'", () => {
    expect(normalizePuzzleKey("3x3")).toBe("333");
    expect(normalizePuzzleKey("333")).toBe("333");
    expect(normalizePuzzleKey("3x3x3")).toBe("333");
    expect(normalizePuzzleKey(" 3X3 ")).toBe("333");
  });
  it("normalizes 2x2 variants (incl. the pre-ADR-002 '2x2x2') to '222'", () => {
    expect(normalizePuzzleKey("2x2")).toBe("222");
    expect(normalizePuzzleKey("222")).toBe("222");
    expect(normalizePuzzleKey("2x2x2")).toBe("222");
  });
  it("keeps OH as its own event", () => {
    expect(normalizePuzzleKey("333oh")).toBe("333oh");
  });
  it("passes through unknown keys and defaults undefined", () => {
    expect(normalizePuzzleKey("Megaminx")).toBe("megaminx");
    expect(normalizePuzzleKey(undefined)).toBe("333");
  });
});

describe("computeStreak", () => {
  const day = 86_400_000;
  const now = new Date("2026-08-03T12:00:00Z").getTime();
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);

  it("counts consecutive active days ending today", () => {
    const dayCounts = new Map<string, number>([
      [key(now), 2],
      [key(now - day), 1],
      [key(now - 2 * day), 3],
      [key(now - 4 * day), 1], // gap on day 3 breaks the streak
    ]);
    expect(computeStreak(dayCounts, now)).toBe(3);
  });

  it("counts from yesterday when today has no activity yet", () => {
    const dayCounts = new Map<string, number>([
      [key(now - day), 1],
      [key(now - 2 * day), 1],
    ]);
    expect(computeStreak(dayCounts, now)).toBe(2);
  });

  it("returns 0 with no activity", () => {
    expect(computeStreak(new Map(), now)).toBe(0);
  });
});

describe("buildHeatmapCounts", () => {
  const day = 86_400_000;
  const now = Date.now();

  it("returns 365 daily buckets with the correct day count", () => {
    const solves = [
      solve({ time: 1000, timestamp: now }),
      solve({ time: 2000, timestamp: now }),
      solve({ time: 3000, timestamp: now - day }),
    ];
    const { counts, dayCounts } = buildHeatmapCounts(solves);
    expect(counts).toHaveLength(365);
    expect(counts[364]).toBe(2); // today
    expect(counts[363]).toBe(1); // yesterday
    expect(dayCounts.size).toBe(2);
  });

  it("handles empty input", () => {
    const { counts, dayCounts } = buildHeatmapCounts([]);
    expect(counts).toHaveLength(365);
    expect(counts.every((c) => c === 0)).toBe(true);
    expect(dayCounts.size).toBe(0);
  });
});

describe("aggregateByPuzzle", () => {
  const base = Date.now();
  it("groups solves by puzzle and computes stats", () => {
    const solves = [
      solve({ time: 10_000, timestamp: base, puzzleType: "333" }),
      solve({ time: 12_000, timestamp: base + 1, puzzleType: "333" }),
      solve({ time: 8000, timestamp: base + 2, puzzleType: "222" }),
    ];
    const result = aggregateByPuzzle(solves);
    expect(result).toHaveLength(2);
    const three = result.find((r) => r.puzzle === "333")!;
    const two = result.find((r) => r.puzzle === "222")!;
    expect(three.count).toBe(2);
    expect(three.stats.best).toBe(10_000);
    expect(two.count).toBe(1);
    expect(two.stats.best).toBe(8000);
    // Sorted by count desc.
    expect(result[0].puzzle).toBe("333");
  });

  it("ignores DNF solves for best but counts them", () => {
    const solves = [
      solve({ time: 5000, timestamp: base, penalty: "DNF" }),
      solve({ time: 9000, timestamp: base + 1 }),
    ];
    const result = aggregateByPuzzle(solves);
    expect(result[0].count).toBe(2);
    expect(result[0].stats.best).toBe(9000);
  });
});

describe("bestEffectiveTime", () => {
  it("returns the best effective time ignoring DNFs", () => {
    const solves = [
      solve({ time: 5000, penalty: "DNF" }),
      solve({ time: 7000, penalty: "+2" }), // effective 9000
      solve({ time: 8000 }),
    ];
    expect(bestEffectiveTime(solves)).toBe(8000);
  });
  it("returns null with no valid solves", () => {
    expect(bestEffectiveTime([])).toBeNull();
    expect(bestEffectiveTime([solve({ time: 1, penalty: "DNF" })])).toBeNull();
  });
});
