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
    // Keep zero-move phases: a simultaneous completion is a valid CFOP skip
    // (for example OLL or PLL skip) and must remain represented in the
    // canonical four-phase contract.
    const phasesMetrics: PhaseMetrics[] = phases
      .map((p) => ({
        phaseName: p.phaseName,
        durationMs: p.durationMs,
        executionMs: p.executionMs,
        recognitionMs: p.recognitionMs,
        transitionMs: p.transitionMs,
        skipped: p.skipped,
        moveCount: p.moveCount,
        tps: p.skipped || p.durationMs <= 0
          ? 0
          : Math.round((p.moveCount / (p.durationMs / 1000)) * 100) / 100,
        pauseCount: 0, // computed below
        pauseTimeMs: 0,
      }));

    // ─── Method-specific metrics ────────────────────────────────────────
    // Computed BEFORE the pauses: CFOP pair boundaries feed the pause
    // classifier so inter-pair gaps are recognized as pair recognition
    // instead of mid-phase hesitation.
    const method = timeline.method.toLowerCase();
    let cfop: CFOPMetrics | undefined;
    let roux: RouxMetrics | undefined;

    if (method === 'cfop') {
      cfop = CFOPMetricsCalculator.compute(timeline);
    } else if (method === 'roux') {
      roux = RouxMetricsCalculator.compute(timeline);
    }

    // First-move index of every F2L pair: a gap landing on one of these is
    // recognition of the next pair, not a mid-phase hesitation.
    const pairStarts =
      cfop && cfop.f2lPairs.length > 0
        ? new Set(
            cfop.f2lPairs
              .map((p) => (p.completionIndex ?? -1) - Math.max(0, p.moves ?? 0) + 1)
              .filter((i) => i >= 0),
          )
        : undefined;

    // ─── Core Metrics ───────────────────────────────────────────────────
    // Detect pauses first (TPS needs pauseTimeMs for effective TPS)
    const pauses: PauseMetrics = PauseDetector.detect(
      timeline,
      PauseDetector.DEFAULT_THRESHOLD_MS,
      pairStarts ? { pairStarts } : undefined,
    );

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
      // Boundary "recognition" gaps are accounted in each phase's
      // recognitionMs, not as internal pause time.
      if (p.category === 'recognition') continue;
      const phaseMetric = phasesMetrics.find((pm) => pm.phaseName === p.phase);
      if (phaseMetric) {
        phaseMetric.pauseCount++;
        phaseMetric.pauseTimeMs += p.durationMs;
      }
    }

    // Pure execution = phase duration minus internal pauses (recognition
    // gaps live outside the phase's own span, in recognitionMs).
    for (const pm of phasesMetrics) {
      if (pm.skipped) continue;
      pm.executionMs = Math.max(0, pm.durationMs - pm.pauseTimeMs);
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

    // Preserve zero-move phases so valid OLL/PLL skips remain comparable.
    const phasesMetrics: PhaseMetrics[] = phases
      .map((p) => ({
        phaseName: p.phaseName,
        durationMs: p.durationMs,
        executionMs: p.executionMs,
        recognitionMs: p.recognitionMs,
        transitionMs: p.transitionMs,
        skipped: p.skipped,
        moveCount: p.moveCount,
        tps: p.skipped || p.durationMs <= 0
          ? 0
          : Math.round((p.moveCount / (p.durationMs / 1000)) * 100) / 100,
        pauseCount: 0,
        pauseTimeMs: 0,
      }));

    for (const p of pauses.pauses) {
      // Boundary "recognition" gaps are accounted in each phase's
      // recognitionMs, not as internal pause time.
      if (p.category === 'recognition') continue;
      const phaseMetric = phasesMetrics.find((pm) => pm.phaseName === p.phase);
      if (phaseMetric) {
        phaseMetric.pauseCount++;
        phaseMetric.pauseTimeMs += p.durationMs;
      }
    }

    // Pure execution = phase duration minus internal pauses (recognition
    // gaps live outside the phase's own span, in recognitionMs).
    for (const pm of phasesMetrics) {
      if (pm.skipped) continue;
      pm.executionMs = Math.max(0, pm.durationMs - pm.pauseTimeMs);
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
