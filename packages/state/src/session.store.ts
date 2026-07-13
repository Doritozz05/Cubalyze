import { createStore } from 'zustand/vanilla';

export interface SolveData {
  id: string;
  sessionId: string;
  timeMs: number;
  date: string;
  scramble: string;
  penalty: string;
  method?: string;
  moves?: unknown[];
  analysisEngineVersion?: string;
}

export interface SessionState {
  currentSessionId: string | null;
  sessionName: string | null;
  solves: SolveData[];
  isRecording: boolean;

  startSession: (id: string, name: string) => void;
  addSolve: (solve: SolveData) => void;
  removeSolve: (id: string) => void;
  clearSession: () => void;
  setRecording: (recording: boolean) => void;
}

const initialState = {
  currentSessionId: null as string | null,
  sessionName: null as string | null,
  solves: [] as SolveData[],
  isRecording: false,
};

export const createSessionStore = () => {
  return createStore<SessionState>((set) => ({
    ...initialState,

    startSession: (id, name) =>
      set({
        currentSessionId: id,
        sessionName: name,
        solves: [],
        isRecording: true,
      }),

    addSolve: (solve) =>
      set((state) => ({
        solves: [...state.solves, solve],
      })),

    removeSolve: (id) =>
      set((state) => ({
        solves: state.solves.filter((s) => s.id !== id),
      })),

    clearSession: () => set(initialState),

    setRecording: (recording) => set({ isRecording: recording }),
  }));
};

export const sessionStore = createSessionStore();
