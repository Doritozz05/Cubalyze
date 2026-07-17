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
import { orientationStore } from '@cubeforge/state';
import { MoveTransformer } from '@cubeforge/math-core';
import type {
  CubeMoveEvent,
  CubeOrientation,
  DisplayMove,
  OrientationCapabilities,
} from '@cubeforge/types';

export interface UseOrientationResult {
  /** The cube's current orientation (snapped to 24 discrete orientations). */
  orientation: CubeOrientation;
  /** Hardware capability flags for the connected cube. */
  capabilities: OrientationCapabilities;

  /** Transform a raw BLE move event into a display move (face remapped). */
  toDisplay: (raw: CubeMoveEvent) => DisplayMove;
  /** Transform a raw BLE move event into a notation string (e.g. "R'", "U2"). */
  toDisplayNotation: (raw: CubeMoveEvent) => string;
  /** Remap a scramble string for display in the current orientation. */
  remapScramble: (scramble: string) => string;
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

  const remapScramble = useCallback(
    (scramble: string): string =>
      MoveTransformer.remapScrambleString(scramble, orientation),
    [orientation],
  );

  return {
    orientation,
    capabilities,
    toDisplay,
    toDisplayNotation,
    remapScramble,
  };
}
