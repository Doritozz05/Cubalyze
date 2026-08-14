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
  /**
   * The single calibration reference quaternion (Three.js convention,
   * MAPPED from raw hardware) that the headless tracker calibrated to.
   * null = not calibrated yet. Every consumer (3D visual GyroFusion, move
   * display) must use THIS reference, not capture its own — otherwise the
   * label display and the 3D model can calibrate to different poses and
   * diverge (moves show an extra rotation while the model looks fine).
   */
  calibrationQuaternion: { x: number; y: number; z: number; w: number } | null;

  /** Update the current orientation (called by the worker via Comlink callback). */
  setOrientation: (o: CubeOrientation) => void;
  /** Update hardware capabilities (called when cube connects/disconnects). */
  setCapabilities: (c: OrientationCapabilities) => void;
  /** Publish the calibration reference (auto-calibrate + manual Calibrate). */
  setCalibrationQuaternion: (q: { x: number; y: number; z: number; w: number }) => void;
  /** Reset to identity orientation and default capabilities. */
  reset: () => void;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export const createOrientationStore = () => {
  return createStore<OrientationState>((set) => ({
    orientation: IDENTITY_ORIENTATION,
    capabilities: DEFAULT_CAPABILITIES,
    calibrationQuaternion: null,

    setOrientation: (o) => set({ orientation: o }),
    setCapabilities: (c) => set({ capabilities: c }),
    setCalibrationQuaternion: (q) => set({ calibrationQuaternion: q }),
    reset: () =>
      set({
        orientation: IDENTITY_ORIENTATION,
        capabilities: DEFAULT_CAPABILITIES,
        calibrationQuaternion: null,
      }),
  }));
};

/** Default singleton instance for headless / simple usage. */
export const orientationStore = createOrientationStore();
