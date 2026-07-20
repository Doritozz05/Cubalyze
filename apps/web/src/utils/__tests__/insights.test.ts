import { describe, it, expect } from "vitest";
import {
  deriveSparkline,
  deriveHistogram,
  deriveActivityHeatmap,
  deriveTpsSeries,
  derivePhaseDistribution,
  derivePauseCause,
  deriveAvgTime,
  deriveTimeline,
} from "../insights";
import type { Solve } from "@/types";
import type {
  CubeMoveEvent,
  PauseDetail,
  PhaseMetrics,
  SolveMetrics,
} from "@cubeforge/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSolve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: "s1",
    time: 12_000,
    penalty: "none",
    scramble: "R U R' U'",
    timestamp: Date.now(),
    method: "CFOP",
    source: "smart",
    ...overrides,
  };
}

function makeMove(face: string, hostTs: number, direction: 1 | -1 | 2 = 1): CubeMoveEvent {
  return { face: face as CubeMoveEvent["face"], direction, cubeTimestamp: hostTs, hostTimestamp: hostTs };
}

function makeMetrics(overrides: Partial<SolveMetrics> = {}): SolveMetrics {
  return {
    solveId: "s1",
    totalTimeMs: 12_000,
    totalMoves: 50,
    phases: [
      { phaseName: "Cross", durationMs: 2000, moveCount: 8, tps: 4, pauseCount: 0, pauseTimeMs: 0 },
      { phaseName: "F2L", durationMs: 6000, moveCount: 29, tps: 4.8, pauseCount: 2, pauseTimeMs: 500 },
      { phaseName: "OLL", durationMs: 1500, moveCount: 9, tps: 6, pauseCount: 1, pauseTimeMs: 300 },
      { phaseName: "PLL", durationMs: 2500, moveCount: 13, tps: 5.2, pauseCount: 0, pauseTimeMs: 0 },
    ],
    tps: { global: 4.1, effective: 4.5, byPhase: {}, peakInstantaneous: 7.2 },
    pauses: {
      totalCount: 3,
      maxDurationMs: 400,
      avgDurationMs: 200,
      byPhase: {},
      totalPauseTimeMs: 800,
      pauseRatio: 0.06,
      pauses: [],
    },
    fluidity: {
      stdDevMs: 30,
      coefficientOfVariation: 0.25,
      byPhase: {},
      burstCount: 5,
      accelerationCount: 3,
      decelerationCount: 2,
    },
    ...overrides,
  };
}

// ─── deriveSparkline ────────────────────────────────────────────────────────

describe("deriveSparkline", () => {
  it("returns effective times excluding DNFs", () => {
    const solves = [
      makeSolve({ id: "1", time: 10_000, penalty: "none" }),
      makeSolve({ id: "2", time: 12_000, penalty: "+2" }), // 14_000 effective
      makeSolve({ id: "3", time: 11_000, penalty: "DNF" }), // excluded
    ];
    expect(deriveSparkline(solves)).toEqual([10_000, 14_000]);
  });

  it("limits to last N", () => {
    const solves = Array.from({ length: 30 }, (_, i) =>
      makeSolve({ id: `${i}`, time: 10_000 + i * 100 }),
    );
    const result = deriveSparkline(solves, 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(10_000 + 25 * 100);
  });

  it("returns empty for all-DNF", () => {
    const solves = [makeSolve({ penalty: "DNF" }), makeSolve({ penalty: "DNF" })];
    expect(deriveSparkline(solves)).toEqual([]);
  });
});

// ─── deriveHistogram ────────────────────────────────────────────────────────

describe("deriveHistogram", () => {
  it("bins solve times into 0.5s buckets", () => {
    const solves = [
      makeSolve({ id: "1", time: 10_100 }),
      makeSolve({ id: "2", time: 10_400 }),
      makeSolve({ id: "3", time: 11_200 }),
      makeSolve({ id: "4", time: 11_800 }),
    ];
    const bins = deriveHistogram(solves, 500);
    expect(bins.length).toBeGreaterThanOrEqual(4);
    // First bin (10.0–10.5) should have 2 solves.
    const first = bins.find((b) => b.fromMs <= 10_100 && b.toMs > 10_100);
    expect(first?.count).toBe(2);
  });

  it("excludes DNFs", () => {
    const solves = [makeSolve({ time: 10_000 }), makeSolve({ penalty: "DNF" })];
    const bins = deriveHistogram(solves);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });

  it("returns empty for no valid solves", () => {
    expect(deriveHistogram([makeSolve({ penalty: "DNF" })])).toEqual([]);
    expect(deriveHistogram([])).toEqual([]);
  });
});

// ─── deriveActivityHeatmap ──────────────────────────────────────────────────

describe("deriveActivityHeatmap", () => {
  it("returns weeks*7 entries", () => {
    const counts = deriveActivityHeatmap([], 12);
    expect(counts).toHaveLength(84);
    expect(counts.every((c) => c === 0)).toBe(true);
  });

  it("counts solves in the right day", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const solves = [makeSolve({ timestamp: today.getTime() })];
    const weeks = 2;
    const counts = deriveActivityHeatmap(solves, weeks);
    // The grid is aligned to Monday. Today's index = days since startMonday.
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const startMonday = new Date(monday);
    startMonday.setDate(monday.getDate() - (weeks - 1) * 7);
    const dayDiff = Math.floor(
      (today.getTime() - startMonday.getTime()) / 86_400_000,
    );
    expect(counts[dayDiff]).toBe(1);
  });
});

