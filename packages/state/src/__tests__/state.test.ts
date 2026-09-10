import { describe, it, expect, beforeEach } from 'vitest';
import { preferencesStore } from '../store.js';
import { connectionStore, createConnectionStore } from '../connection.store.js';
import { timerStore } from '../timer.store.js';
import { sessionStore } from '../session.store.js';
import type { SolveData } from '../session.store.js';
import { createSyncStore } from '../sync.store.js';

describe('PreferencesStore', () => {
  beforeEach(() => {
    preferencesStore.getState().setTheme('light');
  });

  it('initializes with default theme', () => {
    const state = preferencesStore.getState();
    expect(state.theme).toBe('light');
  });

  it('updates theme correctly', () => {
    preferencesStore.getState().setTheme('dark');
    expect(preferencesStore.getState().theme).toBe('dark');
  });

  it('manages themePreset and customThemeColors correctly', () => {
    expect(preferencesStore.getState().themePreset).toBe('default');
    expect(preferencesStore.getState().customThemeColors).toBeNull();

    preferencesStore.getState().setThemePreset('midnight');
    expect(preferencesStore.getState().themePreset).toBe('midnight');

    preferencesStore.getState().setCustomThemeColor('--canvas', '#2e3440');
    expect(preferencesStore.getState().customThemeColors).toEqual({ '--canvas': '#2e3440' });

    preferencesStore.getState().setCustomThemeColor('--ready', '#a3be8c');
    expect(preferencesStore.getState().customThemeColors).toEqual({
      '--canvas': '#2e3440',
      '--ready': '#a3be8c',
      '--ready-soft': 'rgba(163, 190, 140, 0.14)',
    });

    preferencesStore.getState().resetSingleCustomThemeColor('--ready');
    expect(preferencesStore.getState().customThemeColors).toEqual({
      '--canvas': '#2e3440',
    });

    preferencesStore.getState().resetSingleCustomThemeColor('--canvas');
    expect(preferencesStore.getState().customThemeColors).toBeNull();

    preferencesStore.getState().setCustomThemeColor('--ready', '#a3be8c');
    preferencesStore.getState().resetCustomThemeColors();
    expect(preferencesStore.getState().customThemeColors).toBeNull();

    preferencesStore.getState().setThemePreset('default');
  });

  it('manages custom themes (save / rename / delete with cap)', () => {
    const store = preferencesStore.getState();
    expect(store.customThemes).toEqual([]);

    const id = store.saveCustomTheme({
      name: '  Mi tema  ',
      base: 'dark',
      colors: { '--canvas': '#000000' },
    });
    expect(typeof id).toBe('string');

    const themes = preferencesStore.getState().customThemes;
    expect(themes).toHaveLength(1);
    expect(themes[0].name).toBe('Mi tema');
    expect(themes[0].base).toBe('dark');
    expect(themes[0].colors).toEqual({ '--canvas': '#000000' });

    preferencesStore.getState().renameCustomTheme(id as string, 'Noche total');
    expect(preferencesStore.getState().customThemes[0].name).toBe('Noche total');

    // Empty renames are ignored.
    preferencesStore.getState().renameCustomTheme(id as string, '   ');
    expect(preferencesStore.getState().customThemes[0].name).toBe('Noche total');

    preferencesStore.getState().deleteCustomTheme(id as string);
    expect(preferencesStore.getState().customThemes).toEqual([]);
  });

  it('duplicates a custom theme with a fresh id', () => {
    const store = preferencesStore.getState();
    const id = store.saveCustomTheme({
      name: 'Original',
      base: 'dark',
      colors: { '--canvas': '#111111' },
    });
    expect(typeof id).toBe('string');

    const copyId = preferencesStore.getState().duplicateCustomTheme(id as string);
    expect(typeof copyId).toBe('string');
    expect(copyId).not.toBe(id);
    const themes = preferencesStore.getState().customThemes;
    expect(themes).toHaveLength(2);
    expect(themes[1].name).toBe('Original (copy)');
    expect(themes[1].base).toBe('dark');
    expect(themes[1].colors).toEqual({ '--canvas': '#111111' });

    expect(preferencesStore.getState().duplicateCustomTheme('missing')).toBeNull();

    preferencesStore.getState().deleteCustomTheme(id as string);
    preferencesStore.getState().deleteCustomTheme(copyId as string);
    expect(preferencesStore.getState().customThemes).toEqual([]);
  });

  it('manages tabular zero style and custom font metadata', () => {
    expect(preferencesStore.getState().zeroStyle).toBe('slashed');
    preferencesStore.getState().setZeroStyle('dotted');
    expect(preferencesStore.getState().zeroStyle).toBe('dotted');
    preferencesStore.getState().setZeroStyle('slashed');

    const store = preferencesStore.getState();
    const id = store.addCustomFont({ name: '  Mi Mono  ', role: 'mono' });
    expect(typeof id).toBe('string');
    const fonts = preferencesStore.getState().customFonts;
    expect(fonts).toHaveLength(1);
    expect(fonts[0].name).toBe('Mi Mono');
    expect(fonts[0].role).toBe('mono');

    preferencesStore.getState().removeCustomFont(id as string);
    expect(preferencesStore.getState().customFonts).toEqual([]);
  });

  it('caps custom themes at MAX_CUSTOM_THEMES', () => {
    const store = preferencesStore.getState();
    for (let i = 0; i < 10; i++) {
      expect(
        store.saveCustomTheme({ name: `T${i}`, base: 'light', colors: {} }),
      ).not.toBeNull();
    }
    expect(preferencesStore.getState().customThemes).toHaveLength(10);
    expect(
      store.saveCustomTheme({ name: 'overflow', base: 'light', colors: {} }),
    ).toBeNull();
    // Cleanup for other tests.
    for (const t of preferencesStore.getState().customThemes) {
      preferencesStore.getState().deleteCustomTheme(t.id);
    }
    expect(preferencesStore.getState().customThemes).toEqual([]);
  });

  it('initializes language preference with auto default', () => {
    expect(preferencesStore.getState().language).toBe('auto');
  });

  it('updates language preference', () => {
    preferencesStore.getState().setLanguage('es');
    expect(preferencesStore.getState().language).toBe('es');
    preferencesStore.getState().setLanguage('auto');
    expect(preferencesStore.getState().language).toBe('auto');
  });

  it('toggles showBottomLayout (default ON)', () => {
    expect(preferencesStore.getState().showBottomLayout).toBe(true);
    preferencesStore.getState().setShowBottomLayout(false);
    expect(preferencesStore.getState().showBottomLayout).toBe(false);
    preferencesStore.getState().setShowBottomLayout(true);
    expect(preferencesStore.getState().showBottomLayout).toBe(true);
  });

  it('selects a bottom layout template (default slot-hero-left)', () => {
    expect(preferencesStore.getState().bottomLayoutTemplate).toBe('slot-hero-left');
    preferencesStore.getState().setBottomLayoutTemplate('slot-trio');
    expect(preferencesStore.getState().bottomLayoutTemplate).toBe('slot-trio');
    preferencesStore.getState().setBottomLayoutTemplate('slot-hero-left');
    expect(preferencesStore.getState().bottomLayoutTemplate).toBe('slot-hero-left');
  });

  it('stores per-slot content overrides (default empty)', () => {
    expect(preferencesStore.getState().bottomLayoutSlots).toEqual({});
    preferencesStore.getState().setBottomLayoutSlot('slot-hero-left', 'side', {
      kind: 'stats',
      stats: ['bpa', 'wpa'],
    });
    expect(
      preferencesStore.getState().bottomLayoutSlots['slot-hero-left:side'],
    ).toEqual({ kind: 'stats', stats: ['bpa', 'wpa'] });
    preferencesStore.getState().setBottomLayoutSlot('slot-hero-left', 'side', {
      kind: 'stats',
      stats: ['ao5', 'best'],
    });
    expect(
      preferencesStore.getState().bottomLayoutSlots['slot-hero-left:side'],
    ).toEqual({ kind: 'stats', stats: ['ao5', 'best'] });
    preferencesStore.getState().resetBottomLayoutSlots();
    expect(preferencesStore.getState().bottomLayoutSlots).toEqual({});
  });

  it('toggles showHints (default ON)', () => {
    expect(preferencesStore.getState().showHints).toBe(true);
    preferencesStore.getState().setShowHints(false);
    expect(preferencesStore.getState().showHints).toBe(false);
    preferencesStore.getState().setShowHints(true);
    expect(preferencesStore.getState().showHints).toBe(true);
  });

  it('cycles headerMode (default autohide)', () => {
    expect(preferencesStore.getState().headerMode).toBe('autohide');
    preferencesStore.getState().setHeaderMode('always');
    expect(preferencesStore.getState().headerMode).toBe('always');
    preferencesStore.getState().setHeaderMode('hidden');
    expect(preferencesStore.getState().headerMode).toBe('hidden');
    preferencesStore.getState().setHeaderMode('autohide');
    expect(preferencesStore.getState().headerMode).toBe('autohide');
  });

  it('handles spacebarHoldDelay and timePrecision settings', () => {
    const store = preferencesStore.getState();
    expect(store.spacebarHoldDelay).toBe(300);
    expect(store.timePrecision).toBe('centiseconds');

    store.setSpacebarHoldDelay(550);
    store.setTimePrecision('milliseconds');

    const updated = preferencesStore.getState();
    expect(updated.spacebarHoldDelay).toBe(550);
    expect(updated.timePrecision).toBe('milliseconds');
  });

  it('initializes notification & sound preferences with defaults', () => {
    const s = preferencesStore.getState();
    expect(s.notificationsEnabled).toBe(true);
    expect(s.soundsEnabled).toBe(true);
    expect(s.soundVolume).toBe(80);
    expect(s.cubeTurnSoundsEnabled).toBe(false);
    expect(s.practiceReminders).toBe(false);
    expect(s.practiceReminderTime).toBe('19:00');
    expect(s.reviewReminders).toBe(false);
    expect(s.reviewReminderTime).toBe('19:30');
    expect(s.betaFeatures).toBe(false);
  });

  it('updates notification & sound preferences', () => {
    const store = preferencesStore.getState();
    store.setNotificationsEnabled(false);
    store.setSoundsEnabled(false);
    store.setSoundVolume(35);
    store.setCubeTurnSoundsEnabled(true);
    store.setPracticeReminders(true);
    store.setPracticeReminderTime('07:30');
    store.setReviewReminders(true);
    store.setReviewReminderTime('20:15');
    store.setBetaFeatures(true);

    const updated = preferencesStore.getState();
    expect(updated.notificationsEnabled).toBe(false);
    expect(updated.soundsEnabled).toBe(false);
    expect(updated.soundVolume).toBe(35);
    expect(updated.cubeTurnSoundsEnabled).toBe(true);
    expect(updated.practiceReminders).toBe(true);
    expect(updated.practiceReminderTime).toBe('07:30');
    expect(updated.reviewReminders).toBe(true);
    expect(updated.reviewReminderTime).toBe('20:15');
    expect(updated.betaFeatures).toBe(true);
  });

  it('resetPreferences restores every preference to its default', () => {
    const store = preferencesStore.getState();
    store.setTheme('dark');
    store.setSoundVolume(10);
    store.setPracticeReminders(true);
    store.setReviewReminders(true);
    store.setBetaFeatures(true);
    store.setMethod('Roux');
    store.setLanguage('es');
    store.setCubeTurnSoundsEnabled(true);

    store.resetPreferences();

    const reset = preferencesStore.getState();
    expect(reset.theme).toBe('light');
    expect(reset.soundVolume).toBe(80);
    expect(reset.practiceReminders).toBe(false);
    expect(reset.reviewReminders).toBe(false);
    expect(reset.betaFeatures).toBe(false);
    expect(reset.method).toBe('CFOP');
    expect(reset.language).toBe('auto');
    expect(reset.notificationsEnabled).toBe(true);
    expect(reset.soundsEnabled).toBe(true);
    expect(reset.cubeTurnSoundsEnabled).toBe(false);
  });
});

