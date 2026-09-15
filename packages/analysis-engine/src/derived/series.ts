/**
 * Time-series data derivation — TPS trends and phase distributions.
 *
 * Pure functions for chart-ready series data. Framework-agnostic.
 */

import { effectiveTime } from "@cubalyze/statistics";
import type { StatSolve } from "@cubalyze/statistics";
import type { SolveMetrics } from "@cubalyze/types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface TpsPoint {
  solveIdx: number;
  solveNumber: number;
  tps: number;
  timeMs: number;
}

// ─── deriveTpsSeries ─────────────────────────────────────────────────────

/**
 * TPS across solves with valid turn metrics, oldest → newest.
 * Solves without TPS data (e.g. manual solves without moves) are excluded
 * so chart points span full width without blank whitespace padding.
 */
export function deriveTpsSeries(solves: SeriesSolve[]): TpsPoint[] {
  const ordered = [...solves].reverse();
  const points: TpsPoint[] = [];
  let seriesIdx = 0;
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const tps = extractSolveTps(s);
    if (Number.isFinite(tps) && tps > 0) {
      points.push({
        solveIdx: seriesIdx++,
        solveNumber: i + 1,
        tps,
        timeMs: effectiveTime(s),
      });
    }
  }
  return points;
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

/**
 * Whether an analysis was produced by the hardened CFOP pipeline and is safe
 * to include in phase-comparison views. Analyses without a complete canonical
 * report must not be mixed into CFOP shares.
 */
export function isComparablePhaseAnalysis(
  analysis: SolveMetrics | undefined,
): analysis is SolveMetrics {
  const report = analysis?.detectionReport;
  if (!report || typeof report.method !== "string" || report.method.toUpperCase() !== "CFOP") {
    return false;
  }
  if (!report.complete || !report.finalStateSolved || report.confidence === "invalid") {
    return false;
  }

  const expected = new Set(["Cross", "F2L", "OLL", "PLL"]);
  if (!Array.isArray(report.expectedPhases)
    || report.expectedPhases.length !== expected.size
    || new Set(report.expectedPhases).size !== expected.size
    || !report.expectedPhases.every((phase) => expected.has(phase))) {
    return false;
  }

  if (!Number.isFinite(analysis.totalTimeMs) || analysis.totalTimeMs <= 0) {
    return false;
  }
  if (!analysis.tps || !Number.isFinite(analysis.tps.global) || analysis.tps.global < 0) {
    return false;
  }

  const detectedPhases = Array.isArray(analysis.phases) ? analysis.phases : [];
  const detected = new Set(detectedPhases.map((phase) => phase?.phaseName));
  if (detectedPhases.length !== expected.size
    || detected.size !== expected.size
    || ![...expected].every((phase) => detected.has(phase))) {
    return false;
  }

  const reportPhases = Array.isArray(report.phases) ? report.phases : [];
  const reportNames = new Set(reportPhases.map((phase) => phase?.phaseName));
  if (reportPhases.length !== expected.size
    || reportNames.size !== expected.size
    || ![...expected].every((phase) => reportNames.has(phase))) {
    return false;
  }
  if (!reportPhases.every((phase) =>
    phase
    && expected.has(phase.phaseName)
    && Number.isFinite(phase.durationMs)
    && phase.durationMs >= 0
    && Number.isFinite(phase.startTimestamp)
    && Number.isFinite(phase.endTimestamp)
    && phase.endTimestamp >= phase.startTimestamp
    && Number.isInteger(phase.startIndex)
    && Number.isInteger(phase.endIndex)
    && phase.startIndex >= 0
    && phase.endIndex >= phase.startIndex
    && Number.isInteger(phase.moveCount)
    && phase.moveCount >= 0,
  )) {
    return false;
  }
  const totalReportDuration = reportPhases.reduce((sum, phase) => sum + phase.durationMs, 0);
  if (!Number.isFinite(totalReportDuration) || totalReportDuration <= 0) return false;

  const metricsByPhase = new Map(detectedPhases.map((phase) => [phase.phaseName, phase]));
  const reportMatchesMetrics = reportPhases.every((reportPhase) => {
    const metricPhase = metricsByPhase.get(reportPhase.phaseName);
    return metricPhase !== undefined
      && Math.abs(metricPhase.durationMs - reportPhase.durationMs) <= 1
      && metricPhase.moveCount === reportPhase.moveCount;
  });
  if (!reportMatchesMetrics || totalReportDuration > analysis.totalTimeMs + 1) return false;

  const totalPhaseDuration = detectedPhases.reduce(
    (sum, phase) => sum + (Number.isFinite(phase?.durationMs) ? phase.durationMs : 0),
    0,
  );
  if (!Number.isFinite(totalPhaseDuration) || totalPhaseDuration <= 0) return false;

  return detectedPhases.every((phase) =>
    phase
    && expected.has(phase.phaseName)
    && Number.isFinite(phase.durationMs)
    && phase.durationMs >= 0
    && Number.isFinite(phase.moveCount)
    && phase.moveCount >= 0
    && Number.isFinite(phase.tps)
    && phase.tps >= 0,
  );
}

