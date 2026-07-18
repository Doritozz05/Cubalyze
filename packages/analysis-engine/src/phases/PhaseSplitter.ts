import {
  StateMatcher,
  type MethodDefinition,
} from '@cubeforge/math-core';
import type { PhaseSegment, SolveTimeline } from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

/**
 * Splits a SolveTimeline into discrete phase segments based on a
 * MethodDefinition.
 *
 * The splitter scans the timeline entries sequentially. For each phase
 * mask in the method definition, it advances through the timeline until
 * the mask condition is satisfied. When a phase transition is detected,
 * a PhaseSegment is created with the start/end indices and timestamps.
 *
 * CRITICAL: The splitter uses the pre-computed CubeState snapshots stored
 * in each TimelineEntry (via TimelineBuilder.fromSnapshot). This means it
 * automatically works with any initial state — whether the timeline was
 * built from a scrambled cube (scramble passed to build()) or from a solved
 * cube (no scramble). The state at each entry reflects the actual cube
 * state at that point in the solve.
 *
 * Design:
 * - Generic: works with any MethodDefinition (CFOP, Roux, ZZ, Petrus...)
 * - Method-agnostic: only depends on PhaseMask.check()
 * - Offline-friendly: runs on a stored timeline, no hardware needed
 *
 * Example (CFOP, 4 phases):
 *   Phase 0 (Cross):  entries[0..6]   → 7 moves, 2.1s
 *   Phase 1 (F2L):    entries[7..35]  → 29 moves, 6.5s
 *   Phase 2 (OLL):    entries[36..44] → 9 moves, 1.2s
 *   Phase 3 (PLL):    entries[45..57] → 13 moves, 1.8s
 */
export class PhaseSplitter {
  /**
   * Split a timeline into phases according to the given method definition.
   *
   * Algorithm:
   * 1. For each timeline entry:
   *    a. Restore the cube state from the entry's saved snapshot.
   *       (This snapshot already reflects the scramble if one was applied.)
   *    b. Check if the current phase mask is now satisfied.
   *    c. If satisfied, record a PhaseSegment and advance to the next phase.
   *    d. If all phases complete, extend the last phase to cover any
   *       remaining moves and exit.
   *
   * @param timeline - The solve timeline with entries (phases not yet set).
   * @param method - The method definition with ordered phase masks.
   * @returns Array of PhaseSegments in detection order.
   */
  static split(
    timeline: SolveTimeline,
    method: MethodDefinition,
  ): PhaseSegment[] {
    const { entries } = timeline;

    if (entries.length === 0 || method.phases.length === 0) {
      return [];
    }

    const phases: PhaseSegment[] = [];
    let currentPhaseIdx = 0;
    let phaseStartIndex = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Restore the cube state from the entry's saved snapshot.
      // This reflects the actual cube state after this move was applied,
      // including any scramble that was applied during timeline construction.
      const state = TimelineBuilder.fromSnapshot(entry.state);

      // Check if the current phase is now complete
      const currentMask = method.phases[currentPhaseIdx];
      if (!currentMask) break; // safety: all phases done

      if (StateMatcher.matchesMask(state, currentMask)) {
        // Phase transition detected
        const startTs = entries[phaseStartIndex].hostTimestamp;
        const endTs = entry.hostTimestamp;
        const durationMs = endTs - startTs;
        const moveCount = i - phaseStartIndex + 1;

        phases.push({
          phaseName: currentMask.name,
          startIndex: phaseStartIndex,
          endIndex: i,
          startTimestamp: startTs,
          endTimestamp: endTs,
          durationMs: Math.max(0, durationMs),
          moveCount,
        });

        // Advance to the next phase
        currentPhaseIdx++;
        phaseStartIndex = i + 1;

        // If we've completed all phases, extend the last phase to cover
        // any remaining moves and exit
        if (currentPhaseIdx >= method.phases.length) {
          // Only extend if there are remaining entries
          if (phaseStartIndex < entries.length) {
            const lastPhase = phases[phases.length - 1];
            const lastEntry = entries[entries.length - 1];
            lastPhase.endIndex = entries.length - 1;
            lastPhase.endTimestamp = lastEntry.hostTimestamp;
            lastPhase.durationMs = Math.max(
              0,
              lastPhase.endTimestamp - lastPhase.startTimestamp,
            );
            lastPhase.moveCount = entries.length - lastPhase.startIndex;
          }
          break;
        }
      }
    }

    return phases;
  }

  /**
   * Split and annotate a timeline in one step.
   *
   * Modifies the timeline in place:
   * 1. Runs phase detection
   * 2. Assigns phaseId/phaseName to each entry
   * 3. Sets timeline.phases
   *
   * @returns The annotated timeline (same object, mutated in place).
   */
  static splitAndAnnotate(
    timeline: SolveTimeline,
    method: MethodDefinition,
  ): SolveTimeline {
    const phases = PhaseSplitter.split(timeline, method);
    return TimelineBuilder.annotatePhases(timeline, phases);
  }

  /**
   * Get the phase transition indices (the entry index where each phase
   * was first detected as complete).
   */
  static getTransitionIndices(
    timeline: SolveTimeline,
    method: MethodDefinition,
  ): number[] {
    const phases = PhaseSplitter.split(timeline, method);
    return phases.map((p) => p.endIndex);
  }

  /**
   * Check if a specific phase was reached in the timeline.
   */
  static hasPhase(
    timeline: SolveTimeline,
    method: MethodDefinition,
    phaseName: string,
  ): boolean {
    const phases = PhaseSplitter.split(timeline, method);
    return phases.some((p) => p.phaseName === phaseName);
  }

  /**
   * Validate phase splits by replaying the timeline and verifying that
   * each detected phase boundary satisfies its mask condition.
   *
   * Uses the same snapshot-based approach as split() for consistency.
   *
   * Returns true if all phase boundaries are correct.
   */
  static validate(
    timeline: SolveTimeline,
    method: MethodDefinition,
  ): boolean {
    const phases = PhaseSplitter.split(timeline, method);

    if (phases.length === 0) return false;

    let phaseIdx = 0;

    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i];

      // Use the saved snapshot instead of re-applying moves
      const state = TimelineBuilder.fromSnapshot(entry.state);

      // Check if we're at a phase boundary
      if (phaseIdx < phases.length && i === phases[phaseIdx].endIndex) {
        const mask = method.phases[phaseIdx];
        if (!StateMatcher.matchesMask(state, mask)) {
          return false;
        }
        phaseIdx++;
      }
    }

    return phaseIdx === phases.length;
  }
}
