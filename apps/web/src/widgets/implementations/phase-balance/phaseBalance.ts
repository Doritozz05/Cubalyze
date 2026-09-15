import type { Solve } from "@/types";
import { effectiveTime } from "@/types";
import type { PhaseMetrics, SolveMetrics } from "@cubalyze/types";
import { derivePhaseDistribution, isComparablePhaseAnalysis } from "@cubalyze/analysis-engine";
import { getCfopBenchmark, type CfopBenchmarkReference } from "./benchmarks";

export const CFOP_PHASES = ["Cross", "F2L", "OLL", "PLL"] as const;
export type CfopPhaseName = (typeof CFOP_PHASES)[number];

export interface PhaseBalanceRow {
  phaseName: CfopPhaseName;
  avgDurationMs: number;
  avgMoveCount: number;
  share: number;
  avgTps: number;
  latestShare?: number;
  latestDelta?: number;
  latestSkipped?: boolean;
  benchmarkShare?: number;
  benchmarkDelta?: number;
}

export interface PhaseBalanceData {
  rows: PhaseBalanceRow[];
  analysedSolves: number;
  hasEnoughForTrend: boolean;
  averageTimeMs: number;
  benchmark: CfopBenchmarkReference | null;
}

export interface ComparableSolve {
  solve: Solve;
  analysis: SolveMetrics;
}

