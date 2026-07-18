import {
  CubeState,
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
   * @returns A fully reconstructed SolveTimeline ready for phase recognition.
   */
  static build(
    moves: CubeMoveEvent[],
    methodName = 'CFOP',
    orientations?: (CubeOrientation | undefined)[],
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
   */
  static fromStoredSolve(
    solveId: string,
    moves: CubeMoveEvent[],
    methodName = 'CFOP',
  ): SolveTimeline {
    const timeline = TimelineBuilder.build(moves, methodName);
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
