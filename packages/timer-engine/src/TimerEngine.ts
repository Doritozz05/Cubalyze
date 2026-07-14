import { Subject, BehaviorSubject } from 'rxjs';
import { TimerState } from './TimerState';
import { Penalty, getInspectionPenalty, calculateFinalTime } from './WcaRules';

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

export interface TimerStopEventDetail {
  timeMs: number;
  penalty: Penalty;
  finalTimeMs: number;
}

export class TimerEngine {
  readonly tick$ = new Subject<number>();
  readonly state$ = new BehaviorSubject<TimerState>(TimerState.IDLE);
  readonly penalty$ = new BehaviorSubject<Penalty>(Penalty.NONE);
  readonly stop$ = new Subject<TimerStopEventDetail>();
  readonly inspectionWarning$ = new Subject<'8s' | '12s'>();

  private config: TimerConfig;
  private currentState: TimerState = TimerState.IDLE;
  private startTimestamp: number = 0;
  private inspectionStartTimestamp: number = 0;
  private animationFrameId: number | null = null;
  private currentPenalty: Penalty = Penalty.NONE;

  private touchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private inspectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private warned8s: boolean = false;
  private warned12s: boolean = false;

  private solveTimeMs: number = 0;

  constructor(config?: Partial<TimerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public getState(): TimerState {
    return this.currentState;
  }

  public getPenalty(): Penalty {
    return this.currentPenalty;
  }

  public startInspection(): boolean {
    if (!this.config.useInspection) return false;
    if (this.currentState !== TimerState.IDLE && this.currentState !== TimerState.STOPPED) return false;

    this.setState(TimerState.INSPECTION);
    this.currentPenalty = Penalty.NONE;
    this.warned8s = false;
    this.warned12s = false;
    this.inspectionStartTimestamp = performance.now();
    this.startTickLoop();

    this.inspectionTimeoutId = setTimeout(() => {
      if (this.currentState === TimerState.INSPECTION || this.currentState === TimerState.TOUCHING) {
        this.currentPenalty = Penalty.DNF;
        this.penalty$.next(this.currentPenalty);
        
        // Auto-end solve as DNF
        this.stopTickLoop();
        this.solveTimeMs = 0;
        
        if (this.touchTimeoutId) {
          clearTimeout(this.touchTimeoutId);
          this.touchTimeoutId = null;
        }

        const finalTimeMs = calculateFinalTime(this.solveTimeMs, this.currentPenalty);

        this.setState(TimerState.COOLDOWN);
        this.stop$.next({
          timeMs: this.solveTimeMs,
          penalty: this.currentPenalty,
          finalTimeMs
        });

        this.cooldownTimeoutId = setTimeout(() => {
          this.setState(TimerState.STOPPED);
        }, this.config.cooldownDelay);
      }
    }, 17000);

    return true;
  }

  public handleDown(): void {
    const now = performance.now();

    if (this.currentState === TimerState.STOPPED) {
      this.reset();
    }

    if (this.currentState === TimerState.IDLE || this.currentState === TimerState.INSPECTION) {
      const previousWasInspection = this.currentState === TimerState.INSPECTION;
      this.setState(TimerState.TOUCHING);

      this.touchTimeoutId = setTimeout(() => {
        this.setState(TimerState.READY);
        if (previousWasInspection) {
          const elapsed = performance.now() - this.inspectionStartTimestamp;
          this.currentPenalty = getInspectionPenalty(elapsed);
          if (this.currentPenalty !== Penalty.NONE) {
            this.penalty$.next(this.currentPenalty);
          }
        } else {
          this.currentPenalty = Penalty.NONE;
        }
      }, this.config.holdToStartDelay);

    } else if (this.currentState === TimerState.RUNNING) {
      this.stopTickLoop();
      this.solveTimeMs = Math.max(0, now - this.startTimestamp);
      const finalTimeMs = calculateFinalTime(this.solveTimeMs, this.currentPenalty);

      this.setState(TimerState.COOLDOWN);
      this.stop$.next({
        timeMs: this.solveTimeMs,
        penalty: this.currentPenalty,
        finalTimeMs
      });

      this.cooldownTimeoutId = setTimeout(() => {
        this.setState(TimerState.STOPPED);
      }, this.config.cooldownDelay);
    }
  }

  public handleUp(): void {
    if (this.currentState === TimerState.TOUCHING) {
      if (this.touchTimeoutId) {
        clearTimeout(this.touchTimeoutId);
        this.touchTimeoutId = null;
      }
      if (this.config.useInspection && this.inspectionStartTimestamp > 0) {
        this.setState(TimerState.INSPECTION);
      } else {
        this.setState(TimerState.IDLE);
      }
    } else if (this.currentState === TimerState.READY) {
      this.setState(TimerState.RUNNING);
      this.startTimestamp = performance.now();
      this.inspectionStartTimestamp = 0;
      this.startTickLoop();
    }
  }

  public handleSmartCubeStart(): void {
    if (this.currentState === TimerState.INSPECTION || this.currentState === TimerState.IDLE) {
      if (this.touchTimeoutId) {
        clearTimeout(this.touchTimeoutId);
        this.touchTimeoutId = null;
      }
      if (this.currentState === TimerState.INSPECTION) {
        const elapsed = performance.now() - this.inspectionStartTimestamp;
        this.currentPenalty = getInspectionPenalty(elapsed);
        if (this.currentPenalty !== Penalty.NONE) {
          this.penalty$.next(this.currentPenalty);
        }
      } else {
        this.currentPenalty = Penalty.NONE;
      }
      this.setState(TimerState.RUNNING);
      this.startTimestamp = performance.now();
      this.inspectionStartTimestamp = 0;
      this.startTickLoop();
    }
  }

  public handleSmartCubeStop(): void {
    if (this.currentState === TimerState.RUNNING) {
      this.stopTickLoop();
      this.solveTimeMs = Math.max(0, performance.now() - this.startTimestamp);
      const finalTimeMs = calculateFinalTime(this.solveTimeMs, this.currentPenalty);

      this.setState(TimerState.COOLDOWN);
      this.stop$.next({
        timeMs: this.solveTimeMs,
        penalty: this.currentPenalty,
        finalTimeMs
      });

      this.cooldownTimeoutId = setTimeout(() => {
        this.setState(TimerState.STOPPED);
      }, this.config.cooldownDelay);
    }
  }

  public addModifier(flag: 'OK' | '+2' | 'DNF'): void {
    if (this.currentState !== TimerState.STOPPED && this.currentState !== TimerState.COOLDOWN) {
      return;
    }

    if (this.currentPenalty === Penalty.DNF && flag === 'OK') {
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

    this.stop$.next({
      timeMs: this.solveTimeMs,
      penalty: this.currentPenalty,
      finalTimeMs
    });
    this.penalty$.next(this.currentPenalty);
  }

  public reset(): boolean {
    if (this.currentState === TimerState.COOLDOWN) return false;

    if (this.inspectionTimeoutId) {
      clearTimeout(this.inspectionTimeoutId);
      this.inspectionTimeoutId = null;
    }
    this.stopTickLoop();
    if (this.touchTimeoutId) clearTimeout(this.touchTimeoutId);
    if (this.cooldownTimeoutId) clearTimeout(this.cooldownTimeoutId);

    this.currentPenalty = Penalty.NONE;
    this.inspectionStartTimestamp = 0;
    this.solveTimeMs = 0;
    this.setState(TimerState.IDLE);
    return true;
  }

  private setState(newState: TimerState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.state$.next(newState);
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

      if (timeMs >= 8000 && !this.warned8s) {
        this.warned8s = true;
        this.inspectionWarning$.next('8s');
      }
      if (timeMs >= 12000 && !this.warned12s) {
        this.warned12s = true;
        this.inspectionWarning$.next('12s');
      }

      const newPenalty = getInspectionPenalty(timeMs);
      if (newPenalty !== this.currentPenalty) {
        this.currentPenalty = newPenalty;
        this.penalty$.next(this.currentPenalty);
      }
    } else if (this.currentState === TimerState.RUNNING) {
      timeMs = now - this.startTimestamp;
      if (timeMs < 0) {
        this.startTimestamp = now;
        timeMs = 0;
      }
    } else {
      return;
    }

    this.tick$.next(timeMs);
  }
}
