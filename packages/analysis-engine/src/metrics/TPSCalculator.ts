import type { SolveTimeline, TPSMetrics } from '@cubalyze/types';

/**
 * Calculates Turns Per Second (TPS) metrics from a SolveTimeline.
 *
 * TPS is the fundamental speed metric in speedcubing. This calculator
 * computes:
 *   - Global TPS: total moves / total time
 *   - Effective TPS: total moves / (total time - pause time)
 *   - Per-phase TPS: moves in phase / phase duration
 *   - Peak instantaneous TPS: max TPS in any 1-second sliding window
 */
export class TPSCalculator {
  /** Default window size for instantaneous TPS calculation (in ms). */
  static readonly DEFAULT_WINDOW_MS = 1000;

  /** Minimum moves required in a window for valid instantaneous TPS. */
  static readonly MIN_MOVES_FOR_WINDOW = 2;

  /**
   * Compute all TPS metrics for a solve timeline.
   *
   * @param timeline - The annotated SolveTimeline (must have phases set).
   * @param pauseTimeMs - Total pause time in ms (from PauseDetector).
   * @returns TPSMetrics object.
   */
  static compute(
    timeline: SolveTimeline,
    pauseTimeMs = 0,
  ): TPSMetrics {
    const { entries, phases } = timeline;

    if (entries.length === 0) {
      return {
        global: 0,
        effective: 0,
        byPhase: {},
        peakInstantaneous: 0,
      };
    }

    const totalTimeMs = timeline.solveTimeMs !== undefined && Number.isFinite(timeline.solveTimeMs)
      ? Math.max(0, timeline.solveTimeMs)
      : Math.max(0, timeline.endTimestamp - timeline.startTimestamp);
    const effectiveTimeMs = Math.max(1, totalTimeMs - pauseTimeMs);

    // Global TPS
    const global = totalTimeMs > 0 ? entries.length / (totalTimeMs / 1000) : 0;

    // Effective TPS (excluding pauses)
    const effective = entries.length / (effectiveTimeMs / 1000);

    // Per-phase TPS
    const byPhase: Record<string, number> = {};
    for (const phase of phases) {
      const phaseMoves = phase.moveCount;
      const phaseTimeMs = phase.durationMs;
      if (phaseTimeMs > 0) {
        byPhase[phase.phaseName] = phaseMoves / (phaseTimeMs / 1000);
      } else {
        byPhase[phase.phaseName] = 0;
      }
    }

    // Peak instantaneous TPS (sliding window of 1 second)
    const peak = TPSCalculator.computePeakTPS(
      entries,
      TPSCalculator.DEFAULT_WINDOW_MS,
    );

    return {
      global: Math.round(global * 100) / 100,
      effective: Math.round(effective * 100) / 100,
      byPhase,
      peakInstantaneous: Math.round(peak * 100) / 100,
    };
  }

  /**
   * Compute the maximum TPS in any sliding window of `windowMs` duration.
   *
   * Uses a two-pointer sliding window algorithm. For each window,
   * TPS = (number of moves in window) / (window duration in seconds).
   */
  static computePeakTPS(
    entries: SolveTimeline['entries'],
    windowMs = 1000,
  ): number {
    if (entries.length < TPSCalculator.MIN_MOVES_FOR_WINDOW) return 0;

    let maxTPS = 0;
    let left = 0;

    for (let right = 0; right < entries.length; right++) {
      const rightTs = entries[right].hostTimestamp;

      // Shrink window from left until within windowMs
      while (
        left < right &&
        rightTs - entries[left].hostTimestamp > windowMs
      ) {
        left++;
      }

      const moveCount = right - left + 1;
      if (moveCount >= TPSCalculator.MIN_MOVES_FOR_WINDOW) {
        const windowDuration = (rightTs - entries[left].hostTimestamp) / 1000;
        if (windowDuration > 0) {
          const tps = moveCount / windowDuration;
          if (tps > maxTPS) maxTPS = tps;
        }
      }
    }

    return maxTPS;
  }

  /**
   * Compute TPS for a specific phase by name.
   */
  static phaseTPS(timeline: SolveTimeline, phaseName: string): number | null {
    const phase = timeline.phases.find((p) => p.phaseName === phaseName);
    if (!phase || phase.durationMs <= 0) return null;

    return phase.moveCount / (phase.durationMs / 1000);
  }

  /**
   * Compute instantaneous TPS values for a sliding window of N moves.
   * Returns an array of TPS values, one per window position.
   */
  static instantaneousWindow(
    entries: SolveTimeline['entries'],
    moveWindow = 5,
  ): number[] {
    if (entries.length < moveWindow) return [];

    const result: number[] = [];

    for (let i = moveWindow - 1; i < entries.length; i++) {
      const startEntry = entries[i - moveWindow + 1];
      const endEntry = entries[i];
      const duration = (endEntry.hostTimestamp - startEntry.hostTimestamp) / 1000;

      if (duration > 0) {
        result.push(moveWindow / duration);
      } else {
        result.push(0);
      }
    }

    return result;
  }
}