describe('ConnectionStore', () => {
  it('initializes as disconnected', () => {
    const state = connectionStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.deviceName).toBeNull();
    expect(state.deviceModel).toBeNull();
    expect(state.batteryLevel).toBeNull();
    expect(state.error).toBeNull();
  });

  it('transitions to connecting', () => {
    connectionStore.getState().setConnecting();
    expect(connectionStore.getState().status).toBe('connecting');
    expect(connectionStore.getState().error).toBeNull();
  });

  it('transitions to connected with device info', () => {
    connectionStore.getState().setConnected('GAN 356 i3', 'GAN356i3');
    const state = connectionStore.getState();
    expect(state.status).toBe('connected');
    expect(state.deviceName).toBe('GAN 356 i3');
    expect(state.deviceModel).toBe('GAN356i3');
  });

  it('tracks battery level', () => {
    connectionStore.getState().setConnected('Test', 'T1');
    connectionStore.getState().setBatteryLevel(85);
    expect(connectionStore.getState().batteryLevel).toBe(85);
  });

  it('transitions to reconnecting', () => {
    connectionStore.getState().setConnected('Test', 'T1');
    connectionStore.getState().setReconnecting();
    expect(connectionStore.getState().status).toBe('reconnecting');
  });

  it('transitions to disconnected with error', () => {
    connectionStore.getState().setDisconnected('Connection lost');
    const state = connectionStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.error).toBe('Connection lost');
    expect(state.deviceName).toBeNull();
  });

  it('reset clears all fields', () => {
    connectionStore.getState().setConnected('Test', 'T1');
    connectionStore.getState().setBatteryLevel(50);
    connectionStore.getState().reset();
    const state = connectionStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.batteryLevel).toBeNull();
  });

  it('isolated store instances do not share state', () => {
    const storeA = createConnectionStore();
    const storeB = createConnectionStore();
    storeA.getState().setConnected('A', 'A1');
    storeB.getState().setConnected('B', 'B1');
    expect(storeA.getState().deviceName).toBe('A');
    expect(storeB.getState().deviceName).toBe('B');
  });
});

