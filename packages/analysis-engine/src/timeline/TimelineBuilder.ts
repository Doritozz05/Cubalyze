import {
  CubeState,
  FaceletStringConverter,
  MoveTransformer,
} from '@cubeforge/math-core';
import type {
  CubeMoveEvent,
  CubeOrientation,
  CubeStateSnapshot,
  DisplayMove,
  PhaseSegment,
  SolveTimeline,
  TimelineEntry,
} from '@cubeforge/types';

/** Matches the solved facelet string (9 of each of 6 colors, in order). */
const SOLVED_FACELETS = /^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/;

/**
 * Builds a SolveTimeline from a sequence of raw CubeMoveEvents.
 *
 * The timeline is the central data structure for the entire analysis
 * pipeline. It recreates the cube state at each step of the solve,
 * producing an immutable, replayable record of:
 *
 *   (MoveEvent, CubeState, hostTimestamp)
 *
 * This can be built:
 *   - In real-time during a solve (progressive)
 *   - Post-solve from stored moves (offline)
 *   - For replay/testing from synthetic data
 */
export class TimelineBuilder {
  /**
   * Build a complete solve timeline from raw move events.
   *
   * @param moves - The raw CubeMoveEvents from the solve session.
   * @param methodName - The solving method identifier (e.g. "CFOP", "Roux").
   * @param orientations - Optional orientation snapshots per move index.
   * @param scramble - Optional scramble to apply to the initial state.
   *                   When provided, the timeline starts from the scrambled
   *                   state, which is required for correct phase detection.
   * @param initialFacelets - Optional 54-char facelet string from the real
   *                          Smart Cube state at solve start. When provided
   *                          (and not a stale "solved" state), this is used
   *                          as ground truth INSTEAD of the scramble — making
   *                          phase detection deterministic even when scramble
   *                          verification is disabled.
   * @param initialState - Optional CubeState from the move-based tracker.
   *                       Takes highest priority over initialFacelets and
   *                       scramble. This is the most reliable source because
   *                       it is updated from every MOVE event (immediate and
   *                       universal across all GAN cube generations).
   * @returns A fully reconstructed SolveTimeline ready for phase recognition.
   */
  static build(
    moves: CubeMoveEvent[],
    methodName = 'CFOP',
    orientations?: (CubeOrientation | undefined)[],
    scramble?: string,
    initialFacelets?: string,
    initialState?: CubeState,
  ): SolveTimeline {
    if (moves.length === 0) {
      return {
        solveId: '',
        method: methodName,
        entries: [],
        phases: [],
        startTimestamp: 0,
        endTimestamp: 0,
      };
    }

    const state = new CubeState();
    CubeState.initTables();

    // B6+: Precedence: initialState > initialFacelets > scramble > solved.
    //
    // 1. initialState (CubeState): move-tracked state from useSolveSession.
    //    Updated on EVERY MOVE event — immediate, universal, no GATT dep.
    // 2. initialFacelets (string): facelets from the cube's FACELETS event.
    //    Good for Gen3/Gen4 (periodic), less reliable for Gen2 (on-demand).
    // 3. scramble (string): the displayed scramble notation. Used as
    //    fallback when neither of the above is available.
    //
    // Stale-solved guard (facelets only): if facelets show solved AND a
    // scramble is provided, the facelets are likely stale (from before
    // scrambling — Gen2 doesn't send periodic facelets in Mode 3/4).
    // Fall back to the scramble in that case.
    const hasValidFacelets =
      !initialState && !!initialFacelets && initialFacelets.length === 54;
    const faceletsAreSolved =
      hasValidFacelets && SOLVED_FACELETS.test(initialFacelets!);
    const useRealFacelets =
      hasValidFacelets && !(faceletsAreSolved && scramble);

    if (initialState) {
      // Use the move-tracked CubeState directly — no parsing needed
      state.cp.set(initialState.cp);
      state.co.set(initialState.co);
      state.ep.set(initialState.ep);
      state.eo.set(initialState.eo);
    } else if (useRealFacelets) {
      const realState = FaceletStringConverter.fromFaceletString(initialFacelets!);
      state.cp.set(realState.cp);
      state.co.set(realState.co);
      state.ep.set(realState.ep);
      state.eo.set(realState.eo);
    } else if (scramble) {
      // Apply scramble so the initial cube state matches what the
      // solver actually sees. Without this, phase detection starts from
      // a solved cube and cannot detect when phases are completed.
      state.applySequence(scramble);
    }

    const entries: TimelineEntry[] = [];
    let startTimestamp = Infinity;
    let endTimestamp = 0;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const hostTs = move.hostTimestamp;

      // Track time boundaries
      if (hostTs < startTimestamp) startTimestamp = hostTs;
      if (hostTs > endTimestamp) endTimestamp = hostTs;

      // Apply the move to the cube state using move notation
      const moveNotation = MoveTransformer.moveToNotation(move.face, move.direction);
      state.applySequence(moveNotation);

      // Build the display move (face remapped by orientation if available)
      const orientation = orientations?.[i];
      const displayMove: DisplayMove = orientation
        ? MoveTransformer.toDisplay(move, { faceMap: orientation.faceMap })
        : {
            face: move.face,
            direction: move.direction,
            cubeTimestamp: move.cubeTimestamp,
            hostTimestamp: move.hostTimestamp,
          };

      const snapshot = TimelineBuilder.toSnapshot(state);

      const entry: TimelineEntry = {
        index: i,
        move,
        displayMove,
        state: snapshot,
        hostTimestamp: hostTs,
        orientation,
      };

      entries.push(entry);
    }

