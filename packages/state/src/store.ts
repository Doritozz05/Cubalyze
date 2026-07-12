import { createStore } from 'zustand/vanilla';

export interface PreferencesState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const createPreferencesStore = () => {
  return createStore<PreferencesState>((set) => ({
    theme: 'system',
    setTheme: (theme) => set({ theme }),
  }));
};

// Export a default instance for simplicity in headless environments
export const preferencesStore = createPreferencesStore();
