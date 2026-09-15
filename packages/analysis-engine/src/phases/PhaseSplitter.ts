import {
  StateMatcher,
  ColorPhaseDetector,
  type MethodDefinition,
  type PhaseMask,
  COLOR_NEUTRAL_CFOP_MASKS,
  applyFrameRotation,
  bestFrameRotationSequence,
  countCompletedF2LSlotsInFrame,
  IDENTITY_SCHEME,
} from '@cubalyze/math-core';
import type {
  CubeFace,
  InitialStateSource,
  PhaseDetectionConfidence,
  PhaseDetectionReport,
  PhaseDetectionWarning,
  PhaseSegment,
  SolveTimeline,
} from '@cubalyze/types';
import type { CubeState } from '@cubalyze/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { pickSlotFrame } from '../pipeline/slotFrame';

type SplitOptions = {
  colorNeutral?: boolean;
  /**
   * Relax the cross-completion criterion to PERMUTATION only: the cross
   * counts as done the moment its 4 edges occupy their 4 slots, even when
   * one or more are still flipped (misoriented). Matches how
   * reconstructionists mark the cross (the flip fix lands in the first F2L
   * pair). Default false = current strict behavior (position + orientation).
   * Only affects the CFOP color-neutral path.
   */
  relaxedCross?: boolean;
  /** Require every phase and a solved final state when validating. */
  strict?: boolean;
  /**
   * Face-move count of the reconstructionist's WRITTEN PLL block (text
   * route only). `>= PLL_MIN_WRITTEN_MOVES` means a real last-layer
   * algorithm was executed and the AUF-only PLL reclassification must not
   * fire (the state checks cannot distinguish a lagging OLL boundary from a
   * genuine AUF — reconz-11559). 0 = the block label explicitly says
   * "PLL skip". Undefined = no written info (smart route) → no guard.
   */
  writtenPllMoves?: number;
  /**
   * Face-move count of the reconstructionist's WRITTEN OLL block (text
   * route only). `>= OLL_MIN_WRITTEN_MOVES` means a real last-layer
   * orientation algorithm was executed and the AUF-only OLL reclassification
   * must not fire (same rationale as `writtenPllMoves` for PLL). Undefined =
   * no written info (smart route) → no guard.
   */
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
  /**
   * True when the written cross block ends far before ANY valid cross exists
   * (a pseudo/partial cross — reconz-11663 "pseudo xcross", reconz-4319
   * "pseudo cross", reconz-3467 "partial cross"): the solver built the
   * cross edges into their slots but left them misordered (or a partial
   * cross) and fixed the order inside the F2L pairs, so the state-based
   * cross only completes much later. The Cross phase is then cut at the
   * WRITTEN boundary and labeled 'pseudo xcross'.
   */
  pseudoCross?: boolean;
};

/**
 * Pseudo-cross gap: when the winning (relaxed) cross completes this many
 * entries AFTER the written cross block's end, the written block did not
 * contain a real cross (misordered permutation / partial cross) and the
 * Cross phase is cut at the written boundary. Measured on the 300-solve
 * divergence sample: the maximum gap among the 285 well-detected solves is
 * +2, so >=3 never fires on a solve whose cross already lands on its written
 * block. Residual risk (validated absent across the 300-solve sample): a
 * GENUINELY late-valid cross completing exactly 3+ entries after the written
 * end would be mislabeled pseudo — the written end is the only signal, and
 * for CFOP-standard solves it never lags the state cross by 3.
 */
const PSEUDO_CROSS_MIN_GAP = 3;

/**
 * A PLL phase of this many timeline entries or fewer is a candidate for the
 * AUF-only reclassification (paired with `isOneMoveFromSolved` — see below).
 *
 * An AUF alignment is 1-4 entries (U, U2, "U U'", … — the raw notation's
 * U-turn conjugates to ANY face in the timeline, so the count, not the face,
 * is the signal). A real PLL algorithm cannot finish the permutation in
 * under ~9 moves (the shortest U-perm is 9-11 STM), so the threshold is
 * safely below every genuine PLL phase while covering every alignment.
 */
const AUF_MAX_MOVES = 4;

