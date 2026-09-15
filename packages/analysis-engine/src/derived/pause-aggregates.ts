/**
 * Session-level pause aggregation by probable cause.
 *
 * The per-solve timeline (SolveAnalysisPanel) already paints every pause with
 * its cause. This module rolls those pauses up across an entire session so the
 * Insights view can say "this session you lose 0.8s per solve recognizing OLL,
 * 0.45s searching cross pieces…" — a diagnostic axis that per-solve view alone
 * cannot give you.
 *
 * Pure, headless, framework-agnostic.
 */

import type { PauseDetail, PhaseMetrics, SolveMetrics } from "@cubalyze/types";
import { derivePauseCause } from "./timeline";

/** Minimal solve shape accepted by the aggregation. */
export interface PauseAggSolveInput {
  analysis?: SolveMetrics | null;
}

/**
 * A PauseDetail plus the normalized cause string. `cause` is localized by the
 * UI at render time via the same derivePauseCause mapping.
 */
export interface CausePauseRow {
  cause: string;
  phase: string;
  category: PauseDetail["category"];
  durationMs: number;
}

export interface PauseCauseSum {
  /** Raw cause string (e.g. "OLL recognition"). Localize at render. */
  cause: string;
  /** Phase the pauses were attributed to. */
  phase: string;
  /** Total pause time in this session attributed to this cause (ms). */
  totalMs: number;
  /** Number of pauses attributed to this cause. */
  count: number;
  /** Share of the session's total pause time for this cause (0–1). */
  share: number;
}

function analysisOf(s: PauseAggSolveInput): SolveMetrics | undefined {
  const a = s?.analysis;
  return a ?? undefined;
}

/**
 * Roll every pause of every analysed solve in the session up per probable
 * cause. Returns rows sorted by total pause time descending so callers can
 * rank "your biggest pause sinks" at a glance.
 */
export function derivePauseCauseSums(
  solves: PauseAggSolveInput[],
): PauseCauseSum[] {
  const totals = new Map<string, { totalMs: number; count: number; phase: string }>();

  for (const s of solves) {
    const a = analysisOf(s);
    if (!a?.pauses?.pauses?.length) continue;
    const phases: PhaseMetrics[] = a.phases ?? [];
    for (const p of a.pauses.pauses) {
      const cause = derivePauseCause(p, phases);
      const cur = totals.get(cause) ?? { totalMs: 0, count: 0, phase: p.phase };
      cur.totalMs += p.durationMs;
      cur.count += 1;
      totals.set(cause, cur);
    }
  }

  const grandTotal = [...totals.values()].reduce((s, r) => s + r.totalMs, 0);
  const rows: PauseCauseSum[] = [...totals.entries()].map(([cause, r]) => ({
    cause,
    phase: r.phase,
    totalMs: r.totalMs,
    count: r.count,
    share: grandTotal > 0 ? r.totalMs / grandTotal : 0,
  }));

  return rows.sort((a, b) => b.totalMs - a.totalMs);
}

/** Convenience list of every pause row (unaggregated) for drill-down use. */
export function flattenPauseCauses(
  solves: PauseAggSolveInput[],
): CausePauseRow[] {
  const rows: CausePauseRow[] = [];
  for (const s of solves) {
    const a = analysisOf(s);
    if (!a?.pauses?.pauses?.length) continue;
    const phases = a.phases ?? [];
    for (const p of a.pauses.pauses) {
      rows.push({
        cause: derivePauseCause(p, phases),
        phase: p.phase,
        category: p.category,
        durationMs: p.durationMs,
      });
    }
  }
  return rows;
}