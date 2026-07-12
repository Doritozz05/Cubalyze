import { TimerState } from './TimerState';
import { Penalty, getInspectionPenalty, calculateFinalTime } from './WcaRules';
import {
  TimerTickEvent,
  TimerStateChangeEvent,
  TimerPenaltyEvent,
  TimerStopEvent
} from './events';

export class TimerEngine extends EventTarget {
  private currentState: TimerState = TimerState.IDLE;
  private startTimestamp: number = 0;
  private inspectionStartTimestamp: number = 0;
  private animationFrameId: number | null = null;
  private currentPenalty: Penalty = Penalty.NONE;

  constructor() {
    super();
  }

  public getState(): TimerState {
    return this.currentState;
  }

  public getPenalty(): Penalty {
    return this.currentPenalty;
  }

  public startInspection(): void {
    if (this.currentState !== TimerState.IDLE && this.currentState !== TimerState.STOPPED) {
      return;
    }
    this.setState(TimerState.INSPECTION);
    this.currentPenalty = Penalty.NONE;
    this.inspectionStartTimestamp = performance.now();
    this.startTickLoop();
  }

  public ready(): void {
    if (this.currentState !== TimerState.INSPECTION && this.currentState !== TimerState.IDLE && this.currentState !== TimerState.STOPPED) {
      return;
    }
    
    if (this.currentState === TimerState.INSPECTION) {
      // Evaluate if we already exceeded inspection
      const elapsed = performance.now() - this.inspectionStartTimestamp;
      this.currentPenalty = getInspectionPenalty(elapsed);
      if (this.currentPenalty !== Penalty.NONE) {
        this.dispatchEvent(new TimerPenaltyEvent({ penalty: this.currentPenalty }));
      }
    } else {
      this.currentPenalty = Penalty.NONE;
    }
    
    this.setState(TimerState.READY);
    // Don't stop tick loop if we are tracking inspection in background, but READY freezes time conceptually.
    this.stopTickLoop();
  }

  public start(): void {
    if (this.currentState !== TimerState.READY) {
      return;
    }
    this.setState(TimerState.RUNNING);
    this.startTimestamp = performance.now();
    this.startTickLoop();
  }

  public stop(): void {
    if (this.currentState !== TimerState.RUNNING) {
      return;
    }
    this.stopTickLoop();
    
    const solveTimeMs = performance.now() - this.startTimestamp;
    const finalTimeMs = calculateFinalTime(solveTimeMs, this.currentPenalty);
    
    this.setState(TimerState.STOPPED);
    
    this.dispatchEvent(new TimerStopEvent({
      timeMs: solveTimeMs,
      penalty: this.currentPenalty,
      finalTimeMs
    }));
  }

  public reset(): void {
    this.stopTickLoop();
    this.currentPenalty = Penalty.NONE;
    this.setState(TimerState.IDLE);
  }

  private setState(newState: TimerState): void {
    if (this.currentState === newState) return;
    const previousState = this.currentState;
    this.currentState = newState;
    this.dispatchEvent(new TimerStateChangeEvent({ previousState, newState }));
  }

  private startTickLoop(): void {
    this.stopTickLoop(); // Ensure no duplicates
    const loop = () => {
      this.tick();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopTickLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick(): void {
    const now = performance.now();
    let timeMs = 0;

    if (this.currentState === TimerState.INSPECTION) {
      timeMs = now - this.inspectionStartTimestamp;
      
      // Auto-update penalty if we cross thresholds while still inspecting
      const newPenalty = getInspectionPenalty(timeMs);
      if (newPenalty !== this.currentPenalty) {
        this.currentPenalty = newPenalty;
        this.dispatchEvent(new TimerPenaltyEvent({ penalty: this.currentPenalty }));
      }
    } else if (this.currentState === TimerState.RUNNING) {
      timeMs = now - this.startTimestamp;
    } else {
      return;
    }

    this.dispatchEvent(new TimerTickEvent({ timeMs, state: this.currentState }));
  }
}
