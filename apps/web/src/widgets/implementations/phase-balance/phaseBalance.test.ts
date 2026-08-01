import { describe, expect, it } from "vitest";
import type { SolveMetrics } from "@cubeforge/types";
import type { Solve } from "@/types";
import {
  buildPhaseBalance,
  getComparableSolves,
  getLatestComparableAnalysis,
} from "./phaseBalance";

function makeAnalysis(id: string, scale = 1, proportions = [1000, 4000, 1500, 2000]): SolveMetrics {
  const phases = [
    ["Cross", proportions[0]],
    ["F2L", proportions[1]],
    ["OLL", proportions[2]],
    ["PLL", proportions[3]],
  ] as const;
  return {
    solveId: id,
    totalTimeMs: 8500 * scale,
    totalMoves: 50,
    phases: phases.map(([phaseName, durationMs], index) => ({
      phaseName,
      durationMs: durationMs * scale,
      moveCount: [6, 28, 8, 12][index],
      tps: 4,
      pauseCount: 0,
      pauseTimeMs: 0,
    })),
    detectionReport: {
      method: "CFOP",
      expectedPhases: ["Cross", "F2L", "OLL", "PLL"],
      phases: phases.map(([phaseName, durationMs], index) => ({
        phaseName,
        startIndex: index,
        endIndex: index,
        completionIndex: index,
        startTimestamp: 0,
        endTimestamp: durationMs * scale,
        durationMs: durationMs * scale,
        moveCount: [6, 28, 8, 12][index],
      })),
      complete: true,
      finalStateSolved: true,
      confidence: "high",
      warnings: [],
      initialStateSource: "initial-facelets",
      phaseSchema: "cfop-canonical",
    },
    tps: { global: 5, effective: 5, byPhase: {}, peakInstantaneous: 7 },
    pauses: {
      totalCount: 0,
      maxDurationMs: 0,
      avgDurationMs: 0,
      byPhase: {},
      totalPauseTimeMs: 0,
      pauseRatio: 0,
      pauses: [],
    },
    fluidity: {
      stdDevMs: 0,
      coefficientOfVariation: 0,
      byPhase: {},
      burstCount: 0,
      accelerationCount: 0,
      decelerationCount: 0,
    },
  };
}

function makeSolve(id: string, analysis?: SolveMetrics, penalty: Solve["penalty"] = "none", timestamp = Date.now()): Solve {
  return {
    id,
    time: analysis?.totalTimeMs ?? 9000,
    penalty,
    scramble: "R U",
    timestamp,
    method: "CFOP",
    source: "smart",
    analysis,
  };
}

describe("Phase Balance data", () => {
  it("uses only finite, comparable CFOP solves", () => {
    const valid = makeSolve("valid", makeAnalysis("valid"));
    const legacy = makeSolve("legacy", undefined);
    const dnf = makeSolve("dnf", makeAnalysis("dnf"), "DNF");

    expect(getComparableSolves([valid, legacy, dnf])).toHaveLength(1);
    expect(buildPhaseBalance([valid, legacy, dnf]).analysedSolves).toBe(1);
  });

  it("computes shares from the recent self-baseline and latest deltas", () => {
    const first = makeSolve("first", makeAnalysis("first"));
    const latestAnalysis = makeAnalysis("latest", 2);
    const latest = makeSolve("latest", latestAnalysis);
    const data = buildPhaseBalance([latest, first], latestAnalysis);

    expect(data.analysedSolves).toBe(2);
    expect(data.rows.map((row) => row.phaseName)).toEqual(["Cross", "F2L", "OLL", "PLL"]);
    expect(data.rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1);
    expect(data.rows.every((row) => row.latestDelta !== undefined)).toBe(true);
  });

  it("orders comparable solves by timestamp and averages each solve equally", () => {
    const old = makeSolve("old", makeAnalysis("old"), "none", 100);
    const recent = makeSolve("recent", makeAnalysis("recent", 1, [2000, 3000, 1500, 2000]), "none", 300);
    const middle = makeSolve("middle", makeAnalysis("middle", 2), "none", 200);
    const data = buildPhaseBalance([old, recent, middle], undefined, 2);

    expect(getComparableSolves([old, recent, middle], 2).map(({ solve }) => solve.id))
      .toEqual(["recent", "middle"]);
    // The baseline is the arithmetic mean of each solve's share, not a
    // duration-weighted pool: recent Cross=23.5%, middle Cross=11.8%.
    expect(data.rows[0].share).toBeCloseTo((2000 / 8500 + 1000 / 8500) / 2);
  });

  it("rejects malformed, duplicate-phase, zero-duration, and incoherent analyses", () => {
    const malformed = makeAnalysis("malformed");
    malformed.totalTimeMs = Number.NaN;
    const duplicate = makeAnalysis("duplicate");
    duplicate.phases[3].phaseName = "OLL";
    const zero = makeAnalysis("zero");
    zero.phases = zero.phases.map((phase) => ({ ...phase, durationMs: 0 }));
    const incoherent = makeAnalysis("incoherent");
    incoherent.detectionReport!.phases[0].durationMs += 100;
    const badTps = makeAnalysis("bad-tps");
    badTps.tps.global = Number.NaN;
    const badTimestamp = makeSolve("bad-timestamp", makeAnalysis("bad-timestamp"), "none", Number.NaN);

    const solves = [
      makeSolve("malformed", malformed),
      makeSolve("duplicate", duplicate),
      makeSolve("zero", zero),
      makeSolve("incoherent", incoherent),
      makeSolve("bad-tps", badTps),
      badTimestamp,
    ];
    expect(getComparableSolves(solves)).toHaveLength(0);
  });

  it("does not display a pending analysis belonging to another solve", () => {
    const older = makeSolve("older", makeAnalysis("older"), "none", 100);
    const newest = makeSolve("newest", makeAnalysis("newest"), "none", 200);
    const pendingForOlder = makeAnalysis("older");

    expect(getLatestComparableAnalysis([newest, older], pendingForOlder)?.solveId)
      .toBe("newest");
  });
});
