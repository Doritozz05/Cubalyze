import { describe, it, expect } from 'vitest';
import { preferencesStore } from '../store.js';

describe('State Manager (Zustand)', () => {
  it('initializes with default theme', () => {
    const state = preferencesStore.getState();
    expect(state.theme).toBe('system');
  });

  it('updates theme correctly', () => {
    preferencesStore.getState().setTheme('dark');
    expect(preferencesStore.getState().theme).toBe('dark');
  });
});
