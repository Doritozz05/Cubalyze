import { describe, it, expect, beforeEach } from 'vitest';
import { preferencesStore } from '../store.js';
import { connectionStore, createConnectionStore } from '../connection.store.js';
import { timerStore } from '../timer.store.js';
import { sessionStore } from '../session.store.js';
import type { SolveData } from '../session.store.js';

describe('PreferencesStore', () => {
  beforeEach(() => {
    preferencesStore.getState().setTheme('system');
  });

  it('initializes with default theme', () => {
    const state = preferencesStore.getState();
    expect(state.theme).toBe('system');
  });

  it('updates theme correctly', () => {
    preferencesStore.getState().setTheme('dark');
    expect(preferencesStore.getState().theme).toBe('dark');
  });

  it('handles spacebarHoldDelay, showBpaWpa, and timePrecision settings', () => {
    const store = preferencesStore.getState();
    expect(store.spacebarHoldDelay).toBe(300);
    expect(store.showBpaWpa).toBe(true);
    expect(store.timePrecision).toBe('centiseconds');

    store.setSpacebarHoldDelay(550);
    store.setShowBpaWpa(false);
    store.setTimePrecision('milliseconds');

    const updated = preferencesStore.getState();
    expect(updated.spacebarHoldDelay).toBe(550);
    expect(updated.showBpaWpa).toBe(false);
    expect(updated.timePrecision).toBe('milliseconds');
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
