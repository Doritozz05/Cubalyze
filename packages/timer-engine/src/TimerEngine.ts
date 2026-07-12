import { TimerState } from './TimerState';
import { Penalty, getInspectionPenalty, calculateFinalTime } from './WcaRules';
import {
  TimerTickEvent,
  TimerStateChangeEvent,
  TimerPenaltyEvent,
  TimerStopEvent,
  TimerInspectionWarningEvent
} from './events';

export interface TimerConfig {
  useInspection: boolean;
  holdToStartDelay: number;
  cooldownDelay: number;
}

const DEFAULT_CONFIG: TimerConfig = {
  useInspection: true,
  holdToStartDelay: 300,
  cooldownDelay: 500
};

export class TimerEngine extends EventTarget {
  private config: TimerConfig;
  private currentState: TimerState = TimerState.IDLE;
  private startTimestamp: number = 0;
  private inspectionStartTimestamp: number = 0;
  private animationFrameId: number | null = null;
  private currentPenalty: Penalty = Penalty.NONE;

  private touchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private warned8s: boolean = false;
  private warned12s: boolean = false;

  private solveTimeMs: number = 0;

  constructor(config?: Partial<TimerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public getState(): TimerState {
    return this.currentState;
  }

  public getPenalty(): Penalty {
    return this.currentPenalty;
  }

  public startInspection(): void {
    if (!this.config.useInspection) return;
    if (this.currentState !== TimerState.IDLE && this.currentState !== TimerState.STOPPED) return;
    
    this.setState(TimerState.INSPECTION);
    this.currentPenalty = Penalty.NONE;
    this.warned8s = false;
    this.warned12s = false;
    this.inspectionStartTimestamp = performance.now();
    this.startTickLoop();
  }

  public handleDown(): void {
    const now = performance.now();

    if (this.currentState === TimerState.IDLE || this.currentState === TimerState.INSPECTION) {
      // Begin touching
      const previousWasInspection = this.currentState === TimerState.INSPECTION;
      this.setState(TimerState.TOUCHING);
      
      this.touchTimeoutId = setTimeout(() => {
        this.setState(TimerState.READY);
        if (previousWasInspection) {
          const elapsed = now - this.inspectionStartTimestamp;
          this.currentPenalty = getInspectionPenalty(elapsed);
          if (this.currentPenalty !== Penalty.NONE) {
            this.dispatchEvent(new TimerPenaltyEvent({ penalty: this.currentPenalty }));
          }
        } else {
          this.currentPenalty = Penalty.NONE;
        }
      }, this.config.holdToStartDelay);

    } else if (this.currentState === TimerState.RUNNING) {
      // Stop the timer
      this.stopTickLoop();
      this.solveTimeMs = now - this.startTimestamp;
      const finalTimeMs = calculateFinalTime(this.solveTimeMs, this.currentPenalty);
      
      this.setState(TimerState.COOLDOWN);
      this.dispatchEvent(new TimerStopEvent({
        timeMs: this.solveTimeMs,
        penalty: this.currentPenalty,
        finalTimeMs
      }));

      this.cooldownTimeoutId = setTimeout(() => {
        this.setState(TimerState.STOPPED);
      }, this.config.cooldownDelay);
    }
  }

  public handleUp(): void {
    if (this.currentState === TimerState.TOUCHING) {
      // Let go too early
      if (this.touchTimeoutId) {
        clearTimeout(this.touchTimeoutId);
        this.touchTimeoutId = null;
      }
      // Revert state
      if (this.config.useInspection && this.inspectionStartTimestamp > 0) {
        this.setState(TimerState.INSPECTION);
      } else {
        this.setState(TimerState.IDLE);
      }
    } else if (this.currentState === TimerState.READY) {
      // Start the solve
      this.setState(TimerState.RUNNING);
      this.startTimestamp = performance.now();
      // Reset inspection data so it doesn't leak
      this.inspectionStartTimestamp = 0;
      this.startTickLoop();
    }
  }

  public addModifier(flag: 'OK' | '+2' | 'DNF'): void {
    if (this.currentState !== TimerState.STOPPED && this.currentState !== TimerState.COOLDOWN) {
      return;
    }
    
    if (flag === 'OK') {
      this.currentPenalty = Penalty.NONE;
    } else if (flag === '+2') {
      this.currentPenalty = Penalty.PLUS_TWO;
    } else if (flag === 'DNF') {
      this.currentPenalty = Penalty.DNF;
    }

    const finalTimeMs = calculateFinalTime(this.solveTimeMs, this.currentPenalty);
    
    this.dispatchEvent(new TimerStopEvent({
      timeMs: this.solveTimeMs,
      penalty: this.currentPenalty,
      finalTimeMs
    }));
    this.dispatchEvent(new TimerPenaltyEvent({ penalty: this.currentPenalty }));
  }

  public reset(): void {
    if (this.currentState === TimerState.COOLDOWN) return; // Ignore reset during cooldown

    this.stopTickLoop();
    if (this.touchTimeoutId) clearTimeout(this.touchTimeoutId);
    if (this.cooldownTimeoutId) clearTimeout(this.cooldownTimeoutId);
    
    this.currentPenalty = Penalty.NONE;
    this.inspectionStartTimestamp = 0;
    this.solveTimeMs = 0;
    this.setState(TimerState.IDLE);
  }

  private setState(newState: TimerState): void {
    if (this.currentState === newState) return;
    const previousState = this.currentState;
    this.currentState = newState;
    this.dispatchEvent(new TimerStateChangeEvent({ previousState, newState }));
  }

  private startTickLoop(): void {
    this.stopTickLoop();
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

    if (this.currentState === TimerState.INSPECTION || this.currentState === TimerState.TOUCHING) {
      if (!this.config.useInspection || this.inspectionStartTimestamp === 0) return;
      
      timeMs = now - this.inspectionStartTimestamp;
      
      // Emit warnings
      if (timeMs >= 8000 && !this.warned8s) {
        this.warned8s = true;
        this.dispatchEvent(new TimerInspectionWarningEvent({ type: '8s' }));
      }
      if (timeMs >= 12000 && !this.warned12s) {
        this.warned12s = true;
        this.dispatchEvent(new TimerInspectionWarningEvent({ type: '12s' }));
      }

      // Auto-update penalty if we cross thresholds while inspecting/touching
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
