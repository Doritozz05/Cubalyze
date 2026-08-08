import {
  CubeState,
  FaceletStringConverter,
  MoveTransformer,
  SOLVED_FACELETS,
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

/** Slice tokens (M/E/S) — the "other half" of a wide move in the expanded
 *  state stream (r → "R M'"), or a standalone slice. */
const SLICE_TOKEN_RE = /^[MES][2']?$/;

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
   *                          as ground truth INSTEAD of the scramble.
   * @param stateTokens - Optional FULL token stream (face + slice moves) to
   *                      drive the cube state. `moves` must be exactly the
   *                      face tokens of `stateTokens` in order. When provided,
   *                      slice tokens (M/E/S — which a smart cube never emits
   *                      but text reconstructions do) are applied to the
   *                      state WITHOUT creating their own timeline entry, so
   *                      the reconstructed states are exact while the entry
   *                      indices stay in face-move space. Each entry's state
   *                      also consumes the slice tokens immediately following
   *                      its face token — the slice half of a wide move (r →
   *                      "R M'") — so the snapshot reflects the FULL move and a
   *                      phase completed by a wide's slice lands ON its entry
   *                      (not invisibly between entries). Defaults to applying
   *                      `moves` alone.
   * @returns A fully reconstructed SolveTimeline ready for phase recognition.
   */
  static build(
    moves: CubeMoveEvent[],
    methodName = 'CFOP',
    orientations?: (CubeOrientation | undefined)[],
    scramble?: string,
    initialFacelets?: string,
    stateTokens?: readonly string[],
  ): SolveTimeline {
    if (moves.length === 0) {
      return {
        solveId: '',
        method: methodName,
        entries: [],
        phases: [],
        initialStateSource: 'solved-fallback',
        startTimestamp: 0,
        endTimestamp: 0,
      };
    }

    const state = new CubeState();
    CubeState.initTables();

    // ── Initial state: always from scramble notation ────────────────────
    // The scramble is the single source of truth for the initial cube
    // state, matching what the ReplayEngine uses. This guarantees analysis
    // and replay start from the same state.
    //
    // Precedence: initialFacelets > scramble > solved.
    //   - initialFacelets: 54-char string from the cube at solve start.
    //     Used only when available AND not stale-solved.
    //   - scramble: the displayed scramble notation.
    //   - solved: fallback when neither is available.
    //
    // NOTE: The `initialState` (move-tracked CubeState) parameter was
    // removed because BLE move tracking can diverge from the physical
    // scramble state (dropped moves, race conditions). The scramble
    // notation is deterministic and what the user actually executed.
    let initialStateSource: SolveTimeline['initialStateSource'] = 'solved-fallback';
    const hasValidFacelets =
      !!initialFacelets && initialFacelets.length === 54;
    const faceletsAreSolved =
      hasValidFacelets && SOLVED_FACELETS.test(initialFacelets!);
    const useRealFacelets =
      hasValidFacelets && !(faceletsAreSolved && scramble);

    if (useRealFacelets) {
      try {
        const realState = FaceletStringConverter.fromFaceletString(initialFacelets!);
        state.cp.set(realState.cp);
        state.co.set(realState.co);
        state.ep.set(realState.ep);
        state.eo.set(realState.eo);
        initialStateSource = 'initial-facelets';
      } catch {
        // Invalid facelets must not make the whole solve unanalyzable. Fall
        // back to the deterministic scramble below when it is available.
        if (scramble) {
          state.applySequence(scramble);
          initialStateSource = 'scramble';
        }
      }
    } else if (scramble) {
      // Apply scramble so the initial cube state matches what the
      // solver actually sees. Without this, phase detection starts from
      // a solved cube and cannot detect when phases are completed.
      state.applySequence(scramble);
      initialStateSource = 'scramble';
    }

    const entries: TimelineEntry[] = [];
    // Preserve event order for temporal diagnostics. If a device delivers an
    // out-of-order event, the report will flag it instead of silently hiding
    // the problem by taking min/max timestamps.
    const startTimestamp = Number.isFinite(moves[0].hostTimestamp)
      ? moves[0].hostTimestamp
      : 0;
    const endTimestamp = Number.isFinite(moves[moves.length - 1].hostTimestamp)
      ? moves[moves.length - 1].hostTimestamp
      : startTimestamp;

    let tokenCursor = 0;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const hostTs = move.hostTimestamp;

      // Apply the move to the cube state using move notation. When a full
      // `stateTokens` stream is provided, walk it applying every token (face
      // AND slice) until the face token for this entry is consumed — slice
      // moves update the state without becoming timeline entries, so the
      // state at each face-move index is EXACT even for M/E/S/wide solves.
      if (stateTokens && tokenCursor < stateTokens.length) {
        const target = MoveTransformer.moveToNotation(move.face, move.direction);
        let matched = false;
        while (tokenCursor < stateTokens.length) {
          const token = stateTokens[tokenCursor++];
          state.applySequence(token);
          if (token === target) {
            matched = true;
            break;
          }
        }
        // Wide moves expand to face+slice in the state stream (r → "R M'").
        // The entry snapshot must include the slice half, or the state at
        // this entry silently MISSES the full move — e.g. a cross completed
        // by a wide's slice would only materialize BETWEEN entries, invisible
        // to phase detection, and the detected cross drifts to a coincidental
        // late completion (the "cross detected at 16 vs written 11" bug).
        while (
          tokenCursor < stateTokens.length &&
          SLICE_TOKEN_RE.test(stateTokens[tokenCursor])
        ) {
          state.applySequence(stateTokens[tokenCursor++]);
        }
        if (!matched) {
          // Defensive (cannot happen by construction — `moves` is derived from
          // `stateTokens`): the face token was missing, so apply it alone.
          state.applySequence(target);
        }
      } else {
        const moveNotation = MoveTransformer.moveToNotation(move.face, move.direction);
        state.applySequence(moveNotation);
      }

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
      initialStateSource,
      startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : 0,
      endTimestamp: Number.isFinite(endTimestamp) ? endTimestamp : 0,
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
    // Clear previous annotations so repeated analysis cannot leave stale
    // phase IDs on entries that no longer belong to a detected segment.
    for (const entry of timeline.entries) {
      delete entry.phaseId;
      delete entry.phaseName;
    }

    // Skipped phases have no owning move and must not steal the completion
    // move's phase label from the preceding phase.
    for (let p = 0; p < phases.length; p++) {
      const phase = phases[p];
      if (phase.skipped || phase.startIndex > phase.endIndex) continue;
      for (let i = phase.startIndex; i <= phase.endIndex; i++) {
        if (i >= 0 && i < timeline.entries.length) {
          timeline.entries[i].phaseId = p;
          timeline.entries[i].phaseName = phase.phaseName;
        }
      }
    }

    timeline.phases = phases;
    return timeline;
  }
}
