"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "zustand";
import type { TimerState, Penalty, SolveMethod } from "@/types";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { globalAudioSystem } from "@/utils/audioSystem";
import { preferencesStore, orientationStore } from "@cubeforge/state";
import {
  useScrambleValidator,
  type ScrambleValidationResult,
} from "@/hooks/useScrambleValidator";
import { shouldAutoArm } from "@/hooks/shouldAutoArm";
import type { CubeMoveEvent, CubeOrientation, SolveMetrics } from "@cubeforge/types";
import {
  TimelineBuilder,
  PhaseSplitter,
  MetricsAggregator,
} from "@cubeforge/analysis-engine";
import {
  CFOPDefinition,
  CubeState,
  FaceletStringConverter,
  MoveTransformer,
  RouxFullDefinition,
  SOLVED_FACELETS,
  ZZDefinition,
  PetrusDefinition,
  type MethodDefinition,
} from "@cubeforge/math-core";

const METHOD_DEFS: Record<SolveMethod, MethodDefinition> = {
  CFOP: CFOPDefinition,
  Roux: RouxFullDefinition,
  ZZ: ZZDefinition,
  Petrus: PetrusDefinition,
};

export interface UseSolveSessionOptions {
  onSolve?: (time: number, penalty: Penalty) => void;
}

export interface UseSolveSessionResult {
  phase: TimerState;
  time: number;
  lastTime: number | null;
  press: () => void;
  release: () => void;
  reset: () => void;
  cancel: () => void;
  validation: ScrambleValidationResult;
  smartCubeConnected: boolean;
  inspection: boolean;
  scrambleVerification: boolean;
  /** The solving method from preferences. */
  method: SolveMethod;
  /** Collected moves from the current solve (cleared on reset). */
  collectedMoves: CubeMoveEvent[];
  /** Moves captured at solve stop (stable snapshot for analysis). */
  lastSolveMoves: CubeMoveEvent[];
  /** Orientations captured at solve stop (one per move, for RotationCounter). */
  lastSolveOrientations: (CubeOrientation | undefined)[];
  /** Real cube CubeState at solve start (move-tracked ground truth for phase detection). */
  lastSolveStartState: CubeState | null;
}

const mapEngineStateToUIState = (engineState: EngineState): TimerState => {
  switch (engineState) {
    case EngineState.IDLE:
      return "idle";
    case EngineState.INSPECTION:
      return "inspection";
    case EngineState.READY_FOR_MOVE:
      return "ready_for_move";
    case EngineState.TOUCHING:
      return "holding";
    case EngineState.READY:
      return "ready";
    case EngineState.RUNNING:
      return "running";
    case EngineState.COOLDOWN:
    case EngineState.STOPPED:
      return "stopped";
    default:
      return "idle";
  }
};

/**
 * Runs the analysis pipeline on collected moves after a solve.
 *
 * This is intentionally async (via setTimeout 0) to avoid blocking
 * the main thread during the solve completion flow.
 */
async function runAnalysis(
  moves: CubeMoveEvent[],
  scramble: string,
  method: SolveMethod,
  orientations?: (CubeOrientation | undefined)[],
  initialState?: CubeState,
): Promise<SolveMetrics | null> {
  if (moves.length === 0) return null;

  try {
    const methodDef = METHOD_DEFS[method];
    // Pass the move-tracked CubeState as the ground truth for the
    // initial state. This is more reliable than facelets (works on Gen2
    // cubes and in all modes). TimelineBuilder uses initialState first,
    // then falls back to initialFacelets, then scramble.
    // Enable color-neutral detection so any cross face is recognized.
    const timeline = TimelineBuilder.build(
      moves,
      method,
      orientations,
      scramble,
      undefined, // initialFacelets (deprecated in favour of initialState)
      initialState,
    );
    PhaseSplitter.splitAndAnnotate(timeline, methodDef, { colorNeutral: true });
    return await MetricsAggregator.computeAll(timeline, scramble);
  } catch (err) {
    console.error("[Analysis] Pipeline failed:", err);
    return null;
  }
}