function newestSolve(solves: Solve[]): Solve | undefined {
  return solves
    .filter((solve) => Number.isFinite(solve.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}

function currentAnalysisForSolves(
  solves: Solve[],
  analysis?: SolveMetrics | null,
): SolveMetrics | null {
  const newest = newestSolve(solves);
  return analysis
    && newest?.id === analysis.solveId
    && isComparablePhaseAnalysis(analysis)
    ? analysis
    : null;
}

function attachPendingAnalysis(
  solves: Solve[],
  latestAnalysis?: SolveMetrics | null,
): Solve[] {
  const currentAnalysis = currentAnalysisForSolves(solves, latestAnalysis);
  if (!currentAnalysis) return solves;
  // Only overlay an existing solve with the same ID. Never invent a solve
  // for an analysis that could belong to an earlier asynchronous completion.
  return solves.map((solve) =>
    solve.id === currentAnalysis.solveId
      ? { ...solve, analysis: currentAnalysis }
      : solve,
  );
}

function isCfopPhase(name: string): name is CfopPhaseName {
  return (CFOP_PHASES as readonly string[]).includes(name);
}

function comparableSolve(solve: Solve): ComparableSolve | null {
  if (solve.method !== "CFOP"
    || !Number.isFinite(solve.time)
    || solve.time < 0
    || !Number.isFinite(solve.timestamp)) return null;
  const effective = effectiveTime(solve);
  if (!Number.isFinite(effective)) return null;
  if (!isComparablePhaseAnalysis(solve.analysis)) return null;
  const analysis = solve.analysis;
  return { solve, analysis };
}

function phaseMap(phases: PhaseMetrics[]): Map<CfopPhaseName, PhaseMetrics> {
  return new Map(
    phases
      .filter((phase): phase is PhaseMetrics & { phaseName: CfopPhaseName } => isCfopPhase(phase.phaseName))
      .map((phase) => [phase.phaseName, phase]),
  );
}

function sharesForAnalysis(analysis: SolveMetrics): Map<CfopPhaseName, number> {
  const phases = phaseMap(analysis.phases);
  const total = CFOP_PHASES.reduce(
    (sum, phaseName) => sum + Math.max(0, phases.get(phaseName)?.durationMs ?? 0),
    0,
  );
  return new Map(
    CFOP_PHASES.map((phaseName) => [
      phaseName,
      total > 0 ? Math.max(0, phases.get(phaseName)?.durationMs ?? 0) / total : 0,
    ]),
  );
}

export function getComparableSolves(solves: Solve[], limit = 20): ComparableSolve[] {
  return solves
    .map(comparableSolve)
    .filter((value): value is ComparableSolve => value !== null)
    .sort((a, b) => b.solve.timestamp - a.solve.timestamp)
    .slice(0, limit);
}

export function buildPhaseBalance(
  solves: Solve[],
  latestAnalysis?: SolveMetrics | null,
  limit = 20,
): PhaseBalanceData {
  // The just-finished solve can have a valid analysis in `lastAnalysis`
  // milliseconds before the `solves` array receives its state/DB patch.
  // Overlay it here so the widget updates immediately without navigation or
  // another analysis pass.
  const solvesWithPendingAnalysis = attachPendingAnalysis(solves, latestAnalysis);
  const comparable = getComparableSolves(solvesWithPendingAnalysis, limit);
  const baseline = derivePhaseDistribution(
    comparable.map(({ solve, analysis }) => ({ ...solve, analysis })),
  );
  const baselineByPhase = new Map(
    baseline.map((phase) => [phase.phaseName as CfopPhaseName, phase]),
  );
  const currentAnalysis = currentAnalysisForSolves(solves, latestAnalysis);
  const averageTimeMs = comparable.length > 0
    ? comparable.reduce((sum, { solve }) => sum + effectiveTime(solve), 0) / comparable.length
    : 0;
  // Do not show a community reference for a tiny sample: the widget's own
  // baseline is useful from solve one, while comparison becomes meaningful
  // after five comparable solves.
  const benchmark = comparable.length >= 5 ? getCfopBenchmark(averageTimeMs) : null;
  const latestShares = currentAnalysis
    ? sharesForAnalysis(currentAnalysis)
    : undefined;
  const latestPhases = currentAnalysis
    ? phaseMap(currentAnalysis.phases)
    : undefined;

  const rows = CFOP_PHASES.map((phaseName) => {
    const phase = baselineByPhase.get(phaseName);
    const latestPhase = latestPhases?.get(phaseName);
    const latestShare = latestShares?.get(phaseName);
    const averageShare = phase?.share ?? 0;
    return {
      phaseName,
      avgDurationMs: phase?.avgDurationMs ?? 0,
      avgMoveCount: phase?.avgMoveCount ?? 0,
      share: averageShare,
      avgTps: phase?.avgTps ?? 0,
      latestShare,
      latestDelta: latestShare === undefined ? undefined : latestShare - averageShare,
      latestSkipped: latestPhase?.skipped === true
        || (latestPhase?.durationMs === 0 && latestPhase?.moveCount === 0),
      benchmarkShare: benchmark?.shares[phaseName],
      benchmarkDelta: benchmark ? averageShare - benchmark.shares[phaseName] : undefined,
    };
  });

  return {
    rows,
    analysedSolves: comparable.length,
    hasEnoughForTrend: comparable.length >= 5,
    averageTimeMs,
    benchmark,
  };
}

export function getLatestComparableAnalysis(
  solves: Solve[],
  lastAnalysis?: SolveMetrics | null,
): SolveMetrics | null {
  const currentAnalysis = currentAnalysisForSolves(solves, lastAnalysis);
  if (currentAnalysis) {
    return currentAnalysis;
  }
  return getComparableSolves(solves, 1)[0]?.analysis ?? null;
}

export function getPhaseSegments(analysis: SolveMetrics): Array<{
  phaseName: CfopPhaseName;
  durationMs: number;
  share: number;
  skipped: boolean;
}> {
  const phases = phaseMap(analysis.phases);
  const total = CFOP_PHASES.reduce(
    (sum, phaseName) => sum + Math.max(0, phases.get(phaseName)?.durationMs ?? 0),
    0,
  );
  return CFOP_PHASES.map((phaseName) => {
    const phase = phases.get(phaseName);
    const durationMs = Math.max(0, phase?.durationMs ?? 0);
    return {
      phaseName,
      durationMs,
      share: total > 0 ? durationMs / total : 0,
      skipped: phase?.skipped === true || (durationMs === 0 && phase?.moveCount === 0),
    };
  });
}
