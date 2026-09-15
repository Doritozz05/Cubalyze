/**
 * @cubalyze/cube-3d-engine — Scramble Animation
 *
 * Converts a WCA scramble string ("R U R' F2 ...") into the individual
 * layer rotations needed to play it back with animation on the 3D cube.
 *
 * The mapping is shared with {@link ReplayEngine} (FACE_ROTATION_MAP), so a
 * scramble always rotates the exact same layers/angles the replay system uses.
 *
 * Unsupported tokens (wide moves "r", rotations "x/y/z", or anything not in
 * FACE_ROTATION_MAP) make the whole parse return `null` — callers should then
 * fall back to the instant facelet-sync path instead of corrupting the model.
 */

import { FACE_ROTATION_MAP } from '../constants/faceRotation';
import type { CubeFace } from '@cubalyze/types';

/** A single move of a scramble, ready to feed `Cube3DEngine.rotateLayers`. */
export interface ScrambleRotation {
  axis: 'x' | 'y' | 'z';
  layerValue: number;
  angle: number;
}

/**
 * Parse a WCA scramble string into layer rotations.
 *
 * @param scramble Space-separated moves, e.g. "R U R' F2".
 * @returns The ordered rotations, or `null` when the string is empty or
 *          contains a move the engine cannot animate (wide moves, rotations).
 */
export function parseScrambleMoves(scramble: string): ScrambleRotation[] | null {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const result: ScrambleRotation[] = [];
  for (const token of tokens) {
    const face = token[0] as CubeFace;
    const suffix = token.length > 1 ? token[1] : '';
    // Only the exact forms "R", "R'" and "R2" are valid — reject garbage
    // like "R22" or "R2'" instead of silently parsing the first two chars.
    if (token !== face && token !== `${face}'` && token !== `${face}2`) return null;
    const direction = suffix === '2' ? 2 : suffix === "'" ? -1 : 1;
    const mapping = FACE_ROTATION_MAP[face];
    // Unsupported token (lowercase wide move, rotation, garbage) — the caller
    // must fall back to the instant facelet sync path.
    if (!mapping) return null;
    result.push({
      axis: mapping.axis,
      layerValue: mapping.layerValue,
      angle: direction * mapping.angleSign * 90,
    });
  }
  return result;
}

/**
 * Adaptive per-move duration: a 180° turn travels twice as far as a 90° turn,
 * so it gets proportionally more time. Clamped so double-turns never feel
 * sluggish and single turns always stay snappy.
 */
export function scrambleMoveDurationMs(angle: number, baseMs = 160): number {
  const quarterTurns = Math.max(1, Math.abs(angle) / 90);
  return Math.round(baseMs * quarterTurns);
}
