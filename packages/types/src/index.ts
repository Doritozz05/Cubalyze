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
  /** Whole-cube rotation detected from gyroscope (optional). When set, face is meaningless. */
  wholeCubeRotation?: RotationAxis | null;
  /** Direction of the whole-cube rotation (optional) */
  wholeCubeDirection?: CubeMoveDirection;
}

/** The six faces of a standard cube in Singmaster notation */
export type CubeFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

/** Direction of a cube face rotation */
export type CubeMoveDirection = 1 | -1 | 2;

/**
 * A whole-cube rotation event detected from gyroscope data.
 * Separate from CubeMoveEvent because it comes from a different detection pipeline.
 */
export interface RotationEvent {
  /** Rotation axis: 'x', 'y', or 'z' */
  axis: RotationAxis;
  /** Direction: 1 = CW, -1 = CCW, 2 = 180° */
  direction: CubeMoveDirection;
  /** Timestamp when the rotation was detected */
  timestamp: number;
}

// ─── Gyroscope / IMU Events ──────────────────────────────────────────────────

/**
 * Angular velocity vector (rad/s) from the cube's gyroscope.
 * Used for regrip detection (PRD 8.2).
 */
export interface GyroVelocity {
  x: number;
  y: number;
  z: number;
}

/**
 * A quaternion orientation event from the cube's built-in gyroscope/IMU.
 * All fields are components of a unit quaternion (x, y, z, w).
 */
export interface GyroEvent {
  x: number;
  y: number;
  z: number;
  w: number;
  /** Angular velocity in rad/s, present on supported hardware */
  velocity?: GyroVelocity;
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


