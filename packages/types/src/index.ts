/**
 * @cubeforge/types — Shared interface contracts for the CubeForge platform.
 *
 * This package is the single source of truth for types shared between
 * hardware-hal, cube-3d-engine, and the web app. It prevents duplicate
 * definitions and ensures type compatibility across package boundaries.
 */

// ─── Smart Cube Hardware Events ───────────────────────────────────────────────

/**
 * A decoded move event from a smart cube.
 * Emitted by hardware adapters after protocol decryption and clock reconciliation.
 */
export interface CubeMoveEvent {
  /** Standard notation face: 'U', 'D', 'R', 'L', 'F', 'B' */
  face: CubeFace;
  /** Direction: 1 = clockwise, -1 = counter-clockwise, 2 = half-turn (180°) */
  direction: CubeMoveDirection;
  /** Timestamp from the cube's internal hardware clock (may have drift) */
  cubeTimestamp: number;
  /** Browser's performance.now() at the moment the event was received */
  hostTimestamp: number;
}

/** The six faces of a standard cube in Singmaster notation */
export type CubeFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

/** Direction of a cube face rotation */
export type CubeMoveDirection = 1 | -1 | 2;

// ─── Gyroscope / IMU Events ──────────────────────────────────────────────────

/**
 * A quaternion orientation event from the cube's built-in gyroscope/IMU.
 * All fields are components of a unit quaternion (x, y, z, w).
 */
export interface GyroEvent {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ─── Cube Visual State ───────────────────────────────────────────────────────

/** 3D rotation axis for layer rotations */
export type RotationAxis = 'x' | 'y' | 'z';

/**
 * Maps a CubeFace to its rotation axis, layer value (which slice), and
 * angle sign convention. Used by SyncBridge to translate hardware events
 * into 3D engine rotation commands.
 */
export interface FaceRotationMapping {
  axis: RotationAxis;
  layerValue: number;  // 1, 0, or -1 in the 3x3 grid
  angleSign: 1 | -1;   // Sign convention for the rotation direction
}

/** Standard face-to-axis mappings for a 3x3 Rubik's Cube */
export const FACE_ROTATION_MAP: Record<CubeFace, FaceRotationMapping> = {
  U: { axis: 'y', layerValue:  1, angleSign: -1 },
  D: { axis: 'y', layerValue: -1, angleSign:  1 },
  R: { axis: 'x', layerValue:  1, angleSign: -1 },
  L: { axis: 'x', layerValue: -1, angleSign:  1 },
  F: { axis: 'z', layerValue:  1, angleSign: -1 },
  B: { axis: 'z', layerValue: -1, angleSign:  1 },
};
