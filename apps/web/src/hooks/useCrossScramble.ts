"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CrossScrambleGenerator,
  type CrossScrambleResult,
  type PhaseSolution,
} from "@cubalyze/solver-engine";
import { COLOR_NEUTRAL_CFOP_MASKS } from "@cubalyze/math-core";
import type { PhaseMask } from "@cubalyze/math-core";
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from "@cubalyze/types";

/* ──────────────────────────────────────────────────────────────────────────
   useCrossScramble

   Generates a "way-to-cross" scramble (optimal cross == exactly N moves on a
   chosen face or color-neutral) plus the optimal solution(s) and the
   PhaseMask needed for 3D stickering. Also converts the optimal solution
   into a CubeMoveEvent[] that the existing ReplayEngine can replay directly.

   No timer — pure scramble + solve + replay data.
   ─────────────────────────────────────────────────────────────────────── */

export interface UseCrossScrambleOptions {
  /** Cross depth (1–8). Default 5. */
  depth?: number;
  /**
   * Cross face. Omit / pass undefined → color-neutral (picks the best face).
   * Default "D".
   */
  face?: string;
  /** Max retries inside CrossScrambleGenerator. Default 300. */
  maxRetries?: number;
}

export interface CrossScrambleState {
  scramble: string;
  optimalSolution: string;
  optimalDepth: number;
  face: string;
  /** The PhaseMask for the returned face (for setPhaseStickering). */
  stickeringMask: PhaseMask;
  /** Optimal solution as CubeMoveEvent[] (for ReplayEngine). */
  replayMoves: CubeMoveEvent[];
  /** All optimal solutions found (first is the replayed one). */
  allSolutions: PhaseSolution[];
  /** True while generating the next scramble. */
  isGenerating: boolean;
  /** Per-attempt counter (increments every new scramble). */
  scrambleIndex: number;
}

/** Spacing between replay moves in ms (controls ReplayEngine timeline). */
const REPLAY_MOVE_SPACING_MS = 600;

/**
 * Look up the pre-built per-face cross PhaseMask from
 * COLOR_NEUTRAL_CFOP_MASKS (index 0 of each face's masks = cross).
 * Falls back to the D-face entry. No rebuild, no require().
 */
function getCrossMaskForFace(face: string): PhaseMask {
  const entry = COLOR_NEUTRAL_CFOP_MASKS.find((f) => f.face === face);
  if (entry) return entry.masks[0];
  return COLOR_NEUTRAL_CFOP_MASKS[0].masks[0]; // D fallback
}

/**
 * Convert a space-separated move notation string into CubeMoveEvent[]
 * suitable for the existing ReplayEngine.
 *
 * Each move gets a monotonically-increasing hostTimestamp spaced by
 * REPLAY_MOVE_SPACING_MS so the ReplayEngine builds a sensible timeline.
 */
function notationToReplayMoves(notation: string, startTime = 0): CubeMoveEvent[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  const moves: CubeMoveEvent[] = [];
  let ts = startTime;
  for (const tok of tokens) {
    const face = tok[0] as CubeFace;
    const suffix = tok.length > 1 ? tok[1] : "";
    const direction: CubeMoveDirection =
      suffix === "2" ? 2 : suffix === "'" ? -1 : 1;
    moves.push({
      face,
      direction,
      cubeTimestamp: ts,
      hostTimestamp: ts,
    });
    ts += REPLAY_MOVE_SPACING_MS;
  }
  return moves;
}

export interface UseCrossScrambleResult extends CrossScrambleState {
  /** Generate a new scramble at the given (or current) depth/face. */
  regenerate: (opts?: Partial<UseCrossScrambleOptions>) => void;
  /** Current depth (latest scramble). */
  depth: number;
  /** Current face (latest scramble). "CN" when color-neutral. */
  face: string;
  /** Whether color-neutral mode is active. */
  colorNeutral: boolean;
}

export function useCrossScramble(
  initialOpts: UseCrossScrambleOptions = {},
): UseCrossScrambleResult {
  const { depth: initialDepth = 5, face: initialFace = "D", maxRetries = 300 } =
    initialOpts;

  const [depth, setDepth] = useState<number>(initialDepth);
  const [face, setFace] = useState<string | undefined>(initialFace);
  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CrossScrambleResult | null>(null);
  const [replayMoves, setReplayMoves] = useState<CubeMoveEvent[]>([]);
  // Nonce that increments on every regenerate() call. Included in the
  // generate-effect deps so explicit "New scramble" requests (even when
  // depth/face are unchanged) trigger a single generation. This replaces
  // the old `setTimeout(generate, 0)` in regenerate, which caused a
  // double-generation (the setTimeout AND the depth/face effect both fired).
  const [regenerateNonce, setRegenerateNonce] = useState(0);

  // Ref mirror so the generate callback is stable and reads latest values.
  const optsRef = useRef({ depth, face, maxRetries });
  optsRef.current = { depth, face, maxRetries };

  const generate = useCallback(() => {
    const { depth: d, face: f, maxRetries: mr } = optsRef.current;
    setIsGenerating(true);
    // Defer to next tick so the UI can show the loading state; the
    // generator is synchronous but can take ~50–200ms.
    setTimeout(() => {
      try {
        const r = CrossScrambleGenerator.generate({
          depth: d,
          face: f,
          maxRetries: mr,
          acceptUpToDepth: false,
        });
        setResult(r);
        setReplayMoves(notationToReplayMoves(r.optimalSolution));
        setScrambleIndex((i) => i + 1);
      } catch (err) {
        console.error("[useCrossScramble] generation failed:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 0);
  }, []);

  // Single generation path: mount + depth/face change + explicit regenerate.
  // The nonce guarantees that clicking the active depth (a no-op for
  // setDepth) still fires the effect exactly once.
  useEffect(() => {
    generate();
  }, [depth, face, regenerateNonce, generate]);

  const regenerate = useCallback(
    (opts?: Partial<UseCrossScrambleOptions>) => {
      if (opts?.depth != null) setDepth(opts.depth);
      // Use `'face' in opts` (not `!== undefined`) so the caller can
      // explicitly pass `face: undefined` to switch to color-neutral mode.
      if (opts && 'face' in opts) setFace(opts.face);
      // Always bump the nonce → the generate-effect fires exactly once,
      // reading the updated depth/face from optsRef. No setTimeout, no
      // double-generation.
      setRegenerateNonce((n) => n + 1);
    },
    [],
  );

  const resultFace = result?.face ?? face ?? "D";
  const stickeringMask = getCrossMaskForFace(resultFace);
  const colorNeutral = face === undefined;

  return {
    scramble: result?.scramble ?? "",
    optimalSolution: result?.optimalSolution ?? "",
    optimalDepth: result?.optimalDepth ?? 0,
    // The actual face the scramble was solved on (CN picks the best face).
    // The view uses `colorNeutral` to decide whether to show "CN" instead.
    face: resultFace,
    stickeringMask,
    replayMoves,
    allSolutions: result?.allSolutions ?? [],
    isGenerating,
    scrambleIndex,
    regenerate,
    depth,
    colorNeutral,
  };
}
