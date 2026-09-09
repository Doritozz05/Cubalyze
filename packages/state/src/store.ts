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
/** Visibility mode for the top bar (header + glass dock). */
export type HeaderMode = 'always' | 'hidden' | 'autohide';

/** Maximum number of user-created custom themes. */
export const MAX_CUSTOM_THEMES = 10;

/** Maximum number of user-uploaded custom fonts (blobs live in IndexedDB). */
export const MAX_CUSTOM_FONTS = 6;

/**
 * User-uploaded font: metadata only (the file blob lives in IndexedDB,
 * keyed by id). `role` decides which registry list it joins.
 */
export interface CustomFontMeta {
  id: string;
  name: string;
  role: 'sans' | 'mono';
  createdAt: number;
}

/** Accent tokens whose `-soft` companion is derived automatically. */
const ACCENT_SOFT_TOKENS: Record<string, string> = {
  '--ready': '--ready-soft',
  '--hold': '--hold-soft',
  '--dnf': '--dnf-soft',
  '--plus2': '--plus2-soft',
  '--caution': '--caution-soft',
};

/** Full-hex color to the 14% `rgba()` soft used by every built-in preset. */
function hexToSoftRgba(color: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

/**
 * User-created theme: a full snapshot of resolved color tokens plus the
 * light/dark base it was built on. `colors` is a plain record on purpose —
 * the canonical `ThemeColors` type lives in the web app, and this package
 * must not import from it.
 */
export interface CustomTheme {
  id: string;
  name: string;
  base: 'light' | 'dark';
  colors: Record<string, string>;
  createdAt: number;
}

export interface CustomThemeInput {
  name: string;
  base: 'light' | 'dark';
  colors: Record<string, string>;
}

export interface PreferencesState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  /** Active preset theme ('default' | 'dark' | 'light' | 'midnight' | 'custom'). */
  themePreset: string;
  setThemePreset: (preset: string) => void;

  /** User overrides for web color tokens (e.g. { '--canvas': '#14171b', '--surface': '#1b1f23' }). */
  customThemeColors: Record<string, string> | null;
  setCustomThemeColor: (token: string, color: string) => void;
  setCustomThemeColors: (colors: Record<string, string> | null) => void;
  resetCustomThemeColors: () => void;

  /** User-created full themes (snapshots). Persisted; capped at MAX_CUSTOM_THEMES. */
  customThemes: CustomTheme[];
  /** Saves a snapshot, returns its id (or null when the cap is reached). */
  saveCustomTheme: (input: CustomThemeInput) => string | null;
  renameCustomTheme: (id: string, name: string) => void;
  deleteCustomTheme: (id: string) => void;
  /** Copies a theme (new id, " (copia)" suffix), returns the copy id or null at cap. */
  duplicateCustomTheme: (id: string) => string | null;

  /**
   * Top-bar (header + glass dock) visibility mode:
   * - `'always'`  — always visible (default);
   * - `'hidden'`  — hidden entirely;
   * - `'autohide'` — macOS-style: the dock slides away and reappears while
   *   hovering the top edge of the viewport (desktop only; on touch the
   *   Appearance toggle keeps its simple on/off semantics).
   */
  headerMode: HeaderMode;
  setHeaderMode: (mode: HeaderMode) => void;

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

  /** Project hidden face stickers in 3D replay to see all layers simultaneously. */
  replayFloatingStickers: boolean;
  setReplayFloatingStickers: (value: boolean) => void;

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

  /** Keyboard shortcuts configuration. `startTimer` is the hold-to-start
      timer key (default Space, `' '`). */
  shortcuts: {
    newScramble: string;
    copyScramble: string;
    cancelTimer: string;
    startTimer: string;
  };
  setShortcut: (key: 'newScramble' | 'copyScramble' | 'cancelTimer' | 'startTimer', value: string) => void;

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

  /** Show the bottom layout strip below the timer. Default ON. */
  showBottomLayout: boolean;
  setShowBottomLayout: (value: boolean) => void;

  /**
   * Selected bottom layout template id (see `apps/web/src/bottom-layout`).
   * The store only holds the id — template resolution/validation lives in the
   * UI layer. Default 'session-stats'.
   */
  bottomLayoutTemplate: string;
  setBottomLayoutTemplate: (value: string) => void;

  /** Show instruction/hint text (such as "Press space to start") below the timer. Default ON. */
  showHints: boolean;
  setShowHints: (value: boolean) => void;

  /** Custom timer background image data URL or null. Only active on timer and virtual cube views. */
  timerBackgroundImage: string | null;
  setTimerBackgroundImage: (value: string | null) => void;

  /** Opacity of the custom timer background image (0-100). Default 100. */
  timerBackgroundOpacity: number;
  setTimerBackgroundOpacity: (value: number) => void;

  /** Blur of the custom timer background image in px (0-20). Default 0. */
  timerBackgroundBlur: number;
  setTimerBackgroundBlur: (value: number) => void;

  /** Fit style of the custom timer background image ('cover' | 'contain' | 'tile'). Default 'cover'. */
  timerBackgroundFit: 'cover' | 'contain' | 'tile';
  setTimerBackgroundFit: (value: 'cover' | 'contain' | 'tile') => void;

  /** Dark overlay opacity percentage for custom background (0-80). Default 0 (pure image). */
  timerBackgroundOverlay: number;
  setTimerBackgroundOverlay: (value: number) => void;

  /** Experimental: display background across all views/tabs instead of only timer and virtual cube. Default false. */
  timerBackgroundAllViews: boolean;
  setTimerBackgroundAllViews: (value: boolean) => void;

  /** When true and background is video or GIF, animation loops continuously at all times instead of only during inspection and solve. Default false. */
  timerBackgroundAlwaysAnimate: boolean;
  setTimerBackgroundAlwaysAnimate: (value: boolean) => void;

  /** Theme visual effect: translucent liquid glass with backdrop blur on supported UI panels. Default false. */
  liquidGlass: boolean;
  setLiquidGlass: (value: boolean) => void;

  /** Opacity percentage for liquid glass effect (10 - 95, default 65). */
  liquidGlassOpacity: number;
  setLiquidGlassOpacity: (value: number) => void;

  /**
   * Custom backdrop-blur radius in px for liquid glass. `null` (default)
   * keeps the built-in formula tied to opacity; a number overrides it.
   */
  liquidGlassBlur: number | null;
  setLiquidGlassBlur: (value: number | null) => void;

  /**
   * Theme Studio typography: registry ids resolved to font stacks by the
   * web app ('open-sans' + 'cascadia-code' by default, 'system' keeps the
   * legacy pure-system stacks).
   */
  fontSans: string;
  setFontSans: (value: string) => void;
  fontMono: string;
  setFontMono: (value: string) => void;

  /**
   * Tabular zero style: 'dotted' is the typeface default (e.g. Cascadia's
   * signature dotted zero), 'slashed' enables the `zero` OpenType feature.
   * App default is 'slashed'.
   */
  zeroStyle: 'dotted' | 'slashed';
  setZeroStyle: (value: 'dotted' | 'slashed') => void;

  /** User-uploaded fonts (metadata; file blobs live in IndexedDB). */
  customFonts: CustomFontMeta[];
  /** Registers metadata, returns its id (or null when the cap is reached). */
  addCustomFont: (input: { name: string; role: 'sans' | 'mono' }) => string | null;
  removeCustomFont: (id: string) => void;


  // ── Notifications (Settings → Notifications) ──────────────────────────

  /** Master switch: when OFF, every notification (toast, banner, reminder) is suppressed. */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;

  // ── Audio (Settings → Audio) ──────────────────────────────────────────

  /** Audio master switch: when OFF, every sound category is silenced. */
  soundsEnabled: boolean;
  setSoundsEnabled: (value: boolean) => void;

  /** Master sound volume 0–100 (applies to every sound category). */
  soundVolume: number;
  setSoundVolume: (value: number) => void;

  /** Randomized click sounds on every layer turn (replay + virtual cube). */
  cubeTurnSoundsEnabled: boolean;
  setCubeTurnSoundsEnabled: (value: boolean) => void;

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
  theme: 'light' as const,
  themePreset: 'default',
  customThemeColors: null as Record<string, string> | null,
  customThemes: [] as CustomTheme[],
  headerMode: 'autohide' as const,
  appearance3d: 'default',
  scrambleFollowsCube: true,
  inspection: true,
  scrambleDisplay: true,
  scrambleVerification: true,
  method: 'CFOP' as const,
  replayFloatingStickers: true,
  focusMode: true,
  audioCues: true,
  voiceType: 'male' as const,
  showPbDelta: true,
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
    startTimer: ' ',
  },
  spacebarHoldDelay: 300,
  showBpaWpa: true,
  timePrecision: 'centiseconds' as const,
  inputMode: 'timer' as const,
  clickToStart: false,
  haptics: true,
  showBottomLayout: true,
  bottomLayoutTemplate: 'session-stats',
  showHints: true,
  timerBackgroundImage: null,
  timerBackgroundOpacity: 100,
  timerBackgroundBlur: 0,
  timerBackgroundFit: 'cover' as const,
  timerBackgroundOverlay: 0,
  timerBackgroundAllViews: false,
  timerBackgroundAlwaysAnimate: false,
  liquidGlass: false,
  liquidGlassOpacity: 65,
  liquidGlassBlur: null,
  fontSans: 'open-sans',
  fontMono: 'cascadia-code',
  zeroStyle: 'slashed' as const,
  customFonts: [],
  notificationsEnabled: true,
  soundsEnabled: true,
  soundVolume: 80,
  cubeTurnSoundsEnabled: true,
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
      (set, get) => ({
        ...DEFAULT_VALUES,

        setTheme: (theme) => set({ theme }),
        setThemePreset: (themePreset) => set({ themePreset }),
        setCustomThemeColor: (token, color) =>
          set((state) => {
            const customThemeColors = { ...(state.customThemeColors ?? {}), [token]: color };
            // Keep the `-soft` wash in sync with its accent so halos and
            // pills follow the edited color instead of the old preset value.
            const softToken = ACCENT_SOFT_TOKENS[token];
            if (softToken) {
              const soft = hexToSoftRgba(color);
              if (soft) customThemeColors[softToken] = soft;
            }
            return { customThemeColors };
          }),
        setCustomThemeColors: (customThemeColors) => set({ customThemeColors }),
        resetCustomThemeColors: () => set({ customThemeColors: null }),
        saveCustomTheme: (input) => {
          const { customThemes } = get();
          if (customThemes.length >= MAX_CUSTOM_THEMES) return null;
          const name = input.name.trim().slice(0, 40) || 'Mi tema';
          const theme: CustomTheme = {
            id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`,
            name,
            base: input.base,
            colors: { ...input.colors },
            createdAt: Date.now(),
          };
          set({ customThemes: [...customThemes, theme] });
          return theme.id;
        },
        renameCustomTheme: (id, name) => {
          const next = name.trim().slice(0, 40);
          if (!next) return;
          set((state) => ({
            customThemes: state.customThemes.map((t) => (t.id === id ? { ...t, name: next } : t)),
          }));
        },
        deleteCustomTheme: (id) =>
          set((state) => ({
            customThemes: state.customThemes.filter((t) => t.id !== id),
          })),
        duplicateCustomTheme: (id) => {
          const { customThemes } = get();
          if (customThemes.length >= MAX_CUSTOM_THEMES) return null;
          const source = customThemes.find((t) => t.id === id);
          if (!source) return null;
          const theme: CustomTheme = {
            id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`,
            name: `${source.name} (copia)`.slice(0, 40),
            base: source.base,
            colors: { ...source.colors },
            createdAt: Date.now(),
          };
          set({ customThemes: [...customThemes, theme] });
          return theme.id;
        },
        setHeaderMode: (headerMode) => set({ headerMode }),
        setAppearance3d: (appearance3d) => set({ appearance3d }),
        setScrambleFollowsCube: (scrambleFollowsCube) => set({ scrambleFollowsCube }),
        setInspection: (inspection) => set({ inspection }),
        setScrambleDisplay: (scrambleDisplay) => set({ scrambleDisplay }),
        setScrambleVerification: (scrambleVerification) => set({ scrambleVerification }),
        setMethod: (method) => set({ method }),
        setReplayFloatingStickers: (replayFloatingStickers) => set({ replayFloatingStickers }),
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
        setShowBottomLayout: (showBottomLayout) => set({ showBottomLayout }),
        setBottomLayoutTemplate: (bottomLayoutTemplate) => set({ bottomLayoutTemplate }),
        setShowHints: (showHints) => set({ showHints }),
        setTimerBackgroundImage: (timerBackgroundImage) => set({ timerBackgroundImage }),
        setTimerBackgroundOpacity: (timerBackgroundOpacity) => set({ timerBackgroundOpacity }),
        setTimerBackgroundBlur: (timerBackgroundBlur) => set({ timerBackgroundBlur }),
        setTimerBackgroundFit: (timerBackgroundFit) => set({ timerBackgroundFit }),
        setTimerBackgroundOverlay: (timerBackgroundOverlay) => set({ timerBackgroundOverlay }),
        setTimerBackgroundAllViews: (timerBackgroundAllViews) => set({ timerBackgroundAllViews }),
        setTimerBackgroundAlwaysAnimate: (timerBackgroundAlwaysAnimate) => set({ timerBackgroundAlwaysAnimate }),
        setLiquidGlass: (liquidGlass) => set({ liquidGlass }),
        setLiquidGlassOpacity: (liquidGlassOpacity) => set({ liquidGlassOpacity }),
        setLiquidGlassBlur: (liquidGlassBlur) => set({ liquidGlassBlur }),
        setFontSans: (fontSans) => set({ fontSans }),
        setFontMono: (fontMono) => set({ fontMono }),
        setZeroStyle: (zeroStyle) => set({ zeroStyle }),
        addCustomFont: (input) => {
          const { customFonts } = get();
          if (customFonts.length >= MAX_CUSTOM_FONTS) return null;
          const name = input.name.trim().slice(0, 40) || 'Mi fuente';
          const font: CustomFontMeta = {
            id: `font-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`,
            name,
            role: input.role,
            createdAt: Date.now(),
          };
          set({ customFonts: [...customFonts, font] });
          return font.id;
        },
        removeCustomFont: (id) =>
          set((state) => ({
            customFonts: state.customFonts.filter((f) => f.id !== id),
          })),

        setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
        setSoundsEnabled: (soundsEnabled) => set({ soundsEnabled }),
        setSoundVolume: (soundVolume) => set({ soundVolume }),
        setCubeTurnSoundsEnabled: (cubeTurnSoundsEnabled) => set({ cubeTurnSoundsEnabled }),
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
          themePreset: state.themePreset,
          customThemeColors: state.customThemeColors,
          customThemes: state.customThemes,
          headerMode: state.headerMode,
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
          showBottomLayout: state.showBottomLayout,
          bottomLayoutTemplate: state.bottomLayoutTemplate,
          showHints: state.showHints,
          timerBackgroundImage: state.timerBackgroundImage,
          timerBackgroundOpacity: state.timerBackgroundOpacity,
          timerBackgroundBlur: state.timerBackgroundBlur,
          timerBackgroundFit: state.timerBackgroundFit,
          timerBackgroundOverlay: state.timerBackgroundOverlay,
          timerBackgroundAllViews: state.timerBackgroundAllViews,
          timerBackgroundAlwaysAnimate: state.timerBackgroundAlwaysAnimate,
          liquidGlass: state.liquidGlass,
          liquidGlassOpacity: state.liquidGlassOpacity,
          liquidGlassBlur: state.liquidGlassBlur,
          fontSans: state.fontSans,
          fontMono: state.fontMono,
          zeroStyle: state.zeroStyle,
          customFonts: state.customFonts,
          notificationsEnabled: state.notificationsEnabled,
          soundsEnabled: state.soundsEnabled,
          soundVolume: state.soundVolume,
          cubeTurnSoundsEnabled: state.cubeTurnSoundsEnabled,
          practiceReminders: state.practiceReminders,
          practiceReminderTime: state.practiceReminderTime,
          reviewReminders: state.reviewReminders,
          reviewReminderTime: state.reviewReminderTime,
          betaFeatures: state.betaFeatures,
          language: state.language,
        }),
        // v2: `showSessionStats` was renamed to `showBottomLayout` and the
        // selected template id was introduced (`bottomLayoutTemplate`).
        // v3: `showHeader`/`dockAutoHide` booleans were replaced by the
        // `headerMode` tri-state ('always' | 'hidden' | 'autohide').
        // v4: `shortcuts.startTimer` (configurable timer start key) added.
        // v5: `customThemes` (user-created full themes) added.
        // v6: `zeroStyle` default becomes 'slashed' — the setting never
        // took effect before v6, so no real 'dotted' preference exists.
        version: 6,
        migrate: (persistedState, version) => {
          const raw = (persistedState ?? {}) as Record<string, unknown>;
          const migrated: Record<string, unknown> = { ...raw };
          if (!Array.isArray(raw.customThemes)) {
            migrated.customThemes = [];
          }
          if (version < 2) {
            if (typeof raw.showSessionStats === 'boolean') {
              migrated.showBottomLayout = raw.showSessionStats;
            }
            delete migrated.showSessionStats;
            if (typeof migrated.bottomLayoutTemplate !== 'string') {
              migrated.bottomLayoutTemplate = 'session-stats';
            }
          }
          if (version < 3) {
            if (typeof raw.showHeader === 'boolean') {
              migrated.headerMode = raw.showHeader ? 'always' : 'hidden';
            }
            delete migrated.showHeader;
            delete migrated.dockAutoHide;
          }
          if (version < 4) {
            // Existing persisted shortcuts predate the configurable timer
            // start key — keep the user's bindings, default the new one.
            const sc = (raw.shortcuts ?? {}) as Record<string, unknown>;
            migrated.shortcuts = {
              newScramble: 'n',
              copyScramble: 'c',
              cancelTimer: 'escape',
              startTimer: ' ',
              ...sc,
            };
          }
          if (version < 6) {
            migrated.zeroStyle = 'slashed';
          }
          return migrated;
        },
      },
    ),
  );
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
