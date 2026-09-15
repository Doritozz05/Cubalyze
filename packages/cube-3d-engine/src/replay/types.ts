/**
 * @cubalyze/cube-3d-engine — Replay Engine types
 *
 * Shared public types for the ReplayEngine (see ReplayEngine.ts).
 * Kept in their own module so the engine implementation stays under the
 * TDD-0006 1000-line gate.
 */

import type { RotationAxis } from '@cubalyze/types';

/** How to rotate a single layer for one move. */
export interface RotationParams {
  axis: RotationAxis;
  layerValues: number[];
  angle: number;
  /** When this move plays relative to replay start (ms, move-driven). */
  offsetMs: number;
  /** The original move's hostTimestamp (kept for reference/back-compat; the
   *  replay timeline no longer depends on it). */
  hostTimestamp: number;
}

/** Callbacks the renderer must provide. */
export interface ReplayCallbacks {
  resetCube: () => void | Promise<void>;
  rotateLayers: (
    axis: RotationAxis,
    layerValues: number[],
    angle: number,
    durationMs: number,
    elapsedMs?: number,
  ) => void | Promise<void>;
  /** Called when orientation changes. orientationIndex is 0-23 (OrientationTable.ENTRIES).
   *  Pass animationDurationMs > 0 for smooth SLERP, 0 for instant snap (seeking). */
  setOrientation?: (orientationIndex: number, animationDurationMs: number) => void | Promise<void>;
  /**
   * Force-complete every in-flight animation in the renderer (layer rotations
   * + root orientation SLERP). Called before every absolute reset (seek) so a
   * rotation that is still turning when the reset happens can never snap
   * afterwards and re-apply itself on top of the freshly reset cube (the
   * "cube colors lost/buggy after restart/step" bug family). Optional: the
   * renderer may also flush internally inside resetCube().
   */
  flushAnimations?: () => void | Promise<void>;
}

/** Playback states. */
export type ReplayState = 'idle' | 'playing' | 'paused' | 'seeking' | 'complete';
