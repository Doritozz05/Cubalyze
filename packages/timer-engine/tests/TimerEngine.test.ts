import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';
import { Penalty } from '../src/WcaRules';
import { 
  TimerStateChangeEvent, 
  TimerStopEvent, 
  TimerPenaltyEvent, 
  TimerInspectionWarningEvent 
} from '../src/events';

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

    let warnings: string[] = [];
    timer.addEventListener('inspectionWarning', (e: Event) => {
      warnings.push((e as TimerInspectionWarningEvent).detail.type);
    });

    timer.startInspection(); // inspectionStartTimestamp = 1000
    expect(timer.getState()).toBe(TimerState.INSPECTION);

    mockTime = 9100;
    (timer as any).tick();
    expect(warnings).toContain('8s');

    mockTime = 13200;
    (timer as any).tick();
    expect(warnings).toContain('12s');
  });

  it('should stop and calculate final time correctly', () => {
    let stopEventDetail: any = null;
    timer.addEventListener('stop', (e: Event) => {
      stopEventDetail = (e as TimerStopEvent).detail;
    });

    // Start timer
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    
    // Solve
    vi.advanceTimersByTime(5000);
    
    // Stop
    timer.handleDown();
    expect(timer.getState()).toBe(TimerState.COOLDOWN);
    expect(stopEventDetail).not.toBeNull();
    expect(stopEventDetail.timeMs).toBe(5000);
    expect(stopEventDetail.penalty).toBe(Penalty.NONE);
    
    // Cooldown pass
    vi.advanceTimersByTime(500);
    expect(timer.getState()).toBe(TimerState.STOPPED);
  });

  it('should allow manual modifiers post-solve', () => {
    // Start
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp();
    
    // Solve
    vi.advanceTimersByTime(5000);
    timer.handleDown(); // COOLDOWN
    vi.advanceTimersByTime(500); // STOPPED
    
    expect(timer.getPenalty()).toBe(Penalty.NONE);
    
    timer.addModifier('+2');
    expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);
    
    timer.addModifier('DNF');
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('should reset correctly ignoring if in cooldown', () => {
    timer.handleDown();
    vi.advanceTimersByTime(300);
    timer.handleUp(); // RUNNING
    
    timer.handleDown(); // COOLDOWN
    
    timer.reset();
    expect(timer.getState()).toBe(TimerState.COOLDOWN); // Should ignore reset
    
    vi.advanceTimersByTime(500); // STOPPED
    timer.reset();
    expect(timer.getState()).toBe(TimerState.IDLE);
  });
});