describe('TimerStore', () => {
  beforeEach(() => {
    timerStore.getState().reset();
  });

  it('initializes as idle', () => {
    const state = timerStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.elapsedMs).toBe(0);
    expect(state.penalty).toBe('none');
    expect(state.isInspecting).toBe(false);
  });

  it('sets phase and derives isInspecting', () => {
    timerStore.getState().setPhase('inspection');
    expect(timerStore.getState().phase).toBe('inspection');
    expect(timerStore.getState().isInspecting).toBe(true);
  });

  it('sets elapsed ms', () => {
    timerStore.getState().setElapsedMs(12345);
    expect(timerStore.getState().elapsedMs).toBe(12345);
  });

  it('sets penalty', () => {
    timerStore.getState().setPenalty('+2');
    expect(timerStore.getState().penalty).toBe('+2');
  });

  it('reset returns to idle', () => {
    timerStore.getState().setPhase('running');
    timerStore.getState().setElapsedMs(5000);
    timerStore.getState().setPenalty('dnf');
    timerStore.getState().reset();
    const state = timerStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.elapsedMs).toBe(0);
    expect(state.penalty).toBe('none');
    expect(state.isInspecting).toBe(false);
  });
});

describe('SyncStore dataRevision (cross-tab live refresh signal)', () => {
  it('starts at revision 0', () => {
    expect(createSyncStore().getState().dataRevision).toBe(0);
  });

  it('bumpDataRevision increments monotonically', () => {
    const store = createSyncStore();
    store.getState().bumpDataRevision();
    store.getState().bumpDataRevision();
    store.getState().bumpDataRevision();
    expect(store.getState().dataRevision).toBe(3);
  });

  it('notifies subscribers when bumped (hooks re-read the DB)', () => {
    const store = createSyncStore();
    let seen: number | null = null;
    store.subscribe(() => {
      seen = store.getState().dataRevision;
    });
    store.getState().bumpDataRevision();
    expect(seen).toBe(1);
  });

  it('an unrelated status change leaves the revision untouched', () => {
    const store = createSyncStore();
    store.getState().bumpDataRevision();
    const before = store.getState().dataRevision;
    store.getState().setStatus('syncing');
    expect(store.getState().dataRevision).toBe(before); // revision unchanged
  });

  it('reset restores revision to 0', () => {
    const store = createSyncStore();
    store.getState().bumpDataRevision();
    store.getState().reset();
    expect(store.getState().dataRevision).toBe(0);
  });
});

