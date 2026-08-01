import type {
  SolveTimeline,
  SolveMetrics,
  TPSMetrics,
  PauseMetrics,
  FluidityMetrics,
  EfficiencyMetrics,
  RotationMetrics,
  RedundancyResult,
  CFOPMetrics,
  RouxMetrics,
  PhaseMetrics,
} from '@cubeforge/types';
import { TPSCalculator } from './TPSCalculator';
import { PauseDetector } from './PauseDetector';
import { FluidityCalculator } from './FluidityCalculator';
import { RotationCounter } from './RotationCounter';
import { EfficiencyCalculator } from './EfficiencyCalculator';
import { RedundancyDetector } from './RedundancyDetector';
import { CFOPMetricsCalculator } from './CFOPMetricsCalculator';
import { RouxMetricsCalculator } from './RouxMetricsCalculator';

/**
 * Orchestrates all metric calculators and produces a unified
 * SolveMetrics result for a single solve.
 *
 * This is the main entry point for the analysis pipeline.
 * Feed it a `SolveTimeline` (with phases annotated) and the
 * original scramble, and it returns a complete `SolveMetrics` object.
 */
export class MetricsAggregator {
  /**
   * Run ALL metric calculators against a solve timeline.
   *
   * @param timeline - The annotated SolveTimeline.
   * @param scramble - The original scramble string.
   * @returns SolveMetrics with all computed metrics.
   */
  static async computeAll(
    timeline: SolveTimeline,
    scramble: string,
  ): Promise<SolveMetrics> {
    const { entries, phases } = timeline;

    const totalTimeMs = MetricsAggregator.totalTimeMs(timeline);
    const totalMoves = entries.length;

    // ─── Phase-level metrics ────────────────────────────────────────────
    // Filter out zero-move phases — they occur when multiple phase masks
    // complete simultaneously (e.g., at the solved state at the end of a
    // solve). Including them would show confusing 0-move, 0-duration phases
    // in the UI. The phase names are still available via timeline.phases for
    // method-specific calculators (CFOPMetricsCalculator, etc.).
    const phasesMetrics: PhaseMetrics[] = phases
      .filter((p) => p.moveCount > 0)
      .map((p) => ({
        phaseName: p.phaseName,
        durationMs: p.durationMs,
        executionMs: p.executionMs,
        recognitionMs: p.recognitionMs,
        transitionMs: p.transitionMs,
        skipped: p.skipped,
        moveCount: p.moveCount,
        tps: p.durationMs > 0
          ? Math.round((p.moveCount / (p.durationMs / 1000)) * 100) / 100
          : 0,
        pauseCount: 0, // computed below
        pauseTimeMs: 0,
      }));

    // ─── Core Metrics ───────────────────────────────────────────────────
    // Detect pauses first (TPS needs pauseTimeMs for effective TPS)
    const pauses: PauseMetrics = PauseDetector.detect(timeline);

    const tps: TPSMetrics = TPSCalculator.compute(timeline, pauses.totalPauseTimeMs);
    const fluidity: FluidityMetrics = FluidityCalculator.compute(timeline);
    const rotation: RotationMetrics = RotationCounter.compute(timeline);

    // ─── Advanced Metrics ───────────────────────────────────────────────
    const efficiency: EfficiencyMetrics = await EfficiencyCalculator.compute(
      timeline,
      scramble,
    );
    const redundancy: RedundancyResult = RedundancyDetector.analyze(timeline);

    // ─── Update phase-level pause counts ────────────────────────────────
    for (const p of pauses.pauses) {
      const phaseMetric = phasesMetrics.find((pm) => pm.phaseName === p.phase);
      if (phaseMetric) {
        phaseMetric.pauseCount++;
        phaseMetric.pauseTimeMs += p.durationMs;
      }
    }

    // ─── Method-specific metrics ────────────────────────────────────────
    const method = timeline.method.toLowerCase();
    let cfop: CFOPMetrics | undefined;
    let roux: RouxMetrics | undefined;

    if (method === 'cfop') {
      cfop = CFOPMetricsCalculator.compute(timeline);
    } else if (method === 'roux') {
      roux = RouxMetricsCalculator.compute(timeline);
    }

    return {
      solveId: timeline.solveId,
      totalTimeMs,
      totalMoves,
      phases: phasesMetrics,
      detectionReport: timeline.detectionReport,
      tps,
      pauses,
      fluidity,
      efficiency,
      rotation,
      redundancy,
      cfop,
      roux,
    };
  }

  /**
   * Run only core metrics (faster, for real-time feedback).
   */
  static computeCore(timeline: SolveTimeline): {
    totalTimeMs: number;
    totalMoves: number;
    phases: PhaseMetrics[];
    tps: TPSMetrics;
    pauses: PauseMetrics;
    fluidity: FluidityMetrics;
    rotation: RotationMetrics;
    detectionReport?: SolveMetrics['detectionReport'];
  } {
    const { entries, phases } = timeline;

    const totalTimeMs = MetricsAggregator.totalTimeMs(timeline);
    const totalMoves = entries.length;
    const pauses: PauseMetrics = PauseDetector.detect(timeline);
    const tps: TPSMetrics = TPSCalculator.compute(timeline, pauses.totalPauseTimeMs);
    const fluidity: FluidityMetrics = FluidityCalculator.compute(timeline);
    const rotation: RotationMetrics = RotationCounter.compute(timeline);

    // Filter out zero-move phases (same rationale as computeAll)
    const phasesMetrics: PhaseMetrics[] = phases
      .filter((p) => p.moveCount > 0)
      .map((p) => ({
        phaseName: p.phaseName,
        durationMs: p.durationMs,
        executionMs: p.executionMs,
        recognitionMs: p.recognitionMs,
        transitionMs: p.transitionMs,
        skipped: p.skipped,
        moveCount: p.moveCount,
        tps: p.durationMs > 0
          ? Math.round((p.moveCount / (p.durationMs / 1000)) * 100) / 100
          : 0,
        pauseCount: 0,
        pauseTimeMs: 0,
      }));

    for (const p of pauses.pauses) {
      const phaseMetric = phasesMetrics.find((pm) => pm.phaseName === p.phase);
      if (phaseMetric) {
        phaseMetric.pauseCount++;
        phaseMetric.pauseTimeMs += p.durationMs;
      }
    }

    return {
      totalTimeMs,
      totalMoves,
      phases: phasesMetrics,
      tps,
      pauses,
      fluidity,
      rotation,
      detectionReport: timeline.detectionReport,
    };
  }

  /** Prefer the timer's authoritative duration over move-event timestamps. */
  private static totalTimeMs(timeline: SolveTimeline): number {
    if (timeline.solveTimeMs !== undefined && Number.isFinite(timeline.solveTimeMs)) {
      return Math.max(0, timeline.solveTimeMs);
    }
    return Math.max(0, timeline.endTimestamp - timeline.startTimestamp);
  }
}
