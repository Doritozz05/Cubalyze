import {
  StateMatcher,
  ColorPhaseDetector,
  type MethodDefinition,
  type PhaseMask,
  COLOR_NEUTRAL_CFOP_MASKS,
  countCompletedF2LSlotsInFrame,
  rotateDPlusEBlock,
  IDENTITY_SCHEME,
} from '@cubeforge/math-core';
import type {
  CubeFace,
  InitialStateSource,
  PhaseDetectionConfidence,
  PhaseDetectionReport,
  PhaseDetectionWarning,
  PhaseSegment,
  SolveTimeline,
} from '@cubeforge/types';
import type { CubeState } from '@cubeforge/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { pickSlotFrame } from '../pipeline/slotFrame';

type SplitOptions = {
  colorNeutral?: boolean;
  /** Require every phase and a solved final state when validating. */
  strict?: boolean;
  /**
   * TIEBREAK-ONLY hint for color-neutral detection: the timeline index where
   * the solver's written cross segment ends (from the reconstruction text).
   * Used only when two crosses are indistinguishable by state (same phase
   * chain, same longevity); never used to detect a cross. Undefined = no hint.
   */
  preferredCrossIdx?: number;
};

type DetectionRun = {
  phases: PhaseSegment[];
  crossFace?: CubeFace;
  /** The solver's cross color (canonical face letter), from color-neutral detection. */
  crossColor?: CubeFace;
  /** The winning AUF-corrected scheme (face → color) used to evaluate F2L slots. */
  scheme?: Record<string, string>;
};

/**
 * Splits a SolveTimeline into ordered phase segments.
 *
 * Phase masks describe completion states, not recognition timestamps. A
 * segment therefore owns the moves since the previous completion, while
 * `completionIndex` records the exact move at which its mask matched.
 * Recognition time is deliberately not guessed here; only measurable gaps
 * between phase completions are exposed as `transitionMs`.
 */
export class PhaseSplitter {
  static split(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): PhaseSegment[] {
    return PhaseSplitter.detect(timeline, method, options).phases;
  }

  /**
   * Produce a complete detection report without mutating the timeline.
   */
  static getDetectionReport(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): PhaseDetectionReport {
    return PhaseSplitter.buildReport(timeline, method, options);
  }

  /**
   * Split and annotate a timeline in one step. The report is attached to the
   * timeline so downstream metrics can decide whether a solve is comparable.
   */
  static splitAndAnnotate(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): SolveTimeline {
    const report = PhaseSplitter.buildReport(timeline, method, options);
    TimelineBuilder.annotatePhases(timeline, report.phases);
    timeline.detectionReport = report;
    return timeline;
  }

  static getTransitionIndices(
    timeline: SolveTimeline,
    method: MethodDefinition,
  ): number[] {
    return PhaseSplitter.split(timeline, method).map((phase) => phase.endIndex);
  }

  static hasPhase(
    timeline: SolveTimeline,
    method: MethodDefinition,
    phaseName: string,
  ): boolean {
    return PhaseSplitter.split(timeline, method).some(
      (phase) => phase.phaseName === phaseName,
    );
  }

  /**
   * Validate detected boundaries. The default validates the boundaries
   * that were found; `{ strict: true }` additionally requires a complete
   * phase sequence and a solved final state.
   */
  static validate(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): boolean {
    const report = PhaseSplitter.buildReport(timeline, method, options);
    if (report.phases.length === 0) return false;

    // Color-based detection verifies each phase by sticker GEOMETRY (any
    // cross color on any face). Re-checking those phases against the
    // piece-anchored masks would reject every non-canonical style (e.g. the
    // standard white cross on D), so the mask re-verification only applies to
    // canonical mask detection.
    const useColorNeutral = options?.colorNeutral === true && method.name === 'CFOP';
    if (!useColorNeutral) {
      const masks = PhaseSplitter.masksForReport(method, report);
      for (let phaseIndex = 0; phaseIndex < report.phases.length; phaseIndex++) {
        const phase = report.phases[phaseIndex];
        if (phase.skipped || phase.completionIndex === undefined) continue;

        const entry = timeline.entries[phase.completionIndex];
        const mask = masks[phaseIndex];
        if (!entry || !mask) return false;

        const state = TimelineBuilder.fromSnapshot(entry.state);
        if (!StateMatcher.matchesMask(state, mask)) return false;
      }
    }

    if (options?.strict && (!report.complete || !report.finalStateSolved)) {
      return false;
    }

    return true;
  }