describe('SessionStore', () => {
  beforeEach(() => {
    sessionStore.getState().clearSession();
  });

  it('initializes with no session', () => {
    const state = sessionStore.getState();
    expect(state.currentSessionId).toBeNull();
    expect(state.solves).toHaveLength(0);
    expect(state.isRecording).toBe(false);
  });

  it('starts a session', () => {
    sessionStore.getState().startSession('s1', 'Practice');
    const state = sessionStore.getState();
    expect(state.currentSessionId).toBe('s1');
    expect(state.sessionName).toBe('Practice');
    expect(state.solves).toHaveLength(0);
    expect(state.isRecording).toBe(true);
  });

  it('adds solves', () => {
    sessionStore.getState().startSession('s1', 'Test');
    const solve: SolveData = {
      id: 'solve-1',
      sessionId: 's1',
      timeMs: 12345,
      date: new Date().toISOString(),
      scramble: "R U R' U'",
      penalty: 'none',
    };
    sessionStore.getState().addSolve(solve);
    expect(sessionStore.getState().solves).toHaveLength(1);
    expect(sessionStore.getState().solves[0].timeMs).toBe(12345);
  });

  it('removes a solve by id', () => {
    sessionStore.getState().startSession('s1', 'Test');
    const solve1: SolveData = { id: 's1', sessionId: 's1', timeMs: 1000, date: '', scramble: '', penalty: 'none' };
    const solve2: SolveData = { id: 's2', sessionId: 's1', timeMs: 2000, date: '', scramble: '', penalty: 'none' };
    sessionStore.getState().addSolve(solve1);
    sessionStore.getState().addSolve(solve2);
    sessionStore.getState().removeSolve('s1');
    expect(sessionStore.getState().solves).toHaveLength(1);
    expect(sessionStore.getState().solves[0].id).toBe('s2');
  });

  it('clearSession resets state', () => {
    sessionStore.getState().startSession('s1', 'Test');
    sessionStore.getState().clearSession();
    const state = sessionStore.getState();
    expect(state.currentSessionId).toBeNull();
    expect(state.solves).toHaveLength(0);
    expect(state.isRecording).toBe(false);
  });

  it('toggles recording', () => {
    sessionStore.getState().setRecording(true);
    expect(sessionStore.getState().isRecording).toBe(true);
    sessionStore.getState().setRecording(false);
    expect(sessionStore.getState().isRecording).toBe(false);
  });
});
