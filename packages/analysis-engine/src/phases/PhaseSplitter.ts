import {
  StateMatcher,
  type MethodDefinition,
  type PhaseMask,
  COLOR_NEUTRAL_CFOP_MASKS,
  type FaceCFOPMasks,
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
 * Color-Neutral Support:
 *   When `colorNeutral: true` is passed, the splitter tries all 6 cross
 *   face masks for the first phase. Once the cross face is detected, all
 *   subsequent phases (F2L, OLL, PLL) use masks specific to that face.
 *
 * Design:
 * - Generic: works with any MethodDefinition (CFOP, Roux, ZZ, Petrus...)
 * - Method-agnostic: only depends on StateMatcher.matchesMask()
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
   * @param timeline - The solve timeline with entries (phases not yet set).
   * @param method - The method definition with ordered phase masks.
   * @param options.colorNeutral - If true, auto-detect the cross face
   *   and use face-specific masks for all phases (CFOP only).
   * @returns Array of PhaseSegments in detection order.
   */
  static split(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: { colorNeutral?: boolean },
  ): PhaseSegment[] {
    const { entries } = timeline;

    if (entries.length === 0 || method.phases.length === 0) {
      return [];
    }

    // ── Color-neutral setup ─────────────────────────────────────────────
    const useColorNeutral =
      options?.colorNeutral === true && method.name === 'CFOP';
    let faceMasks: FaceCFOPMasks | null = null;

    const phases: PhaseSegment[] = [];
    let currentPhaseIdx = 0;
    let phaseStartIndex = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Restore the cube state from the entry's saved snapshot.
      const state = TimelineBuilder.fromSnapshot(entry.state);

      // Check if the current phase is now complete
      const currentMask = method.phases[currentPhaseIdx];
      if (!currentMask) break; // safety: all phases done

      let phaseMatched = false;

      if (useColorNeutral) {
        if (currentPhaseIdx === 0) {
          // ── Cross phase: try all 6 faces ──────────────────────────
          const result = PhaseSplitter.detectCrossFace(state);
          if (result) {
            faceMasks = result;
            phaseMatched = true;
          }
        } else if (faceMasks) {
          // ── F2L/OLL/PLL: use the detected face's masks ────────────
          const faceMask = faceMasks.masks[currentPhaseIdx];
          if (faceMask) {
            phaseMatched = StateMatcher.matchesMask(state, faceMask);
          }
        }
        // If faceMasks is null and we're past phase 0, fall through
        // to standard check (shouldn't happen in practice)
      }

      if (!phaseMatched) {
        // Standard check (non-color-neutral or fallback)
        phaseMatched = StateMatcher.matchesMask(state, currentMask);
      }

      if (phaseMatched) {
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

        // ── Handle simultaneous phase completions ────────────────────
        // When two masks match at the same entry (e.g., OLL and PLL both
        // complete at the last move), the current entry satisfies both.
        // Without this loop, the last phase would be skipped entirely
        // because there are no more entries to check.
        // We create zero-duration segments for any additional phases
        // that also match at this same entry. These are filtered out
        // by MetricsAggregator (which skips 0-move phases) but retained
        // in timeline.phases for annotation and method-specific metrics.
        while (currentPhaseIdx < method.phases.length) {
          const nextMask = method.phases[currentPhaseIdx];
          let nextMatched = false;

          if (useColorNeutral && faceMasks) {
            const faceMask = faceMasks.masks[currentPhaseIdx];
            if (faceMask) {
              nextMatched = StateMatcher.matchesMask(state, faceMask);
            }
          }
          if (!nextMatched) {
            nextMatched = StateMatcher.matchesMask(state, nextMask);
          }

          if (nextMatched) {
            // This phase also completes at this entry → zero-move segment
            phases.push({
              phaseName: nextMask.name,
              startIndex: i,
              endIndex: i,
              startTimestamp: endTs,
              endTimestamp: endTs,
              durationMs: 0,
              moveCount: 0,
            });
            currentPhaseIdx++;
          } else {
            break;
          }
        }

        // If we've completed all phases, extend the last phase to cover
        // any remaining moves and exit
        if (currentPhaseIdx >= method.phases.length) {
          if (phaseStartIndex < entries.length && phases.length > 0) {
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
   * Try to detect which face the cross is on by checking all 6 cross masks.
   *
   * @returns The matching FaceCFOPMasks and its index, or null if no cross found.
   */
  private static detectCrossFace(
    state: ReturnType<typeof TimelineBuilder.fromSnapshot>,
  ): FaceCFOPMasks | null {
    for (let i = 0; i < COLOR_NEUTRAL_CFOP_MASKS.length; i++) {
      const faceMasks = COLOR_NEUTRAL_CFOP_MASKS[i];
      if (StateMatcher.matchesMask(state, faceMasks.masks[0])) {
        return faceMasks;
      }
    }
    return null;
  }

  /**
   * Split and annotate a timeline in one step.
   *
   * Modifies the timeline in place:
   * 1. Runs phase detection
   * 2. Assigns phaseId/phaseName to each entry
   * 3. Sets timeline.phases
   *
   * @param options.colorNeutral - Enable color-neutral cross detection.
   * @returns The annotated timeline (same object, mutated in place).
   */
  static splitAndAnnotate(
    timeline: SolveTimeline,
    method: MethodDefinition,
    options?: { colorNeutral?: boolean },
  ): SolveTimeline {
    const phases = PhaseSplitter.split(timeline, method, options);
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
    options?: { colorNeutral?: boolean },
  ): boolean {
    const phases = PhaseSplitter.split(timeline, method, options);

    if (phases.length === 0) return false;

    const useColorNeutral =
      options?.colorNeutral === true && method.name === 'CFOP';
    let faceMasks: FaceCFOPMasks | null = null;
    let phaseIdx = 0;

    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i];
      const state = TimelineBuilder.fromSnapshot(entry.state);

      // Handle ALL phase boundaries at this entry (including zero-duration
      // phases created by the while loop in split()).
      while (phaseIdx < phases.length && i === phases[phaseIdx].endIndex) {
        let mask: PhaseMask;

        if (useColorNeutral && faceMasks) {
          mask = faceMasks.masks[phaseIdx];
        } else if (useColorNeutral && phaseIdx === 0) {
          const result = PhaseSplitter.detectCrossFace(state);
          if (result) {
            faceMasks = result;
            mask = faceMasks.masks[phaseIdx];
          } else {
            mask = method.phases[phaseIdx];
          }
        } else {
          mask = method.phases[phaseIdx];
        }

        if (!StateMatcher.matchesMask(state, mask)) {
          return false;
        }
        phaseIdx++;
      }
    }

    return phaseIdx === phases.length;
  }
}
