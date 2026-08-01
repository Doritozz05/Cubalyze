import type {
  SolveTimeline,
  PauseMetrics,
  PauseDetail,
} from '@cubeforge/types';

/**
 * Detects and classifies pauses in a solve timeline.
 *
 * A pause is a gap between consecutive moves that exceeds a configurable
 * threshold. Pauses are classified into three categories:
 *   - mid-phase: pause within a single phase
 *   - pre-algorithm: pause just before the last layer (OLL/PLL or CMLL)
 *   - transition: pause between two different phases
 */
export class PauseDetector {
  /** Default pause threshold in milliseconds. */
  static readonly DEFAULT_THRESHOLD_MS = 500;

  /**
   * Estimated turn execution time to subtract from inter-move gaps.
   *
   * Inter-move gaps include both recognition/reaction time AND the
   * physical turn time. We subtract this to isolate recognition pauses.
   * Set to 0 to count raw inter-move gaps as pauses.
   */
  static readonly TURN_EXECUTION_MS = 100;

  /** Threshold for "long" pauses (potential lookahead loss). */
  static readonly LONG_PAUSE_THRESHOLD_MS = 1500;

  /** Threshold for "critical" pauses (potential error). */
  static readonly CRITICAL_PAUSE_THRESHOLD_MS = 3000;

  /**
   * Detect all pauses in a solve timeline.
   *
   * @param timeline - The annotated SolveTimeline.
   * @param thresholdMs - Minimum gap to classify as a pause (default 500ms).
   * @returns PauseMetrics with all detected pauses.
   */
  static detect(
    timeline: SolveTimeline,
    thresholdMs = PauseDetector.DEFAULT_THRESHOLD_MS,
  ): PauseMetrics {
    const { entries, phases } = timeline;

    if (entries.length < 2) {
      return {
        totalCount: 0,
        maxDurationMs: 0,
        avgDurationMs: 0,
        byPhase: {},
        totalPauseTimeMs: 0,
        pauseRatio: 0,
        pauses: [],
      };
    }

    const pauses: PauseDetail[] = [];
    const totalTimeMs = timeline.solveTimeMs !== undefined && Number.isFinite(timeline.solveTimeMs)
      ? Math.max(0, timeline.solveTimeMs)
      : Math.max(0, timeline.endTimestamp - timeline.startTimestamp);
    let totalPauseTimeMs = 0;

    // Scan for gaps between consecutive moves
    for (let i = 0; i < entries.length - 1; i++) {
      const current = entries[i];
      const next = entries[i + 1];
      const gapMs = next.hostTimestamp - current.hostTimestamp;
      // Out-of-order events are reported by PhaseSplitter and must not create
      // negative pause durations or corrupt aggregate pause time.
      if (!Number.isFinite(gapMs) || gapMs < 0) continue;

      // A gap between moves could be a deliberate pause or just slow turning.
      // We subtract a "reasonable turn time" of ~100ms to avoid flagging
      // normal turning speed as pauses.
      const effectiveGapMs = gapMs - PauseDetector.TURN_EXECUTION_MS;

      if (effectiveGapMs >= thresholdMs) {
        const category = PauseDetector.classifyPause(
          current,
          next,
          phases,
        );

        const pause: PauseDetail = {
          startIndex: i,
          endIndex: i + 1,
          durationMs: Math.round(effectiveGapMs),
          phase: current.phaseName || 'unknown',
          category,
        };

        pauses.push(pause);
        totalPauseTimeMs += effectiveGapMs;
      }
    }

    // Per-phase pause stats
    const byPhase: Record<string, { count: number; avgMs: number }> = {};
    for (const pause of pauses) {
      if (!byPhase[pause.phase]) {
        byPhase[pause.phase] = { count: 0, avgMs: 0 };
      }
      byPhase[pause.phase].count++;
      byPhase[pause.phase].avgMs += pause.durationMs;
    }

    // Finalize per-phase averages
    for (const key of Object.keys(byPhase)) {
      const stats = byPhase[key];
      stats.avgMs = Math.round(stats.avgMs / stats.count);
    }

    const totalCount = pauses.length;
    const maxDurationMs = pauses.length > 0
      ? Math.max(...pauses.map((p) => p.durationMs))
      : 0;
    const avgDurationMs = totalCount > 0
      ? Math.round(totalPauseTimeMs / totalCount)
      : 0;

    return {
      totalCount,
      maxDurationMs,
      avgDurationMs,
      byPhase,
      totalPauseTimeMs,
      pauseRatio: totalTimeMs > 0
        ? Math.min(1, Math.round((totalPauseTimeMs / totalTimeMs) * 1000) / 1000)
        : 0,
      pauses,
    };
  }

  /**
   * Classify a pause based on its position in the solve.
   *
   * Categories:
   *   - 'pre-algorithm': pause just before OLL, PLL, or CMLL (last layer)
   *   - 'transition': pause at a phase boundary
   *   - 'mid-phase': pause within the same phase
   */
  private static classifyPause(
    current: SolveTimeline['entries'][number],
    next: SolveTimeline['entries'][number],
    phases: SolveTimeline['phases'],
  ): PauseDetail['category'] {
    // If the next entry starts a new phase, it's a transition pause
    if (
      current.phaseId !== undefined &&
      next.phaseId !== undefined &&
      current.phaseId !== next.phaseId
    ) {
      return 'transition';
    }

    // If the next phase is a last-layer phase (OLL, PLL, CMLL, LL),
    // it's a pre-algorithm pause
    const nextPhaseName = next.phaseName?.toLowerCase() || '';
    if (
      nextPhaseName === 'oll' ||
      nextPhaseName === 'pll' ||
      nextPhaseName === 'cmll' ||
      nextPhaseName === 'll'
    ) {
      return 'pre-algorithm';
    }

    return 'mid-phase';
  }

  /**
   * Count long pauses (> LONG_PAUSE_THRESHOLD_MS).
   */
  static longPauses(metrics: PauseMetrics): PauseDetail[] {
    return metrics.pauses.filter(
      (p) => p.durationMs >= PauseDetector.LONG_PAUSE_THRESHOLD_MS,
    );
  }

  /**
   * Count critical pauses (> CRITICAL_PAUSE_THRESHOLD_MS).
   */
  static criticalPauses(metrics: PauseMetrics): PauseDetail[] {
    return metrics.pauses.filter(
      (p) => p.durationMs >= PauseDetector.CRITICAL_PAUSE_THRESHOLD_MS,
    );
  }
}
