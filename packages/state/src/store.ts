import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

/** UI languages offered by the app. `'auto'` follows the browser language. */
export type AppLanguage = 'auto' | 'en' | 'es';

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

  /** Show the top header bar (session switcher, puzzle selector, profile chip…). */
  showHeader: boolean;
  setShowHeader: (value: boolean) => void;

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

  /**
   * Virtual-cube turn animation speed. 'instant' disables the animation
   * entirely (moves snap). Applies to keyboard, drag and background
   * rotations — the scramble is always applied instantly.
   */
  cubeTurnSpeed: "slow" | "normal" | "fast" | "instant";
  setCubeTurnSpeed: (value: "slow" | "normal" | "fast" | "instant") => void;

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

  // ── Notifications & sound (Settings → Notifications) ──────────────────

  /** Master switch: when OFF, every notification (sound, toast, reminder) is suppressed. */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;

  /** Sounds on/off — gates inspection voice cues and PB fanfare audio. */
  soundsEnabled: boolean;
  setSoundsEnabled: (value: boolean) => void;

  /** Master sound volume 0–100 (applies to inspection voice and PB fanfare). */
  soundVolume: number;
  setSoundVolume: (value: number) => void;

  /** Daily practice reminder (browser notification + in-app toast). */
  practiceReminders: boolean;
  setPracticeReminders: (value: boolean) => void;

  /** Time of day (HH:MM, 24h) for the practice reminder. */
  practiceReminderTime: string;
  setPracticeReminderTime: (value: string) => void;

  /** Daily SRS review-queue reminder. */
  reviewReminders: boolean;
  setReviewReminders: (value: boolean) => void;

  /** Time of day (HH:MM, 24h) for the review reminder. */
  reviewReminderTime: string;
  setReviewReminderTime: (value: string) => void;

  // ── Advanced (Settings → Advanced) ─────────────────────────────────────

  /** Opt-in beta features (hidden unless enabled). */
  betaFeatures: boolean;
  setBetaFeatures: (value: boolean) => void;

  /** UI language. `'auto'` follows the browser language (default). */
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;

  /** Restore every preference to its default value (Settings → Advanced → Reset options). */
  resetPreferences: () => void;
}

// zustand/middleware/persist falls back to a JSON storage backed by the
// global `localStorage` automatically. We do not pass `storage` so that
// persist works equally in browser, vitest (jsdom) and any future SSR
// env that shims storage.

const DEFAULT_VALUES = {
  theme: 'system' as const,
  showHeader: true,
  appearance3d: 'default',
  scrambleFollowsCube: true,
  inspection: true,
  scrambleDisplay: true,
  scrambleVerification: true,
  method: 'CFOP' as const,
  focusMode: false,
  audioCues: true,
  voiceType: 'male' as const,
  showPbDelta: false,
  pbCelebrationAudio: true,
  pbCelebrationAnimation: true,
  customStickerColors: {
    U: '#ece8e2',
    D: '#ffe62a',
    F: '#1abe57',
    B: '#3d7ce0',
    R: '#eb4242',
    L: '#ff801f',
  },
  cubeTurnSpeed: 'normal' as const,
  hardwareTimer: 'none' as const,
  shortcuts: {
    newScramble: 'n',
    copyScramble: 'c',
    cancelTimer: 'escape',
  },
  spacebarHoldDelay: 300,
  showBpaWpa: true,
  timePrecision: 'centiseconds' as const,
  inputMode: 'timer' as const,
  clickToStart: false,
  haptics: true,
  showSessionStats: true,
  notificationsEnabled: true,
  soundsEnabled: true,
  soundVolume: 80,
  practiceReminders: false,
  practiceReminderTime: '19:00',
  reviewReminders: false,
  reviewReminderTime: '19:30',
  betaFeatures: false,
  language: 'auto' as const,
};