// ─── deriveTpsSeries ────────────────────────────────────────────────────────

describe("deriveTpsSeries", () => {
  it("returns one point per solve, oldest first, NaN for no analysis", () => {
    const solves = [
      makeSolve({ id: "old", time: 15_000, analysis: makeMetrics({ tps: { global: 3, effective: 3, byPhase: {}, peakInstantaneous: 5 } }) }),
      makeSolve({ id: "new", time: 10_000 }), // no analysis → NaN
    ];
    // Input is newest-first; output is oldest-first.
    const series = deriveTpsSeries(solves);
    expect(series).toHaveLength(2);
    expect(series[0].tps).toBeNaN(); // "new" is oldest here? No — "old" is index 0 in input.
    // Actually: input [old, new], reversed → [new, old]. So series[0] = new (NaN), series[1] = old (3).
    expect(series[0].solveIdx).toBe(0);
    expect(series[1].tps).toBe(3);
  });
});

// ─── derivePhaseDistribution ────────────────────────────────────────────────

describe("derivePhaseDistribution", () => {
  it("averages phase shares across analysed solves", () => {
    const m1 = makeMetrics();
    const solves = [
      makeSolve({ id: "1", analysis: m1 }),
      makeSolve({ id: "2", analysis: m1 }),
    ];
    const dist = derivePhaseDistribution(solves);
    expect(dist).toHaveLength(4);
    // Shares sum to ~1.
    const totalShare = dist.reduce((s, d) => s + d.share, 0);
    expect(totalShare).toBeCloseTo(1, 1);
  });

  it("returns empty when no analysed solves", () => {
    expect(derivePhaseDistribution([makeSolve()])).toEqual([]);
  });
});

// ─── derivePauseCause ───────────────────────────────────────────────────────

describe("derivePauseCause", () => {
  const phases: PhaseMetrics[] = [
    { phaseName: "Cross", durationMs: 2000, moveCount: 8, tps: 4, pauseCount: 0, pauseTimeMs: 0 },
    { phaseName: "F2L", durationMs: 6000, moveCount: 29, tps: 4.8, pauseCount: 2, pauseTimeMs: 500 },
    { phaseName: "OLL", durationMs: 1500, moveCount: 9, tps: 6, pauseCount: 1, pauseTimeMs: 300 },
    { phaseName: "PLL", durationMs: 2500, moveCount: 13, tps: 5.2, pauseCount: 0, pauseTimeMs: 0 },
  ];

  it("recognizes transition pauses", () => {
    const p: PauseDetail = { startIndex: 7, endIndex: 8, durationMs: 200, phase: "Cross", category: "transition" };
    expect(derivePauseCause(p, phases)).toContain("transition");
    expect(derivePauseCause(p, phases)).toContain("F2L");
  });

  it("recognizes OLL pre-algorithm recognition", () => {
    const p: PauseDetail = { startIndex: 35, endIndex: 36, durationMs: 300, phase: "OLL", category: "pre-algorithm" };
    expect(derivePauseCause(p, phases)).toBe("OLL recognition");
  });

  it("recognizes F2L mid-phase pair search", () => {
    const p: PauseDetail = { startIndex: 15, endIndex: 16, durationMs: 250, phase: "F2L", category: "mid-phase" };
    expect(derivePauseCause(p, phases)).toBe("F2L pair recognition");
  });
});

