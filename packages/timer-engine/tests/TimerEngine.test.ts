import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';
import { Penalty } from '../src/WcaRules';

describe('Advanced WCA TimerEngine', () => {
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

  it('should initialize in IDLE state', () => {
    expect(timer.getState()).toBe(TimerState.IDLE);
    expect(timer.getPenalty()).toBe(Penalty.NONE);
  });

  it('should transition to TOUCHING then READY then RUNNING', () => {
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    vi.advanceTimersByTime(300);
    expect(timer.getState()).toBe(TimerState.READY);

    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('should revert to IDLE if released too early', () => {
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    vi.advanceTimersByTime(100);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('should handle WCA inspection and warnings', () => {
    let mockTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    const warnings: string[] = [];
    const sub = timer.inspectionWarning$.subscribe(type => warnings.push(type));

    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);

    mockTime = 9100;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (timer as any).tick();
    expect(warnings).toContain('8s');

    mockTime = 13200;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (timer as any).tick();
    expect(warnings).toContain('12s');

    sub.unsubscribe();
  });

  it('should stop and calculate final time correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stopEventDetail: any = null;
    const sub = timer.stop$.subscribe(detail => { stopEventDetail = detail; });

    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();

    vi.advanceTimersByTime(5000);

    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
    expect(stopEventDetail).not.toBeNull();
    expect(stopEventDetail.timeMs).toBe(5000);
    expect(stopEventDetail.penalty).toBe(Penalty.NONE);

    vi.advanceTimersByTime(500);
    expect(timer.getState()).toBe(TimerState.STOPPED);

    sub.unsubscribe();
  });

  it('should allow manual modifiers post-solve', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();

    vi.advanceTimersByTime(5000);
    timer.handleDown();
    vi.advanceTimersByTime(500);

    expect(timer.getPenalty()).toBe(Penalty.NONE);

    timer.addModifier('+2');
    expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);

    timer.addModifier('DNF');
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('should reset correctly ignoring if in cooldown', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();

    timer.handleDown();

    timer.reset();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);

    vi.advanceTimersByTime(500);
    timer.reset();
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('should detect state changes via state$ BehaviorSubject', () => {
    const states: TimerState[] = [];
    const sub = timer.state$.subscribe(s => states.push(s));

    timer.handleDown();
    expect(states).toContain(TimerState.TOUCHING);

    vi.advanceTimersByTime(300);
    expect(states).toContain(TimerState.READY);

    timer.handleUp();
    expect(states).toContain(TimerState.RUNNING);

    timer.handleDown();
    expect(states).toContain(TimerState.COOLDOWN);

    vi.advanceTimersByTime(500);
    expect(states).toContain(TimerState.STOPPED);

    sub.unsubscribe();
  });

  it('should reject OK modifier after DNF', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    vi.advanceTimersByTime(1000);
    timer.handleDown();
    vi.advanceTimersByTime(500);

    timer.addModifier('DNF');
    expect(timer.getPenalty()).toBe(Penalty.DNF);

    timer.addModifier('OK');
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('should return true/false from reset', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();

    timer.handleDown();
    const result1 = timer.reset();
    expect(result1).toBe(false);

    vi.advanceTimersByTime(500);
    const result2 = timer.reset();
    expect(result2).toBe(true);
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('should return true/false from startInspection', () => {
    const result1 = timer.startInspection();
    expect(result1).toBe(true);

    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    timer.handleDown();
    vi.advanceTimersByTime(500);
    const result2 = timer.startInspection();
    expect(result2).toBe(true);

    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    const result3 = timer.startInspection();
    expect(result3).toBe(false);
  });

  it('should trigger DNF penalty on inspection timeout at 17s', () => {
    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);

    vi.advanceTimersByTime(17000);
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  // ──────────────────────────────────────────────────────────────────────
  //  ARMED state — gates Smart Cube auto-start from IDLE.
  // ──────────────────────────────────────────────────────────────────────

  it('arm() transitions IDLE → ARMED, and only from IDLE', () => {
    expect(timer.arm()).toBe(true);
    expect(timer.getState()).toBe(TimerState.ARMED);

    // second call from ARMED must be rejected
    expect(timer.arm()).toBe(false);
  });

  it('arm() is rejected from any non-IDLE state', () => {
    // RUNNING
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);
    expect(timer.arm()).toBe(false);

    // INSPECTION
    timer.reset();
    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);
    expect(timer.arm()).toBe(false);
  });

  it('Smart Cube start fires from ARMED and INSPECTION but NOT from IDLE', () => {
    // From IDLE: should be a no-op (was previously starting the timer; now disallowed)
    timer.handleSmartCubeStart();
    expect(timer.getState()).toBe(TimerState.IDLE);

    // From ARMED
    timer.arm();
    expect(timer.getState()).toBe(TimerState.ARMED);
    timer.handleSmartCubeStart();
    expect(timer.getState()).toBe(TimerState.RUNNING);

    // From INSPECTION (new engine)
    timer.reset();
    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);
    timer.handleSmartCubeStart();
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('manual override on ARMED enters TOUCHING and returns to ARMED on early release', () => {
    timer.arm();
    expect(timer.getState()).toBe(TimerState.ARMED);

    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.TOUCHING);

    // Release before hold-delay expires → must return to ARMED, not IDLE.
    vi.advanceTimersByTime(100);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.ARMED);

    // Full hold path from ARMED → READY → release → RUNNING
    timer.handleDown();
    vi.advanceTimersByTime(300);
    expect(timer.getState()).toBe(TimerState.READY);
    timer.handleUp();
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('reset() from ARMED returns to IDLE', () => {
    timer.arm();
    expect(timer.getState()).toBe(TimerState.ARMED);
    expect(timer.reset()).toBe(true);
    expect(timer.getState()).toBe(TimerState.IDLE);
  });

  it('ARMED does not emit tick events (no running clock)', () => {
    const ticks: number[] = [];
    const sub = timer.tick$.subscribe(t => ticks.push(t));

    timer.arm();
    vi.advanceTimersByTime(2000);
    timer.reset();

    expect(ticks.length).toBe(0);
    sub.unsubscribe();
  });
});