export const createPreferencesStore = () => {
  return createStore<PreferencesState>()(
    persist(
      (set) => ({
        ...DEFAULT_VALUES,

        setTheme: (theme) => set({ theme }),
        setShowHeader: (showHeader) => set({ showHeader }),
        setAppearance3d: (appearance3d) => set({ appearance3d }),
        setScrambleFollowsCube: (scrambleFollowsCube) => set({ scrambleFollowsCube }),
        setInspection: (inspection) => set({ inspection }),
        setScrambleDisplay: (scrambleDisplay) => set({ scrambleDisplay }),
        setScrambleVerification: (scrambleVerification) => set({ scrambleVerification }),
        setMethod: (method) => set({ method }),
        setFocusMode: (focusMode) => set({ focusMode }),
        setAudioCues: (audioCues) => set({ audioCues }),
        setVoiceType: (voiceType) => set({ voiceType }),
        setShowPbDelta: (showPbDelta) => set({ showPbDelta }),
        setPbCelebrationAudio: (pbCelebrationAudio) => set({ pbCelebrationAudio }),
        setPbCelebrationAnimation: (pbCelebrationAnimation) => set({ pbCelebrationAnimation }),
        setCustomStickerColors: (colors) =>
          set((state) => ({
            customStickerColors: { ...state.customStickerColors, ...colors },
          })),
        setCubeTurnSpeed: (cubeTurnSpeed) => set({ cubeTurnSpeed }),
        setHardwareTimer: (hardwareTimer) => set({ hardwareTimer }),
        setShortcut: (key, value) =>
          set((state) => ({
            shortcuts: { ...state.shortcuts, [key]: value },
          })),
        setSpacebarHoldDelay: (spacebarHoldDelay) => set({ spacebarHoldDelay }),
        setShowBpaWpa: (showBpaWpa) => set({ showBpaWpa }),
        setTimePrecision: (timePrecision) => set({ timePrecision }),
        setInputMode: (inputMode) => set({ inputMode }),
        setClickToStart: (clickToStart) => set({ clickToStart }),
        setHaptics: (haptics) => set({ haptics }),
        setShowSessionStats: (showSessionStats) => set({ showSessionStats }),

        setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
        setSoundsEnabled: (soundsEnabled) => set({ soundsEnabled }),
        setSoundVolume: (soundVolume) => set({ soundVolume }),
        setPracticeReminders: (practiceReminders) => set({ practiceReminders }),
        setPracticeReminderTime: (practiceReminderTime) => set({ practiceReminderTime }),
        setReviewReminders: (reviewReminders) => set({ reviewReminders }),
        setReviewReminderTime: (reviewReminderTime) => set({ reviewReminderTime }),
        setBetaFeatures: (betaFeatures) => set({ betaFeatures }),
        setLanguage: (language) => set({ language }),

        resetPreferences: () => set({ ...DEFAULT_VALUES }),
      }),
      {
        name: 'cubeforge-prefs',
        partialize: (state) => ({
          theme: state.theme,
          showHeader: state.showHeader,
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
          cubeTurnSpeed: state.cubeTurnSpeed,
          shortcuts: state.shortcuts,
          spacebarHoldDelay: state.spacebarHoldDelay,
          showBpaWpa: state.showBpaWpa,
          timePrecision: state.timePrecision,
          inputMode: state.inputMode,
          clickToStart: state.clickToStart,
          haptics: state.haptics,
          showSessionStats: state.showSessionStats,
          notificationsEnabled: state.notificationsEnabled,
          soundsEnabled: state.soundsEnabled,
          soundVolume: state.soundVolume,
          practiceReminders: state.practiceReminders,
          practiceReminderTime: state.practiceReminderTime,
          reviewReminders: state.reviewReminders,
          reviewReminderTime: state.reviewReminderTime,
          betaFeatures: state.betaFeatures,
          language: state.language,
        }),
        version: 1,
      },
    ),
  );
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