/**
 * The state checks alone CANNOT tell an AUF from a real PLL whose OLL
 * boundary detection lags INTO the PLL block (the OLL mask matches at the
 * penultimate algorithm move, whose state is — by definition — one move
 * from solved: reconz-11559's written "EPLL" reads exactly like reconz-5061's
 * written "AUF" from the states). The reconstructionist's written block is
 * the ONLY discriminator: a written PLL block of this many face moves or
 * more is a real last-layer algorithm (the shortest is the 9-STM U-perm),
 * so the reclassification must not fire. The text route passes the written
 * block's face-move count via `SplitOptions.writtenPllMoves`; the smart
 * route has no written info (undefined → the guard is inert) and relies on
 * the state checks alone.
 */
const PLL_MIN_WRITTEN_MOVES = 5;

/**
 * True when a SINGLE face turn (any of the 18) brings the cube to
 * solved-up-to-rotation.
 *
 * The AUF alignment — one U-turn in the SOLVER's frame — conjugates to one
 * arbitrary face move in the timeline (reconz-5061's trailing "U2" is an R2
 * in the cube frame), so the check must try every face, not just U. A real
 * PLL state is never one move from solved (the shortest U-perm is 9-11
 * STM), so this is the precise test for "the LL permutation was already
 * solved when OLL completed" — it also shields the reclassification from
 * solves whose OLL boundary lands late inside the PLL algorithm (their
 * mid-PLL state is many moves from solved).
 */
function isOneMoveFromSolved(state: CubeState): boolean {
  const turns = [
    'U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'",
    'D', 'D2', "D'", 'L', 'L2', "L'", 'B', 'B2', "B'",
  ];
  for (const turn of turns) {
    const candidate = state.clone();
    candidate.applySequence(turn);
    if (candidate.isSolvedUpToRotation()) return true;
  }
  return false;
}

