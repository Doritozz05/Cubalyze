"use client";

import { useCallback, useRef, useState } from "react";
import { useStore } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import i18n from "@/i18n";
import { preferencesStore } from "@cubeforge/state";
import type { Penalty, PuzzleCategory, Solve, SolveSource } from "@/types";
import type {
  CubeMoveEvent,
  CubeOrientation,
  OrientationTimeline,
  SolveMetrics,
} from "@cubeforge/types";
import { detectPbMilestones, type PbMilestoneResult } from "@/utils/pbDetection";
import { queueSolveAnalysis } from "@/utils/solveAnalysisCoordinator";
import { runAnalysis } from "@/hooks/useSolveSession";
import { methodForEvent, puzzleCategoryToType } from "@/utils/puzzleUtils";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { activeCubeStore } from "@/stores/activeCubeStore";
import { hardwareLinkStore } from "@/stores/hardwareLinkStore";
import {
  cubeAttribution,
  cubesForEventWithSmartFallback,
  latestCubeIdForEvent,
  resolveActiveCube,
} from "@/views/Collection/activeCube";
import { globalAudioSystem } from "@/utils/audioSystem";
import { hapticCelebrate } from "@/utils/haptics";
import { isDev } from "@/utils/env";
import type { UsePersistentSessionResult } from "@/hooks/usePersistentSession";

/** Per-call overrides for the hook's `handleComplete` —
 *  used by the virtual cube simulator, which owns its own scramble + next-
 *  scramble lifecycle and must force `source: "virtual"`. */
export interface SolveCompletionOverrides {
  source?: SolveSource;
  scramble?: string;
  puzzleType?: string;
  onNextScramble?: () => void;
}

export interface SolveCompletionDeps {
  addSolve: UsePersistentSessionResult["addSolve"];
  updateSolve: UsePersistentSessionResult["updateSolve"];
  currentScramble: string;
  puzzle: PuzzleCategory;
  /** Current solves, newest first (read via ref to avoid stale closures). */
  solvesRef: React.MutableRefObject<Solve[]>;
  /** Live Smart Cube connection state (read via ref at solve-stop time). */
  smartCubeConnectedRef: React.MutableRefObject<boolean>;
  /** Set (or clear) the active PB milestone banner. */
  onPbMilestone: (result: PbMilestoneResult | null) => void;
  /** Advance to the next scramble after a solve is persisted. */
  onNextScramble: () => void;
}

/**
 * Owns the end-of-solve pipeline (extracted from App.tsx):
 *  1. PB milestone detection (Single / Ao5 / Ao12) + celebration feedback.
 *  2. Immediate save of the solve with raw moves, so replay/timeline have
 *     data from the first render.
 *  3. A background analysis job that later patches the same solve with
 *     compacted moves + computed metrics.
 *
 * Monotonic completion tokens prevent an out-of-order IndexedDB promise
 * from deciding which analysis is displayed: a token becomes "saved" only
 * after its own insert succeeds, so a failed later insert cannot hide an
 * earlier valid analysis.
 */