  private static detect(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): DetectionRun {
    if (timeline.entries.length === 0 || method.phases.length === 0) {
      return { phases: [] };
    }

    const useColorNeutral = options?.colorNeutral === true && method.name === 'CFOP';
    if (useColorNeutral) {
      // Color-based detection: recognizes the cross by the sticker geometry,
      // so any cross color on any face (including the standard white-on-D
      // style, which piece-anchored masks cannot see) is detected.
      const colorRun = PhaseSplitter.detectColorNeutral(timeline, options?.preferredCrossIdx);
      if (colorRun.phases.length > 0) return colorRun;
    }

    return { phases: PhaseSplitter.runDetection(timeline, method.phases) };
  }

  /**
   * Color-based CFOP detection: any cross color on any face, re-colored to the
   * solver's scheme. Falls back to an empty run when no cross is ever complete.
   */
  private static detectColorNeutral(
    timeline: SolveTimeline,
    preferredCrossIdx?: number,
  ): DetectionRun {
    const states = timeline.entries.map((entry) =>
      TimelineBuilder.fromSnapshot(entry.state),
    );
    const result = ColorPhaseDetector.detect(states, preferredCrossIdx);
    if (!result || result.completions[0] < 0) return { phases: [] };

    // Only found completions become segments (mirroring runDetection, which
    // stops at the first missing mask). Trailing -1 means the phase never
    // completed and must not be indexed.
    const found: number[] = [];
    for (const completion of result.completions) {
      if (completion < 0) break;
      found.push(completion);
    }
    const phases = PhaseSplitter.buildSegments(
      timeline,
      ['Cross', 'F2L', 'OLL', 'PLL'],
      found,
    );
    return {
      phases,
      crossFace: result.crossFace as CubeFace,
      crossColor: result.crossColor as CubeFace,
      scheme: result.scheme as Record<string, string>,
    };
  }

  private static runDetection(
    timeline: SolveTimeline,
    masks: readonly PhaseMask[],
  ): PhaseSegment[] {
    const { entries } = timeline;
    const completions: number[] = [];
    let searchFrom = 0;

    for (const mask of masks) {
      let completionIndex = -1;
      for (let i = searchFrom; i < entries.length; i++) {
        const state = TimelineBuilder.fromSnapshot(entries[i].state);
        if (StateMatcher.matchesMask(state, mask)) {
          completionIndex = i;
          break;
        }
      }
      if (completionIndex < 0) break;
      completions.push(completionIndex);
      // Start at the same state to allow OLL/PLL (or other nested masks) to
      // complete simultaneously. A later phase naturally searches forward.
      searchFrom = completionIndex;
    }

    return PhaseSplitter.buildSegments(
      timeline,
      masks.map((mask) => mask.name),
      completions,
    );
  }

