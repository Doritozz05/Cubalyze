/**
 * @cubeforge/training — Session Engine
 *
 * Pure state machine for training sessions. Exercise-agnostic:
 * the same engine runs an OLL Drill or a Cross Trainer.
 *
 * States: Idle → Setup → Armed → Solving → Verdict → Setup (cycle)
 *
 * The engine emits state transitions as plain objects. The UI layer
 * (apps/web) subscribes to transitions and renders accordingly.
 */

import type {
  TrainingSessionPhase,
  TrainingSessionConfig,
  TrainingSessionState,
  TrainingAttempt,
  AttemptVerdict,
  PlayMode,
} from '../types';

// ─── Internal State ──────────────────────────────────────────────────────

interface InternalState {
  phase: TrainingSessionPhase;
  config: TrainingSessionConfig;
  attemptIndex: number;
  attempts: TrainingAttempt[];
  currentTimeMs: number;
  stoppedTimeMs: number;
  smartCubeConnected: boolean;
  currentScramble: string;
  currentCaseId: string;
}

// ─── Event Types ─────────────────────────────────────────────────────────

export type SessionEvent =
  | { type: 'START_SESSION'; config: TrainingSessionConfig }
  | { type: 'SCRAMBLE_GENERATED'; scramble: string; caseId: string }
  | { type: 'ARM' }
  | { type: 'START_SOLVING' }
  | { type: 'TICK'; timeMs: number }
  | { type: 'STOP'; timeMs: number }
  | { type: 'VERDICT'; verdict: AttemptVerdict; playMode: PlayMode; expectedMoves?: string[] }
  | { type: 'NEXT_ATTEMPT' }
  | { type: 'END_SESSION' }
  | { type: 'SMART_CUBE_CONNECTED'; connected: boolean };

// ─── Listener Type ───────────────────────────────────────────────────────

export type SessionStateListener = (state: TrainingSessionState) => void;

// ─── Engine ──────────────────────────────────────────────────────────────

export class TrainingSessionEngine {
  private state: InternalState;
  private listeners: Set<SessionStateListener> = new Set();
  private attemptIdCounter = 0;

  constructor() {
    this.state = this.createInitialState();
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Get current session state snapshot */
  getState(): TrainingSessionState {
    return toPublicState(this.state);
  }

  /** Subscribe to state changes */
  subscribe(listener: SessionStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Dispatch an event to the state machine */
  dispatch(event: SessionEvent): void {
    this.state = this.reduce(this.state, event);
    this.notify();
  }

  /** Reset to initial idle state */
  reset(): void {
    this.state = this.createInitialState();
    this.notify();
  }

  // ── State Reducer ─────────────────────────────────────────────────

  private reduce(state: InternalState, event: SessionEvent): InternalState {
    switch (event.type) {
      case 'START_SESSION':
        this.attemptIdCounter = 0;
        return {
          ...this.createInitialState(),
          phase: 'setup',
          config: event.config,
        };

      case 'SCRAMBLE_GENERATED':
        if (state.phase !== 'setup') return state;
        return {
          ...state,
          currentScramble: event.scramble,
          currentCaseId: event.caseId,
        };

      case 'ARM':
        if (state.phase !== 'setup') return state;
        return { ...state, phase: 'armed' };

      case 'START_SOLVING':
        if (state.phase !== 'armed') return state;
        return { ...state, phase: 'solving', currentTimeMs: 0 };

      case 'TICK':
        if (state.phase !== 'solving') return state;
        return { ...state, currentTimeMs: event.timeMs };

      case 'STOP':
        if (state.phase !== 'solving') return state;
        return {
          ...state,
          phase: 'verdict',
          stoppedTimeMs: event.timeMs,
          currentTimeMs: event.timeMs,
        };

      case 'VERDICT': {
        if (state.phase !== 'verdict') return state;
        const attempt: TrainingAttempt = {
          id: `attempt-${++this.attemptIdCounter}-${Date.now()}`,
          exerciseId: state.config.preset.exerciseId,
          caseId: state.currentCaseId,
          scramble: state.currentScramble,
          timeMs: state.stoppedTimeMs,
          verdict: event.verdict,
          playMode: event.playMode,
          timestamp: Date.now(),
          expectedMoves: event.expectedMoves,
        };
        return {
          ...state,
          attempts: [attempt, ...state.attempts],
          attemptIndex: state.attemptIndex + 1,
        };
      }

      case 'NEXT_ATTEMPT':
        if (state.phase !== 'verdict') return state;
        return { ...state, phase: 'setup', stoppedTimeMs: 0 };

      case 'END_SESSION':
        return { ...state, phase: 'idle' };

      case 'SMART_CUBE_CONNECTED':
        return { ...state, smartCubeConnected: event.connected };

      default:
        return state;
    }
  }

  // ── Private ────────────────────────────────────────────────────────

  private createInitialState(): InternalState {
    return {
      phase: 'idle',
      config: { preset: { exerciseId: '', methodId: '' } },
      attemptIndex: 0,
      attempts: [],
      currentTimeMs: 0,
      stoppedTimeMs: 0,
      smartCubeConnected: false,
      currentScramble: '',
      currentCaseId: '',
    };
  }

  private notify(): void {
    const publicState = toPublicState(this.state);
    for (const listener of this.listeners) {
      listener(publicState);
    }
  }
}

// ─── State Mapper ────────────────────────────────────────────────────────

function toPublicState(internal: InternalState): TrainingSessionState {
  return {
    phase: internal.phase,
    config: internal.config,
    attemptIndex: internal.attemptIndex,
    attempts: internal.attempts,
    currentTimeMs: internal.currentTimeMs,
    stoppedTimeMs: internal.stoppedTimeMs,
    smartCubeConnected: internal.smartCubeConnected,
  };
}
