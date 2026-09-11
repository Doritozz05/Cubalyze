"use client";

// ─────────────────────────────────────────────────────────────────────────
// useOrientation — connects the Zustand orientation store to React components.
//
// Provides:
//   - The current CubeOrientation (snapped to 24 orientations)
//   - Hardware capability flags (hasIMU, gyroSupported)
//   - Helper functions to transform raw BLE moves → display notation
//   - Helper to remap scramble strings for the current orientation
//
// When no IMU is available, orientation is identity and all helpers
// return the raw notation unchanged — zero behavior difference.
// ─────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { useStore } from 'zustand';
import { orientationStore, preferencesStore } from '@cubeforge/state';
import { MoveTransformer } from '@cubeforge/math-core';
import type { PuzzleCategory } from '@/types';
import type {
  CubeMoveEvent,
  CubeOrientation,
  DisplayMove,
  OrientationCapabilities,
} from '@cubeforge/types';

/**
 * Whether a puzzle's orientation can define the frame the scramble is written
 * in — i.e. whether the orientation-adapted scramble display applies to it.
 *
 * Central policy used by `remapScramble`: only puzzles with FIXED centres
 * (3×3 and up) have a colour reference the scramble notation is relative to.
 *
 * A 2×2 has no centres, so its orientation carries no meaning for the
 * scramble: it stays a DYNAMIC scramble (a new one every solve) but must never
 * rotate with the cube. This matters on a 3×3 solved as a 2×2, where a
 * middle-layer turn arrives as `M = R + L' + x'`: the reported `x'` is the 3×3
 * CORE rotation, while the 2×2 corners never moved, so following it silently
 * rewrote the 2×2 scramble.
 */
export function scrambleFollowsCubeForPuzzle(puzzle: PuzzleCategory): boolean {
  return puzzle !== '2x2';
}

export interface UseOrientationResult {
  /** The cube's current orientation (snapped to 24 discrete orientations). */
  orientation: CubeOrientation;
  /** Hardware capability flags for the connected cube. */
  capabilities: OrientationCapabilities;

  /** Transform a raw BLE move event into a display move (face remapped). */
  toDisplay: (raw: CubeMoveEvent) => DisplayMove;
  /** Transform a raw BLE move event into a notation string (e.g. "R'", "U2"). */
  toDisplayNotation: (raw: CubeMoveEvent) => string;
  /**
   * Remap a scramble string for display in the current orientation.
   *
   * @param puzzle the active puzzle (optional). When given, the central policy
   *   `scrambleFollowsCubeForPuzzle` decides whether the orientation applies at
   *   all — a 2×2 is never remapped. Callers that omit it keep the 3×3
   *   behaviour, so existing training views are unaffected.
   */
  remapScramble: (scramble: string, puzzle?: PuzzleCategory) => string;
}

export function useOrientation(): UseOrientationResult {
  const orientation = useStore(orientationStore, (s) => s.orientation);
  const capabilities = useStore(orientationStore, (s) => s.capabilities);

  const toDisplay = useCallback(
    (raw: CubeMoveEvent): DisplayMove =>
      MoveTransformer.toDisplay(raw, orientation),
    [orientation],
  );

  const toDisplayNotation = useCallback(
    (raw: CubeMoveEvent): string =>
      MoveTransformer.toDisplayNotation(raw, orientation),
    [orientation],
  );

  const scrambleFollowsCube = useStore(preferencesStore, (s) => s.scrambleFollowsCube);

  const remapScramble = useCallback(
    (scramble: string, puzzle?: PuzzleCategory): string => {
      if (!scrambleFollowsCube) return scramble;
      if (puzzle !== undefined && !scrambleFollowsCubeForPuzzle(puzzle)) return scramble;
      return MoveTransformer.remapScrambleString(scramble, orientation);
    },
    [orientation, scrambleFollowsCube],
  );

  return {
    orientation,
    capabilities,
    toDisplay,
    toDisplayNotation,
    remapScramble,
  };
}
