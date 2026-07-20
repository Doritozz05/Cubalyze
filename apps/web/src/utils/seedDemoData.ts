/**
 * Demo data seed — generates realistic solve data with full CFOP analysis metrics
 * so the Insights panel is populated in dev without needing a Smart Cube.
 *
 * Triggered once: when the DB has 0 solves and `?seed=demo` is in the URL,
 * OR `localStorage["cubeforge:seed-demo"] === "1"`.
 *
 * Persisted to IndexedDB (SQLite) so data survives hard reloads.
 */

import type { CubeMoveEvent, SolveMetrics } from "@cubeforge/types";
import { v4 as uuidv4 } from "uuid";
import type { SolvesRepository, SessionsRepository } from "@cubeforge/database";

// ─── Helpers ────────────────────────────────────────────────────────────────

const FACES = ["R", "U", "F", "L", "D", "B"] as const;

/** Generate `n` random cube move events with realistic timestamps. */
function randomMoves(n: number, baseTs: number, avgGapMs = 180): CubeMoveEvent[] {
  const moves: CubeMoveEvent[] = [];
  let ts = baseTs;
  for (let i = 0; i < n; i++) {
    // simulate variable inter-move gaps
    const gap = Math.max(40, avgGapMs + (Math.random() - 0.5) * 160);
    ts += gap;
    // Insert occasional pauses (1 in 12 chance)
    if (Math.random() < 0.08) ts += 400 + Math.random() * 1200;

    moves.push({
      face: FACES[Math.floor(Math.random() * FACES.length)],
      direction: (Math.random() < 0.15 ? 2 : Math.random() < 0.5 ? 1 : -1) as 1 | -1 | 2,
      hostTimestamp: Math.round(ts),
      cubeTimestamp: 0,
    });
  }
  return moves;
}