/**
 * Splits a SolveTimeline into ordered phase segments.
 *
 * Phase masks describe completion states, not recognition timestamps. A
 * segment therefore owns the moves since the previous completion, while
 * `completionIndex` records the exact move at which its mask matched.
 * Recognition time is NOT guessed: it is the measurable gap between the
 * previous phase's completion move and this phase's first move — exposed
 * as `recognitionMs` (with `transitionMs` kept as a legacy alias of the
 * same measurement, per the professional recognition/execution model).
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
      const colorRun = PhaseSplitter.detectColorNeutral(
        timeline,
        options?.preferredCrossIdx,
        options?.relaxedCross,
      );
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
    relaxedCross?: boolean,
  ): DetectionRun {
    const states = timeline.entries.map((entry) =>
      TimelineBuilder.fromSnapshot(entry.state),
    );
    const result = ColorPhaseDetector.detect(states, preferredCrossIdx, {
      relaxedCross,
    });
    if (!result || result.completions[0] < 0) return { phases: [] };

    // ── Pseudo-cross: cut the Cross phase at the WRITTEN boundary ─────────
    // A pseudo/partial cross (the solver leaves the cross edges misordered or
    // incomplete and fixes the order inside the F2L pairs) never produces a
    // valid cross near the reconstructionist's written cross block, so the
    // state-based cross completes much later — the panel then claims an
    // xx/xxxcross spanning the whole F2L (reconz-11663). The state alone
    // cannot tell this from a genuinely late cross (identical states), so the
    // written boundary is the ONLY signal: end the Cross phase there and
    // label it 'pseudo xcross'.
    //
    // Relaxed mode only: a late STRICT cross is also the signature of plain
    // flipped-edge crosses that the relaxed criterion already resolves AT the
    // written end (reconz-5848 s@24/r@9) — the rule must only fire when even
    // the PERMUTATION completes late. Needs the written segment (undefined for
    // flat/unlabelled solves and the smart-cube route) and a gap >= 3 (the
    // max measured gap among well-detected solves is +2).
    const pseudoCross =
      relaxedCross === true &&
      preferredCrossIdx !== undefined &&
      result.completions[0] - preferredCrossIdx >= PSEUDO_CROSS_MIN_GAP;
    const completions: number[] = pseudoCross
      ? [preferredCrossIdx, ...result.completions.slice(1)]
      : result.completions;

    // Only found completions become segments (mirroring runDetection, which
    // stops at the first missing mask). Trailing -1 means the phase never
    // completed and must not be indexed.
    const found: number[] = [];
    for (const completion of completions) {
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
      pseudoCross,
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
      // Recognition time = the boundary gap before this phase's first move
      // (the same measurable gap exposed as transitionMs, which is kept as a
      // legacy alias). Zero for the first phase (inspection is not captured)
      // and for skipped phases (no moves to recognize).
      const recognitionMs = transitionMs;

      phases.push({
        phaseName,
        startIndex,
        endIndex,
        completionIndex,
        startTimestamp,
        endTimestamp,
        durationMs,
        executionMs: durationMs,
        recognitionMs,
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

    if (!complete) warnings.push('incomplete-solve');
    if (timeline.entries.length > 0 && !finalStateSolved) {
      warnings.push('final-state-not-solved');
    }
    if (initialStateSource === 'unknown') warnings.push('initial-state-unknown');
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
      // ─── AUF-only PLL = PLL skip ────────────────────────────────────────
      // A PLL phase whose permutation was ALREADY solved when OLL completed
      // (the solver-frame state is solved up to rotation + at most one
      // U-turn) executes only the AUF alignment — there is no PLL step.
      // Reclassify it as a skip (badge + report.skips) and fold the
      // alignment span into OLL, so the move/duration accounting stays
      // exact. (A real remaining permutation — U-perm, Z-perm, … — is never
      // one U-turn from solved, so only the alignment case fires.)
      const ollPhase = detection.phases.find(
        (p) => p.phaseName === 'OLL',
      );
      const pllPhase = detection.phases.find(
        (p) => p.phaseName === 'PLL',
      );
      const ollState =
        ollPhase?.completionIndex !== undefined &&
        ollPhase.completionIndex < timeline.entries.length
          ? TimelineBuilder.fromSnapshot(
              timeline.entries[ollPhase.completionIndex]?.state,
            )
          : null;
      // Written-PLL guard: a reconstructionist who wrote a real PLL block
      // (>=5 face moves — the shortest algorithm is the 9-STM U-perm) means
      // a permutation step was executed; the state checks cannot distinguish
      // that from a genuine AUF when the OLL boundary lags into the block
      // (reconz-11559's "EPLL" ends one U-turn from solved, exactly like a
      // real AUF), so the reclassification must not fire. The smart route
      // passes nothing (undefined) and relies on the state checks alone.
      const writtenRealPll =
        options?.writtenPllMoves !== undefined &&
        options.writtenPllMoves >= PLL_MIN_WRITTEN_MOVES;
      // Short-circuit: the cheap guard blocks the reclassification before
      // the expensive state check (18 clone+apply+isSolvedUpToRotation)
      // ever runs.
      const isAufOnly =
        !writtenRealPll && ollState !== null && isOneMoveFromSolved(ollState);
      if (
        ollPhase &&
        pllPhase &&
        !pllPhase.skipped &&
        pllPhase.moveCount >= 1 &&
        pllPhase.moveCount <= AUF_MAX_MOVES &&
        isAufOnly
      ) {
        // The PLL phase is 1-4 entries and ends solved (its completion is
        // the solved state by detection) — too short for any real PLL
        // algorithm, so it is the AUF alignment only: the LL permutation was
        // already solved when OLL completed. Preserve the skipped-phase
        // convention (same indices as the previous phase, zero
        // moves/duration) and fold the alignment span into the last
        // NON-skipped phase (buildSegments' trailing-fold invariant: the
        // final active phase owns the trailing events — OLL normally, F2L
        // when OLL itself is skipped, e.g. a VLS/1LLL finish), so every
        // timeline entry stays owned exactly once.
        const aufEndIndex = pllPhase.endIndex ?? ollPhase.completionIndex ?? 0;
        const aufEndTimestamp = pllPhase.endTimestamp;
        pllPhase.skipped = true;
        pllPhase.startIndex = ollPhase.completionIndex ?? 0;
        pllPhase.endIndex = ollPhase.completionIndex ?? 0;
        pllPhase.completionIndex = ollPhase.completionIndex;
        pllPhase.moveCount = 0;
        pllPhase.durationMs = 0;
        pllPhase.executionMs = 0;
        pllPhase.startTimestamp = ollPhase.endTimestamp;
        pllPhase.endTimestamp = ollPhase.endTimestamp;
        // The PLL is now skipped — the last NON-skipped phase owns the
        // alignment span.
        const lastActive = [...detection.phases]
          .reverse()
          .find((p) => !p.skipped);
        if (lastActive) {
          lastActive.endIndex = aufEndIndex;
          lastActive.endTimestamp = aufEndTimestamp;
          lastActive.moveCount =
            (lastActive.endIndex ?? 0) - (lastActive.startIndex ?? 0) + 1;
          lastActive.durationMs = PhaseSplitter.safeElapsed(
            lastActive.startTimestamp,
            lastActive.endTimestamp,
          );
          lastActive.executionMs = lastActive.durationMs;
        }
      }

      if (detection.phases.some((p) => p.phaseName === 'OLL' && p.skipped)) {
        skips.push('oll');
      }
      if (detection.phases.some((p) => p.phaseName === 'PLL' && p.skipped)) {
        skips.push('pll');
      }

      const crossPhase = detection.phases.find((p) => p.phaseName === 'Cross');
      if (detection.pseudoCross) {
        // The written block never contained a real cross: no pairs are home
        // at its end by construction, so the slot-based xcross check would
        // only ever read 'plain'. Label it 'pseudo xcross' directly.
        crossType = 'pseudo xcross';
        xcrossPairs = [];
      } else if (crossPhase && crossPhase.completionIndex !== undefined) {
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
                options?.relaxedCross,
              )
            : { crossFace: crossFace ?? 'D', scheme: scheme ?? IDENTITY_SCHEME };
          const frameFace: CubeFace = picked.crossFace as CubeFace;
          const frameScheme = picked.scheme;
          const solverStates = timeline.solverFrameStates;
          // The same DP the F2L pair scan uses (bestFrameRotationSequence),
          // over the SAME span ([cross completion, F2L end]) so the xcross
          // verdict and the pair scan share identical per-index frames.
          const xstart = Math.max(0, crossPhase.completionIndex);
          const xend = Math.min(
            timeline.entries.length - 1,
            f2lPhase?.endIndex ?? crossPhase.completionIndex + 2,
          );
          let xframes: ReturnType<typeof bestFrameRotationSequence> = [];
          {
            const xstates: CubeState[] = [];
            let xok = true;
            for (let i = xstart; i <= xend; i++) {
              const snapshot = solverStates?.[i] ?? timeline.entries[i]?.state;
              if (!snapshot) {
                xok = false;
                break;
              }
              xstates.push(TimelineBuilder.fromSnapshot(snapshot));
            }
            if (xok && xstates.length > 0) {
              xframes = bestFrameRotationSequence(
                xstates,
                0,
                xstates.length - 1,
                frameFace,
                frameScheme,
              );
            }
          }
          const stateAt = (idx: number): CubeState => {
            const snapshot = solverStates?.[idx] ?? timeline.entries[idx]?.state;
            const cube = TimelineBuilder.fromSnapshot(snapshot);
            const j = idx - xstart;
            if (j < 0 || j >= xframes.length) return cube;
            return applyFrameRotation(cube, xframes[j], frameFace);
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

    const phaseTimeMs = detection.phases.reduce(
      (sum, phase) => sum + Math.max(0, phase.durationMs),
      0,
    );
    const transitionTimeMs = detection.phases.reduce(
      (sum, phase) => sum + Math.max(0, phase.transitionMs ?? 0),
      0,
    );
    // Unattributed time measures TIMELINE time that no detected phase owns —
    // deliberately NOT the timer duration. The timer measures wall time from
    // start to stop and inherently includes the lag between the last move and
    // the stop (BLE facelet polling / manual stop reaction); a timer-based
    // residual is therefore positive on nearly every smart solve and would
    // fire the warning constantly, while the panel already surfaces that dead
    // time as "idle/transition" info. Measured against the timeline's own
    // span (first→last move), the residual is ~0 for complete solves and only
    // becomes meaningful when detection is incomplete (trailing moves unowned
    // by any phase) or timestamps are inconsistent — the cases this warning
    // exists for.
    const spanMs = PhaseSplitter.safeElapsed(
      timeline.startTimestamp,
      timeline.endTimestamp,
    );
    const unattributedTimeMs = Math.max(
      0,
      spanMs - phaseTimeMs - transitionTimeMs,
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
