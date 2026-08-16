/**
 * Phase A5 — WcaRules is profile-driven.
 *
 * The rules of the ACTIVE event come from the registry via a
 * WcaRulesProfile, not a single global 3×3 set. These tests pin:
 *   • the default profile keeps the exact 3×3 behaviour (15s → +2, 17s → DNF)
 *   • custom thresholds are honoured
 *   • events without inspection (inspectionMs: null) never penalise
 *   • the TimerEngine consumes the profile (DNF timeout, no inspection,
 *     penalty allow-list)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Penalty,
  getInspectionPenalty,
  isPenaltyAllowed,
  SPEED_RULES,
  BLD_RULES,
  FMC_RULES,
  MBLD_RULES,
  type WcaRulesProfile,
} from '../src/WcaRules';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';

describe('WcaRules — profile-driven (A5)', () => {
  // ── getInspectionPenalty with profiles ──────────────────────────────

  it('default profile = exact 3×3 behaviour (15s → +2, 17s → DNF)', () => {
    expect(getInspectionPenalty(14_999)).toBe(Penalty.NONE);
    expect(getInspectionPenalty(15_000)).toBe(Penalty.PLUS_TWO);
    expect(getInspectionPenalty(16_999)).toBe(Penalty.PLUS_TWO);
    expect(getInspectionPenalty(17_000)).toBe(Penalty.DNF);
  });

  it('custom thresholds are honoured', () => {
    const fastProfile: WcaRulesProfile = {
      inspectionMs: 10_000,
      plusTwoAfterMs: 10_000,
      dnfAfterMs: 12_000,
      allowedPenalties: [Penalty.NONE, Penalty.PLUS_TWO, Penalty.DNF],
      format: 'a5',
      scoring: 'time',
    };
    expect(getInspectionPenalty(9_999, fastProfile)).toBe(Penalty.NONE);
    expect(getInspectionPenalty(10_000, fastProfile)).toBe(Penalty.PLUS_TWO);
    expect(getInspectionPenalty(11_999, fastProfile)).toBe(Penalty.PLUS_TWO);
    expect(getInspectionPenalty(12_000, fastProfile)).toBe(Penalty.DNF);
  });

  it('inspectionMs null → never a penalty from the inspection clock', () => {
    expect(getInspectionPenalty(0, BLD_RULES)).toBe(Penalty.NONE);
    expect(getInspectionPenalty(100_000, BLD_RULES)).toBe(Penalty.NONE);
  });

  it('canonical profiles declare the right shape', () => {
    // Speed: inspection + all penalties.
    expect(SPEED_RULES.inspectionMs).toBe(15_000);
    expect(SPEED_RULES.allowedPenalties).toEqual([
      Penalty.NONE,
      Penalty.PLUS_TWO,
      Penalty.DNF,
    ]);
    // BLD/FMC/MBLD: no inspection, no +2.
    for (const profile of [BLD_RULES, FMC_RULES, MBLD_RULES]) {
      expect(profile.inspectionMs).toBeNull();
      expect(profile.allowedPenalties).not.toContain(Penalty.PLUS_TWO);
    }
    expect(BLD_RULES.format).toBe('bo3');
    expect(FMC_RULES.format).toBe('mo3');
    expect(FMC_RULES.scoring).toBe('fmc-moves');
    expect(MBLD_RULES.format).toBe('bo1');
    expect(MBLD_RULES.timeLimitMs).toBe(3_600_000);
    expect(MBLD_RULES.scoring).toBe('mbf-points');
  });

  it('isPenaltyAllowed follows the profile allow-list', () => {
    expect(isPenaltyAllowed(SPEED_RULES, Penalty.PLUS_TWO)).toBe(true);
    expect(isPenaltyAllowed(SPEED_RULES, Penalty.DNF)).toBe(true);
    expect(isPenaltyAllowed(BLD_RULES, Penalty.PLUS_TWO)).toBe(false);
    expect(isPenaltyAllowed(BLD_RULES, Penalty.DNF)).toBe(true);
  });
});

describe('TimerEngine — consumes the event rules profile (A5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  it('inspection DNF timeout comes from the profile, not a hardcoded 17s', () => {
    const engine = new TimerEngine({
      useInspection: true,
      rules: {
        inspectionMs: 5_000,
        plusTwoAfterMs: 5_000,
        dnfAfterMs: 5_000,
        allowedPenalties: [Penalty.NONE, Penalty.PLUS_TWO, Penalty.DNF],
        format: 'a5',
        scoring: 'time',
      },
    });
    engine.startInspection();
    expect(engine.getState()).toBe(TimerState.INSPECTION);

    // A custom 5s window must auto-DNF at 5s — long before the 17s default.
    vi.advanceTimersByTime(5_100);
    expect(engine.getPenalty()).toBe(Penalty.DNF);
  });

  it('an event without inspection cannot enter INSPECTION', () => {
    const engine = new TimerEngine({ useInspection: true, rules: BLD_RULES });
    expect(engine.startInspection()).toBe(false);
    expect(engine.getState()).toBe(TimerState.IDLE);
  });

  it('+2 is ignored when the event profile does not allow it (BLD)', () => {
    const engine = new TimerEngine({ useInspection: false, rules: BLD_RULES });
    // Manual hold-and-release solve.
    engine.handleDown();
    vi.advanceTimersByTime(300);
    engine.handleUp(); // RUNNING
    vi.advanceTimersByTime(1_000);
    engine.handleDown(); // stop → COOLDOWN

    engine.addModifier('+2');
    expect(engine.getPenalty()).toBe(Penalty.NONE);

    engine.addModifier('DNF');
    expect(engine.getPenalty()).toBe(Penalty.DNF);
  });
});