    return {
      solveId: '',
      method: methodName,
      entries,
      phases: [],
      startTimestamp: startTimestamp === Infinity ? 0 : startTimestamp,
      endTimestamp,
    };
  }

  /**
   * Convert a CubeState to a serializable snapshot.
   */
  static toSnapshot(state: CubeState): CubeStateSnapshot {
    return {
      cp: Array.from(state.cp),
      co: Array.from(state.co),
      ep: Array.from(state.ep),
      eo: Array.from(state.eo),
    };
  }

  /**
   * Reconstruct a CubeState from a snapshot (for replay/testing).
   */
  static fromSnapshot(snapshot: CubeStateSnapshot): CubeState {
    return new CubeState(snapshot.cp, snapshot.co, snapshot.ep, snapshot.eo);
  }

  /**
   * Build a timeline from a solve stored in the database.
   *
   * The solve already has `moves: CubeMoveEvent[]` stored.
   * This method is the bridge between persistence and analysis.
   *
   * @param solveId - Database solve ID.
   * @param moves - The moves from the stored solve.
   * @param methodName - Solving method identifier.
   * @param scramble - Optional scramble to apply for correct phase detection.
   */
  static fromStoredSolve(
    solveId: string,
    moves: CubeMoveEvent[],
    methodName = 'CFOP',
    scramble?: string,
  ): SolveTimeline {
    // Stored solves don't have initialFacelets (only the scramble was
    // persisted), so we pass only the scramble. This preserves backward
    // compatibility for historical solve analysis.
    const timeline = TimelineBuilder.build(moves, methodName, undefined, scramble);
    timeline.solveId = solveId;
    return timeline;
  }

  /**
   * Annotate a timeline with phase information.
   *
   * Modifies the timeline in place:
   * 1. Assigns phaseId/phaseName to each entry
   * 2. Sets timeline.phases
   *
   * @returns The annotated timeline (same object, mutated in place).
   */
  static annotatePhases(
    timeline: SolveTimeline,
    phases: PhaseSegment[],
  ): SolveTimeline {
    // Assign phaseId and phaseName to each entry
    for (let p = 0; p < phases.length; p++) {
      const phase = phases[p];
      for (let i = phase.startIndex; i <= phase.endIndex; i++) {
        if (i < timeline.entries.length) {
          timeline.entries[i].phaseId = p;
          timeline.entries[i].phaseName = phase.phaseName;
        }
      }
    }

    timeline.phases = phases;
    return timeline;
  }
}
