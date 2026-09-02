/**
 * Demo data seed — generates realistic solve data with full CFOP analysis metrics
 * so the Insights panel can be populated on demand during development.
 *
 * MANUAL-ONLY: this module NEVER seeds automatically. Trigger it from the
 * console via `window.seedDemoData()` (development builds only). Demo solves
 * are written to a dedicated "Demo Session" flagged `is_demo=1` and are
 * excluded from real statistics; `window.clearDemoData()` wipes them.
 */

import type { CubeFace, CubeMoveEvent, OrientationTimeline, SolveMetrics } from "@cubeforge/types";
import { v4 as uuidv4 } from "uuid";
import type { SolvesRepository, SessionsRepository } from "@cubeforge/database";
import { ANALYSIS_PIPELINE_VERSION } from "@cubeforge/analysis-engine";
import { isDev } from "./env";

// ─── Orientation Timeline Generator ───────────────────────────────────────

/**
 * Generate a random orientation timeline for a solve with the given number of moves.
 *
 * A typical CFOP solve has 1-4 whole-cube rotations (y rotations during F2L,
 * occasional x rotations during OLL/PLL recognition). Each rotation moves from
 * one of the 24 orientations to another.
 *
 * @param totalMoves - Total number of moves in the solve
 * @returns An OrientationTimeline
 */
