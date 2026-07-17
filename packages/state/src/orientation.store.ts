import { createStore } from 'zustand/vanilla';
import type {
  CubeOrientation,
  OrientationCapabilities,
  FacePermutation,
} from '@cubeforge/types';

// ─── Identity defaults ───────────────────────────────────────────────────────

const IDENTITY_FACE_MAP: FacePermutation = {
  U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R',
};

const IDENTITY_ORIENTATION: CubeOrientation = {
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  faceMap: IDENTITY_FACE_MAP,
  label: 'F:F U:U R:R',
};

const DEFAULT_CAPABILITIES: OrientationCapabilities = {
  hasIMU: false,
  gyroSupported: false,
};

// ─── Store interface ─────────────────────────────────────────────────────────

export interface OrientationState {
  /** The cube's current physical orientation (identity until first confident snap). */
  orientation: CubeOrientation;
  /** Hardware capability flags for the connected cube. */
  capabilities: OrientationCapabilities;

  /** Update the current orientation (called by the worker via Comlink callback). */
  setOrientation: (o: CubeOrientation) => void;
  /** Update hardware capabilities (called when cube connects/disconnects). */
  setCapabilities: (c: OrientationCapabilities) => void;
  /** Reset to identity orientation and default capabilities. */
  reset: () => void;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export const createOrientationStore = () => {
  return createStore<OrientationState>((set) => ({
    orientation: IDENTITY_ORIENTATION,
    capabilities: DEFAULT_CAPABILITIES,

    setOrientation: (o) => set({ orientation: o }),
    setCapabilities: (c) => set({ capabilities: c }),
    reset: () =>
      set({
        orientation: IDENTITY_ORIENTATION,
        capabilities: DEFAULT_CAPABILITIES,
      }),
  }));
};

/** Default singleton instance for headless / simple usage. */
export const orientationStore = createOrientationStore();
