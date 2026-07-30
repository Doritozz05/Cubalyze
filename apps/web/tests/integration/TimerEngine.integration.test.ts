import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerEngine, TimerState } from '@cubeforge/timer-engine';
import { Subject } from 'rxjs';

// Simulate the HardwareTimerEvent type from @cubeforge/hardware-hal
// (avoids a build dependency on hardware-hal for this test)
interface HardwareTimerEvent {
  type: 'hardwareDown' | 'hardwareUp' | 'hardwareReset';
  leftHand?: boolean;
  rightHand?: boolean;
  timestamp?: number;
}

describe('Timer Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should process hardware events through the engine', () => {
    const eventsSubject = new Subject<HardwareTimerEvent>();
    const engine = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500, useInspection: false });

    // Wire adapter events to engine methods (simulates the app integration layer)
    eventsSubject.subscribe((event) => {
      if (event.type === 'hardwareDown') engine.handleDown();
      if (event.type === 'hardwareUp') engine.handleUp();
    });

    expect(engine.getState()).toBe(TimerState.IDLE);

    // Simulate hands on
    eventsSubject.next({ type: 'hardwareDown', leftHand: true, rightHand: true, timestamp: 100 });
    expect(engine.getState()).toBe(TimerState.TOUCHING);

    // Advance past hold-to-start delay
    vi.advanceTimersByTime(300);
    expect(engine.getState()).toBe(TimerState.READY);

    // Simulate hands off → starts running
    eventsSubject.next({ type: 'hardwareUp', leftHand: false, rightHand: false, timestamp: 400 });
    expect(engine.getState()).toBe(TimerState.RUNNING);

    eventsSubject.unsubscribe();
  });

  it('should revert to IDLE if hardware releases too early', () => {
    const eventsSubject = new Subject<HardwareTimerEvent>();
    const engine = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500, useInspection: false });

    eventsSubject.subscribe((event) => {
      if (event.type === 'hardwareDown') engine.handleDown();
      if (event.type === 'hardwareUp') engine.handleUp();
    });

    eventsSubject.next({ type: 'hardwareDown' });
    expect(engine.getState()).toBe(TimerState.TOUCHING);

    // Release before hold delay
    vi.advanceTimersByTime(100);
    eventsSubject.next({ type: 'hardwareUp' });
    expect(engine.getState()).toBe(TimerState.IDLE);

    eventsSubject.unsubscribe();
  });

  it('should stop and report time when hands return during solve', () => {
    const eventsSubject = new Subject<HardwareTimerEvent>();
    const engine = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500, useInspection: false });

    let stopDetail: { timeMs: number } | null = null;
    const stopSub = engine.stop$.subscribe((detail) => { stopDetail = detail; });

    eventsSubject.subscribe((event) => {
      if (event.type === 'hardwareDown') engine.handleDown();
      if (event.type === 'hardwareUp') engine.handleUp();
    });

    // Start solve
    eventsSubject.next({ type: 'hardwareDown' });
    vi.advanceTimersByTime(300);
    eventsSubject.next({ type: 'hardwareUp' });
    expect(engine.getState()).toBe(TimerState.RUNNING);

    // Advance 5 seconds
    vi.advanceTimersByTime(5000);

    // Stop solve
    eventsSubject.next({ type: 'hardwareDown' });
    expect(engine.getState()).toBe(TimerState.COOLDOWN);
    expect(stopDetail).not.toBeNull();
    expect(stopDetail!.timeMs).toBe(5000);

    vi.advanceTimersByTime(500);
    expect(engine.getState()).toBe(TimerState.STOPPED);

    eventsSubject.unsubscribe();
    stopSub.unsubscribe();
  });

  it('should transition to INSPECTION from STOPPED/IDLE when inspection is enabled', () => {
    const engine = new TimerEngine({ holdToStartDelay: 300, cooldownDelay: 500, useInspection: true });

    expect(engine.getState()).toBe(TimerState.IDLE);
    expect(engine.startInspection()).toBe(true);
    expect(engine.getState()).toBe(TimerState.INSPECTION);

    // Holding during inspection enters TOUCHING
    engine.handleDown();
    expect(engine.getState()).toBe(TimerState.TOUCHING);

    // Releasing past hold delay starts RUNNING
    vi.advanceTimersByTime(300);
    expect(engine.getState()).toBe(TimerState.READY);
    engine.handleUp();
    expect(engine.getState()).toBe(TimerState.RUNNING);

    // Stop solve
    vi.advanceTimersByTime(2000);
    engine.handleDown();
    expect(engine.getState()).toBe(TimerState.COOLDOWN);
    vi.advanceTimersByTime(500);
    expect(engine.getState()).toBe(TimerState.STOPPED);

    // From STOPPED state: resetting to IDLE and starting inspection
    engine.reset();
    expect(engine.getState()).toBe(TimerState.IDLE);
    expect(engine.startInspection()).toBe(true);
    expect(engine.getState()).toBe(TimerState.INSPECTION);
  });
});