function generateOrientationTimeline(totalMoves: number): OrientationTimeline {
  const timeline: OrientationTimeline = [];

  // Identity orientation at move 0
  timeline.push([0, 0]);

  if (totalMoves < 4) return timeline;

  // Random number of orientation changes: 0-3 for short solves, 1-4 for normal
  const numChanges = totalMoves < 15
    ? Math.floor(Math.random() * 3) // 0-2 for short solves
    : 1 + Math.floor(Math.random() * 3); // 1-3 for normal solves

  if (numChanges === 0) return timeline;

  // Pick random move indices for orientation changes (not too close together)
  const changeIndices: number[] = [];
  for (let attempt = 0; attempt < numChanges * 3; attempt++) {
    const idx = 2 + Math.floor(Math.random() * Math.max(1, totalMoves - 3));
    // Ensure not too close to existing changes (at least 3 moves apart)
    if (changeIndices.every((ci) => Math.abs(ci - idx) >= 3)) {
      changeIndices.push(idx);
      if (changeIndices.length >= numChanges) break;
    }
  }
  changeIndices.sort((a, b) => a - b);

  if (changeIndices.length === 0) return timeline;

  // Pick random orientations for each change (from the 24 available)
  let lastOrientationIndex = 0;
  for (const changeIdx of changeIndices) {
    // Pick a random orientation (0-23) different from current
    let newOrientationIndex: number;
    do {
      newOrientationIndex = Math.floor(Math.random() * 24);
    } while (newOrientationIndex === lastOrientationIndex);

    timeline.push([changeIdx, newOrientationIndex]);
    lastOrientationIndex = newOrientationIndex;
  }

  return timeline;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FACES = ["R", "U", "F", "L", "D", "B"] as const;

/**
 * Compute the inverse of a scramble notation string.
 * The CORRECT mathematical inverse of a move sequence:
 *   1) REVERSE the order of moves
 *   2) Invert each move in place
 *
 * e.g. "R U R' U'" → "U R U' R'" (NOT "R' U' R U"!)
 *
 * Without the reversal, applying the "inverse" after the scramble does NOT
 * return the cube to solved state — the replay ends with a scrambled cube
 * and the analysis pipeline cannot detect phases.
 *
 * Root cause of "seed solves never end solved" — FIXED by adding .reverse().
 */
function inverseNotation(notation: string): string {
  return notation
    .split(/\s+/)
    .map((token) => {
      if (!token) return "";
      const face = token[0];
      const suffix = token.length > 1 ? token[1] : "";
      if (suffix === "2") return token; // 180° is its own inverse
      if (suffix === "'") return face; // inverse of R' is R
      return face + "'"; // inverse of R is R'
    })
    .reverse() // ← CRITICAL FIX: reverse the order for correct mathematical inverse
    .join(" ");
}

/**
 * Generate real solve moves from a scramble using inverse-scramble.
 * This guarantees the replay ends with a solved cube.
 *
 * Returns the moves AND the indices where pauses were detected.
 * The hostTimestamps are normalized so the last move's offset ≈ totalSpanMs.
 */
function solveMovesFromScramble(
  scramble: string,
  baseTs: number,
  totalSpanMs: number,
): {
  moves: CubeMoveEvent[];
  pauseGaps: { startIndex: number; endIndex: number; durationMs: number }[];
} {
  const solveNotation = inverseNotation(scramble);
  const tokens = solveNotation.split(/\s+/).filter(Boolean);
  const n = tokens.length;

  // Step 1: generate raw inter-move gaps (ms) with occasional pauses
  const gaps: number[] = [];
  const pauseGaps: { startIndex: number; endIndex: number; durationMs: number }[] = [];
  let rawTotal = 0;
  const avgGapMs = totalSpanMs / n;

  for (let i = 0; i < n; i++) {
    const gap = Math.max(40, avgGapMs + (Math.random() - 0.5) * avgGapMs * 0.8);
    gaps.push(gap);
    rawTotal += gap;

    // Occasionally insert a detectable pause (gap >= 600ms → PauseDetector
    // would flag it after subtracting 100ms turn-execution time).
    if (i > 0 && Math.random() < 0.08) {
      const pauseMs = Math.round(500 + Math.random() * 1200);
      gaps[i - 1] += pauseMs;
      rawTotal += pauseMs;
      pauseGaps.push({ startIndex: i - 1, endIndex: i, durationMs: pauseMs });
    }
  }

  // Step 2: scale all gaps to fit exactly within totalSpanMs
  const scale = totalSpanMs / rawTotal;
  let cumulativeHost = baseTs;
  let cumulativeCube = 1000;
  const moves: CubeMoveEvent[] = [];
  const adjustedPauseGaps: typeof pauseGaps = [];

  for (let i = 0; i < n; i++) {
    const scaledGap = Math.round(gaps[i] * scale);
    cumulativeHost += scaledGap;
    cumulativeCube += scaledGap;

    // Parse the token into face + direction
    const token = tokens[i];
    const face = token[0] as CubeFace;
    const suffix = token.length > 1 ? token[1] : "";
    const direction: 1 | -1 | 2 =
      suffix === "2" ? 2 : suffix === "'" ? -1 : 1;

    moves.push({
      face,
      direction,
      hostTimestamp: cumulativeHost,
      cubeTimestamp: cumulativeCube,
    });

    // Track adjusted pause durations
    const rawPause = pauseGaps.find(p => p.startIndex === i - 1 && p.endIndex === i);
    if (rawPause) {
      adjustedPauseGaps.push({
        startIndex: rawPause.startIndex,
        endIndex: rawPause.endIndex,
        durationMs: Math.round(rawPause.durationMs * scale),
      });
    }
  }

  return { moves, pauseGaps: adjustedPauseGaps };
}

/**
 * Random scramble string (no consecutive same face on successive moves).
 * Generates exactly `length` moves so the inverse-scramble solve also has
 * `length` moves, matching the expected CFOP move count range (~48-61).
 */
function randomScramble(length: number): string {
  const moves: string[] = [];
  let last = "";
  for (let i = 0; i < length; i++) {
    let f: string;
    do {
      f = FACES[Math.floor(Math.random() * FACES.length)];
    } while (f === last);
    last = f;
    const suffix = Math.random() < 0.3 ? "2" : Math.random() < 0.5 ? "'" : "";
    moves.push(f + suffix);
  }
  return moves.join(" ");
}

// ─── Solve time generators (CFOP bell curve ~12-22s) ──────────────────────

/** Generate a realistic CFOP solve time spread. */
function cfopTime(): number {
  // roughly normal around 15s, std 3.5s, clamp to 8-30s
  let t = 15000;
  for (let i = 0; i < 6; i++) t += (Math.random() - 0.5) * 4000;
  return Math.max(8000, Math.min(30000, Math.round(t)));
}

// ─── Full SolveMetrics generator ────────────────────────────────────────────

function generateMetrics(
  totalTimeMs: number,
  totalMoves: number,
  pauseGaps: { startIndex: number; endIndex: number; durationMs: number }[],
): SolveMetrics {
  const solveId = uuidv4();

  // Phase splits (CFOP proportions: Cross~10%, F2L~55%, OLL~15%, PLL~20%)
  const crossPct = 0.08 + Math.random() * 0.04;
  const f2lPct = 0.48 + Math.random() * 0.1;
  const ollPct = 0.12 + Math.random() * 0.06;
  const pllPct = Math.max(0.05, 1 - crossPct - f2lPct - ollPct);

  const crossMs = Math.round(totalTimeMs * crossPct);
  const f2lMs = Math.round(totalTimeMs * f2lPct);
  const ollMs = Math.round(totalTimeMs * ollPct);
  const pllMs = Math.round(totalTimeMs * pllPct);

  // Move count distribution — ensure sum equals totalMoves
  const crossMoves = Math.max(3, Math.min(8, 5 + Math.floor(Math.random() * 4)));
  const f2lMoves = Math.max(18, Math.min(35, 24 + Math.floor(Math.random() * 8)));
  const ollMoves = Math.max(5, Math.min(12, 7 + Math.floor(Math.random() * 5)));
  // PLL gets whatever moves remain to make the sum exact
  const pllMoves = Math.max(6, totalMoves - crossMoves - f2lMoves - ollMoves);

  // TPS per phase
  const crossTps = crossMs > 0 ? +(crossMoves / (crossMs / 1000)).toFixed(1) : 0;
  const f2lTps = f2lMs > 0 ? +(f2lMoves / (f2lMs / 1000)).toFixed(1) : 0;
  const ollTps = ollMs > 0 ? +(ollMoves / (ollMs / 1000)).toFixed(1) : 0;
  const pllTps = pllMs > 0 ? +(pllMoves / (pllMs / 1000)).toFixed(1) : 0;
  const globalTps = totalTimeMs > 0 ? +(totalMoves / (totalTimeMs / 1000)).toFixed(2) : 0;

  // ── Pauses: derived from actual inter-move gaps ────────────────────
  const pauseCount = Math.min(pauseGaps.length, 10);
  const realPauses = pauseGaps.slice(0, pauseCount).map((g) => {
    // Determine phase based on where this pause falls in the move sequence
    const ratio = g.startIndex / totalMoves;
    let phase = "F2L";
    const crossEnd = crossMoves / totalMoves;
    const f2lEnd = (crossMoves + f2lMoves) / totalMoves;
    const ollEnd = (crossMoves + f2lMoves + ollMoves) / totalMoves;
    if (ratio < crossEnd) phase = "Cross";
    else if (ratio < f2lEnd) phase = "F2L";
    else if (ratio < ollEnd) phase = "OLL";
    else phase = "PLL";

    let category: "mid-phase" | "recognition" | "mid-algorithm" = "mid-phase";
    // Classify: near a phase boundary → recognition of the NEXT phase;
    // inside a last-layer algorithm → mid-algorithm hesitation.
    const nearCrossF2L = Math.abs(g.startIndex - crossMoves) <= 2;
    const nearF2lOll = Math.abs(g.startIndex - (crossMoves + f2lMoves)) <= 2;
    const nearOllPll = Math.abs(g.startIndex - (crossMoves + f2lMoves + ollMoves)) <= 2;
    if (nearCrossF2L || nearF2lOll || nearOllPll) {
      category = "recognition";
      if (nearCrossF2L) phase = "F2L";
      else if (nearF2lOll) phase = "OLL";
      else phase = "PLL";
    } else if (phase === "OLL" || phase === "PLL") {
      category = "mid-algorithm";
    }

    return {
      startIndex: g.startIndex,
      endIndex: g.endIndex,
      durationMs: g.durationMs,
      phase,
      category,
    };
  });

  const totalPauseTimeMs = realPauses.reduce((s, p) => s + p.durationMs, 0);
  const pauseRatio = totalTimeMs > 0 ? totalPauseTimeMs / totalTimeMs : 0;

  // Per-phase pause time only counts INTERNAL pauses (mid-phase /
  // mid-algorithm) — boundary gaps are the next phase's recognition.
  const phasePauses = (name: string) =>
    realPauses.filter((p) => p.phase === name && p.category !== "recognition");

  const phases = [
    { phaseName: "Cross", durationMs: crossMs, moveCount: crossMoves, tps: crossTps, pauseCount: phasePauses("Cross").length, pauseTimeMs: phasePauses("Cross").reduce((s, p) => s + p.durationMs, 0) },
    { phaseName: "F2L", durationMs: f2lMs, moveCount: f2lMoves, tps: f2lTps, pauseCount: phasePauses("F2L").length, pauseTimeMs: phasePauses("F2L").reduce((s, p) => s + p.durationMs, 0) },
    { phaseName: "OLL", durationMs: ollMs, moveCount: ollMoves, tps: ollTps, pauseCount: phasePauses("OLL").length, pauseTimeMs: phasePauses("OLL").reduce((s, p) => s + p.durationMs, 0) },
    { phaseName: "PLL", durationMs: pllMs, moveCount: pllMoves, tps: pllTps, pauseCount: phasePauses("PLL").length, pauseTimeMs: phasePauses("PLL").reduce((s, p) => s + p.durationMs, 0) },
  ];

  const pauses = {
    totalCount: pauseCount,
    maxDurationMs: pauseCount > 0 ? Math.max(...realPauses.map(p => p.durationMs)) : 0,
    avgDurationMs: pauseCount > 0 ? Math.round(totalPauseTimeMs / pauseCount) : 0,
    byPhase: Object.fromEntries(
      [...new Set(realPauses.map(p => p.phase))].map((phaseName) => {
        const list = realPauses.filter(p => p.phase === phaseName);
        return [phaseName, { count: list.length, avgMs: Math.round(list.reduce((s, p) => s + p.durationMs, 0) / list.length) }];
      })
    ),
    totalPauseTimeMs,
    pauseRatio,
    pauses: realPauses,
  };


  const f2lPairCount = 4;
  const f2lPairMs = f2lMs / f2lPairCount;
  const f2lPairs = Array.from({ length: f2lPairCount }, (_, i) => ({
    pairNumber: i + 1,
    slotId: (["FR", "BR", "BL", "FL"] as const)[i],
    timeMs: Math.round(f2lPairMs * (0.7 + Math.random() * 0.6)),
    moves: Math.round(f2lMoves / f2lPairCount),
    tps: +(f2lTps * (0.8 + Math.random() * 0.4)).toFixed(1),
    recognitionMs: i === 0 ? 0 : Math.round(80 + Math.random() * 400),
  }));

  // Scale pair times to match total F2L time
  const pairTotal = f2lPairs.reduce((s, p) => s + p.timeMs + p.recognitionMs, 0);
  if (pairTotal > 0) {
    const scale = f2lMs / pairTotal;
    for (const p of f2lPairs) {
      p.timeMs = Math.round(p.timeMs * scale);
      p.recognitionMs = Math.round(p.recognitionMs * scale);
    }
  }

  // ── TPS instantaneous window: one TPS value per move ──────────────
  const instantaneousWindow: number[] = Array.from({ length: totalMoves }, () =>
    +Math.max(1.5, globalTps * (0.5 + Math.random())).toFixed(2),
  );

  let phaseIndex = 0;
  let phaseTimestamp = 0;
  const detectionPhases = phases.map((phase) => {
    const startIndex = phaseIndex;
    const endIndex = phaseIndex + phase.moveCount - 1;
    const startTimestamp = phaseTimestamp;
    const endTimestamp = phaseTimestamp + phase.durationMs;
    phaseIndex += phase.moveCount;
    phaseTimestamp = endTimestamp;
    // Recognition = the boundary gap before this phase's first move.
    // Cross recognition happens during inspection (not captured) → 0.
    const recognitionMs =
      phase.phaseName === "Cross" ? 0 : Math.round(120 + Math.random() * 380);
    return {
      phaseName: phase.phaseName,
      startIndex,
      endIndex,
      completionIndex: endIndex,
      startTimestamp,
      endTimestamp,
      durationMs: phase.durationMs,
      executionMs: Math.max(0, phase.durationMs - (phase.pauseTimeMs ?? 0)),
      recognitionMs,
      transitionMs: recognitionMs,
      skipped: false,
      moveCount: phase.moveCount,
    };
  });

  return {
    solveId,
    totalTimeMs,
    totalMoves,
    phases,
    detectionReport: {
      method: "CFOP",
      expectedPhases: ["Cross", "F2L", "OLL", "PLL"],
      phases: detectionPhases,
      complete: true,
      finalStateSolved: true,
      confidence: "medium",
      warnings: [],
      initialStateSource: "scramble",
      phaseSchema: "cfop-canonical",
      solveTimeMs: totalTimeMs,
      transitionTimeMs: 0,
      unattributedTimeMs: 0,
    },
    tps: {
      global: globalTps,
      effective: +(totalMoves / ((totalTimeMs - totalPauseTimeMs) / 1000)).toFixed(2),
      byPhase: { Cross: crossTps, F2L: f2lTps, OLL: ollTps, PLL: pllTps },
      peakInstantaneous: +(globalTps * (1.2 + Math.random() * 0.8)).toFixed(1),
      instantaneousWindow,
    },
    pauses,
    fluidity: {
      stdDevMs: Math.round(40 + Math.random() * 60),
      coefficientOfVariation: +(0.15 + Math.random() * 0.25).toFixed(2),
      byPhase: { Cross: 0.12, F2L: 0.22, OLL: 0.18, PLL: 0.15 },
      burstCount: Math.floor(Math.random() * 4),
      accelerationCount: Math.floor(Math.random() * 3),
      decelerationCount: Math.floor(Math.random() * 2),
    },
    efficiency: {
      moveEfficiencyRatio: +(1.0 + Math.random() * 0.5).toFixed(2),
      optimalMoveCount: Math.round(totalMoves * 0.75),
      redundancies: Math.floor(Math.random() * 3),
      cancellations: Math.floor(Math.random() * 2),
      overturns: Math.floor(Math.random() * 2),
      forwardDrift: +(0.75 + Math.random() * 0.2).toFixed(2),
    },
    rotation: {
      totalCount: Math.floor(Math.random() * 6),
      byAxis: { x: Math.floor(Math.random() * 2), y: Math.floor(Math.random() * 3), z: Math.floor(Math.random() * 1) },
      estimatedRotationTimeMs: Math.round(100 + Math.random() * 400),
      consecutiveCount: Math.floor(Math.random() * 2),
      byPhase: { F2L: Math.floor(Math.random() * 4), OLL: Math.floor(Math.random() * 1), PLL: Math.floor(Math.random() * 1) },
      rotationToMoveRatio: +(0.02 + Math.random() * 0.08).toFixed(2),
      redundantRotations: Math.floor(Math.random() * 1),
    },
    cfop: {
      crossEfficiency: +(0.6 + Math.random() * 0.4).toFixed(2),
      crossToF2LTransitionMs: Math.round(200 + Math.random() * 600),
      crossMoves,
      crossTPS: crossTps,
      f2lPairs,
      f2lLookaheadScore: +(0.4 + Math.random() * 0.5).toFixed(2),
      ollRecognitionMs: Math.round(200 + Math.random() * 500),
      ollExecutionMs: Math.round(ollMs - 200 - Math.random() * 500),
      ollTPS: ollTps,
      pllRecognitionMs: Math.round(200 + Math.random() * 600),
      pllExecutionMs: Math.round(pllMs - 200 - Math.random() * 600),
      pllTPS: pllTps,
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

const DEMO_SESSION_NAME = "Demo Session";

/**
 * Attach the manual console helpers (called once during app init):
 *  - `window.seedDemoData()`  → seeds demo solves right now (dev builds only).
 *  - `window.clearDemoData()` → deletes demo solves + the Demo session.
 *
 * No seeding ever happens automatically.
 */
export function attachDemoDataHelpers(
  sessionsRepo: SessionsRepository,
  solvesRepo: SolvesRepository,
): void {
  if (typeof window === "undefined") return;
  // Never expose demo-data hooks in production: the helpers only make sense
  // in development, and `window.seedDemoData` would otherwise be a foot-gun
  // on user data (it self-guards, but the surface is unnecessary).
  if (!isDev()) return;
  (window as unknown as Record<string, unknown>).seedDemoData = () => {
    void seedDemoData(sessionsRepo, solvesRepo);
  };
  (window as unknown as Record<string, unknown>).clearDemoData = () => {
    void (async () => {
      try {
        await sessionsRepo.deleteDemoSessions();
        await solvesRepo.deleteDemoData();
      } finally {
        window.location.reload();
      }
    })();
  };
}

/**
 * Seed the database with demo solves.
 *
 * MANUAL-ONLY: never invoked automatically by the app. Trigger it via
 * `window.seedDemoData()` in the console (development builds only — production
 * ignores it). Demo solves are written to a dedicated "Demo Session"
 * (is_demo = 1) and are excluded from real statistics.
 */
export async function seedDemoData(
  sessionsRepo: SessionsRepository,
  solvesRepo: SolvesRepository,
): Promise<void> {
  if (typeof window === "undefined") return;
  // Demo data only exists in development builds.
  if (!isDev()) return;

  // Don't double-seed: only when the user has no real solves AND no demo
  // session has been created yet (a previous seed already populated one).
  const existing = await solvesRepo.countNonDemo();
  if (existing > 0) return;
  const allSessions = await sessionsRepo.findAll();
  if (allSessions.some((s) => s.name === DEMO_SESSION_NAME)) return;

  // Always a dedicated demo session — never the user's own session.
  const sessionId = uuidv4();
  await sessionsRepo.insert(
    {
      id: sessionId,
      name: DEMO_SESSION_NAME,
      createdAt: Date.now(),
    },
    { isDemo: true },
  );

  // Generate 20 solves over the last 2 hours
  const now = Date.now();
  const solves = Array.from({ length: 20 }, (_, i) => {
    const minsAgo = (19 - i) * 5 + Math.floor(Math.random() * 3); // every ~5 min
    const ts = new Date(now - minsAgo * 60_000);
    const totalTimeMs = cfopTime();
    // Target move count must match the scramble length so the inverse-scramble
    // solve has the same number of moves as the metrics expect.
    const targetMoves = 48 + Math.floor(Math.random() * 14); // 48-61
    const scramble = randomScramble(targetMoves);
    // Generate REAL solve moves as the inverse of the scramble, so the
    // replay actually ends with a solved cube.
    const { moves, pauseGaps } = solveMovesFromScramble(scramble, ts.getTime(), totalTimeMs);
    const totalMoves = moves.length;
    const analysis = generateMetrics(totalTimeMs, totalMoves, pauseGaps);
    // Generate orientation timeline (simulates IMU/gyro data from a smart cube)
    const orientationTimeline = generateOrientationTimeline(totalMoves);

    return {
      id: uuidv4(),
      sessionId,
      timeMs: totalTimeMs,
      timestamp: ts.getTime(),
      scramble,
      penalty: (Math.random() < 0.1 ? "+2" : "none") as "none" | "+2" | "DNF",
      method: "CFOP" as const,
      source: "smart" as const,
      moves,
      orientationTimeline,
      analysisEngineVersion: ANALYSIS_PIPELINE_VERSION,
      analysis: JSON.stringify(analysis),
      createdAt: ts.getTime(),
      updatedAt: ts.getTime(),
    };
  });

  // Insert all solves
  for (const solve of solves) {
    await solvesRepo.insert(solve, { isDemo: true });
  }

  console.log(`[seedDemoData] Seeded ${solves.length} demo solves (is_demo). They are excluded from Stats/Insights; run window.clearDemoData() to remove them.`);
}
