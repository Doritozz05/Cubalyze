/**
 * @file Time-series data derivation — TPS trends and phase distributions.
 *
 * Pure functions for chart-ready series data. Framework-agnostic.
 */

import { effectiveTime } from "@cubeforge/statistics";
import type { StatSolve } from "@cubeforge/statistics";
import type { SolveMetrics } from "@cubeforge/types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface TpsPoint {
  solveIdx: number;
  tps: number;
  timeMs: number;
}

export interface PhaseShare {
  phaseName: string;
  avgDurationMs: number;
  avgMoveCount: number;
  share: number;
  avgTps: number;
}

/** Minimal solve shape for TPS series. */
export interface SeriesSolve extends StatSolve {
  analysis?: SolveMetrics;
}

// ─── deriveTpsSeries ─────────────────────────────────────────────────────

/**
 * TPS across analysed solves, oldest → newest.
 * Solves without analysis are included as NaN so charts show gaps.
 */
export function deriveTpsSeries(solves: SeriesSolve[]): TpsPoint[] {
  const ordered = [...solves].reverse();
  return ordered.map((s, i) => ({
    solveIdx: i,
    tps: s.analysis?.tps.global ?? NaN,
    timeMs: effectiveTime(s),
  }));
}

// ─── derivePhaseDistribution ──────────────────────────────────────────────

/**
 * Average per-phase distribution across all analysed solves.
 */
export function derivePhaseDistribution(solves: SeriesSolve[]): PhaseShare[] {
  const analysed = solves.filter((s) => s.analysis && s.analysis.phases.length > 0);
  if (analysed.length === 0) return [];

  const acc = new Map<string, { dur: number; moves: number; tps: number; n: number }>();
  for (const s of analysed) {
    for (const p of s.analysis!.phases) {
      const cur = acc.get(p.phaseName) ?? { dur: 0, moves: 0, tps: 0, n: 0 };
      cur.dur += p.durationMs;
      cur.moves += p.moveCount;
      cur.tps += p.tps;
      cur.n += 1;
      acc.set(p.phaseName, cur);
    }
  }

  const grandDur = Array.from(acc.values()).reduce((s, v) => s + v.dur, 0) || 1;
  return Array.from(acc.entries())
    .map(([phaseName, v]) => ({
      phaseName,
      avgDurationMs: v.dur / v.n,
      avgMoveCount: v.moves / v.n,
      share: v.dur / grandDur,
      avgTps: v.tps / v.n,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs);
}
