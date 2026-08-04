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

  /** Whether to show the scramble display on the timer and save scramble with solves. */
  scrambleDisplay: boolean;
  setScrambleDisplay: (value: boolean) => void;

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

  /** Show PB delta (+/- offset from personal best) next to the timer. */
  showPbDelta: boolean;
  setShowPbDelta: (value: boolean) => void;

  /** Play celebratory audio fanfare on Personal Best. */
  pbCelebrationAudio: boolean;
  setPbCelebrationAudio: (value: boolean) => void;

  /** Display celebratory animation & banner on Personal Best. */
  pbCelebrationAnimation: boolean;
  setPbCelebrationAnimation: (value: boolean) => void;

  /** Custom sticker colors for the 'custom' cube skin. */
  customStickerColors: {
    U: string;
    D: string;
    F: string;
    B: string;
    R: string;
    L: string;
  };
  setCustomStickerColors: (colors: Partial<{ U: string; D: string; F: string; B: string; R: string; L: string }>) => void;

  /** Hardware timer type: none, stackmat (audio), or gan (Bluetooth). */
  hardwareTimer: 'none' | 'stackmat' | 'gan';
  setHardwareTimer: (value: 'none' | 'stackmat' | 'gan') => void;

  /** Keyboard shortcuts configuration. */
  shortcuts: {
    newScramble: string;
    copyScramble: string;
    cancelTimer: string;
  };
  setShortcut: (key: 'newScramble' | 'copyScramble' | 'cancelTimer', value: string) => void;

  /** Spacebar hold duration in milliseconds before timer is ready to start (e.g. 0, 300, 550, 1000). */
  spacebarHoldDelay: number;
  setSpacebarHoldDelay: (value: number) => void;

  /** Show Best/Worst Possible Average (BPA/WPA) in active stats. */
  showBpaWpa: boolean;
  setShowBpaWpa: (value: boolean) => void;

  /** Time precision format: centiseconds (0.01s) or milliseconds (0.001s). */
  timePrecision: 'centiseconds' | 'milliseconds';
  setTimePrecision: (value: 'centiseconds' | 'milliseconds') => void;

  /** Timer input mode: 'timer' uses the normal hold-to-start timer; 'manual' shows a text input for typing times directly (like csTimer). */
  inputMode: 'timer' | 'manual';
  setInputMode: (value: 'timer' | 'manual') => void;

  /** When enabled, clicking the timer area starts/stops the timer (like spacebar). Default OFF. */
  clickToStart: boolean;
  setClickToStart: (value: boolean) => void;

  /** Optional haptic feedback (navigator.vibrate) on the touch regime. Default ON. */
  haptics: boolean;
  setHaptics: (value: boolean) => void;

  /** Show the compact session stats strip (Ao5, Ao12, Best, Mean) below the timer. Default ON. */
  showSessionStats: boolean;
  setShowSessionStats: (value: boolean) => void;
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

        scrambleDisplay: true,
        setScrambleDisplay: (value) => set({ scrambleDisplay: value }),

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

        showPbDelta: false,
        setShowPbDelta: (value) => set({ showPbDelta: value }),

        pbCelebrationAudio: true,
        setPbCelebrationAudio: (value) => set({ pbCelebrationAudio: value }),

        pbCelebrationAnimation: true,
        setPbCelebrationAnimation: (value) => set({ pbCelebrationAnimation: value }),

        customStickerColors: {
          U: '#ece8e2',
          D: '#ffe62a',
          F: '#1abe57',
          B: '#3d7ce0',
          R: '#eb4242',
          L: '#ff801f',
        },
        setCustomStickerColors: (colors) =>
          set((state) => ({
            customStickerColors: { ...state.customStickerColors, ...colors },
          })),

        hardwareTimer: 'none',
        setHardwareTimer: (value) => set({ hardwareTimer: value }),

        shortcuts: {
          newScramble: 'n',
          copyScramble: 'c',
          cancelTimer: 'escape',
        },
        setShortcut: (key, value) =>
          set((state) => ({
            shortcuts: { ...state.shortcuts, [key]: value },
          })),

        spacebarHoldDelay: 300,
        setSpacebarHoldDelay: (value) => set({ spacebarHoldDelay: value }),

        showBpaWpa: true,
        setShowBpaWpa: (value) => set({ showBpaWpa: value }),

        timePrecision: 'centiseconds',
        setTimePrecision: (value) => set({ timePrecision: value }),

        inputMode: 'timer',
        setInputMode: (value) => set({ inputMode: value }),

        clickToStart: false,
        setClickToStart: (value) => set({ clickToStart: value }),

        haptics: true,
        setHaptics: (value) => set({ haptics: value }),

        showSessionStats: true,
        setShowSessionStats: (value) => set({ showSessionStats: value }),
      }),
      {
        name: 'cubeforge-prefs',
        partialize: (state) => ({
          theme: state.theme,
          appearance3d: state.appearance3d,
          scrambleFollowsCube: state.scrambleFollowsCube,
          inspection: state.inspection,
          scrambleDisplay: state.scrambleDisplay,
          scrambleVerification: state.scrambleVerification,
          method: state.method,
          focusMode: state.focusMode,
          audioCues: state.audioCues,
          voiceType: state.voiceType,
          showPbDelta: state.showPbDelta,
          pbCelebrationAudio: state.pbCelebrationAudio,
          pbCelebrationAnimation: state.pbCelebrationAnimation,
          hardwareTimer: state.hardwareTimer,
          customStickerColors: state.customStickerColors,
          shortcuts: state.shortcuts,
          spacebarHoldDelay: state.spacebarHoldDelay,
          showBpaWpa: state.showBpaWpa,
          timePrecision: state.timePrecision,
          inputMode: state.inputMode,
          clickToStart: state.clickToStart,
          haptics: state.haptics,
          showSessionStats: state.showSessionStats,
        }),
        version: 1,
      },
    ),
  );
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
