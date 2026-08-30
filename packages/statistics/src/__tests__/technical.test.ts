import { describe, expect, it } from "vitest";
import type { SolveMetrics } from "@cubeforge/types";
import {
  derivePhaseTimeStats,
  deriveEconomyStats,
  deriveRotationStats,
  deriveLookaheadStats,
  deriveCrossStats,
  deriveRecognitionCosts,
  deriveSessionTechnicalStats,
  deriveMoveMetrics,
  deriveCaseIntelligence,
} from "../technical";

/** Minimal valid SolveMetrics with the fields the derivations read. */
function metrics(config: {
  id?: string;
  totalTimeMs?: number;
  totalMoves?: number;
  phases?: SolveMetrics["phases"];
  efficiency?: SolveMetrics["efficiency"];
  rotation?: SolveMetrics["rotation"];
  pauses?: SolveMetrics["pauses"];
  fluidity?: SolveMetrics["fluidity"];
  tps?: SolveMetrics["tps"];
  cfop?: SolveMetrics["cfop"];
  detectionReport?: SolveMetrics["detectionReport"];
} = {}): SolveMetrics {
  return {
    solveId: config.id ?? "s",
    totalTimeMs: config.totalTimeMs ?? 10000,
    totalMoves: config.totalMoves ?? 50,
    phases:
      config.phases ??
      [
        { phaseName: "Cross", durationMs: 1500, moveCount: 6, tps: 4, pauseCount: 0, pauseTimeMs: 0 },
        { phaseName: "F2L", durationMs: 5000, moveCount: 25, tps: 5, pauseCount: 1, pauseTimeMs: 300 },
        { phaseName: "OLL", durationMs: 1500, moveCount: 8, tps: 5.33, pauseCount: 0, pauseTimeMs: 0, recognitionMs: 600, executionMs: 900 },
        { phaseName: "PLL", durationMs: 2000, moveCount: 11, tps: 5.5, pauseCount: 0, pauseTimeMs: 0, recognitionMs: 950, executionMs: 1050 },
      ],
    tps: config.tps ?? { global: 5, effective: 5, byPhase: {}, peakInstantaneous: 9 },
    pauses:
      config.pauses ?? {
        totalCount: 2,
        maxDurationMs: 400,
        avgDurationMs: 200,
        byPhase: {},
        totalPauseTimeMs: 400,
        pauseRatio: 0.04,
        pauses: [],
      },
    fluidity: config.fluidity ?? {
      stdDevMs: 60,
      coefficientOfVariation: 0.5,
      byPhase: {},
      burstCount: 2,
      accelerationCount: 3,
      decelerationCount: 1,
    },
    efficiency:
      config.efficiency ?? {
        moveEfficiencyRatio: 1.25,
        optimalMoveCount: 40,
        redundancies: 2,
        cancellations: 1,
        overturns: 1,
        forwardDrift: 0.1,
      },
    rotation:
      config.rotation ?? {
        totalCount: 4,
        byAxis: { x: 1, y: 2, z: 1 },
        estimatedRotationTimeMs: 500,
        consecutiveCount: 1,
        byPhase: { F2L: 3, OLL: 1 },
        rotationToMoveRatio: 0.08,
        redundantRotations: 2,
      },
    cfop: config.cfop ?? {
      crossEfficiency: 1.5,
      crossToF2LTransitionMs: 700,
      crossMoves: 7,
      crossTPS: 4.5,
      f2lPairs: [
        { pairNumber: 1, slotId: "FR", timeMs: 1200, moves: 6, tps: 5, recognitionMs: 0, completionIndex: 12 },
        { pairNumber: 2, slotId: "FL", timeMs: 1300, moves: 7, tps: 5.4, recognitionMs: 200, completionIndex: 20 },
        { pairNumber: 3, slotId: "BR", timeMs: 1100, moves: 5, tps: 4.5, recognitionMs: 100, completionIndex: 26 },
        { pairNumber: 4, slotId: "BL", timeMs: 1400, moves: 7, tps: 5, recognitionMs: 150, completionIndex: 34 },
      ],
      f2lLookaheadScore: 0.72,
      ollRecognitionMs: 600,
      ollExecutionMs: 900,
      ollTPS: 5.3,
      pllRecognitionMs: 950,
      pllExecutionMs: 1050,
      pllTPS: 5.5,
      ollCase: { caseNumber: "OLL 24", caseName: "oc", confidence: "exact" },
      pllCase: { caseNumber: "Ta", caseName: "Ta", confidence: "exact" },
    },
    detectionReport:
      config.detectionReport ?? {
        method: "CFOP",
        expectedPhases: ["Cross", "F2L", "OLL", "PLL"],
        phases: [],
        complete: true,
        finalStateSolved: true,
        crossColor: "D",
        crossType: "xcross",
        skips: ["pll"],
        confidence: "high",
        warnings: [],
        initialStateSource: "scramble",
        phaseSchema: "cfop-canonical",
      },
  };
}

