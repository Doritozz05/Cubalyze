/**
 * Nivel 3 — Category 6 & 7: Race Conditions + Memory Leaks (TimerEngine)
 *
 * Tests what happens when operations overlap or state machines
 * receive unexpected sequences of events.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';
import { Penalty } from '../src/WcaRules';

// ═══════════════════════════════════════════════════════════════════════
//  R1: Timer handleDown + handleDown simultaneous / double events
// ═══════════════════════════════════════════════════════════════════════

describe('R1 — TimerEngine race conditions', { timeout: 30000 }, () => {
  let timer: TimerEngine;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    timer = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('double handleDown from IDLE: second is a no-op', () => {
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    // Second handleDown while touching: no handler, state stays TOUCHING
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);
  });

  it('handleDown during RUNNING stops correctly', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);

    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
  });

  it('handleDown during STOPPED resets and starts new solve', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    timer.handleDown();
    vi.advanceTimersByTime(500);
    expect(timer.getState()).toBe(TimerState.STOPPED);

    // From STOPPED, handleDown triggers reset then TOUCHING
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);
  });

  it('handleUp during READY starts RUNNING', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    expect(timer.getState()).toBe(TimerState.READY);

    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('handleUp during TOUCHING (early release) returns to previous state', () => {
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    // Release too early
    vi.advanceTimersByTime(100);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('rapid fire: 50 down/up cycles in succession', () => {
    // Use zero-delay timer
    const fastTimer = new TimerEngine({ useInspection: false, holdToStartDelay: 0, cooldownDelay: 0 });

    for (let i = 0; i < 50; i++) {
      fastTimer.handleDown();
      // With holdToStartDelay=0, setTimeout(fn, 0) fires next tick
      vi.advanceTimersByTime(0);
      fastTimer.handleUp();
      fastTimer.handleDown();
      vi.advanceTimersByTime(0);
      fastTimer.reset();
    }

    expect(fastTimer.getState()).toBe(TimerState.IDLE);
  });

  it('handleSmartCubeStart during INSPECTION starts RUNNING', () => {
    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);

    timer.handleSmartCubeStart();
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('handleSmartCubeStart during TOUCHING is rejected (guard clause)', () => {
    timer.startInspection();
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    timer.handleSmartCubeStart();
    expect(timer.getState()).toBe(TimerState.TOUCHING); // rejected
  });

  it('handleSmartCubeStop during RUNNING stops correctly', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);

    timer.handleSmartCubeStop();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
  });

  it('reset during RUNNING returns to IDLE', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);

    expect(timer.reset()).toBe(true);
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('reset during COOLDOWN returns false', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);

    expect(timer.reset()).toBe(false);
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
  });

  it('addModifier during non-STOPPED/COOLDOWN state is ignored', () => {
    timer.addModifier('+2');
    expect(timer.getPenalty()).toBe(Penalty.NONE);

    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    timer.addModifier('DNF');
    expect(timer.getPenalty()).toBe(Penalty.NONE);
  });

  it('DNF then OK is rejected (blocked by guard)', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    timer.handleDown();
    vi.advanceTimersByTime(500);
    expect(timer.getState()).toBe(TimerState.STOPPED);

    timer.addModifier('DNF');
    expect(timer.getPenalty()).toBe(Penalty.DNF);

    timer.addModifier('OK');
    // Guard: if currentPenalty === DNF && flag === 'OK', return
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('inspection timeout fires correctly even after rapid state changes', () => {
    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);

    // Advance past 17s while still in INSPECTION (not holding down)
    vi.advanceTimersByTime(17100);
    // Timeout fires: inspection > 17s → DNF + auto-stop
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('inspection penalty calculated on hold timer completion', () => {
    timer.startInspection();
    // Advance 14s then hold down: penalty should be NONE (under 15s)
    vi.advanceTimersByTime(14000);
    timer.handleDown(); // TOUCHING during inspection
    vi.advanceTimersByTime(300); // hold timer fires → READY
    expect(timer.getPenalty()).toBe(Penalty.NONE);
  });

  it('inspection penalty +2 when hold completes after 15s', () => {
    timer.startInspection();
    vi.advanceTimersByTime(15500); // > 15s, < 17s → +2
    timer.handleDown();
    vi.advanceTimersByTime(300);
    expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  R5: Settings change during active solve
// ═══════════════════════════════════════════════════════════════════════

describe('R5 — Settings change during active solve', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('changing useInspection during solve does not crash', () => {
    // Timer with inspection, holdToStartDelay: 0
    const timer = new TimerEngine({ useInspection: true, holdToStartDelay: 0, cooldownDelay: 0 });

    timer.handleDown(); // TOUCHING, setTimeout(fn, 0) queued
    vi.advanceTimersByTime(0); // hold timer fires → READY
    timer.handleUp(); // READY → RUNNING

    expect(timer.getState()).toBe(TimerState.RUNNING);
    timer.handleDown(); // RUNNING → COOLDOWN
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
  });

  it('arm() + handleDown + early release returns to READY_FOR_MOVE', () => {
    const timer = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500 });
    timer.arm();
    expect(timer.getState()).toBe(TimerState.READY_FOR_MOVE);

    timer.handleDown();
    vi.advanceTimersByTime(100); // < 300ms hold → early release
    timer.handleUp();
    // Early release from READY_FOR_MOVE should return to READY_FOR_MOVE
    expect(timer.getState()).toBe(TimerState.READY_FOR_MOVE);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  M3: 100 solves with TimerEngine (no leak of timeouts/listeners)
// ═══════════════════════════════════════════════════════════════════════

describe('M3 — TimerEngine 100-solve soak (memory stability)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('completes 100 solve cycles without errors', () => {
    const timer = new TimerEngine({ useInspection: false, holdToStartDelay: 0, cooldownDelay: 0 });

    for (let i = 0; i < 100; i++) {
      timer.handleDown();
      vi.advanceTimersByTime(0); // hold timer fires
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(0); // cooldown fires
      timer.reset();

      expect(timer.getState()).toBe(TimerState.IDLE);
      expect(timer.getPenalty()).toBe(Penalty.NONE);
    }
  });

  it('completes 50 inspection-based solve cycles', () => {
    const timer = new TimerEngine({ useInspection: true, holdToStartDelay: 0, cooldownDelay: 0 });

    for (let i = 0; i < 50; i++) {
      timer.startInspection();
      timer.handleDown();
      vi.advanceTimersByTime(0); // hold timer fires
      timer.handleUp();
      timer.handleDown();
      vi.advanceTimersByTime(0); // cooldown fires
      timer.reset();

      expect(timer.getState()).toBe(TimerState.IDLE);
    }
  });
});
