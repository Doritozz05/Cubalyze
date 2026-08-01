import type { Solve } from "@/types";
import { effectiveTime } from "@/types";
import type { PhaseMetrics, SolveMetrics } from "@cubeforge/types";
import { derivePhaseDistribution, isComparablePhaseAnalysis } from "@cubeforge/analysis-engine";

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
}

export interface PhaseBalanceData {
  rows: PhaseBalanceRow[];
  analysedSolves: number;
  hasEnoughForTrend: boolean;
}

export interface ComparableSolve {
  solve: Solve;
  analysis: SolveMetrics;
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
  return { solve, analysis: solve.analysis };
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
  const comparable = getComparableSolves(solves, limit);
  const baseline = derivePhaseDistribution(
    comparable.map(({ solve, analysis }) => ({ ...solve, analysis })),
  );
  const baselineByPhase = new Map(
    baseline.map((phase) => [phase.phaseName as CfopPhaseName, phase]),
  );
  const latestShares = latestAnalysis && isComparablePhaseAnalysis(latestAnalysis)
    ? sharesForAnalysis(latestAnalysis)
    : undefined;

  const rows = CFOP_PHASES.map((phaseName) => {
    const phase = baselineByPhase.get(phaseName);
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
    };
  });

  return {
    rows,
    analysedSolves: comparable.length,
    hasEnoughForTrend: comparable.length >= 5,
  };
}

export function getLatestComparableAnalysis(
  solves: Solve[],
  lastAnalysis?: SolveMetrics | null,
): SolveMetrics | null {
  const newestSolve = solves
    .filter((solve) => Number.isFinite(solve.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (
    lastAnalysis
    && newestSolve?.id === lastAnalysis.solveId
    && isComparablePhaseAnalysis(lastAnalysis)
  ) {
    return lastAnalysis;
  }
  return getComparableSolves(solves, 1)[0]?.analysis ?? null;
}

export function getPhaseSegments(analysis: SolveMetrics): Array<{
  phaseName: CfopPhaseName;
  durationMs: number;
  share: number;
}> {
  const phases = phaseMap(analysis.phases);
  const total = CFOP_PHASES.reduce(
    (sum, phaseName) => sum + Math.max(0, phases.get(phaseName)?.durationMs ?? 0),
    0,
  );
  return CFOP_PHASES.map((phaseName) => ({
    phaseName,
    durationMs: Math.max(0, phases.get(phaseName)?.durationMs ?? 0),
    share: total > 0 ? Math.max(0, phases.get(phaseName)?.durationMs ?? 0) / total : 0,
  }));
}
