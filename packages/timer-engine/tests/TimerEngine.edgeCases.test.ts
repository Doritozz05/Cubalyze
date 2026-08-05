import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';
import { Penalty } from '../src/WcaRules';

describe('TimerEngine — Level 2 Edge Cases', () => {
  let timer: TimerEngine;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    timer = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ────────────────────────────────────────────────────────────────────
  //  Invalid state transitions
  // ────────────────────────────────────────────────────────────────────

  describe('handleDown — invalid transitions', () => {
    it('handleDown during RUNNING stops the timer (valid, not invalid)', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.RUNNING);

      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
    });

    it('handleDown during COOLDOWN is a no-op (no state change)', () => {
      // Get to COOLDOWN
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      // handleDown during COOLDOWN should not change state
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
    });

    it('handleDown during STOPPED triggers reset and new down', () => {
      // Get to STOPPED
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      // handleDown from STOPPED: resets and starts new hold
      const resetSpy = vi.spyOn(timer, 'reset');
      timer.handleDown();
      expect(resetSpy).toHaveBeenCalled();
      expect(timer.getState()).toBe(TimerState.TOUCHING);
      resetSpy.mockRestore();
    });

    it('handleDown during READY (second simultaneous press) is no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      expect(timer.getState()).toBe(TimerState.READY);

      // Second handleDown during READY — no handler for this state
      timer.handleDown();
      // Should remain in READY (no transition defined for this case)
      expect(timer.getState()).toBe(TimerState.READY);
    });
  });

  describe('handleUp — invalid transitions', () => {
    it('handleUp during IDLE is a no-op', () => {
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.IDLE);
    });

    it('handleUp during STOPPED is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.STOPPED);
    });

    it('handleUp during COOLDOWN is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
    });

    it('handleUp during RUNNING is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.RUNNING);

      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.RUNNING);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  addModifier edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('addModifier — invalid states', () => {
    it('addModifier during IDLE is a no-op', () => {
      timer.addModifier('+2');
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });

    it('addModifier during RUNNING is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.addModifier('DNF');
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });

    it('addModifier during INSPECTION is a no-op', () => {
      timer.startInspection();
      timer.addModifier('+2');
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });

    it('addModifier with unknown flag is silently ignored', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      // @ts-expect-error testing invalid input
      timer.addModifier('INVALID');
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });

    it('DNF → +2 is allowed (override DNF with +2)', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      timer.addModifier('DNF');
      expect(timer.getPenalty()).toBe(Penalty.DNF);

      timer.addModifier('+2');
      expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);
    });

    it('OK resets penalty back to NONE', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);

      timer.addModifier('+2');
      expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);

      timer.addModifier('OK');
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });

    it('addModifier during COOLDOWN is allowed', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      timer.addModifier('+2');
      expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  startInspection edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('startInspection — edge cases', () => {
    it('startInspection during RUNNING returns false', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.RUNNING);

      expect(timer.startInspection()).toBe(false);
      expect(timer.getState()).toBe(TimerState.RUNNING);
    });

    it('startInspection during COOLDOWN returns false', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      expect(timer.startInspection()).toBe(false);
    });

    it('startInspection with useInspection=false returns false', () => {
      const noInspTimer = new TimerEngine({ useInspection: false });
      expect(noInspTimer.startInspection()).toBe(false);
      expect(noInspTimer.getState()).toBe(TimerState.IDLE);
    });

    it('startInspection from STOPPED returns true', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      expect(timer.startInspection()).toBe(true);
      expect(timer.getState()).toBe(TimerState.INSPECTION);
    });

    it('double startInspection from IDLE returns false on second call', () => {
      expect(timer.startInspection()).toBe(true);
      expect(timer.startInspection()).toBe(false);
      expect(timer.getState()).toBe(TimerState.INSPECTION);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  handleSmartCubeStart / handleSmartCubeStop edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('handleSmartCubeStart — edge cases', () => {
    it('handleSmartCubeStart during TOUCHING is a no-op (not in guard clause)', () => {
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.TOUCHING);

      timer.handleSmartCubeStart();
      expect(timer.getState()).toBe(TimerState.TOUCHING);
    });

    it('handleSmartCubeStart during RUNNING is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.RUNNING);

      timer.handleSmartCubeStart();
      expect(timer.getState()).toBe(TimerState.RUNNING);
    });

    it('handleSmartCubeStart during STOPPED is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      timer.handleSmartCubeStart();
      expect(timer.getState()).toBe(TimerState.STOPPED);
    });

    it('handleSmartCubeStart during COOLDOWN is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      timer.handleSmartCubeStart();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
    });

    it('handleSmartCubeStart from TOUCHING is a no-op (guard clause only allows INSPECTION/READY_FOR_MOVE)', () => {
      timer.startInspection();
      expect(timer.getState()).toBe(TimerState.INSPECTION);

      // Simulate user touching during inspection
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.TOUCHING);

      // Smart cube move fires — but handleSmartCubeStart only fires from
      // INSPECTION or READY_FOR_MOVE, NOT from TOUCHING.
      // The guard clause `if (state !== INSPECTION && state !== READY_FOR_MOVE) return;`
      // correctly rejects TOUCHING.
      timer.handleSmartCubeStart();
      expect(timer.getState()).toBe(TimerState.TOUCHING);
    });
  });

  describe('handleSmartCubeStop — edge cases', () => {
    it('handleSmartCubeStop during IDLE is a no-op', () => {
      timer.handleSmartCubeStop();
      expect(timer.getState()).toBe(TimerState.IDLE);
    });

    it('handleSmartCubeStop during INSPECTION is a no-op', () => {
      timer.startInspection();
      timer.handleSmartCubeStop();
      expect(timer.getState()).toBe(TimerState.INSPECTION);
    });

    it('handleSmartCubeStop during READY_FOR_MOVE is a no-op', () => {
      timer.arm();
      timer.handleSmartCubeStop();
      expect(timer.getState()).toBe(TimerState.READY_FOR_MOVE);
    });

    it('handleSmartCubeStop during COOLDOWN is a no-op', () => {
      // Subscribe BEFORE the solve flow to capture the stop event from handleDown
      const stopEvents: unknown[] = [];
      const sub = timer.stop$.subscribe(e => stopEvents.push(e));

      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
      // The initial stop from handleDown was captured
      expect(stopEvents.length).toBe(1);

      timer.handleSmartCubeStop();
      expect(timer.getState()).toBe(TimerState.COOLDOWN);
      // No additional stop event emitted
      expect(stopEvents.length).toBe(1);

      sub.unsubscribe();
    });

    it('handleSmartCubeStop during STOPPED is a no-op', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);

      timer.handleSmartCubeStop();
      expect(timer.getState()).toBe(TimerState.STOPPED);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Inspection timeout edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('inspection timeout — edge cases', () => {
    it('inspection timeout at 17s DNFs when still in TOUCHING (hold delay longer than 17s)', () => {
      // Use a hold delay longer than 17s so the TOUCHING timeout doesn't fire
      // before the inspection timeout. When the inspection timeout fires at 17s,
      // it transitions to COOLDOWN with DNF penalty if still in TOUCHING.
      const slowTimer = new TimerEngine({ holdToStartDelay: 30000, cooldownDelay: 500 });
      slowTimer.startInspection();
      expect(slowTimer.getState()).toBe(TimerState.INSPECTION);

      slowTimer.handleDown();
      expect(slowTimer.getState()).toBe(TimerState.TOUCHING);

      vi.advanceTimersByTime(17000);
      // The inspection timeout fires → auto-DNF → COOLDOWN
      expect(slowTimer.getPenalty()).toBe(Penalty.DNF);
      expect(slowTimer.getState()).toBe(TimerState.COOLDOWN);
    });

    it('inspection timeout transitions to COOLDOWN → STOPPED', () => {
      timer.startInspection();
      vi.advanceTimersByTime(17000);

      expect(timer.getPenalty()).toBe(Penalty.DNF);
      expect(timer.getState()).toBe(TimerState.COOLDOWN);

      vi.advanceTimersByTime(500);
      expect(timer.getState()).toBe(TimerState.STOPPED);
    });

    it('inspection emits stop$ with DNF penalty on timeout', () => {
      const stopEvents: unknown[] = [];
      const sub = timer.stop$.subscribe(e => stopEvents.push(e));

      timer.startInspection();
      vi.advanceTimersByTime(17000);

      expect(stopEvents.length).toBe(1);
      expect((stopEvents[0] as { penalty: Penalty }).penalty).toBe(Penalty.DNF);
      expect((stopEvents[0] as { finalTimeMs: number }).finalTimeMs).toBe(Infinity);

      sub.unsubscribe();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Timer config edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('config edge cases', () => {
    it('holdToStartDelay = 0: immediately READY on handleDown', () => {
      const fastTimer = new TimerEngine({ holdToStartDelay: 0, cooldownDelay: 500 });
      fastTimer.handleDown();
      // With 0ms delay, setTimeout(fn, 0) fires on next tick
      vi.advanceTimersByTime(0);
      expect(fastTimer.getState()).toBe(TimerState.READY);
    });

    it('cooldownDelay = 0: immediately STOPPED after handleDown in RUNNING', () => {
      const fastTimer = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 0 });
      fastTimer.handleDown();
      vi.advanceTimersByTime(300);
      fastTimer.handleUp();
      fastTimer.handleDown();
      vi.advanceTimersByTime(0);
      expect(fastTimer.getState()).toBe(TimerState.STOPPED);
    });

    it('useInspection = false: inspection methods are ignored', () => {
      const noInspTimer = new TimerEngine({ useInspection: false });
      expect(noInspTimer.startInspection()).toBe(false);
      noInspTimer.handleDown();
      expect(noInspTimer.getState()).toBe(TimerState.TOUCHING);
      // Release too early goes back to IDLE (not INSPECTION)
      vi.advanceTimersByTime(100);
      noInspTimer.handleUp();
      expect(noInspTimer.getState()).toBe(TimerState.IDLE);
    });

    it('extreme holdToStartDelay is handled correctly', () => {
      const longTimer = new TimerEngine({ holdToStartDelay: 5000, cooldownDelay: 500 });
      longTimer.handleDown();
      expect(longTimer.getState()).toBe(TimerState.TOUCHING);

      vi.advanceTimersByTime(3000);
      expect(longTimer.getState()).toBe(TimerState.TOUCHING);

      vi.advanceTimersByTime(2000);
      expect(longTimer.getState()).toBe(TimerState.READY);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Rapid state changes / race conditions
  // ────────────────────────────────────────────────────────────────────

  describe('rapid state changes', () => {
    it('rapid handleDown → handleUp → handleDown in TOUCHING works', () => {
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.TOUCHING);

      // Immediate release
      vi.advanceTimersByTime(50);
      timer.handleUp();
      expect(timer.getState()).toBe(TimerState.IDLE);

      // Immediate re-press
      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.TOUCHING);
    });

    it('reset → startInspection → handleDown works sequentially', () => {
      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(500);

      timer.reset();
      expect(timer.getState()).toBe(TimerState.IDLE);

      timer.startInspection();
      expect(timer.getState()).toBe(TimerState.INSPECTION);

      timer.handleDown();
      expect(timer.getState()).toBe(TimerState.TOUCHING);
    });

    it('reset clears all timeouts (no runaway callbacks)', () => {
      timer.startInspection();
      timer.handleDown();
      // Reset should clear inspection timeout and touch timeout
      expect(timer.reset()).toBe(true);
      expect(timer.getState()).toBe(TimerState.IDLE);

      // Verify no runaway timeouts fire
      vi.advanceTimersByTime(20000);
      expect(timer.getState()).toBe(TimerState.IDLE);
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  //  Tick loop edge cases
  // ────────────────────────────────────────────────────────────────────

  describe('tick loop — edge cases', () => {
    it('tick does not emit during IDLE', () => {
      const ticks: number[] = [];
      const sub = timer.tick$.subscribe(t => ticks.push(t));
      vi.advanceTimersByTime(2000);
      expect(ticks.length).toBe(0);
      sub.unsubscribe();
    });

    it('tick during RUNNING emits increasing values', () => {
      let mockTime = 10000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();
      // Tick loop started

      const ticks: number[] = [];
      const sub = timer.tick$.subscribe(t => ticks.push(t));

      mockTime = 10500;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (timer as any).tick();
      expect(ticks[0]).toBe(500);

      mockTime = 11000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (timer as any).tick();
      expect(ticks[1]).toBe(1000);

      sub.unsubscribe();
    });

    it('tick during RUNNING corrects negative time (clock skew)', () => {
      let mockTime = 10000;
      const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

      timer.handleDown();
      vi.advanceTimersByTime(300);
      timer.handleUp();

      // Simulate clock going backwards
      mockTime = 9000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (timer as any).tick();

      // startTimestamp should be reset to now, timeMs should be 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((timer as any).solveTimeMs).not.toBeLessThan(0);

      nowSpy.mockRestore();
    });
  });
});
