import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerEngine } from '../src/TimerEngine';
import { TimerState } from '../src/TimerState';
import { Penalty } from '../src/WcaRules';
import { TimerStateChangeEvent, TimerStopEvent, TimerPenaltyEvent } from '../src/events';

describe('TimerEngine', () => {
  let timer: TimerEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    timer = new TimerEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should initialize in IDLE state', () => {
    expect(timer.getState()).toBe(TimerState.IDLE);
    expect(timer.getPenalty()).toBe(Penalty.NONE);
  });

  it('should transition to INSPECTION', () => {
    let stateChangeEmitted = false;
    timer.addEventListener('stateChange', (e: Event) => {
      const event = e as TimerStateChangeEvent;
      if (event.detail.newState === TimerState.INSPECTION) {
        stateChangeEmitted = true;
      }
    });

    timer.startInspection();
    expect(timer.getState()).toBe(TimerState.INSPECTION);
    expect(stateChangeEmitted).toBe(true);
  });

  it('should handle WCA +2 penalty during inspection', () => {
    timer.startInspection();
    
    let penaltyEmitted = Penalty.NONE;
    timer.addEventListener('penalty', (e: Event) => {
      const event = e as TimerPenaltyEvent;
      penaltyEmitted = event.detail.penalty;
    });

    // Advance 15.5 seconds
    vi.advanceTimersByTime(15500);
    
    // Stop inspection and get ready
    timer.ready();
    
    expect(timer.getPenalty()).toBe(Penalty.PLUS_TWO);
    expect(penaltyEmitted).toBe(Penalty.PLUS_TWO);
  });

  it('should handle WCA DNF penalty during inspection', () => {
    timer.startInspection();
    
    // Advance 17.5 seconds
    vi.advanceTimersByTime(17500);
    
    timer.ready();
    
    expect(timer.getPenalty()).toBe(Penalty.DNF);
  });

  it('should transition to READY', () => {
    timer.startInspection();
    timer.ready();
    expect(timer.getState()).toBe(TimerState.READY);
  });

  it('should transition to RUNNING and track time', () => {
    timer.startInspection();
    timer.ready();
    timer.start();
    
    expect(timer.getState()).toBe(TimerState.RUNNING);
  });

  it('should stop and calculate final time with +2 penalty', () => {
    let stopEventDetail: any = null;
    timer.addEventListener('stop', (e: Event) => {
      const event = e as TimerStopEvent;
      stopEventDetail = event.detail;
    });

    timer.startInspection();
    vi.advanceTimersByTime(15500); // Trigger +2
    timer.ready();
    
    timer.start();
    vi.advanceTimersByTime(5000); // 5 seconds solve
    timer.stop();
    
    expect(timer.getState()).toBe(TimerState.STOPPED);
    expect(stopEventDetail).not.toBeNull();
    expect(stopEventDetail.timeMs).toBe(5000);
    expect(stopEventDetail.penalty).toBe(Penalty.PLUS_TWO);
    expect(stopEventDetail.finalTimeMs).toBe(7000); // 5000 + 2000
  });

  it('should stop and calculate final time with DNF', () => {
    let stopEventDetail: any = null;
    timer.addEventListener('stop', (e: Event) => {
      const event = e as TimerStopEvent;
      stopEventDetail = event.detail;
    });

    timer.startInspection();
    vi.advanceTimersByTime(18000); // Trigger DNF
    timer.ready();
    
    timer.start();
    vi.advanceTimersByTime(5000); // 5 seconds solve
    timer.stop();
    
    expect(stopEventDetail.timeMs).toBe(5000);
    expect(stopEventDetail.penalty).toBe(Penalty.DNF);
    expect(stopEventDetail.finalTimeMs).toBe(Infinity);
  });

  it('should correctly calculate clean solve time', () => {
    let stopEventDetail: any = null;
    timer.addEventListener('stop', (e: Event) => {
      const event = e as TimerStopEvent;
      stopEventDetail = event.detail;
    });

    timer.startInspection();
    vi.advanceTimersByTime(5000); // Clean inspection
    timer.ready();
    
    timer.start();
    vi.advanceTimersByTime(10000); // 10 seconds solve
    timer.stop();
    
    expect(stopEventDetail.timeMs).toBe(10000);
    expect(stopEventDetail.penalty).toBe(Penalty.NONE);
    expect(stopEventDetail.finalTimeMs).toBe(10000);
  });

  it('should reset state correctly', () => {
    timer.startInspection();
    timer.ready();
    timer.start();
    timer.reset();
    
    expect(timer.getState()).toBe(TimerState.IDLE);
    expect(timer.getPenalty()).toBe(Penalty.NONE);
  });
});
