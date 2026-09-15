import { createStore } from 'zustand/vanilla';

/**
 * Sync status mirror for the UI. Kept deliberately free of a
 * @cubalyze/sync-engine dependency (the status union is duplicated here to
 * avoid a package dependency; the engine's `onStatus` callback writes into
 * this store from the web layer).
 */
export type SyncStatus =
  | 'signed_out'
  | 'unconfigured'
  | 'idle'
  | 'syncing'
  | 'claim'
  | 'claim_pending'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  /** Epoch ms of the last successful sync, or null. */
  lastSyncedAt: number | null;
  /** Rows waiting to be pushed (informational). */
  pendingCount: number;
  /** Human-readable last error (null when healthy). */
  error: string | null;
  /**
   * Bumped on every data change (local writes and sync cycles that moved
   * rows), local or from another tab via BroadcastChannel. Data hooks
   * subscribe to it to re-read the shared SQLite DB — the cross-tab live
   * refresh signal.
   */
  dataRevision: number;

  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (t: number) => void;
  setPendingCount: (n: number) => void;
  setError: (e: string | null) => void;
  bumpDataRevision: () => void;
  reset: () => void;
}

const initialState = {
  status: 'signed_out' as SyncStatus,
  lastSyncedAt: null as number | null,
  pendingCount: 0,
  error: null as string | null,
  dataRevision: 0,
};

export const createSyncStore = () => {
  return createStore<SyncState>((set) => ({
    ...initialState,

    setStatus: (status) => set({ status }),

    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

    setPendingCount: (pendingCount) => set({ pendingCount }),

    setError: (error) => set({ error }),

    bumpDataRevision: () => set((s) => ({ dataRevision: s.dataRevision + 1 })),

    reset: () => set(initialState),
  }));
};

export const syncStore = createSyncStore();