export interface SeriesSolve extends StatSolve {
  analysis?: SolveMetrics;
  moves?: unknown[];
  tps?: number;
  etps?: number;
}

/**
 * Safely extracts TPS for a solve.
 * Supports solves with global analysis metrics, direct `tps`/`etps` properties,
 * or raw move events array (calculating moves.length / timeInSeconds).
 */
export function extractSolveTps(solve: SeriesSolve): number {
  const s = solve as unknown as Record<string, unknown>;
  if (typeof s.tps === "number" && Number.isFinite(s.tps) && s.tps > 0) return s.tps;
  if (typeof s.etps === "number" && Number.isFinite(s.etps) && s.etps > 0) return s.etps;

  if (
    solve.analysis?.tps?.global != null &&
    Number.isFinite(solve.analysis.tps.global) &&
    solve.analysis.tps.global > 0
  ) {
    return solve.analysis.tps.global;
  }

  if (Array.isArray(s.moves) && s.moves.length > 0) {
    const timeMs = effectiveTime(solve);
    if (Number.isFinite(timeMs) && timeMs > 0) {
      return s.moves.length / (timeMs / 1000);
    }
  }

  return NaN;
}



// ─── derivePhaseDistribution ──────────────────────────────────────────────

/**
 * Average per-phase distribution across all analysed solves.
 */
export function derivePhaseDistribution(solves: SeriesSolve[]): PhaseShare[] {
  const analysed = solves.filter((s) => isComparablePhaseAnalysis(s.analysis));
  if (analysed.length === 0) return [];

  const phaseNames = ["Cross", "F2L", "OLL", "PLL"];
  const acc = new Map<string, { dur: number; moves: number; tps: number; share: number; n: number; tpsN: number }>();
  for (const s of analysed) {
    const totalDuration = s.analysis!.phases.reduce((sum, phase) => sum + phase.durationMs, 0);
    if (!Number.isFinite(totalDuration) || totalDuration <= 0) continue;
    for (const p of s.analysis!.phases) {
      const cur = acc.get(p.phaseName) ?? { dur: 0, moves: 0, tps: 0, share: 0, n: 0, tpsN: 0 };
      cur.dur += p.durationMs;
      cur.moves += p.moveCount;
      if (p.durationMs > 0 && p.moveCount > 0) {
        cur.tps += p.tps;
        cur.tpsN += 1;
      }
      cur.share += p.durationMs / totalDuration;
      cur.n += 1;
      acc.set(p.phaseName, cur);
    }
  }

  return phaseNames
    .map((phaseName) => {
      const v = acc.get(phaseName);
      if (!v) return null;
      return {
        phaseName,
        avgDurationMs: v.dur / v.n,
        avgMoveCount: v.moves / v.n,
        share: v.share / v.n,
        avgTps: v.tpsN > 0 ? v.tps / v.tpsN : 0,
      };
    })
    .filter((phase): phase is PhaseShare => phase !== null);
}