describe("derivePhaseTimeStats", () => {
  it("aggregates per-phase time, moves, tps and share across solves", () => {
    const a = metrics({ totalTimeMs: 10000 });
    const b = metrics({
      totalTimeMs: 10000,
      phases: [
        { phaseName: "Cross", durationMs: 2500, moveCount: 8, tps: 3.2, pauseCount: 0, pauseTimeMs: 0 },
        { phaseName: "F2L", durationMs: 4500, moveCount: 24, tps: 5.3, pauseCount: 1, pauseTimeMs: 200 },
        { phaseName: "OLL", durationMs: 1500, moveCount: 8, tps: 5.33, pauseCount: 0, pauseTimeMs: 0 },
        { phaseName: "PLL", durationMs: 1500, moveCount: 10, tps: 6.67, pauseCount: 0, pauseTimeMs: 0 },
      ],
    });
    const out = derivePhaseTimeStats([a, b]);

    const cross = out.find((p) => p.phaseName === "Cross");
    expect(cross).toBeDefined();
    expect(cross!.count).toBe(2);
    expect(cross!.avgMs).toBe(2000); // (1500 + 2500)/2
    expect(cross!.p25Ms).toBe(1500);
    expect(cross!.p75Ms).toBe(2500);
    expect(cross!.avgMoves).toBe(7);
    expect(cross!.avgTps).toBeCloseTo(3.6, 5);
    expect(cross!.avgSharePct).toBeCloseTo(20, 5); // (15 + 25)/2

    const oll = out.find((p) => p.phaseName === "OLL");
    expect(oll!.avgRecognitionMs).toBe(600); // only solve a has recognitionMs (b has none)
    expect(oll!.recognitionRatio).toBeCloseTo(600 / 1500, 5);
  });

  it("skips skipped phases and returns [] on no analyses", () => {
    const skipped = metrics();
    skipped.phases = skipped.phases.map((p) =>
      p.phaseName === "F2L" ? { ...p, skipped: true } : p,
    );
    const out = derivePhaseTimeStats([skipped]);
    expect(out.find((p) => p.phaseName === "F2L")).toBeUndefined();
    expect(out.length).toBe(3);
    expect(derivePhaseTimeStats([])).toEqual([]);
    expect(derivePhaseTimeStats([null, undefined])).toEqual([]);
  });
});

describe("deriveEconomyStats", () => {
  it("averages moves, efficiency, and sums waste", () => {
    const a = metrics({ totalMoves: 50 });
    const b = metrics({
      totalMoves: 46,
      efficiency: {
        moveEfficiencyRatio: 1.15,
        optimalMoveCount: 40,
        redundancies: 1,
        cancellations: 0,
        overturns: 1,
        forwardDrift: 0.05,
      },
    });
    const out = deriveEconomyStats([a, b]);
    expect(out.count).toBe(2);
    expect(out.avgMoves).toBe(48);
    expect(out.avgEfficiencyRatio).toBeCloseTo(1.2, 5);
    expect(out.redundanciesTotal).toBe(3); // 2 + 1
    expect(out.cancellationsTotal).toBe(1);
    expect(out.overturnsTotal).toBe(2);
  });
});

