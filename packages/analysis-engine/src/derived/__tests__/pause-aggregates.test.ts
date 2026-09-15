import { describe, it, expect } from "vitest";
import type { SolveMetrics } from "@cubalyze/types";
import { derivePauseCauseSums, flattenPauseCauses } from "../pause-aggregates";

function makeSolve(phases: string[], pauses: Array<{ phase: string; durationMs: number; category: "recognition" | "mid-algorithm" | "mid-phase" }>): { analysis: SolveMetrics } {
  return {
    analysis: {
      solveId: "s",
      totalTimeMs: 10_000,
      totalMoves: 40,
      phases: phases.map((phaseName) => ({
        phaseName,
        durationMs: 2000,
        moveCount: 10,
        tps: 5,
        pauseCount: 0,
        pauseTimeMs: 0,
      })),
      tps: { global: 4, effective: 5, byPhase: {}, peakInstantaneous: 8 },
      pauses: {
        totalCount: pauses.length,
        maxDurationMs: Math.max(...pauses.map((p) => p.durationMs), 0),
        avgDurationMs: 0,
        byPhase: {},
        totalPauseTimeMs: pauses.reduce((s, p) => s + p.durationMs, 0),
        pauseRatio: 0.1,
        pauses: pauses.map((p) => ({
          startIndex: 0,
          endIndex: 1,
          durationMs: p.durationMs,
          phase: p.phase,
          category: p.category,
        })),
      },
      fluidity: { stdDevMs: 100, coefficientOfVariation: 0.3, byPhase: {}, burstCount: 0, accelerationCount: 0, decelerationCount: 0 },
    } as SolveMetrics,
  };
}

describe("derivePauseCauseSums", () => {
  it("returns [] for empty solves", () => {
    expect(derivePauseCauseSums([])).toEqual([]);
  });

  it("returns [] when no solve has pauses", () => {
    const s = makeSolve(["Cross", "F2L", "OLL", "PLL"], []);
    expect(derivePauseCauseSums([s])).toEqual([]);
  });

  it("aggregates pause time per cause across solves", () => {
    const s1 = makeSolve(["Cross", "F2L", "OLL", "PLL"], [
      { phase: "OLL", durationMs: 500, category: "recognition" },
      { phase: "PLL", durationMs: 300, category: "recognition" },
    ]);
    const s2 = makeSolve(["Cross", "F2L", "OLL", "PLL"], [
      { phase: "OLL", durationMs: 250, category: "recognition" },
    ]);
    const rows = derivePauseCauseSums([s1, s2]);
    const oll = rows.find((r) => r.cause === "OLL recognition");
    const pll = rows.find((r) => r.cause === "PLL recognition");
    expect(oll).toMatchObject({ cause: "OLL recognition", totalMs: 750, count: 2, phase: "OLL" });
    expect(pll).toMatchObject({ cause: "PLL recognition", totalMs: 300, count: 1 });
  });

  it("sorts rows by total pause time descending and sets share", () => {
    const s = makeSolve(["Cross", "F2L", "OLL", "PLL"], [
      { phase: "OLL", durationMs: 100, category: "recognition" },
      { phase: "Cross", durationMs: 300, category: "mid-phase" },
    ]);
    const rows = derivePauseCauseSums([s]);
    expect(rows[0].cause).toBe("Cross piece search");
    expect(rows[0].share).toBeCloseTo(0.75, 5);
    expect(rows[1].share).toBeCloseTo(0.25, 5);
  });

  it("categorizes mid-algorithm pauses as hesitation", () => {
    const s = makeSolve(["Cross", "F2L", "OLL", "PLL"], [
      { phase: "PLL", durationMs: 400, category: "mid-algorithm" },
    ]);
    const rows = derivePauseCauseSums([s]);
    expect(rows[0].cause).toBe("PLL hesitation");
  });
});

describe("flattenPauseCauses", () => {
  it("returns one row per pause in solve order", () => {
    const s = makeSolve(["Cross", "F2L", "OLL", "PLL"], [
      { phase: "F2L", durationMs: 200, category: "mid-phase" },
      { phase: "OLL", durationMs: 300, category: "recognition" },
    ]);
    const rows = flattenPauseCauses([s]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cause: "F2L pair recognition", durationMs: 200, category: "mid-phase" });
    expect(rows[1]).toMatchObject({ cause: "OLL recognition", durationMs: 300, category: "recognition" });
  });
});
