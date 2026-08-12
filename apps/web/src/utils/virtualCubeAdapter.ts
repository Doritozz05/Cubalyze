"use client";

import { Subject } from "rxjs";
import type { CubeFace } from "@cubeforge/types";
import type { ScrambleValidationAdapter } from "@/hooks/useScrambleValidator";

/**
 * A virtual-cube equivalent of the Smart Cube stream surface. The Cube tab
 * pushes every turn it animates into {@link moves$} — the EXACT same stream
 * the physical timer's scramble validator + TimerEngine consume — plus
 * facelet snapshots for solved-detection and the sticky `needsReset` escape
 * (a solved cube resets the validator, like the physical cube's facelets).
 */
export interface VirtualCubeAdapter extends ScrambleValidationAdapter {
  /** Push a completed turn (already mirrored into the CubeState/engine). */
  pushMove(face: CubeFace, direction: 1 | -1): void;
  /** Push an absolute facelet snapshot (solved on mount/reset, solved when
   *  the solve completes). */
  pushFacelets(facelets: string): void;
}

export function createVirtualCubeAdapter(): VirtualCubeAdapter {
  const movesSubject = new Subject<import("@cubeforge/types").CubeMoveEvent>();
  const faceletsSubject = new Subject<string>();

  return {
    // The virtual cube is always "connected": the validator + auto-arm
    // logic treat it exactly like a paired Smart Cube.
    isConnected: true,
    moves$: movesSubject.asObservable(),
    facelets$: faceletsSubject.asObservable(),
    // Facelets are pushed directly by the view (no hardware round-trip).
    requestFacelets: async () => {},

    pushMove(face, direction) {
      movesSubject.next({
        face,
        direction,
        cubeTimestamp: 0,
        hostTimestamp: performance.now(),
      });
    },
    pushFacelets(facelets) {
      faceletsSubject.next(facelets);
    },
  };
}
