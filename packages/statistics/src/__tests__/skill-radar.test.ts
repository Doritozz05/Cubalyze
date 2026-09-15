import { describe, it, expect } from "vitest";
import { deriveSkillRadarProfile } from "../technical";
import type { SolveMetrics } from "@cubalyze/types";

describe("deriveSkillRadarProfile", () => {
  it("returns zeroed axes and empty profile when no solves or analysis are present", () => {
    const profile = deriveSkillRadarProfile([]);
    expect(profile.analysedCount).toBe(0);
    expect(profile.overallScore).toBe(0);
    expect(profile.axes).toHaveLength(6);
    expect(profile.primaryStrength).toBeNull();
    expect(profile.primaryBottleneck).toBeNull();
    for (const axis of profile.axes) {
      expect(axis.score).toBe(0);
      expect(axis.formattedValue).toBe("—");
    }
  });

  it("computes high scores for an elite solve with high TPS, minimal pauses, low moves and 0 rotations", () => {
    const eliteSolve: SolveMetrics = {
      solveId: "elite-1",
      totalTimeMs: 6500,
      totalMoves: 45,
      phases: [
        { phaseName: "Cross", durationMs: 700, moveCount: 5, tps: 7.1, pauseCount: 0, pauseTimeMs: 0 },
        { phaseName: "F2L", durationMs: 3200, moveCount: 22, tps: 6.9, pauseCount: 1, pauseTimeMs: 200 },
        { phaseName: "OLL", durationMs: 1100, moveCount: 8, tps: 7.2, pauseCount: 0, pauseTimeMs: 0, recognitionMs: 250 },
        { phaseName: "PLL", durationMs: 1500, moveCount: 10, tps: 6.7, pauseCount: 0, pauseTimeMs: 0, recognitionMs: 220 },
      ],
      tps: {
        global: 6.92,
        effective: 7.25,
        byPhase: { Cross: 7.1, F2L: 6.9, OLL: 7.2, PLL: 6.7 },
        peakInstantaneous: 9.5,
      },
      pauses: {
        totalCount: 1,
        maxDurationMs: 200,
        avgDurationMs: 200,
        totalPauseTimeMs: 200,
        pauseRatio: 0.03,
        byPhase: { F2L: { count: 1, avgMs: 200 } },
        pauses: [],
      },
      fluidity: {
        stdDevMs: 35,
        coefficientOfVariation: 0.42,
        byPhase: {},
        burstCount: 4,
        accelerationCount: 2,
        decelerationCount: 1,
      },
      efficiency: {
        moveEfficiencyRatio: 1.1,
        optimalMoveCount: 41,
        redundancies: 0,
        cancellations: 0,
        overturns: 0,
        forwardDrift: 0.95,
      },
      rotation: {
        totalCount: 0,
        byAxis: { x: 0, y: 0, z: 0 },
        estimatedRotationTimeMs: 0,
        consecutiveCount: 0,
        byPhase: { Cross: 0, F2L: 0, OLL: 0, PLL: 0 },
        rotationToMoveRatio: 0,
        redundantRotations: 0,
      },
    };

    const profile = deriveSkillRadarProfile(eliteSolve);
    expect(profile.analysedCount).toBe(1);
    expect(profile.overallScore).toBeGreaterThanOrEqual(75);

    const tpsAxis = profile.axes.find((a) => a.id === "tps");
    const lookaheadAxis = profile.axes.find((a) => a.id === "lookahead");
    const ergonomicsAxis = profile.axes.find((a) => a.id === "ergonomics");
    const economyAxis = profile.axes.find((a) => a.id === "economy");

    expect(tpsAxis?.score).toBeGreaterThanOrEqual(80);
    expect(lookaheadAxis?.score).toBeGreaterThanOrEqual(80);
    expect(ergonomicsAxis?.score).toBe(100);
    expect(economyAxis?.score).toBeGreaterThanOrEqual(75);
    expect(profile.primaryStrength).not.toBeNull();
  });

  it("identifies bottlenecks correctly when a solve has high pauses and excessive rotations", () => {
    const strugglingSolve: SolveMetrics = {
      solveId: "struggling-1",
      totalTimeMs: 28000,
      totalMoves: 82,
      phases: [
        { phaseName: "Cross", durationMs: 4500, moveCount: 10, tps: 2.2, pauseCount: 2, pauseTimeMs: 2000 },
        { phaseName: "F2L", durationMs: 16000, moveCount: 44, tps: 2.75, pauseCount: 5, pauseTimeMs: 8500 },
        { phaseName: "OLL", durationMs: 3500, moveCount: 12, tps: 3.4, pauseCount: 1, pauseTimeMs: 1200, recognitionMs: 1400 },
        { phaseName: "PLL", durationMs: 4000, moveCount: 16, tps: 4.0, pauseCount: 1, pauseTimeMs: 1100, recognitionMs: 1500 },
      ],
      tps: {
        global: 2.92,
        effective: 3.2,
        byPhase: {},
        peakInstantaneous: 4.5,
      },
      pauses: {
        totalCount: 9,
        maxDurationMs: 2400,
        avgDurationMs: 1420,
        totalPauseTimeMs: 12800,
        pauseRatio: 0.46,
        byPhase: {},
        pauses: [],
      },
      fluidity: {
        stdDevMs: 280,
        coefficientOfVariation: 1.35,
        byPhase: {},
        burstCount: 1,
        accelerationCount: 1,
        decelerationCount: 7,
      },
      efficiency: {
        moveEfficiencyRatio: 1.75,
        optimalMoveCount: 47,
        redundancies: 4,
        cancellations: 2,
        overturns: 3,
        forwardDrift: 0.65,
      },
      rotation: {
        totalCount: 22,
        byAxis: { x: 4, y: 16, z: 2 },
        estimatedRotationTimeMs: 2100,
        consecutiveCount: 2,
        byPhase: { Cross: 1, F2L: 5, OLL: 0, PLL: 1 },
        rotationToMoveRatio: 0.085,
        redundantRotations: 3,
      },
    };

    const profile = deriveSkillRadarProfile(strugglingSolve);
    expect(profile.analysedCount).toBe(1);

    const lookaheadAxis = profile.axes.find((a) => a.id === "lookahead");
    const ergonomicsAxis = profile.axes.find((a) => a.id === "ergonomics");

    expect(lookaheadAxis?.status).toBe("bottleneck");
    expect(ergonomicsAxis?.status).toBe("bottleneck");
    expect(profile.primaryBottleneck).not.toBeNull();
  });

  it("aggregates multiple solves smoothly and measures session consistency", () => {
    const s1: SolveMetrics = {
      solveId: "s-1",
      totalTimeMs: 10000,
      totalMoves: 55,
      phases: [{ phaseName: "Cross", durationMs: 1500, moveCount: 6, tps: 4.0, pauseCount: 0, pauseTimeMs: 0 }],
      tps: { global: 5.5, effective: 5.8, byPhase: {}, peakInstantaneous: 7.0 },
      pauses: { totalCount: 2, maxDurationMs: 600, avgDurationMs: 400, totalPauseTimeMs: 800, pauseRatio: 0.08, byPhase: {}, pauses: [] },
      fluidity: { stdDevMs: 60, coefficientOfVariation: 0.70, byPhase: {}, burstCount: 2, accelerationCount: 1, decelerationCount: 1 },
      rotation: { totalCount: 2, byAxis: { x: 0, y: 2, z: 0 }, estimatedRotationTimeMs: 600, consecutiveCount: 0, byPhase: {}, rotationToMoveRatio: 0.036, redundantRotations: 0 },
    };

    const s2: SolveMetrics = {
      solveId: "s-2",
      totalTimeMs: 11000,
      totalMoves: 60,
      phases: [{ phaseName: "Cross", durationMs: 1800, moveCount: 7, tps: 3.9, pauseCount: 0, pauseTimeMs: 0 }],
      tps: { global: 5.0, effective: 5.4, byPhase: {}, peakInstantaneous: 6.8 },
      pauses: { totalCount: 3, maxDurationMs: 800, avgDurationMs: 500, totalPauseTimeMs: 1500, pauseRatio: 0.125, byPhase: {}, pauses: [] },
      fluidity: { stdDevMs: 75, coefficientOfVariation: 0.78, byPhase: {}, burstCount: 1, accelerationCount: 1, decelerationCount: 2 },
      rotation: { totalCount: 3, byAxis: { x: 0, y: 3, z: 0 }, estimatedRotationTimeMs: 900, consecutiveCount: 1, byPhase: {}, rotationToMoveRatio: 0.05, redundantRotations: 1 },
    };

    const profile = deriveSkillRadarProfile([s1, s2]);
    expect(profile.analysedCount).toBe(2);
    expect(profile.overallScore).toBeGreaterThanOrEqual(60);
    expect(profile.axes).toHaveLength(6);

    const consistencyAxis = profile.axes.find((a) => a.id === "consistency");
    expect(consistencyAxis?.score).toBeGreaterThanOrEqual(70);
    expect(consistencyAxis?.unit).toBe("var");
  });

  it("accurately reports real solve TPS (e.g. 2.71) with permissive scoring", () => {
    const realSolve: SolveMetrics = {
      solveId: "real-1",
      totalTimeMs: 22140,
      totalMoves: 60,
      phases: [
        { phaseName: "Cross", durationMs: 3200, moveCount: 8, tps: 2.5, pauseCount: 1, pauseTimeMs: 1200 },
        { phaseName: "F2L", durationMs: 12500, moveCount: 32, tps: 2.56, pauseCount: 3, pauseTimeMs: 4100 },
        { phaseName: "OLL", durationMs: 2800, moveCount: 9, tps: 3.21, pauseCount: 1, pauseTimeMs: 900, recognitionMs: 650 },
        { phaseName: "PLL", durationMs: 3640, moveCount: 11, tps: 3.02, pauseCount: 1, pauseTimeMs: 800, recognitionMs: 550 },
      ],
      tps: {
        global: 2.71,
        effective: 4.88,
        byPhase: {},
        peakInstantaneous: 5.2,
      },
      pauses: {
        totalCount: 6,
        maxDurationMs: 1600,
        avgDurationMs: 1166,
        totalPauseTimeMs: 7000,
        pauseRatio: 0.316,
        byPhase: {},
        pauses: [],
      },
      fluidity: {
        stdDevMs: 64,
        coefficientOfVariation: 0.74,
        byPhase: {},
        burstCount: 2,
        accelerationCount: 1,
        decelerationCount: 3,
      },
      efficiency: {
        moveEfficiencyRatio: 1.25,
        optimalMoveCount: 48,
        redundancies: 1,
        cancellations: 0,
        overturns: 1,
        forwardDrift: 0.88,
      },
      rotation: {
        totalCount: 3,
        byAxis: { x: 0, y: 3, z: 0 },
        estimatedRotationTimeMs: 900,
        consecutiveCount: 0,
        byPhase: { Cross: 1, F2L: 2, OLL: 0, PLL: 0 },
        rotationToMoveRatio: 0.05,
        redundantRotations: 0,
      },
    };

    const profile = deriveSkillRadarProfile(realSolve);
    const tpsAxis = profile.axes.find((a) => a.id === "tps");
    const economyAxis = profile.axes.find((a) => a.id === "economy");

    expect(tpsAxis?.formattedValue).toBe("2.71");
    expect(tpsAxis?.unit).toBe("TPS");
    expect(tpsAxis?.rawValue).toBe(2.71);
    expect(tpsAxis?.score).toBeGreaterThanOrEqual(45); // Permissive: not 0!
    expect(economyAxis?.score).toBeGreaterThanOrEqual(60); // 60 moves has healthy score
  });

  it("gives healthy ergonomics score for smart cube solves with 12-15 rotations (wide moves/regrips)", () => {
    const smartCubeSolve: SolveMetrics = {
      solveId: "smart-1",
      totalTimeMs: 20000,
      totalMoves: 58,
      phases: [],
      tps: { global: 2.9, effective: 3.5, byPhase: {}, peakInstantaneous: 4.8 },
      pauses: { totalCount: 4, maxDurationMs: 900, avgDurationMs: 600, totalPauseTimeMs: 2400, pauseRatio: 0.12, byPhase: {}, pauses: [] },
      fluidity: { stdDevMs: 50, coefficientOfVariation: 0.6, byPhase: {}, burstCount: 2, accelerationCount: 1, decelerationCount: 1 },
      rotation: {
        totalCount: 14,
        byAxis: { x: 4, y: 8, z: 2 },
        estimatedRotationTimeMs: 2800,
        consecutiveCount: 1,
        byPhase: {},
        rotationToMoveRatio: 0.24,
        redundantRotations: 2,
      },
    };

    const profile = deriveSkillRadarProfile(smartCubeSolve);
    const ergoAxis = profile.axes.find((a) => a.id === "ergonomics");

    expect(ergoAxis?.formattedValue).toBe("14.0");
    expect(ergoAxis?.score).toBeGreaterThanOrEqual(50); // Not 0!
  });

  it("rewards descending times (positive progression/warmup) with high consistency score", () => {
    const s1 = { time: 30000, moves: [] };
    const s2 = { time: 27000, moves: [] };
    const s3 = { time: 24000, moves: [] };
    const s4 = { time: 21000, moves: [] };

    const profile = deriveSkillRadarProfile([s1, s2, s3, s4]);
    const consistencyAxis = profile.axes.find((a) => a.id === "consistency");

    expect(consistencyAxis?.score).toBeGreaterThanOrEqual(80); // High score for steady improvement!
  });

  it("scores user session (36s down to 17.89s) with solid consistency score (> 70) and formatted percent", () => {
    // CubeForge passes newest-first:
    const s4 = { time: 17890, timestamp: 1725277840000, moves: [] }; // newest
    const s3 = { time: 31140, timestamp: 1725277830000, moves: [] };
    const s2 = { time: 20820, timestamp: 1725277820000, moves: [] };
    const s1 = { time: 36130, timestamp: 1725277810000, moves: [] }; // oldest

    const profile = deriveSkillRadarProfile([s4, s3, s2, s1]);
    const consistencyAxis = profile.axes.find((a) => a.id === "consistency");

    expect(consistencyAxis?.score).toBeGreaterThanOrEqual(70);
    expect(consistencyAxis?.formattedValue).not.toBe("—");
    expect(consistencyAxis?.formattedValue).toMatch(/%$/);
  });

  it("produces identical consistency metrics regardless of UI filter sort order", () => {
    const s1 = { time: 36130, timestamp: 1000, moves: [] }; // oldest
    const s2 = { time: 20820, timestamp: 2000, moves: [] };
    const s3 = { time: 31140, timestamp: 3000, moves: [] };
    const s4 = { time: 17890, timestamp: 4000, moves: [] }; // newest

    // Sorted by fastest (17s, 20s, 31s, 36s)
    const sortedFastest = [s4, s2, s3, s1];
    // Sorted by slowest (36s, 31s, 20s, 17s)
    const sortedSlowest = [s1, s3, s2, s4];
    // Random shuffle
    const shuffled = [s3, s1, s4, s2];

    const p1 = deriveSkillRadarProfile(sortedFastest);
    const p2 = deriveSkillRadarProfile(sortedSlowest);
    const p3 = deriveSkillRadarProfile(shuffled);

    const c1 = p1.axes.find((a) => a.id === "consistency");
    const c2 = p2.axes.find((a) => a.id === "consistency");
    const c3 = p3.axes.find((a) => a.id === "consistency");

    expect(c1?.score).toBe(c2?.score);
    expect(c2?.score).toBe(c3?.score);
    expect(c1?.formattedValue).toBe(c2?.formattedValue);
  });
});

