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
  pushMove(face: CubeFace, direction: 1 | -1, displayNotation?: string): void;
  /**
   * Push a completed action as ONE full-notation token ("r" for a wide
   * move). Emitted on {@link tokens$} — the validator compares one user
   * action against one scramble token.
   */
  pushToken(notation: string, displayNotation?: string): void;
  /**
   * The solver-frame notation for the most recent token pushed via
   * {@link pushToken} — what the user actually performed on the rotated
   * view (e.g. "r"), as opposed to the cube-frame conjugated token the
   * validator receives ("b" under a y grip). Emitted BEFORE the token so
   * the session collector can pair them. Used to persist `displayNotation`
   * on the wide event so the replay shows the solver's own move.
   */
  tokenDisplay$?: import("rxjs").Observable<string>;
  /** Push an absolute facelet snapshot (solved on mount/reset, solved when
   *  the solve completes). */
  pushFacelets(facelets: string): void;
  /**
   * Force the scramble validator to re-seed from a FRESH state for the
   * CURRENT scramble text. Used by the Scramble button, which applies the
   * scramble already on screen — the text does not change, so the normal
   * scramble-change re-seed never fires on its own.
   */
  pushReset(): void;
}

export function createVirtualCubeAdapter(): VirtualCubeAdapter {
  const movesSubject = new Subject<import("@cubeforge/types").CubeMoveEvent>();
  const faceletsSubject = new Subject<string>();
  const resetSubject = new Subject<void>();
  const tokensSubject = new Subject<string>();
  const tokenDisplaySubject = new Subject<string>();

  return {
    // The virtual cube is always "connected": the validator + auto-arm
    // logic treat it exactly like a paired Smart Cube.
    isConnected: true,
    moves$: movesSubject.asObservable(),
    facelets$: faceletsSubject.asObservable(),
    reset$: resetSubject.asObservable(),
    tokens$: tokensSubject.asObservable(),
    tokenDisplay$: tokenDisplaySubject.asObservable(),
    // Facelets are pushed directly by the view (no hardware round-trip).
    requestFacelets: async () => {},

    pushMove(face, direction, displayNotation) {
      movesSubject.next({
        face,
        direction,
        displayNotation,
        cubeTimestamp: 0,
        hostTimestamp: performance.now(),
      });
    },
    pushToken(notation, displayNotation) {
      // Emit the display label FIRST so the session's collector (subscribed
      // to both streams) can pair the solver-frame notation with the token
      // that follows synchronously.
      tokenDisplaySubject.next(displayNotation ?? notation);
      tokensSubject.next(notation);
    },
    pushFacelets(facelets) {
      faceletsSubject.next(facelets);
    },
    pushReset() {
      resetSubject.next();
    },
  };
}
