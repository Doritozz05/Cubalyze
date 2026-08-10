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
  /** Standard notation face: 'U', 'D', 'R', 'L', 'F', 'B' (or slice M/E/S for replays). */
  face: CubeFace;
  /** Direction: 1 = clockwise, -1 = counter-clockwise, 2 = half-turn (180°) */
  direction: CubeMoveDirection;
  /** Timestamp from the cube's internal hardware clock (may have drift) */
  cubeTimestamp: number;
  /** Browser's performance.now() at the moment the event was received */
  hostTimestamp: number;
  /**
   * True for a WIDE move (r/l/u/d/f/b) synthesized by the reconstruction
   * replay path. The outer face AND the middle layer rotate TOGETHER as one
   * animation. Hardware events never set this.
   */
  wide?: boolean;
  /**
   * Display notation override (e.g. "r'") — the token the solver actually
   * wrote, shown verbatim by the replay UI instead of the decomposed
   * face+slice letters. Only present on synthetic reconstruction events.
   */
  displayNotation?: string;
}

/** The six outer faces of a standard cube in Singmaster notation. */
export type OuterFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

/**
 * A face label: the six outer faces PLUS the slice moves M/E/S.
 * Slice faces only ever appear in replay/state move streams (wide moves are
 * decomposed into outer face + slice before reaching the engine), never in
 * hardware events or orientation tables.
 */
export type CubeFace = OuterFace | 'M' | 'E' | 'S';

/** Direction of a cube face rotation */
export type CubeMoveDirection = 1 | -1 | 2;

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

// ─── Cube Orientation System ────────────────────────────────────────────────
// Dynamic notation system: adapts move display to the cube's physical orientation.
// See: docs/02-architecture/Dynamic_Notation_Orientation_System.md
export * from './orientation';

// ─── Analysis Pipeline Types ─────────────────────────────────────────────────
// SolveTimeline, metrics, and phase segmentation types.
export * from './analysis';

