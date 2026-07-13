import { createStore } from 'zustand/vanilla';

export type TimerPhase = 'idle' | 'inspection' | 'touching' | 'ready' | 'running' | 'stopped' | 'cooldown';
export type TimerPenalty = 'none' | '+2' | 'dnf';

export interface TimerState {
  phase: TimerPhase;
  elapsedMs: number;
  penalty: TimerPenalty;
  isInspecting: boolean;

  setPhase: (phase: TimerPhase) => void;
  setElapsedMs: (ms: number) => void;
  setPenalty: (penalty: TimerPenalty) => void;
  reset: () => void;
}

const initialState = {
  phase: 'idle' as TimerPhase,
  elapsedMs: 0,
  penalty: 'none' as TimerPenalty,
  isInspecting: false,
};

export const createTimerStore = () => {
  return createStore<TimerState>((set) => ({
    ...initialState,

    setPhase: (phase) => set({ phase, isInspecting: phase === 'inspection' }),

    setElapsedMs: (ms) => set({ elapsedMs: ms }),

    setPenalty: (penalty) => set({ penalty }),

    reset: () => set(initialState),
  }));
};

export const timerStore = createTimerStore();