describe("deriveRotationStats", () => {
  it("returns rotations per solve, per pair, and without-rotation %", () => {
    const a = metrics(); // 4 rotations, F2L 3, redundant 2, 4 pairs
    const b = metrics({
      rotation: {
        ...metrics().rotation!,
        totalCount: 0,
        byPhase: {},
        redundantRotations: 0,
        rotationToMoveRatio: 0,
      },
    });
    const out = deriveRotationStats([a, b]);
    expect(out.count).toBe(2);
    expect(out.avgPerSolve).toBe(2);
    expect(out.solvesWithoutRotationPct).toBe(50);
    expect(out.redundantRotationsTotal).toBe(2);
    // F2L rotations total 3 across solve a → avg per pair = 3 / 8 pairs total.
    expect(out.avgPerPair).toBeCloseTo(3 / 8, 5);
    expect(out.byPhase.F2L).toBe(3);
  });
});

describe("deriveLookaheadStats", () => {
  it("averages pauses, cross→F2L, lookahead score, pacing", () => {
    const a = metrics();
    const out = deriveLookaheadStats([a]);
    expect(out.avgPauseCount).toBe(2);
    expect(out.avgPauseRatio).toBe(0.04);
    expect(out.avgCrossToF2LMs).toBe(700);
    expect(out.avgLookaheadScore).toBe(0.72);
    expect(out.avgPeakTps).toBe(9);
    expect(out.burstsTotal).toBe(2);
    expect(out.maxPauseTimeMs).toBe(400);
  });
});

describe("deriveCrossStats", () => {
  it("tracks cross efficiency, xcross rate and LL skips", () => {
    const a = metrics(); // crossType xcross, skips ['pll']
    const b = metrics({ detectionReport: { ...metrics().detectionReport!, crossType: "plain", skips: [] } });
    const out = deriveCrossStats([a, b]);
    expect(out.count).toBe(2);
    expect(out.avgCrossMoves).toBe(7);
    expect(out.xcrossCount).toBe(1);
    expect(out.xcrossPct).toBe(50);
    expect(out.skips.pll).toBe(1);
    expect(out.skips.oll).toBe(0);
  });
});

describe("deriveRecognitionCosts", () => {
  it("computes recognition/execution shares for OLL and PLL", () => {
    const out = deriveRecognitionCosts([metrics(), metrics()]);
    const oll = out.find((r) => r.phase === "OLL");
    const pll = out.find((r) => r.phase === "PLL");
    expect(oll!.avgRecognitionMs).toBe(600);
    expect(oll!.avgExecutionMs).toBe(900);
    expect(oll!.recognitionShare).toBeCloseTo(600 / 1500, 5);
    expect(pll!.recognitionShare).toBeCloseTo(950 / 2000, 5);
  });
});

describe("deriveSessionTechnicalStats", () => {
  it("combines everything and counts analysed solves", () => {
    const out = deriveSessionTechnicalStats([metrics(), metrics(), null, { analysis: undefined }]);
    expect(out.counts.total).toBe(3); // the null record is excluded
    expect(out.counts.analysed).toBe(2);
    expect(out.phases.length).toBe(4);
    expect(out.economy.count).toBe(2);
    expect(out.rotations.count).toBe(2);
  });
});

