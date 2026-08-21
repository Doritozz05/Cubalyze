import { createStore } from 'zustand/vanilla';

/**
 * Sync status mirror for the UI. Kept deliberately free of a
 * @cubeforge/sync-engine dependency (the status union is duplicated here to
 * avoid a package dependency; the engine's `onStatus` callback writes into
 * this store from the web layer).
 */
export type SyncStatus =
  | 'signed_out'
  | 'unconfigured'
  | 'idle'
  | 'syncing'
  | 'claim'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  /** Epoch ms of the last successful sync, or null. */
  lastSyncedAt: number | null;
  /** Rows waiting to be pushed (informational). */
  pendingCount: number;
  /** Human-readable last error (null when healthy). */
  error: string | null;

  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (t: number) => void;
  setPendingCount: (n: number) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

const initialState = {
  status: 'signed_out' as SyncStatus,
  lastSyncedAt: null as number | null,
  pendingCount: 0,
  error: null as string | null,
};

export const createSyncStore = () => {
  return createStore<SyncState>((set) => ({
    ...initialState,

    setStatus: (status) => set({ status }),

    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

    setPendingCount: (pendingCount) => set({ pendingCount }),

    setError: (error) => set({ error }),

    reset: () => set(initialState),
  }));
};

export const syncStore = createSyncStore();