  /**
   * Build ordered phase segments from precomputed completion indices.
   *
   * A non-skipped phase owns the moves after the previous completion up to and
   * including its completion move. A skipped phase (same completion index as
   * the previous one) owns no move; its indices remain addressable for
   * compatibility consumers, while `skipped` is the source of truth for
   * annotation and metrics.
   */
  private static buildSegments(
    timeline: SolveTimeline,
    names: readonly string[],
    completions: readonly number[],
  ): PhaseSegment[] {
    const { entries } = timeline;
    const phases: PhaseSegment[] = [];
    let previousCompletion = -1;

    for (let k = 0; k < completions.length; k++) {
      const phaseName = names[k];
      const completionIndex = completions[k];
      const skipped = completionIndex === previousCompletion;
      const startIndex = skipped ? completionIndex : previousCompletion + 1;
      const endIndex = completionIndex;
      const startTimestamp = skipped
        ? entries[completionIndex].hostTimestamp
        : entries[previousCompletion + 1]?.hostTimestamp ?? entries[completionIndex].hostTimestamp;
      const endTimestamp = entries[completionIndex].hostTimestamp;
      const durationMs = skipped
        ? 0
        : PhaseSplitter.safeElapsed(startTimestamp, endTimestamp);
      const transitionMs = phases.length > 0
        ? PhaseSplitter.safeElapsed(
            phases[phases.length - 1].endTimestamp,
            startTimestamp,
          )
        : 0;

      phases.push({
        phaseName,
        startIndex,
        endIndex,
        completionIndex,
        startTimestamp,
        endTimestamp,
        durationMs,
        executionMs: durationMs,
        recognitionMs: 0,
        transitionMs,
        skipped,
        moveCount: skipped ? 0 : endIndex - startIndex + 1,
      });

      previousCompletion = completionIndex;
    }

    // Preserve the invariant that a fully detected solve covers any trailing
    // events after the last completion. Those events belong to the final
    // non-skipped phase; a skipped terminal phase remains zero-move.
    if (completions.length === names.length && phases.length > 0) {
      const lastPhase = [...phases].reverse().find((phase) => !phase.skipped);
      if (lastPhase && lastPhase.endIndex < entries.length - 1) {
        lastPhase.endIndex = entries.length - 1;
        lastPhase.endTimestamp = entries[entries.length - 1].hostTimestamp;
        lastPhase.durationMs = PhaseSplitter.safeElapsed(
          lastPhase.startTimestamp,
          lastPhase.endTimestamp,
        );
        lastPhase.executionMs = lastPhase.durationMs;
        lastPhase.moveCount = lastPhase.endIndex - lastPhase.startIndex + 1;
      }
    }

    return phases;
  }

