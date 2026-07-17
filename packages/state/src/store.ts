import { createStore } from 'zustand/vanilla';

export interface PreferencesState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  /** Whether the scramble display rotates to match cube orientation. */
  scrambleFollowsCube: boolean;
  setScrambleFollowsCube: (value: boolean) => void;
}

export const createPreferencesStore = () => {
  return createStore<PreferencesState>((set) => ({
    theme: 'system',
    setTheme: (theme) => set({ theme }),
    scrambleFollowsCube: true,
    setScrambleFollowsCube: (value) => set({ scrambleFollowsCube: value }),
  }));
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
