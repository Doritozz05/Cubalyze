import type { SolveTimeline, RouxMetrics } from '@cubeforge/types';

/**
 * Computes Roux-specific metrics from a solve timeline.
 *
 * Requires the timeline to already be annotated with Roux phases
 * (First Block, Second Block, CMLL, LSE-EO, LSE-ULUR, LSE)
 * via PhaseSplitter.
 */
export class RouxMetricsCalculator {
  /**
   * Compute all Roux-specific metrics.
   */
  static compute(timeline: SolveTimeline): RouxMetrics {
    const { entries, phases } = timeline;

    const defaultResult: RouxMetrics = {
      firstBlockMoves: 0,
      firstBlockTPS: 0,
      firstBlockEfficiency: 0,
      secondBlockMoves: 0,
      secondBlockTPS: 0,
      sbSquareTimeMs: 0,
      cmllRecognitionMs: 0,
      cmllExecutionMs: 0,
      cmllTPS: 0,
      lseEOTimeMs: 0,
      lseULURTimeMs: 0,
      lseMsliceTimeMs: 0,
    };

    if (entries.length === 0) return defaultResult;

    // ─── First Block ────────────────────────────────────────────────────
    const fbPhase = phases.find((p) => p.phaseName === 'First Block');
    if (fbPhase) {
      defaultResult.firstBlockMoves = fbPhase.moveCount;
      defaultResult.firstBlockTPS = fbPhase.durationMs > 0
        ? Math.round((fbPhase.moveCount / (fbPhase.durationMs / 1000)) * 100) / 100
        : 0;
      // Optimal FB is typically 5-7 moves
      defaultResult.firstBlockEfficiency = fbPhase.moveCount <= 7
        ? Math.round((fbPhase.moveCount / 7) * 100) / 100
        : Math.round((7 / fbPhase.moveCount) * 100) / 100;
    }

    // ─── Second Block ───────────────────────────────────────────────────
    const sbPhase = phases.find((p) => p.phaseName === 'Second Block');
    if (sbPhase) {
      defaultResult.secondBlockMoves = sbPhase.moveCount;
      defaultResult.secondBlockTPS = sbPhase.durationMs > 0
        ? Math.round((sbPhase.moveCount / (sbPhase.durationMs / 1000)) * 100) / 100
        : 0;

      // SB square time: approximate as first half of SB
      const sbMidPoint = Math.floor((sbPhase.startIndex + sbPhase.endIndex) / 2);
      if (sbMidPoint > sbPhase.startIndex) {
        defaultResult.sbSquareTimeMs =
          entries[sbMidPoint].hostTimestamp - entries[sbPhase.startIndex].hostTimestamp;
      }
    }

    // ─── CMLL ───────────────────────────────────────────────────────────
    const cmllPhase = phases.find((p) => p.phaseName === 'CMLL');
    if (cmllPhase && cmllPhase.startIndex > 0) {
      const preCMLLEntry = entries[cmllPhase.startIndex - 1];
      const firstCMLLEntry = entries[cmllPhase.startIndex];
      defaultResult.cmllRecognitionMs = Math.max(
        0,
        firstCMLLEntry.hostTimestamp - preCMLLEntry.hostTimestamp,
      );
      defaultResult.cmllExecutionMs = Math.max(
        0,
        cmllPhase.durationMs - defaultResult.cmllRecognitionMs,
      );
      defaultResult.cmllTPS = cmllPhase.moveCount > 0 && cmllPhase.durationMs > 0
        ? Math.round((cmllPhase.moveCount / (cmllPhase.durationMs / 1000)) * 100) / 100
        : 0;
    }

    // ─── LSE sub-phases ─────────────────────────────────────────────────
    const eoPhase = phases.find((p) => p.phaseName === 'LSE-EO');
    const ulurPhase = phases.find((p) => p.phaseName === 'LSE-ULUR');
    const lsePhase = phases.find((p) => p.phaseName === 'LSE');

    if (eoPhase) {
      defaultResult.lseEOTimeMs = eoPhase.durationMs;
    }
    if (ulurPhase) {
      defaultResult.lseULURTimeMs = ulurPhase.durationMs;
    }
    if (lsePhase && eoPhase && ulurPhase) {
      // LSE phase (the last phase) starts after ULUR completes.
      // Its duration IS the M-slice time.
      defaultResult.lseMsliceTimeMs = lsePhase.durationMs;
    }

    return defaultResult;
  }
}