describe("deriveMoveMetrics", () => {
  const face = (i: number) => (["R", "U", "F", "D", "L", "B"] as const)[i % 6];

  it("computes face frequency, doubles, and pacing from timestamps", () => {
    // 6 moves, 100 ms apart, starting at 1000. Two doubles (R2 at 0 and 5).
    const moves = Array.from({ length: 6 }, (_, i) => ({
      face: face(i),
      direction: i === 0 || i === 5 ? (2 as const) : (1 as const),
      cubeTimestamp: i * 100,
      hostTimestamp: 1000 + i * 100,
    }));
    const out = deriveMoveMetrics(moves);

    expect(out.count).toBe(6);
    expect(out.durationMs).toBe(500);
    expect(out.tps).toBeCloseTo(12, 5); // 6 / 0.5s
    // Each face appears once → 1/6 each.
    expect(out.facePct.R).toBeCloseTo(100 / 6, 5);
    expect(out.dominantFace).toBe("R");
    // Doubles at indices 0 and 5 → 2/6.
    expect(out.doublesPct).toBeCloseTo(100 / 3, 5);
    // Consecutive faces: 6 distinct faces in order → 0.
    expect(out.consecutiveSameFace).toBe(0);
    expect(out.gapMeanMs).toBe(100);
    expect(out.gapStdMs).toBe(0);
    expect(out.gapMaxMs).toBe(100);
  });

  it("counts consecutive same-face moves and wide/slice moves", () => {
    const moves = [
      { face: "R" as const, direction: 1 as const, cubeTimestamp: 0, hostTimestamp: 1000 },
      { face: "R" as const, direction: -1 as const, cubeTimestamp: 1, hostTimestamp: 1200 },
      { face: "U" as const, direction: 2 as const, cubeTimestamp: 2, hostTimestamp: 1400 },
      { face: "b" as const, direction: 1 as const, cubeTimestamp: 3, hostTimestamp: 1600 },
    ];
    const out = deriveMoveMetrics(moves as never);
    expect(out.consecutiveSameFace).toBe(1); // R then R
    expect(out.wideCount).toBe(0);
    expect(out.gapMeanMs).toBe(200);
  });

  it("returns zeros/empty for no moves", () => {
    const out = deriveMoveMetrics([]);
    expect(out.count).toBe(0);
    expect(out.dominantFace).toBeNull();
    expect(out.gapMeanMs).toBeNull();
    expect(out.faceFreq).toEqual({});
    expect(deriveMoveMetrics(undefined).count).toBe(0);
  });
});

describe("deriveCaseIntelligence", () => {
  it("aggregates F2L/OLL/PLL case frequency and averages", () => {
    // Solve A: F2L cases Pj (x2) and Jm (x1). Solve B: Jm again.
    const a = metrics();
    a.cfop!.f2lPairs = [
      { pairNumber: 1, slotId: "FR", timeMs: 1000, moves: 6, tps: 6, recognitionMs: 0, detectedCase: { caseNumber: "F2L 39", caseName: "Pj", confidence: "exact" } },
      { pairNumber: 2, slotId: "FL", timeMs: 1200, moves: 7, tps: 5.8, recognitionMs: 0, detectedCase: { caseNumber: "F2L 39", caseName: "Pj", confidence: "exact" } },
      { pairNumber: 3, slotId: "BR", timeMs: 800, moves: 5, tps: 6, recognitionMs: 0, detectedCase: { caseNumber: "F2L 2", caseName: "Jm", confidence: "exact" } },
    ];
    const b = metrics();
    b.cfop!.f2lPairs = [
      { pairNumber: 1, slotId: "FR", timeMs: 1100, moves: 6, tps: 5.5, recognitionMs: 0, detectedCase: { caseNumber: "F2L 2", caseName: "Jm", confidence: "exact" } },
    ];

    const out = deriveCaseIntelligence([a, b]);
    const pj = out.find((c) => c.caseName === "Pj");
    const jm = out.find((c) => c.caseName === "Jm");

    expect(pj!.phase).toBe("F2L");
    expect(pj!.count).toBe(2);
    expect(pj!.avgTimeMs).toBe(1100); // (1000 + 1200) / 2
    expect(pj!.avgMoves).toBe(6.5);

    expect(jm!.count).toBe(2);
    expect(jm!.avgTimeMs).toBe(950); // (800 + 1100) / 2

    // OLL + PLL cases from the default fixture are also aggregated.
    expect(out.some((c) => c.phase === "OLL")).toBe(true);
    expect(out.some((c) => c.phase === "PLL")).toBe(true);
    expect(out.some((c) => c.phase === "PLL" && c.caseName === "Ta")).toBe(true);
  });

  it("ignores pairs with no recognized case", () => {
    const a = metrics();
    a.cfop!.f2lPairs = [
      { pairNumber: 1, slotId: "FR", timeMs: 1000, moves: 6, tps: 6, recognitionMs: 0 },
    ];
    const out = deriveCaseIntelligence([a]);
    expect(out.some((c) => c.phase === "F2L" && c.count > 0)).toBe(false);
  });
});