  private static buildReport(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: SplitOptions,
  ): PhaseDetectionReport {
    const detection = PhaseSplitter.detect(timeline, method, options);
    const expectedPhases = method.phases.map((phase) => phase.name);
    const complete = detection.phases.length >= expectedPhases.length;
    const finalStateSolved = PhaseSplitter.finalStateSolved(timeline);
    const initialStateSource: InitialStateSource =
      timeline.initialStateSource ?? 'unknown';
    const warnings: PhaseDetectionWarning[] = [];

    if (detection.phases.length < expectedPhases.length) {
      warnings.push('missing-phase', 'incomplete-solve');
    }
    if (timeline.entries.length > 0 && !finalStateSolved) {
      warnings.push('final-state-not-solved');
    }
    if (initialStateSource === 'unknown') warnings.push('initial-state-unknown');
    if (initialStateSource === 'scramble') warnings.push('scramble-only-seed');
    if (PhaseSplitter.hasNonMonotonicTimestamps(timeline)) {
      warnings.push('non-monotonic-timestamps');
    }
    if (PhaseSplitter.hasNonFiniteTimestamps(timeline)) {
      warnings.push('non-finite-timestamps');
    }

    const crossFace = detection.crossFace;
    if (method.name === 'CFOP' && crossFace && !['D', 'U'].includes(crossFace)) {
      warnings.push('side-cross-approximation');
    }
    if (detection.phases.some((phase) => phase.skipped)) {
      warnings.push('phase-skip', 'advanced-technique-possible');
    }

    // ─── CFOP advanced techniques: XCross / XXCross + explicit skips ────
    // XCross: an F2L pair is already solved (edge+corner home, oriented) at
    // the moment the cross completes. Evaluated in the SOLVER's frame via the
    // ColorPhaseDetector scheme (any cross color); the canonical mask path
    // falls back to the identity scheme (canonical D-cross).
    const crossColor = detection.crossColor;
    const scheme = detection.scheme;
    let crossType: PhaseDetectionReport['crossType'];
    let xcrossPairs: PhaseDetectionReport['xcrossPairs'];
    const skips: NonNullable<PhaseDetectionReport['skips']> = [];

    if (method.name === 'CFOP') {
      if (detection.phases.some((p) => p.phaseName === 'OLL' && p.skipped)) {
        skips.push('oll');
      }
      if (detection.phases.some((p) => p.phaseName === 'PLL' && p.skipped)) {
        skips.push('pll');
      }

      const crossPhase = detection.phases.find((p) => p.phaseName === 'Cross');
      if (crossPhase && crossPhase.completionIndex !== undefined) {
        // The cross may complete DISALIGNED (its edges on the cross face but
        // not yet aligned with the side centers); the solver aligns it within
        // 1-2 moves. A single move can never complete a slot from scratch, so
        // scanning the next two entries for the max slot count only ever
        // catches the alignment (no false positives from a fast first pair).
        //
        // SLOT ANALYSIS RUNS IN THE SOLVER'S FRAME: after P2 frame recovery
        // rotates the snapshots, piece-anchored slot checks no longer see the
        // pieces the solver solved (the whole frame shifted), so a genuine
        // xcross degrades to 'plain' (the Yiheng-12340 regression). The
        // pre-recovery solver-frame states (already rotated by the inspection
        // grip when one is known) are preserved on the timeline; the check
        // reads THOSE (undoing the accumulated D+E d-regrip offsets) instead
        // of the rotated timeline states. The crossFace/scheme come from
        // pickSlotFrame (the labeling under which the solver's pairs are
        // home), shared with the F2L pair scan so the two never diverge.
        //
        // Defensive: on incoherent solves the color detector can produce a
        // scheme whose re-coloring is not a valid cube (repeated colors) and
        // countCompletedF2LSlotsInFrame would throw. XCross info is a bonus —
        // degrade to 'plain' instead of failing the whole report.
        try {
          const f2lPhase = detection.phases.find((p) => p.phaseName === 'F2L');
          const picked = f2lPhase
            ? pickSlotFrame(
                timeline,
                crossFace,
                scheme ?? null,
                options?.preferredCrossIdx,
                f2lPhase.startIndex,
                f2lPhase.endIndex ?? f2lPhase.startIndex,
              )
            : { crossFace: crossFace ?? 'D', scheme: scheme ?? IDENTITY_SCHEME };
          const frameFace: CubeFace = picked.crossFace as CubeFace;
          const frameScheme = picked.scheme;
          const solverStates = timeline.solverFrameStates;
          const solverOffsets = timeline.solverFrameOffsets;
          const stateAt = (idx: number): CubeState => {
            const snapshot = solverStates?.[idx] ?? timeline.entries[idx]?.state;
            const cube = TimelineBuilder.fromSnapshot(snapshot);
            const offset = solverOffsets?.[idx] ?? 0;
            return offset === 0 ? cube : rotateDPlusEBlock(cube, -offset);
          };
          let best = countCompletedF2LSlotsInFrame(
            stateAt(crossPhase.completionIndex),
            frameFace,
            frameScheme,
          );
          for (let offset = 1; offset <= 2; offset++) {
            if (crossPhase.completionIndex + offset >= timeline.entries.length) break;
            const candidate = countCompletedF2LSlotsInFrame(
              stateAt(crossPhase.completionIndex + offset),
              frameFace,
              frameScheme,
            );
            if (candidate.completedCount > best.completedCount) best = candidate;
          }
          crossType =
            best.completedCount === 0
              ? 'plain'
              : best.completedCount === 1
                ? 'xcross'
                : best.completedCount === 2
                  ? 'xxcross'
                  : 'xxxcross';
          if (best.slots.length > 0) {
            xcrossPairs = best.slots.map((s) => ({
              slot: s.name,
              colors: s.colors,
            }));
          }
        } catch {
          crossType = 'plain';
        }
      }
    }

    const durationMs = PhaseSplitter.solveDuration(timeline);
    const phaseTimeMs = detection.phases.reduce(
      (sum, phase) => sum + Math.max(0, phase.durationMs),
      0,
    );
    const transitionTimeMs = detection.phases.reduce(
      (sum, phase) => sum + Math.max(0, phase.transitionMs ?? 0),
      0,
    );
    const unattributedTimeMs = Math.max(
      0,
      durationMs - phaseTimeMs - transitionTimeMs,
    );
    if (unattributedTimeMs > 0.5) warnings.push('unattributed-time');

    const uniqueWarnings = [...new Set(warnings)];
    const confidence: PhaseDetectionConfidence =
      timeline.entries.length === 0 || expectedPhases.length === 0
        ? 'invalid'
        : uniqueWarnings.includes('non-finite-timestamps')
          ? 'invalid'
          : !complete
            ? 'low'
            : uniqueWarnings.length > 0
              ? 'medium'
              : 'high';

    const phaseSchema = method.name !== 'CFOP'
      ? 'generic'
      : crossFace && !['D', 'U'].includes(crossFace)
        ? 'cfop-advanced'
        : 'cfop-canonical';

    return {
      method: method.name,
      expectedPhases,
      phases: detection.phases,
      complete,
      finalStateSolved,
      crossFace,
      crossColor,
      crossType,
      xcrossPairs,
      skips,
      confidence,
      warnings: uniqueWarnings,
      initialStateSource,
      phaseSchema,
      solveTimeMs: timeline.solveTimeMs,
      transitionTimeMs,
      unattributedTimeMs,
    };
  }

