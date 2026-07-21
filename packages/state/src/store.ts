import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

/**
 * User-controlled preferences for the timer flow.
 *
 * - `inspection`            : WCA-style 15s inspection timer before the solve (default ON).
 * - `scrambleVerification`  : when a Smart Cube is connected, require that the
 *                             recorded scramble sequence be applied before the
 *                             solve can start. (default ON).
 * - `theme`                 : theme preference.
 * - `scrambleFollowsCube`   : visual preference for the orientation tracking.
 *
 * Only preferences that have a wired runtime consumer belong here. See the
 * `useSolveSession` and `useScrambleValidator` hooks for the read paths;
 * without a consumer, a stored flag is unreachable behaviour.
 *
 * Persisted in localStorage under `cubeforge-prefs` via zustand/middleware so
 * the state is rehydrated synchronously on cold load. No backend migration
 * is required.
 */
export interface PreferencesState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  /** 3D Appearance mode */
  appearance3d: string;
  setAppearance3d: (value: string) => void;

  /** Whether the scramble display rotates to match cube orientation. */
  scrambleFollowsCube: boolean;
  setScrambleFollowsCube: (value: boolean) => void;

  /** WCA-style 15s inspection timer before the solve. */
  inspection: boolean;
  setInspection: (value: boolean) => void;

  /** Require the scramble to be physically applied before solving. */
  scrambleVerification: boolean;
  setScrambleVerification: (value: boolean) => void;

  /** Solving method for phase detection and metrics. */
  method: 'CFOP' | 'Roux' | 'ZZ' | 'Petrus';
  setMethod: (value: 'CFOP' | 'Roux' | 'ZZ' | 'Petrus') => void;

  /** Focus mode: hide everything except timer when ready or running. */
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;

  /** Audio cues during inspection (8s and 12s WCA warnings). */
  audioCues: boolean;
  setAudioCues: (value: boolean) => void;

  /** Voice type for inspection audio cues. */
  voiceType: 'male' | 'female';
  setVoiceType: (value: 'male' | 'female') => void;
}

// zustand/middleware/persist falls back to a JSON storage backed by the
// global `localStorage` automatically. We do not pass `storage` so that
// persist works equally in browser, vitest (jsdom) and any future SSR
// env that shims storage.

export const createPreferencesStore = () => {
  return createStore<PreferencesState>()(
    persist(
      (set) => ({
        theme: 'system',
        setTheme: (theme) => set({ theme }),

        appearance3d: 'default',
        setAppearance3d: (value) => set({ appearance3d: value }),

        scrambleFollowsCube: true,
        setScrambleFollowsCube: (value) => set({ scrambleFollowsCube: value }),

        inspection: true,
        setInspection: (value) => set({ inspection: value }),

        scrambleVerification: true,
        setScrambleVerification: (value) => set({ scrambleVerification: value }),

        method: 'CFOP',
        setMethod: (value) => set({ method: value }),

        focusMode: false,
        setFocusMode: (value) => set({ focusMode: value }),

        audioCues: true,
        setAudioCues: (value) => set({ audioCues: value }),

        voiceType: 'male',
        setVoiceType: (value) => set({ voiceType: value }),
      }),
      {
        name: 'cubeforge-prefs',
        partialize: (state) => ({
          theme: state.theme,
          appearance3d: state.appearance3d,
          scrambleFollowsCube: state.scrambleFollowsCube,
          inspection: state.inspection,
          scrambleVerification: state.scrambleVerification,
          method: state.method,
          focusMode: state.focusMode,
          audioCues: state.audioCues,
          voiceType: state.voiceType,
        }),
        version: 1,
      },
    ),
  );
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