/** Random scramble string. */
function randomScramble(): string {
  const moves: string[] = [];
  let last = "";
  for (let i = 0; i < 20; i++) {
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

function generateMetrics(totalTimeMs: number, totalMoves: number): SolveMetrics {
  const solveId = uuidv4();

  // Phase splits (CFOP proportions: Cross~10%, F2L~55%, OLL~15%, PLL~20%)
  const crossPct = 0.08 + Math.random() * 0.04;
  const f2lPct = 0.48 + Math.random() * 0.1;
  const ollPct = 0.12 + Math.random() * 0.06;
  const pllPct = 1 - crossPct - f2lPct - ollPct;

  const crossMs = Math.round(totalTimeMs * crossPct);
  const f2lMs = Math.round(totalTimeMs * f2lPct);
  const ollMs = Math.round(totalTimeMs * ollPct);
  const pllMs = Math.round(totalTimeMs * pllPct);

  // Move count distribution
  const crossMoves = 5 + Math.floor(Math.random() * 4);  // 5-8
  const f2lMoves = 24 + Math.floor(Math.random() * 8);   // 24-31
  const ollMoves = 7 + Math.floor(Math.random() * 5);    // 7-11
  const pllMoves = 10 + Math.floor(Math.random() * 6);   // 10-15

  // TPS per phase
  const crossTps = crossMs > 0 ? +(crossMoves / (crossMs / 1000)).toFixed(1) : 0;
  const f2lTps = f2lMs > 0 ? +(f2lMoves / (f2lMs / 1000)).toFixed(1) : 0;
  const ollTps = ollMs > 0 ? +(ollMoves / (ollMs / 1000)).toFixed(1) : 0;
  const pllTps = pllMs > 0 ? +(pllMoves / (pllMs / 1000)).toFixed(1) : 0;
  const globalTps = totalTimeMs > 0 ? +(totalMoves / (totalTimeMs / 1000)).toFixed(2) : 0;

  // Pauses
  const pauseCount = 1 + Math.floor(Math.random() * 5);
  const totalPauseTimeMs = Math.round(totalTimeMs * (0.05 + Math.random() * 0.12));
  const pauseRatio = totalTimeMs > 0 ? totalPauseTimeMs / totalTimeMs : 0;

  const phases = [
    { phaseName: "Cross", durationMs: crossMs, moveCount: crossMoves, tps: crossTps, pauseCount: 0, pauseTimeMs: 0 },
    { phaseName: "F2L", durationMs: f2lMs, moveCount: f2lMoves, tps: f2lTps, pauseCount: Math.floor(pauseCount * 0.5), pauseTimeMs: Math.round(totalPauseTimeMs * 0.5) },
    { phaseName: "OLL", durationMs: ollMs, moveCount: ollMoves, tps: ollTps, pauseCount: Math.floor(pauseCount * 0.25), pauseTimeMs: Math.round(totalPauseTimeMs * 0.25) },
    { phaseName: "PLL", durationMs: pllMs, moveCount: pllMoves, tps: pllTps, pauseCount: Math.floor(pauseCount * 0.25), pauseTimeMs: Math.round(totalPauseTimeMs * 0.25) },
  ];

  const pauses = {
    totalCount: pauseCount,
    maxDurationMs: Math.round(300 + Math.random() * 900),
    avgDurationMs: pauseCount > 0 ? Math.round(totalPauseTimeMs / pauseCount) : 0,
    byPhase: {
      F2L: { count: Math.floor(pauseCount * 0.5), avgMs: Math.round(totalPauseTimeMs * 0.5 / Math.max(1, Math.floor(pauseCount * 0.5))) },
      OLL: { count: Math.floor(pauseCount * 0.25), avgMs: Math.round(totalPauseTimeMs * 0.25 / Math.max(1, Math.floor(pauseCount * 0.25))) },
      PLL: { count: Math.ceil(pauseCount * 0.25), avgMs: Math.round(totalPauseTimeMs * 0.25 / Math.max(1, Math.ceil(pauseCount * 0.25))) },
    },
    totalPauseTimeMs,
    pauseRatio,
    pauses: Array.from({ length: pauseCount }, (_ , i) => ({
      startIndex: Math.floor((i / pauseCount) * totalMoves),
      endIndex: Math.floor(((i + 1) / pauseCount) * totalMoves) - 1,
      durationMs: Math.round(200 + Math.random() * 700),
      phase: ["F2L", "F2L", "OLL", "PLL"][i] ?? "F2L",
      category: (["mid-phase", "pre-algorithm", "transition"] as const)[i % 3],
    })),
  };

  const f2lPairCount = 4;
  const f2lPairMs = f2lMs / f2lPairCount;
  const f2lPairs = Array.from({ length: f2lPairCount }, (_, i) => ({
    pairNumber: i + 1,
    slotId: (["FR", "BR", "BL", "FL"] as const)[i],
    timeMs: Math.round(f2lPairMs * (0.7 + Math.random() * 0.6)),
    moves: Math.round(f2lMoves / f2lPairCount),
    tps: +(f2lTps * (0.8 + Math.random() * 0.4)).toFixed(1),
    pauseBeforeMs: i === 0 ? 0 : Math.round(80 + Math.random() * 400),
  }));

  // Scale pair times to match total F2L time
  const pairTotal = f2lPairs.reduce((s, p) => s + p.timeMs + p.pauseBeforeMs, 0);
  if (pairTotal > 0) {
    const scale = f2lMs / pairTotal;
    for (const p of f2lPairs) {
      p.timeMs = Math.round(p.timeMs * scale);
      p.pauseBeforeMs = Math.round(p.pauseBeforeMs * scale);
    }
  }

  return {
    solveId,
    totalTimeMs,
    totalMoves,
    phases,
    tps: {
      global: globalTps,
      effective: +(totalMoves / ((totalTimeMs - totalPauseTimeMs) / 1000)).toFixed(2),
      byPhase: { Cross: crossTps, F2L: f2lTps, OLL: ollTps, PLL: pllTps },
      peakInstantaneous: +(globalTps * (1.2 + Math.random() * 0.8)).toFixed(1),
      instantaneousWindow: [],
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

/** Seed the database with demo solves if empty. */
export async function seedDemoDataIfEmpty(
  sessionsRepo: SessionsRepository,
  solvesRepo: SolvesRepository,
): Promise<void> {
  // Only seed if localStorage flag is set (opt-in, not automatic)
  if (typeof window === "undefined") return;

  const flag = window.localStorage.getItem("cubeforge:seed-demo");
  const url = new URL(window.location.href);
  if (flag !== "1" && !url.searchParams.has("seed")) return;

  // Check if solves already exist (don't double-seed)
  const existing = await solvesRepo.count();
  if (existing > 0) return;

  // Find or create a session
  const allSessions = await sessionsRepo.findAll();
  let sessionId: string;
  if (allSessions.length > 0) {
    sessionId = allSessions[0].id;
  } else {
    sessionId = uuidv4();
    await sessionsRepo.insert({
      id: sessionId,
      name: "Demo Session",
      puzzleType: "3x3",
      createdAt: new Date().toISOString(),
    });
  }

  // Generate 20 solves over the last 2 hours
  const now = Date.now();
  const solves = Array.from({ length: 20 }, (_, i) => {
    const minsAgo = (19 - i) * 5 + Math.floor(Math.random() * 3); // every ~5 min
    const ts = new Date(now - minsAgo * 60_000);
    const totalTimeMs = cfopTime();
    const totalMoves = 48 + Math.floor(Math.random() * 14); // 48-61 moves
    const moves = randomMoves(totalMoves, ts.getTime(), totalTimeMs / totalMoves);
    const analysis = generateMetrics(totalTimeMs, totalMoves);

    return {
      id: uuidv4(),
      sessionId,
      timeMs: totalTimeMs,
      date: ts.toISOString(),
      scramble: randomScramble(),
      penalty: (Math.random() < 0.1 ? "+2" : "none") as "none" | "+2" | "dnf",
      method: "CFOP" as const,
      source: "smart" as const,
      moves,
      analysisEngineVersion: "0.1.0",
      analysis: JSON.stringify(analysis),
      createdAt: ts.toISOString(),
      updatedAt: ts.toISOString(),
    };
  });

  // Insert all solves
  for (const solve of solves) {
    await solvesRepo.insert(solve);
  }

  console.log(`[seedDemoData] Seeded ${solves.length} demo solves. Reload to see them in Insights.`);
}