// ─── deriveAvgTime ──────────────────────────────────────────────────────────

describe("deriveAvgTime", () => {
  it("averages effective times excluding DNF", () => {
    const solves = [
      makeSolve({ id: "1", time: 10_000 }),
      makeSolve({ id: "2", time: 14_000, penalty: "+2" }), // 16_000
      makeSolve({ id: "3", penalty: "DNF" }), // excluded
    ];
    expect(deriveAvgTime(solves)).toBe((10_000 + 16_000) / 2);
  });

  it("returns null for no valid solves", () => {
    expect(deriveAvgTime([makeSolve({ penalty: "DNF" })])).toBeNull();
    expect(deriveAvgTime([])).toBeNull();
  });
});

// ─── deriveTimeline ─────────────────────────────────────────────────────────

describe("deriveTimeline", () => {
  it("derives move ticks with offsets from raw moves", () => {
    const base = 1000;
    const solve = makeSolve({
      moves: [
        makeMove("R", base),
        makeMove("U", base + 200),
        makeMove("R", base + 400, 2), // face "R" + direction 2 → label "R2"
      ],
    });
    const tl = deriveTimeline(solve);
    expect(tl.moveTicks).toHaveLength(3);
    expect(tl.moveTicks[0].offsetMs).toBe(0);
    expect(tl.moveTicks[1].offsetMs).toBe(200);
    expect(tl.moveTicks[2].label).toBe("R2");
  });

  it("computes rolling TPS from timestamps when no analysis window", () => {
    const base = 1000;
    const solve = makeSolve({
      // totalMs === move span so no 0-TPS tail is appended (lets us assert
      // on the last REAL rolling sample).
      time: 1000,
      moves: [
        makeMove("R", base),
        makeMove("U", base + 250),
        makeMove("R", base + 500),
        makeMove("U", base + 750),
        makeMove("R", base + 1000),
      ],
    });
    const tl = deriveTimeline(solve);
    expect(tl.tpsSamples.length).toBeGreaterThan(0);
    // Rolling window of 4: last sample covers moves[1..4] spanning 750ms →
    // TPS = 4/0.75s ≈ 5.33.
    expect(tl.tpsSamples[tl.tpsSamples.length - 1].tps).toBeCloseTo(5.33, 0);
  });

  it("builds stage segments from analysis phases (falls back to cumulative durationMs when no moves)", () => {
    const solve = makeSolve({ analysis: makeMetrics() });
    const tl = deriveTimeline(solve);
    expect(tl.stageSegments).toHaveLength(4);
    expect(tl.stageSegments[0].phaseName).toBe("Cross");
    expect(tl.stageSegments[0].startMs).toBe(0);
    expect(tl.stageSegments[1].startMs).toBe(2000); // Cross durationMs
  });

  it("annotates pause marks with probable cause", () => {
    const metrics = makeMetrics({
      pauses: {
        totalCount: 1,
        maxDurationMs: 300,
        avgDurationMs: 300,
        byPhase: {},
        totalPauseTimeMs: 300,
        pauseRatio: 0.025,
        pauses: [
          { startIndex: 35, endIndex: 36, durationMs: 300, phase: "OLL", category: "pre-algorithm" },
        ],
      },
    });
    const solve = makeSolve({
      moves: Array.from({ length: 50 }, (_, i) => makeMove("R", 1000 + i * 200)),
      analysis: metrics,
    });
    const tl = deriveTimeline(solve);
    expect(tl.pauseMarks).toHaveLength(1);
    expect(tl.pauseMarks[0].probableCause).toBe("OLL recognition");
  });

  it("handles solve with no moves and no analysis", () => {
    const tl = deriveTimeline(makeSolve({ moves: undefined, analysis: undefined }));
    expect(tl.moveTicks).toEqual([]);
    // No move data → a flat 0-TPS baseline spanning [0, totalMs].
    expect(tl.tpsSamples).toEqual([
      { offsetMs: 0, tps: 0 },
      { offsetMs: 12_000, tps: 0 },
    ]);
    expect(tl.stageSegments).toEqual([]);
    expect(tl.pauseMarks).toEqual([]);
    // No phases → no segments (no "Stop"/tail block anymore).
    expect(tl.segments).toEqual([]);
    expect(tl.totalMs).toBe(12_000); // falls back to solve.time
  });

  it("totalMs = move span (last move − first move), not solve.time", () => {
    // Moves span only the first 10s; solve.time is 12s. totalMs must be
    // the move span (10000), NOT solve.time (12000) — the post-last-move
    // stop reaction is NOT part of the timeline.
    const base = 1000;
    const solve = makeSolve({
      time: 12_000,
      moves: Array.from({ length: 50 }, (_, i) => makeMove("R", base + i * 200)), // span 9800ms
      analysis: makeMetrics({
        totalTimeMs: 12_000, // pipeline reports timer time; we override with move span
        tps: { global: 4.1, effective: 4.5, byPhase: {}, peakInstantaneous: 7.2 },
      }),
    });
    const tl = deriveTimeline(solve);
    const lastMoveOffset = solve.moves![solve.moves!.length - 1].hostTimestamp - base;
    expect(tl.totalMs).toBe(lastMoveOffset);
    expect(tl.totalMs).not.toBe(12_000);
  });

  it("segments tile the timeline: Σ durationMs === totalMs (no tail block)", () => {
    const metrics = makeMetrics();
    const solve = makeSolve({
      moves: Array.from({ length: 50 }, (_, i) => makeMove("R", 1000 + i * 200)),
      analysis: metrics,
    });
    const tl = deriveTimeline(solve);
    expect(tl.segments.length).toBeGreaterThan(0);
    // No "tail"/"Stop" block should exist anymore.
    expect(tl.segments.every((s) => s.kind !== "tail")).toBe(true);
    const sum = tl.segments.reduce((s, seg) => s + seg.durationMs, 0);
    expect(sum).toBeCloseTo(tl.totalMs, 0);
    // First segment starts at 0; last ends at totalMs (= last move offset).
    expect(tl.segments[0].startMs).toBe(0);
    expect(tl.segments[tl.segments.length - 1].endMs).toBe(tl.totalMs);
  });

  it("segments use REAL move coordinates — transition pause lives between phases", () => {
    // Moves: 50 @ 200ms apart → move index N → offset N*200ms.
    // phaseForMove assigns by cumulative moveCount: Cross 8, F2L 29, OLL 9, PLL 13.
    //   Cross = indices 0-7  → offsets [0, 1400]
    //   F2L  = indices 8-36  → offsets [1600, 7200]
    //   OLL  = indices 37-45 → offsets [7400, 9000]
    //   PLL  = indices 46-49 → offsets [9200, 9800]
    // A transition pause between Cross and F2L: startIndex=7 (last Cross move),
    // endIndex=8 (first F2L move). Its gap = offset[8] - offset[7] = 200ms.
    // It must appear as a PAUSE block in the inter-phase gap [1400, 1600],
    // NOT inside the Cross block. The Cross block must END at 1400, and the
    // F2L block must START at 1600 (after the pause).
    const metrics = makeMetrics({
      pauses: {
        totalCount: 1,
        maxDurationMs: 200,
        avgDurationMs: 200,
        byPhase: {},
        totalPauseTimeMs: 200,
        pauseRatio: 0.02,
        pauses: [
          { startIndex: 7, endIndex: 8, durationMs: 200, phase: "Cross", category: "transition" },
        ],
      },
    });
    const solve = makeSolve({
      moves: Array.from({ length: 50 }, (_, i) => makeMove("R", 1000 + i * 200)),
      analysis: metrics,
    });
    const tl = deriveTimeline(solve);
    const pauseSegs = tl.segments.filter((s) => s.kind === "pause");
    expect(pauseSegs).toHaveLength(1);
    expect(pauseSegs[0].pauseCategory).toBe("transition");
    expect(pauseSegs[0].phaseName).toBe("Cross");
    // The pause must be at the inter-phase gap [1400, 1600], not inside Cross.
    expect(pauseSegs[0].startMs).toBe(1400); // offset of last Cross move
    expect(pauseSegs[0].endMs).toBe(1600); // offset of first F2L move
    // P1.b — pause segments carry move indices for the adjacent-moves popover.
    expect(pauseSegs[0].moveStartIndex).toBe(7); // last Cross move
    expect(pauseSegs[0].moveEndIndex).toBe(8); // first F2L move
    // The Cross phase block must end at 1400 (the pause's start), and the
    // F2L phase block must start at 1600 (the pause's end). This is the key
    // fix: the transition pause is BETWEEN the phases, not inside Cross.
    const crossSegs = tl.segments.filter((s) => s.phaseName === "Cross" && s.kind === "phase");
    const f2lSegs = tl.segments.filter((s) => s.phaseName === "F2L" && s.kind === "phase");
    expect(crossSegs.length).toBeGreaterThan(0);
    expect(f2lSegs.length).toBeGreaterThan(0);
    expect(crossSegs[crossSegs.length - 1].endMs).toBe(1400);
    expect(f2lSegs[0].startMs).toBe(1600);
    // Σ still equals totalMs.
    const sum = tl.segments.reduce((s, seg) => s + seg.durationMs, 0);
    expect(sum).toBeCloseTo(tl.totalMs, 0);
  });

  it("mid-phase pause splits a phase into exec sub-blocks", () => {
    // F2L = indices 8-36 (offsets 1600→7200). A mid-phase pause at
    // startIndex=15, endIndex=16 (offset 3000→3200) splits F2L into
    // [exec 1600-3000][pause 3000-3200][exec 3200-7400].
    //
    // The trailing exec sub-block ends at 7400 (NOT 7200) because there's
    // no detected boundary pause between F2L and OLL — so the inter-phase
    // gap [7200, 7400] (last F2L move → first OLL move) is absorbed into
    // F2L's last exec block. This is the gap-absorption rule that keeps
    // Σ segments === totalMs without inventing a gap block type.
    const metrics = makeMetrics({
      pauses: {
        totalCount: 1,
        maxDurationMs: 200,
        avgDurationMs: 200,
        byPhase: {},
        totalPauseTimeMs: 200,
        pauseRatio: 0.02,
        pauses: [
          { startIndex: 15, endIndex: 16, durationMs: 200, phase: "F2L", category: "mid-phase" },
        ],
      },
    });
    const solve = makeSolve({
      moves: Array.from({ length: 50 }, (_, i) => makeMove("R", 1000 + i * 200)),
      analysis: metrics,
    });
    const tl = deriveTimeline(solve);
    const f2lSegs = tl.segments.filter((s) => s.phaseName === "F2L");
    expect(f2lSegs).toHaveLength(3); // exec + pause + exec
    expect(f2lSegs[0].kind).toBe("phase");
    expect(f2lSegs[0].startMs).toBe(1600);
    expect(f2lSegs[0].endMs).toBe(3000);
    expect(f2lSegs[1].kind).toBe("pause");
    expect(f2lSegs[1].startMs).toBe(3000);
    expect(f2lSegs[1].endMs).toBe(3200);
    expect(f2lSegs[2].kind).toBe("phase");
    expect(f2lSegs[2].startMs).toBe(3200);
    // Ends at 7400 = first OLL move offset (gap-absorption), not 7200.
    expect(f2lSegs[2].endMs).toBe(7400);
    // Contiguity: OLL's first block starts exactly where F2L's last ends.
    // No visual gap between segments — this is the gap-absorption contract.
    const ollSegs = tl.segments.filter((s) => s.phaseName === "OLL");
    expect(ollSegs[0].startMs).toBe(7400);
    const sum = tl.segments.reduce((s, seg) => s + seg.durationMs, 0);
    expect(sum).toBeCloseTo(tl.totalMs, 0);
  });
});
