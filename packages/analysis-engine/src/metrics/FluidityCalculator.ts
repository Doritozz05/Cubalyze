import type { SolveTimeline, FluidityMetrics } from '@cubalyze/types';

/**
 * Calculates fluidity metrics from inter-move time intervals.
 *
 * Fluidity measures how smoothly a cuber transitions between moves.
 * High fluidity = consistent, rhythmic turning with minimal hesitation.
 * Low fluidity = stop-and-go style with high variance between moves.
 *
 * Metrics computed:
 *   - Standard deviation of inter-move times
 *   - Coefficient of variation (σ/μ)
 *   - Per-phase fluidity
 *   - Burst detection (sequences of rapid, low-variance moves)
 *   - Acceleration/deceleration event counts
 */
export class FluidityCalculator {
  /** Max moves considered for a burst window. */
  static readonly BURST_WINDOW = 4;

  /** CV threshold for a burst (lower = more consistent). */
  static readonly BURST_CV_THRESHOLD = 0.3;

  /** If a move is 150% faster than average, it's an acceleration. */
  static readonly ACCELERATION_FACTOR = 1.5;

  /** If a move is 50% slower than average, it's a deceleration. */
  static readonly DECELERATION_FACTOR = 0.5;

  /**
   * Compute fluidity metrics for a solve timeline.
   *
   * @param timeline - The annotated SolveTimeline.
   * @returns FluidityMetrics.
   */
  static compute(timeline: SolveTimeline): FluidityMetrics {
    const { entries, phases } = timeline;

    if (entries.length < 2) {
      return {
        stdDevMs: 0,
        coefficientOfVariation: 0,
        byPhase: {},
        burstCount: 0,
        accelerationCount: 0,
        decelerationCount: 0,
      };
    }

    // ─── Global inter-move times ──────────────────────────────────────────
    const intervals = FluidityCalculator.getIntervals(entries);
    if (intervals.length === 0) {
      return {
        stdDevMs: 0,
        coefficientOfVariation: 0,
        byPhase: {},
        burstCount: 0,
        accelerationCount: 0,
        decelerationCount: 0,
      };
    }

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, t) => sum + (t - meanInterval) ** 2, 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);
    const cov = meanInterval > 0 ? stdDev / meanInterval : 0;

    // ─── Per-phase fluidity ───────────────────────────────────────────────
    const byPhase: Record<string, number> = {};
    for (const phase of phases) {
      const phaseEntries = entries.slice(phase.startIndex, phase.endIndex + 1);
      if (phaseEntries.length < 2) {
        byPhase[phase.phaseName] = 0;
        continue;
      }

      const phaseIntervals = FluidityCalculator.getIntervals(phaseEntries);
      const pMean = phaseIntervals.reduce((a, b) => a + b, 0) / phaseIntervals.length;
      if (pMean === 0) {
        byPhase[phase.phaseName] = 0;
        continue;
      }
      const pVar =
        phaseIntervals.reduce((sum, t) => sum + (t - pMean) ** 2, 0) /
        phaseIntervals.length;
      const pStd = Math.sqrt(pVar);
      byPhase[phase.phaseName] = Math.round((pStd / pMean) * 1000) / 1000;
    }

    // ─── Burst detection ──────────────────────────────────────────────────
    let burstCount = 0;
    let inBurst = false;

    for (let i = 0; i <= intervals.length - FluidityCalculator.BURST_WINDOW; i++) {
      const window = intervals.slice(i, i + FluidityCalculator.BURST_WINDOW);
      const wMean = window.reduce((a, b) => a + b, 0) / window.length;
      const wVar =
        window.reduce((sum, t) => sum + (t - wMean) ** 2, 0) / window.length;
      const wStd = Math.sqrt(wVar);
      const wCv = wMean > 0 ? wStd / wMean : 0;

      if (wCv < FluidityCalculator.BURST_CV_THRESHOLD && !inBurst) {
        burstCount++;
        inBurst = true;
      } else if (wCv >= FluidityCalculator.BURST_CV_THRESHOLD) {
        inBurst = false;
      }
    }

    // ─── Acceleration / Deceleration events ───────────────────────────────
    let accelerationCount = 0;
    let decelerationCount = 0;

    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1];
      const curr = intervals[i];

      if (prev > 0 && curr > 0) {
        const ratio = prev / curr;
        if (ratio > FluidityCalculator.ACCELERATION_FACTOR) {
          accelerationCount++;
        } else if (ratio < FluidityCalculator.DECELERATION_FACTOR) {
          decelerationCount++;
        }
      }
    }

    return {
      stdDevMs: Math.round(stdDev),
      coefficientOfVariation: Math.round(cov * 1000) / 1000,
      byPhase,
      burstCount,
      accelerationCount,
      decelerationCount,
    };
  }

  /**
   * Extract inter-move time intervals from timeline entries.
   */
  private static getIntervals(
    entries: SolveTimeline['entries'],
  ): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const interval = entries[i].hostTimestamp - entries[i - 1].hostTimestamp;
      if (Number.isFinite(interval) && interval >= 0) intervals.push(interval);
    }
    return intervals;
  }
}