export function useSolveCompletion(deps: SolveCompletionDeps) {
  const {
    addSolve,
    updateSolve,
    currentScramble,
    puzzle,
    solvesRef,
    smartCubeConnectedRef,
    onPbMilestone,
    onNextScramble,
  } = deps;

  // Display/preferences are read from the store so the completion pipeline
  // always uses the latest user settings without extra props from the caller.
  const methodPref = useStore(preferencesStore, (s) => s.method);
  const scrambleDisplay = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const pbCelebrationAudio = useStore(preferencesStore, (s) => s.pbCelebrationAudio);
  const pbCelebrationAnimation = useStore(preferencesStore, (s) => s.pbCelebrationAnimation);
  const notificationsEnabled = useStore(preferencesStore, (s) => s.notificationsEnabled);
  const soundsEnabled = useStore(preferencesStore, (s) => s.soundsEnabled);
  const soundVolume = useStore(preferencesStore, (s) => s.soundVolume);

  const [lastAnalysis, setLastAnalysis] = useState<SolveMetrics | null>(null);
  const completionTokenRef = useRef(0);
  const latestSavedTokenRef = useRef(0);

  const handleComplete = useCallback(
    async (
      time: number,
      penalty: Penalty,
      rawMoves: CubeMoveEvent[],
      _rawOrientations: (CubeOrientation | undefined)[],
      rawOrientationTimeline: OrientationTimeline | undefined,
      /**
       * Per-call overrides (used by the virtual cube simulator, which owns
       * its own scramble + next-scramble lifecycle):
       *   - source: force the recorded SolveSource (e.g. "virtual"). Defaults
       *     to smart/manual from `smartCubeConnectedRef`.
       *   - scramble: the scramble this solve solved (defaults to the live
       *     timer's `currentScramble`).
       *   - puzzleType: puzzle type string (defaults to the app puzzle).
       *   - onNextScramble: replaces the default next-scramble callback
       *     (defaults to the live timer's).
       */
      overrides?: SolveCompletionOverrides,
    ) => {
      // These locals are captured by this solve's background job before the
      // next scramble is generated, so the analysis uses the correct input.
      const capturedScramble = overrides?.scramble ?? currentScramble;
      const capturedPuzzleType = overrides?.puzzleType ?? puzzleCategoryToType(puzzle);
      const capturedNextScramble = overrides?.onNextScramble ?? onNextScramble;
      // Two different questions, deliberately answered separately:
      //   • the ANALYSIS input — only ever used inside the 3×3-only branch
      //     below, where "the user's method" is exactly right;
      //   • the PERSISTED method — an event without a method (2×2, Pyraminx,
      //     …) must store none, or the row claims "CFOP" for a Pyraminx solve.
      const capturedMethod = methodPref;
      const capturedPersistedMethod = methodForEvent(capturedPuzzleType, methodPref);
      const solveId = uuidv4();
      const completionToken = ++completionTokenRef.current;

      // `smartCubeConnectedRef` reflects the live connection state at
      // solve-stop time (synced by an effect in App). We use a ref instead
      // of the state variable directly because `handleComplete` is declared
      // before `useSolveSession` provides it (it's passed as `onSolve`).
      // The virtual cube passes an explicit `source` override instead.
      const capturedSource: SolveSource =
        overrides?.source ??
        (smartCubeConnectedRef.current ? "smart" : "manual");

      // Which of the user's cubes this solve belongs to. A virtual solve has no
      // physical cube, and `resolveActiveCube` only ever answers with a cube of
      // THIS event that is still owned — an event with nothing registered in
      // the Locker stores no attribution rather than a guess. Read imperatively
      // so a Locker edit never re-renders the timer. In 2×2 with "3×3 as 2×2"
      // on, a linked smart 3×3 is a valid candidate (same rule as the dock).
      const use3x3As2x2 = preferencesStore.getState().use3x3As2x2;
      const collectionData = useCollectionStore.getState().data;
      const activeByEvent = activeCubeStore.getState().byEvent[capturedPuzzleType];
      const cubeCandidates = cubesForEventWithSmartFallback(
        collectionData,
        capturedPuzzleType,
        capturedPuzzleType === "222" && use3x3As2x2,
      );
      // The cube in your hand beats the Locker fallbacks (Main, most recent).
      // In 2×2 with "3×3 as 2×2" on, that is the linked smart 3×3 — the exact
      // case that used to store no attribution at all. Gated hardware is inert
      // here: it is not in `cubeCandidates`, so the preference finds nothing.
      const linked = hardwareLinkStore.getState();
      const hardwareItemId = linked.status === "linked" ? linked.itemId : null;
      const capturedCube =
        capturedSource === "virtual"
          ? {} // no physical cube — the simulator is not in your hand
          : cubeAttribution(
              resolveActiveCube(
                collectionData,
                capturedPuzzleType,
                activeByEvent,
                latestCubeIdForEvent(solvesRef.current, capturedPuzzleType),
                cubeCandidates,
                hardwareItemId,
              ),
            );

      const pbResult = detectPbMilestones(
        solvesRef.current,
        time,
        penalty,
        capturedPuzzleType,
      );
      if (pbResult.types.length > 0) {
        hapticCelebrate();
        // PB audio is gated by the audio master switch and the per-celebration
        // toggle (Settings → Audio) — notifications master no longer silences
        // sound.
        if (pbCelebrationAudio && soundsEnabled) {
          globalAudioSystem.setVolume(soundVolume);
          globalAudioSystem.playPbFanfare(pbResult.types);
        }
        if (pbCelebrationAnimation && notificationsEnabled) {
          onPbMilestone(pbResult);
        }
      } else {
        onPbMilestone(null);
      }

      // Save with raw moves immediately so replay/timeline have data from the
      // first render. The background job later replaces them with compacted
      // moves and computed metrics.
      const savePromise = addSolve({
        id: solveId,
        time,
        scramble: scrambleDisplay ? capturedScramble : "",
        penalty,
        method: capturedPersistedMethod,
        ...capturedCube,
        source: capturedSource,
        moves: rawMoves,
        orientationTimeline: rawOrientationTimeline,
        puzzleType: capturedPuzzleType,
      });
      savePromise
        .then((returnedId) => {
          if (!returnedId) {
            console.warn('[handleComplete] addSolve returned null — solve NOT saved to DB!');
            toast.error(i18n.t("toast:solveNotSavedDb"));
            return;
          }
          latestSavedTokenRef.current = Math.max(latestSavedTokenRef.current, completionToken);
          capturedNextScramble();

          // Analysis is intentionally independent from the save continuation.
          // It waits for this exact insert, then patches this exact solve.
          // Nothing here depends on a global "pending solve" ref.
          //
          // Deep phase analysis is 3×3-only (analysis-engine's PhaseSplitter
          // + CFOP/Roux/ZZ/Petrus definitions on a 54-sticker CubeState).
          // 2×2 virtual solves keep their moves for the replay but skip it —
          // running the 3×3 pipeline would persist meaningless metrics.
          if (rawMoves.length > 0 && capturedPuzzleType === "333") {
            queueSolveAnalysis(
              {
                solveId,
                save: savePromise,
                analyze: async () =>
                  runAnalysis(
                    rawMoves,
                    capturedScramble,
                    capturedMethod,
                    _rawOrientations,
                    time,
                  ),
                onResult: async ({ metrics: analysis, compactedMoves, compactedOrientationTimeline }) => {
                  if (latestSavedTokenRef.current === completionToken) {
                    setLastAnalysis(analysis);
                  }
                  if (isDev()) {
                    console.log(
                      '%c[App] Persisting moves+analysis to solve %s · %d raw → %d compacted',
                      'color:#38bdf8',
                      solveId.slice(0, 8),
                      rawMoves.length,
                      compactedMoves.length,
                    );
                  }
                  await updateSolve(solveId, {
                    moves: compactedMoves,
                    orientationTimeline: compactedOrientationTimeline,
                    analysis,
                  });
                },
              },
              (err) => {
                console.error(`[App] Background analysis failed for solve ${solveId}:`, err);
              },
            );
          }
        })
        .catch((err) => {
          console.error('[handleComplete] addSolve threw:', err);
          toast.error(i18n.t("toast:solveSaveFailed"));
        });
    },
    [
      addSolve,
      currentScramble,
      methodPref,
      notificationsEnabled,
      onNextScramble,
      onPbMilestone,
      pbCelebrationAnimation,
      pbCelebrationAudio,
      puzzle,
      scrambleDisplay,
      smartCubeConnectedRef,
      solvesRef,
      soundVolume,
      soundsEnabled,
      updateSolve,
    ],
  );
  // (Store reads above are already stable selectors — the memoized callback
  // keeps the prefs that matter in its dependency array.)

  return { handleComplete, lastAnalysis };
}
