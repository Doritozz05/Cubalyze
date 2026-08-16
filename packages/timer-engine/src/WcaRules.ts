export enum Penalty {
  NONE = 'NONE',
  PLUS_TWO = '+2',
  DNF = 'DNF'
}

/** Official result format for one attempt (WCA). */
export type WcaAttemptFormat = 'a5' | 'bo3' | 'bo1' | 'mo3' | 'bo2';

/** How an event's result is scored (WCA). */
export type WcaScoring = 'time' | 'mbf-points' | 'fmc-moves';

/**
 * WCA rules profile for one event. Single source of truth lives here (phase
 * A5); the event registry (`@cubeforge/events`) declares which profile each
 * event uses and the timer engine consumes it — never a global 3×3 set.
 */
export interface WcaRulesProfile {
  /** Inspection window in ms, or null when the event has no inspection (BLD/FMC/MBLD). */
  inspectionMs: number | null;
  /** Threshold in ms from inspection start after which the attempt is +2. */
  plusTwoAfterMs?: number;
  /** Threshold in ms from inspection start after which the attempt is DNF. */
  dnfAfterMs?: number;
  /** Penalties the event allows (e.g. BLD: NONE/DNF only — no +2). */
  allowedPenalties: readonly Penalty[];
  /** Official format of one attempt. */
  format: WcaAttemptFormat;
  /** Official time limit in ms (e.g. Multi-Blind 3_600_000). */
  timeLimitMs?: number;
  /** How the result is scored. */
  scoring: WcaScoring;
}

// ── Canonical profiles (single source of truth) ───────────────────────────
// The event registry imports these — the timer's default is exactly the 3×3
// profile, so behaviour is identical for existing events.

/** Speed events: 15s inspection → +2, 17s → DNF, Ao5, time scoring. */
export const SPEED_RULES: WcaRulesProfile = {
  inspectionMs: 15_000,
  plusTwoAfterMs: 15_000,
  dnfAfterMs: 17_000,
  allowedPenalties: [Penalty.NONE, Penalty.PLUS_TWO, Penalty.DNF],
  format: 'a5',
  scoring: 'time',
};

/** Blindfolded events: no inspection, no +2 (WCA: DNF only), Bo3, time. */
export const BLD_RULES: WcaRulesProfile = {
  inspectionMs: null,
  allowedPenalties: [Penalty.NONE, Penalty.DNF],
  format: 'bo3',
  scoring: 'time',
};

/** Fewest Moves: no inspection, DNF only, mo3, move-count scoring. */
export const FMC_RULES: WcaRulesProfile = {
  inspectionMs: null,
  allowedPenalties: [Penalty.NONE, Penalty.DNF],
  format: 'mo3',
  scoring: 'fmc-moves',
};

/** Multi-Blind: no inspection, DNF only, one attempt, 1h limit, points. */
export const MBLD_RULES: WcaRulesProfile = {
  inspectionMs: null,
  allowedPenalties: [Penalty.NONE, Penalty.DNF],
  format: 'bo1',
  timeLimitMs: 3_600_000,
  scoring: 'mbf-points',
};

/** Whether an event profile allows applying the given penalty. */
export function isPenaltyAllowed(profile: WcaRulesProfile, penalty: Penalty): boolean {
  return profile.allowedPenalties.includes(penalty);
}

/**
 * Penalty from an inspection time, according to the event's profile.
 *
 * The profile argument defaults to {@link SPEED_RULES} (the 3×3 behaviour:
 * 15s → +2, 17s → DNF), so existing 1-arg call sites keep working unchanged.
 */
export function getInspectionPenalty(
  inspectionTimeMs: number,
  profile: WcaRulesProfile = SPEED_RULES,
): Penalty {
  // No inspection for the event → never a penalty from the inspection clock.
  if (profile.inspectionMs === null) return Penalty.NONE;

  const dnfAfterMs = profile.dnfAfterMs ?? 17_000;
  const plusTwoAfterMs = profile.plusTwoAfterMs ?? 15_000;

  if (inspectionTimeMs < 0) return Penalty.NONE;
  if (inspectionTimeMs >= dnfAfterMs) return Penalty.DNF;
  if (inspectionTimeMs >= plusTwoAfterMs) return Penalty.PLUS_TWO;
  return Penalty.NONE;
}

export function calculateFinalTime(solveTimeMs: number, penalty: Penalty): number {
  if (penalty === Penalty.DNF) {
    return Infinity; // Or however DNF is represented numerically
  }
  if (penalty === Penalty.PLUS_TWO) {
    return solveTimeMs + 2000;
  }
  return solveTimeMs;
}