/**
 * The single source of truth for the solve start-of-flow orchestration.
 *
 * New in EPIC 5: collects moves during Smart Cube solves and exposes
 * them for post-solve analysis. The analysis pipeline runs asynchronously
 * so it never blocks the timer UI.
 */
export function useSolveSession(
  scramble: string,
  options: UseSolveSessionOptions = {},
): UseSolveSessionResult {
  const inspectionPref = useStore(preferencesStore, (s) => s.inspection);
  const scrambleVerificationPref = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const methodPref = useStore(preferencesStore, (s) => s.method);

  const engine = useMemo(
    () => new TimerEngine({ useInspection: inspectionPref }),
    [inspectionPref],
  );

  const validation = useScrambleValidator(scramble, scrambleVerificationPref);

  const [phase, setPhase] = useState<TimerState>("idle");
  const [time, setTime] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [smartCubeConnected, setSmartCubeConnected] = useState(
    () => !!globalCubeAdapter.isConnected,
  );

  // ── Move collection buffer ────────────────────────────────────────────
  const collectedMovesRef = useRef<CubeMoveEvent[]>([]);
  const [collectedMoves, setCollectedMoves] = useState<CubeMoveEvent[]>([]);
  // Stable snapshot captured at solve stop — avoids race with IDLE clearing
  const lastSolveMovesRef = useRef<CubeMoveEvent[]>([]);
  const [lastSolveMoves, setLastSolveMoves] = useState<CubeMoveEvent[]>([]);

  // ── Orientation collection (one per move, for RotationCounter) ─────────
  const collectedOrientationsRef = useRef<(CubeOrientation | undefined)[]>([]);
  const lastSolveOrientationsRef = useRef<(CubeOrientation | undefined)[]>([]);
  const [lastSolveOrientations, setLastSolveOrientations] = useState<(CubeOrientation | undefined)[]>([]);
  const currentOrientationRef = useRef<CubeOrientation | undefined>(undefined);

  // ── Move-based CubeState tracker — deterministic, works on all GAN gens ──
  // Tracks the real cube state from ALL MOVE events (scramble + solve),
  // regardless of timer state. More reliable than facelets because MOVE
  // events are immediate and universal across all cube generations.
  // Initialised from the first FACELETS event (absolute state at connect),
  // then kept in sync move-by-move.
  const realCubeStateRef = useRef(new CubeState());
  const realCubeStateSeededRef = useRef(false);
  // Snapshot of realCubeStateRef at solve start (cloned when RUNNING fires).
  const solveStartStateRef = useRef<CubeState | null>(null);
  const [lastSolveStartState, setLastSolveStartState] = useState<CubeState | null>(null);

  // ── Pending first solve move — arrives in IDLE during the ~16ms race
  //   between isScrambled=true and the auto-arm effect. Buffered here and
  //   replayed when the engine enters RUNNING (via the state$ subscription).
  const pendingFirstMoveRef = useRef<CubeMoveEvent | null>(null);

  const onSolveRef = useRef(options.onSolve);
  useEffect(() => {
    onSolveRef.current = options.onSolve;
  });

  useEffect(() => {
    const sub1 = engine.state$.subscribe((engineState) => {
      if (engineState === EngineState.IDLE) {
        collectedMovesRef.current = [];
        collectedOrientationsRef.current = [];
        setCollectedMoves([]);
        // clear solve-start state so stale data doesn't leak into the
        // next solve.
        solveStartStateRef.current = null;
      }
      // capture the real cube state at the moment the timer starts
      // running. realCubeStateRef tracks all moves from connect, so this
      // clone is the scrambled state the solver is about to solve.
      if (engineState === EngineState.RUNNING) {
        solveStartStateRef.current = realCubeStateRef.current.clone();
        // replay the pending first move that arrived during the IDLE
        // race window (if any). This move is part of the solve but arrived
        // before the auto-arm effect armed the engine.
        if (pendingFirstMoveRef.current) {
          collectedMovesRef.current.push(pendingFirstMoveRef.current);
          collectedOrientationsRef.current.push(currentOrientationRef.current);
          setCollectedMoves([...collectedMovesRef.current]);
          pendingFirstMoveRef.current = null;
        }
      }
      setPhase(mapEngineStateToUIState(engineState));
    });
    const sub2 = engine.tick$.subscribe((t) => setTime(t));
    const sub3 = engine.stop$.subscribe((ev) => {
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      lastSolveMovesRef.current = [...collectedMovesRef.current];
      lastSolveOrientationsRef.current = [...collectedOrientationsRef.current];
      setLastSolveMoves(lastSolveMovesRef.current);
      setLastSolveOrientations(lastSolveOrientationsRef.current);
      // snapshot the move-tracked CubeState for analysis.
      setLastSolveStartState(solveStartStateRef.current);
      if (onSolveRef.current) {
        const uiPenalty: Penalty =
          ev.penalty === "NONE" ? "none" : (ev.penalty as "+2" | "DNF");
        onSolveRef.current(ev.timeMs, uiPenalty);
      }
    });
    const sub4 = engine.inspectionWarning$.subscribe((warning) => {
      if (warning === "8s") globalAudioSystem.play8s();
      if (warning === "12s") globalAudioSystem.play12s();
    });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      sub4.unsubscribe();
      engine.reset();
    };
  }, [engine]);

  // Smart Cube presence polling
  useEffect(() => {
    const update = () => setSmartCubeConnected(!!globalCubeAdapter.isConnected);
    update();
    const connSub = globalCubeAdapter.connectionStatus$?.subscribe((status) => {
      setSmartCubeConnected(status === 'connected');
    });
    return () => connSub?.unsubscribe();
  }, []);

  // Auto-arm logic
  const wasScrambledRef = useRef(false);
  useEffect(() => {
    const justScrambled = validation.isScrambled && !wasScrambledRef.current;
    wasScrambledRef.current = validation.isScrambled;

    if (justScrambled) {
      // If the engine is STOPPED (post-solve), reset to IDLE
      // BEFORE checking shouldAutoArm so the user doesn't have to press
      // Space manually. The shouldAutoArm guard (stateIsIdle) requires
      // IDLE, so reset must happen first. COOLDOWN blocks reset(), but
      // by the time the scramble completes the 500ms cooldown has expired.
      if (engine.getState() === EngineState.STOPPED) {
        engine.reset();
      }

      if (
        shouldAutoArm({
          smartCube: smartCubeConnected,
          scrambleVerif: scrambleVerificationPref,
          inspection: inspectionPref,
          stateIsIdle: engine.getState() === EngineState.IDLE,
        })
      ) {
        // arm() transitions to READY_FOR_MOVE. The NEXT cube move — which
        // is necessarily the user's FIRST solve move (the scramble validator
        // has already consumed every scramble move to set isScrambled=true) —
        // is captured by the READY_FOR_MOVE branch of the move wiring below.
        engine.arm();
      }
    }
  }, [
    validation.isScrambled,
    smartCubeConnected,
    scrambleVerificationPref,
    inspectionPref,
    engine,
  ]);

  // Smart Cube move wiring + move collection
  useEffect(() => {
    const adapter = globalCubeAdapter;
    if (!adapter.moves$) return;

    const moveSub = adapter.moves$.subscribe((move: CubeMoveEvent) => {
      const current = engine.getState();

      // Track the real cube state from ALL moves, regardless of timer
      // state. This is the ground truth for timeline seeding — more reliable
      // than facelets because MOVE events are immediate (not periodic).
      const notation = MoveTransformer.moveToNotation(move.face, move.direction);
      realCubeStateRef.current.applySequence(notation);

      // If a move arrives in IDLE (before auto-arm has fired), buffer
      // it as the pending first solve move. It will be replayed when the
      // engine enters RUNNING via the state$ subscription.
      if (current === EngineState.IDLE) {
        pendingFirstMoveRef.current = move;
        return;
      }

      // Collect moves while running
      if (current === EngineState.RUNNING) {
        collectedMovesRef.current.push(move);
        collectedOrientationsRef.current.push(currentOrientationRef.current);
        setCollectedMoves([...collectedMovesRef.current]);
      }

      // First solve move (auto-arm path) or a move during inspection:
      // start the timer and capture this move as part of the solve.
      // This branch handles the move that auto-arm was waiting for — it is
      // NOT a scramble move (the validator already finished the scramble).
      if (
        current === EngineState.INSPECTION ||
        current === EngineState.READY_FOR_MOVE
      ) {
        engine.handleSmartCubeStart();
        // Capture the move that triggered the start — it is part of the solve
        collectedMovesRef.current.push(move);
        collectedOrientationsRef.current.push(currentOrientationRef.current);
        setCollectedMoves([...collectedMovesRef.current]);
        return;
      }
    });

    let faceletSub: import("rxjs").Subscription | undefined;
    if (adapter.facelets$) {
      faceletSub = adapter.facelets$.subscribe(
        (f: string) => {
          // Seed the move-based CubeState tracker from the first
          // FACELETS event (absolute state at connect). Subsequent MOVE
          // events keep it in sync.
          if (!realCubeStateSeededRef.current) {
            try {
              const realState = FaceletStringConverter.fromFaceletString(f);
              realCubeStateRef.current = realState;
              realCubeStateSeededRef.current = true;
            } catch {
              // Facelets string may be invalid — ignore and keep tracking
              // from moves only (starting from solved assumption).
            }
          }
          const isSolved = SOLVED_FACELETS.test(f);
          if (isSolved && engine.getState() === EngineState.RUNNING) {
            engine.handleSmartCubeStop();
          }
        },
      );
    }

    return () => {
      moveSub.unsubscribe();
      faceletSub?.unsubscribe();
    };
  }, [engine]);

  // Track current orientation from the orientation store (for RotationCounter)
  useEffect(() => {
    const unsub = orientationStore.subscribe((state) => {
      currentOrientationRef.current = state.orientation;
    });
    return unsub;
  }, []);

  const press = useCallback(() => {
    const current = engine.getState();

    if (current === EngineState.STOPPED) {
      engine.reset();
      return;
    }

    if (
      current === EngineState.RUNNING ||
      current === EngineState.COOLDOWN
    ) {
      engine.handleDown();
      return;
    }

    if (
      current === EngineState.TOUCHING ||
      current === EngineState.READY
    ) {
      return;
    }

    if (current === EngineState.INSPECTION) {
      engine.handleDown();
      return;
    }

    if (current === EngineState.READY_FOR_MOVE) {
      engine.handleDown();
      return;
    }

    if (inspectionPref) {
      engine.startInspection();
    } else if (smartCubeConnected) {
      engine.arm();
    } else {
      engine.handleDown();
    }
  }, [engine, inspectionPref, smartCubeConnected]);

  const release = useCallback(() => {
    engine.handleUp();
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
  }, [engine]);

  const cancel = useCallback(() => {
    const current = engine.getState();
    if (
      current === EngineState.RUNNING ||
      current === EngineState.COOLDOWN ||
      current === EngineState.STOPPED
    ) {
      return;
    }
    engine.reset();
  }, [engine]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      release();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [press, release]);

  return {
    phase,
    time,
    lastTime,
    press,
    release,
    reset,
    cancel,
    validation,
    smartCubeConnected,
    inspection: inspectionPref,
    scrambleVerification: scrambleVerificationPref,
    method: methodPref,
    collectedMoves,
    lastSolveMoves,
    lastSolveOrientations,
    lastSolveStartState,
  };
}

/** Re-export for consumers that need the analysis pipeline. */
export { runAnalysis };