  private static masksForReport(
    method: MethodDefinition,
    report: PhaseDetectionReport,
  ): readonly PhaseMask[] {
    if (method.name === 'CFOP' && report.crossFace) {
      const faceMasks = COLOR_NEUTRAL_CFOP_MASKS.find(
        (face) => face.face === report.crossFace,
      );
      if (faceMasks) return faceMasks.masks;
    }
    return method.phases;
  }

  private static finalStateSolved(timeline: SolveTimeline): boolean {
    const last = timeline.entries[timeline.entries.length - 1];
    if (!last) return false;
    try {
      // A cube solved up to rotation (all faces uniform) IS a solved cube:
      // reconstructions routinely finish in a rotated frame (recon.nz frame
      // quirk), so the verdict must not depend on the canonical orientation.
      return TimelineBuilder.fromSnapshot(last.state).isSolvedUpToRotation();
    } catch {
      return false;
    }
  }

  private static solveDuration(timeline: SolveTimeline): number {
    if (timeline.solveTimeMs !== undefined && Number.isFinite(timeline.solveTimeMs)) {
      return Math.max(0, timeline.solveTimeMs);
    }
    return PhaseSplitter.safeElapsed(timeline.startTimestamp, timeline.endTimestamp);
  }

  private static safeElapsed(start: number, end: number): number {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    return Math.max(0, end - start);
  }

  private static hasNonMonotonicTimestamps(timeline: SolveTimeline): boolean {
    for (let i = 1; i < timeline.entries.length; i++) {
      const previous = timeline.entries[i - 1].hostTimestamp;
      const current = timeline.entries[i].hostTimestamp;
      if (Number.isFinite(previous) && Number.isFinite(current) && current < previous) {
        return true;
      }
    }
    return false;
  }

  private static hasNonFiniteTimestamps(timeline: SolveTimeline): boolean {
    return timeline.entries.some((entry) => !Number.isFinite(entry.hostTimestamp));
  }
}
