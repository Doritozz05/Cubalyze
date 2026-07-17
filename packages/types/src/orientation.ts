// ─── Cube Orientation Types ──────────────────────────────────────────────────
//
// These types support the dynamic notation system that adapts move display
// to the cube's current physical orientation. See the design document:
//   docs/02-architecture/Dynamic_Notation_Orientation_System.md

import type { CubeFace, CubeMoveDirection, GyroEvent } from './index';

/**
 * A permutation mapping: position → original face currently occupying it.
 *
 * For example, after a `y` rotation (same as U), the original R face moves
 * to the F position, so `faceMap.F === 'R'`.
 *
 * The identity map is { U:'U', D:'D', F:'F', B:'B', L:'L', R:'R' }.
 */
export type FacePermutation = Record<CubeFace, CubeFace>;

/**
 * The cube's current orientation — one of 24 possible orientations in the
 * rotation group of the cube (octahedral group O ≅ S₄).
 */
export interface CubeOrientation {
  /** Unit quaternion representing this orientation (Three.js convention: Y-up, right-handed). */
  quaternion: { x: number; y: number; z: number; w: number };
  /** Position → original face permutation. Used for move remapping. */
  faceMap: FacePermutation;
  /** Human-readable label, e.g. "F:Green U:White R:Red" (calibration-relative, for debugging). */
  label: string;
}

/**
 * A display move — same structure as CubeMoveEvent but with the face remapped
 * according to the current orientation. The direction is ALWAYS preserved
 * (a whole-cube rotation is a proper rotation, so it preserves rotation sense).
 */
export interface DisplayMove {
  face: CubeFace;
  direction: CubeMoveDirection;
  cubeTimestamp: number;
  hostTimestamp: number;
}

/**
 * A whole-cube rotation event detected by the OrientationTracker.
 * Emitted when the cube's snapped orientation changes. Used by the analysis
 * engine for rotation counting and user-perspective reconstruction.
 */
export interface RotationEvent {
  /** The rotation axis in Singmaster notation. */
  axis: 'x' | 'y' | 'z';
  /** Direction: 1 = clockwise, -1 = counter-clockwise, 2 = half-turn (180°). */
  direction: CubeMoveDirection;
  /** Timestamp (host performance.now() or equivalent). */
  timestamp: number;
  /** The orientation before this rotation. */
  fromOrientation: CubeOrientation;
  /** The orientation after this rotation. */
  toOrientation: CubeOrientation;
}

/**
 * Capability flags describing what orientation data the connected hardware
 * can provide.
 */
export interface OrientationCapabilities {
  /** Whether the cube has a gyroscope/IMU that provides orientation quaternions. */
  hasIMU: boolean;
  /** Whether gyro support was confirmed by the hardware info event. */
  gyroSupported: boolean;
}

// Re-export GyroEvent for convenience (it's already exported from index.ts,
// but consumers of this module may want a single import point).
export type { GyroEvent };
