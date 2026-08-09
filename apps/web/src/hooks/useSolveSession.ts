"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "zustand";
import type { TimerState, Penalty, SolveMethod } from "@/types";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { mapTimerState } from "@/utils/timerState";
import { useTimerKeyboard } from "@/hooks/useTimerKeyboard";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { globalAudioSystem } from "@/utils/audioSystem";
import { hapticStart, hapticStop } from "@/utils/haptics";
import { preferencesStore, orientationStore } from "@cubeforge/state";
import {
  StackmatAdapter,
  GanTimerAdapter,
  type HardwareTimerAdapter,
  type HardwareTimerEvent,
} from "@cubeforge/hardware-hal";
import {
  useScrambleValidator,
  type ScrambleValidationResult,
} from "@/hooks/useScrambleValidator";
import { shouldAutoArm } from "@/hooks/shouldAutoArm";
import { resolveIdlePress } from "@/hooks/pressDispatch";
import {
  moveNotation,
  logSolveDiagnostic,
  logBleAudit,
  type BleAuditEntry,
} from "@/hooks/solveSessionDebug";
import type {
  CubeMoveDirection,
  CubeMoveEvent,
  CubeOrientation,
  OrientationTimeline,
  SolveMetrics,
} from "@cubeforge/types";
import { analyzeSolve } from "@cubeforge/analysis-engine";
import {
  compactCubeMoves,
  compactOrientationTimeline,
  CubeState,
  FaceletStringConverter,
  MoveTransformer,
  SOLVED_FACELETS,
} from "@cubeforge/math-core";

export interface UseSolveSessionOptions {
  /**
   * Called when a solve completes (timer stops).
   *
   * Receives the raw collected moves, orientations, and orientation
   * timeline so the caller can persist them immediately. The analysis
   * pipeline runs separately and updates the solve with compacted moves
   * and computed metrics.
   */
  onSolve?: (
    time: number,
    penalty: Penalty,
    moves: CubeMoveEvent[],
    orientations: (CubeOrientation | undefined)[],
    orientationTimeline: OrientationTimeline | undefined,
  ) => void;
  /**
   * Optional ref that disables global keyboard shortcuts (space key)
   * when its current value is true. Used to prevent the practice timer
   * from interfering with training views that have their own timer.
   */
  keyboardDisabledRef?: React.MutableRefObject<boolean>;
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
  /** Compact orientation timeline for persistent storage (IMU solves only). */
  lastSolveOrientationTimeline: OrientationTimeline | undefined;
}

// End-of-solve diagnostic logging lives in `solveSessionDebug.ts` (opt-in
// via `?cfop_debug=1` / localStorage, or automatic on localhost dev).

/**
 * Runs the analysis pipeline on collected moves after a solve.
 *
 * Intentionally async so it never blocks the main thread during the
 * solve completion flow.
 */
async function runAnalysis(
  moves: CubeMoveEvent[],
  scramble: string,
  method: SolveMethod,
  orientations?: (CubeOrientation | undefined)[],
  solveTimeMs?: number,
): Promise<{ metrics: SolveMetrics; compactedMoves: CubeMoveEvent[]; compactedOrientationTimeline: OrientationTimeline | undefined } | null> {
  if (moves.length === 0) return null;

  try {
    // Compact consecutive same-face same-direction moves (D + D → D2)
    // before feeding the analysis pipeline. The GAN Gen2 protocol has no
    // native 180° encoding, so physical half-turns are reported as two
    // 90° events. Compacting here keeps move counts, TPS, and phase
    // boundaries honest.
    //
    // CRITICAL: We return the compacted moves so the caller can persist
    // them as the single source of truth. This guarantees that
    // solve.moves.length === analysis.totalMoves at all times.
    const compacted = compactCubeMoves(moves, orientations);

    // UNIFIED PIPELINE (Fase 5): delegate the WHOLE detection + metrics
    // to `analyzeSolve` — the same shared core the reconstruction text
    // route uses (build → solveTimeMs → color-neutral split → P2 frame
    // recovery → MetricsAggregator). Nothing here re-implements detection.
    // The initial state is seeded from the scramble — the SAME scramble the
    // ReplayEngine uses, guaranteeing analysis and replay start from
    // identical states. Color-neutral detection is always on (any cross
    // face is recognized); P2 frame recovery is a no-op for physical
    // solves (a solved cube ends canonically solved).
    const { timeline, metrics } = await analyzeSolve({
      moves: compacted.moves,
      method,
      scramble,
      orientations: compacted.orientations,
      solveTimeMs,
    });

    // End-of-solve diagnostic. Gated behind URL/localStorage flag
    // (?cfop_debug=1 or localStorage.cubeforge:cfop-debug="1") so
    // production consoles stay clean.
    logSolveDiagnostic({
      moves,
      scramble,
      method,
      timeline,
      metrics,
    });

    // Build orientation timeline from COMPACTED orientations so indices
    // match the compacted moves array. This guarantees that replay and
    // analysis see the same orientation at each move index.
    const compactedOrientationTimeline = compactOrientationTimeline(compacted.orientations);

    return { metrics, compactedMoves: compacted.moves, compactedOrientationTimeline };
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
  const scrambleDisplayPref = useStore(preferencesStore, (s) => s.scrambleDisplay);
  const scrambleVerificationRaw = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const scrambleVerificationPref = scrambleDisplayPref && scrambleVerificationRaw;
  const methodPref = useStore(preferencesStore, (s) => s.method);
  const voiceTypePref = useStore(preferencesStore, (s) => s.voiceType);
  const hardwareTimerPref = useStore(preferencesStore, (s) => s.hardwareTimer);
  const spacebarHoldDelayPref = useStore(preferencesStore, (s) => s.spacebarHoldDelay);

  const engine = useMemo(
    () =>
      new TimerEngine({
        useInspection: inspectionPref,
        holdToStartDelay: spacebarHoldDelayPref,
      }),
    [inspectionPref, spacebarHoldDelayPref],
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

  // ── BLE deduplication: tracks the last processed cubeTimestamp + face +
  //     direction to filter hardware-level retransmits. The GAN BLE stack
  //     sometimes sends the exact same physical MOVE event twice with
  //     identical cubeTimestamp. Including face+direction in the check
  //     protects against firmware that sends static cubeTimestamp=0.
  //     Reset on IDLE so each solve starts fresh. Do NOT reset on RUNNING —
  //     doing so creates a race window where the first solve move's
  //     duplicate bypasses the filter (the ref was just cleared to null).
  const lastCubeTimestampRef = useRef<number | null>(null);
  const lastMoveFaceRef = useRef<string | null>(null);
  const lastMoveDirRef = useRef<number | null>(null);

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

  // ── Orientation timeline compression (for persistent storage) ────────────
  const lastSolveOrientationTimelineRef = useRef<OrientationTimeline | undefined>(undefined);
  const [lastSolveOrientationTimeline, setLastSolveOrientationTimeline] = useState<OrientationTimeline | undefined>(undefined);

  // ── Pending first solve move(s) — arrives in IDLE during the ~16ms race
  //   between isScrambled=true and the auto-arm effect. Buffered here as an
  //   ARRAY because the user may start with a double-turn (e.g. D2 = two
  //   consecutive D90° BLE events). A single-ref buffer would overwrite the
  //   first event with the second, losing it.  All buffered moves are
  //   replayed when the engine enters RUNNING (via the state$ subscription).
  const pendingMovesBufferRef = useRef<CubeMoveEvent[]>([]);

  // ── Full BLE move audit log ──────────────────────────────────────────
  const bleAuditLogRef = useRef<BleAuditEntry[]>([]);
  const bleAuditCounterRef = useRef(0);

  // Mirror validation.isScrambled into a ref so it can be read synchronously
  // from the move subscriber (which fires from a Subject callback BEFORE
  // React state has propagated). The move subscriber uses this to filter
  // out IDLE-buffered moves that are scramble-leaks — i.e. the last
  // scramble move arriving after the validator published isScrambled=true
  // but before engine.arm() actually fires the RFM state transition.
  // Without this filter, the scramble-leak is replayed as moves[0] and
  // inflates move counts by 1 per solve (e.g. 136 moves instead of ~30).
  const isScrambledRef = useRef(false);
  useEffect(() => {
    isScrambledRef.current = validation.isScrambled;
  }, [validation.isScrambled]);

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
        // Reset BLE dedup tracker for the next solve
        lastCubeTimestampRef.current = null;
        lastMoveFaceRef.current = null;
        lastMoveDirRef.current = null;
        // Reset BLE audit log for the next cycle
        bleAuditLogRef.current = [];
        bleAuditCounterRef.current = 0;
      }
      // Defensive: clear any stale IDLE-buffered pending moves whenever the
      // engine arms (inspection/RFM/touching). This catches scramble-leak
      // noise that may have re-buffered itself after the initial
      // justScrambled effect. Without this, the pending replay on RUNNING
      // transition would push them back as solve moves.
      //
      // IMPORTANT: also undo ALL buffered moves from realCubeStateRef so the
      // tracker state matches the real cube. Each buffered move was applied
      // to the tracker in the IDLE branch but is NOT a solve move — it's a
      // scramble-leak from the race window where isScrambledRef hadn't
      // propagated yet.  Undo in reverse order to correctly peel off each
      // layer.
      if (
        engineState === EngineState.INSPECTION ||
        engineState === EngineState.READY_FOR_MOVE ||
        engineState === EngineState.TOUCHING
      ) {
        const buf = pendingMovesBufferRef.current;
        if (buf.length > 0) {
          // ALWAYS clear the buffer on arm.  The buffer contains moves
          // that arrived in IDLE — these are either scramble-leaks
          // (last scramble moves arriving after isScrambled was set but
          // before the effect propagated) or pre-scramble noise.
          // Legitimate solve moves arrive AFTER the engine arms (in RFM
          // or RUNNING), never before.  Undo from realCubeStateRef and
          // discard.
          for (let bi = buf.length - 1; bi >= 0; bi--) {
            const buffered = buf[bi];
            const invDir: CubeMoveDirection =
              buffered.direction === 1 ? -1 : buffered.direction === -1 ? 1 : 2;
            realCubeStateRef.current.applySequence(
              MoveTransformer.moveToNotation(buffered.face, invDir),
            );
          }
          pendingMovesBufferRef.current = [];
        }
      }
      // capture the real cube state at the moment the timer starts
      // running. realCubeStateRef tracks all moves from connect, so this
      // clone is the scrambled state the solver is about to solve.
      if (engineState === EngineState.RUNNING) {
        // Subtle tactile pulse when the solve starts (touch regime only).
        hapticStart();
        // Replay ALL pending first solve moves that arrived during the
        // IDLE race window (if any). The move subscriber already took a
        // pre-apply snapshot for them (after undoing the buffered moves'
        // effect on realCubeStateRef), so we just push them into
        // collected-moves here.
        const buf = pendingMovesBufferRef.current;
        if (buf.length > 0) {
          for (const m of buf) {
            collectedMovesRef.current.push(m);
            collectedOrientationsRef.current.push(currentOrientationRef.current);
          }
          setCollectedMoves([...collectedMovesRef.current]);
          pendingMovesBufferRef.current = [];
        }
      }
      setPhase(mapTimerState(engineState));
    });
    const sub2 = engine.tick$.subscribe((t) => setTime(t));
    const sub3 = engine.stop$.subscribe((ev) => {
      // Short double-tap when the solve is finalized (touch regime only).
      hapticStop();
      setLastTime(ev.timeMs);
      setTime(ev.timeMs);
      lastSolveMovesRef.current = [...collectedMovesRef.current];
      lastSolveOrientationsRef.current = [...collectedOrientationsRef.current];
      setLastSolveMoves(lastSolveMovesRef.current);
      setLastSolveOrientations(lastSolveOrientationsRef.current);
      // Compress orientations to ultra-compact keyframe timeline for storage
      const timeline = compactOrientationTimeline(lastSolveOrientationsRef.current);
      lastSolveOrientationTimelineRef.current = timeline;
      setLastSolveOrientationTimeline(timeline);

      // ── BLE Audit Log dump ────────────────────────────────────────────
      // Dump the FULL BLE move audit log at solve-stop so the user can
      // compare every move the cube sent vs what the analysis received.
      // Opt-in via solveSessionDebug (URL/localStorage flags or dev mode).
      logBleAudit({
        auditLog: bleAuditLogRef.current,
        collected: collectedMovesRef.current,
        pendingMoves: pendingMovesBufferRef.current,
      });

      if (onSolveRef.current) {
        const uiPenalty: Penalty =
          ev.penalty === "NONE" ? "none" : (ev.penalty as "+2" | "DNF");
        // Pass the raw collected data so the caller can persist moves
        // immediately — before the async analysis pipeline completes.
        // This prevents the "0 moves" flash in replay/timeline widgets.
        onSolveRef.current(
          ev.timeMs,
          uiPenalty,
          lastSolveMovesRef.current,
          lastSolveOrientationsRef.current,
          lastSolveOrientationTimelineRef.current,
        );
      }
    });
    const sub4 = engine.inspectionWarning$.subscribe((warning) => {
      // Read fresh values from the store each time (avoids stale closures).
      // Inspection voice cues are gated by the audio-cue toggle AND the
      // master notifications/sound switches (Settings → Notifications).
      const prefs = preferencesStore.getState();
      if (!prefs.audioCues) return;
      if (!prefs.notificationsEnabled || !prefs.soundsEnabled) return;
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

  // ── Hardware timer (Stackmat / GAN Timer) integration ──────────────────
  // The adapter is created once and kept alive via a ref. On connect, it
  // subscribes to the adapter's events$ stream; on disconnect it tears
  // down cleanly. Events are mapped to engine calls:
  //   hardwareDown → handleDown() (hold to arm / stop)
  //   hardwareUp   → handleUp()   (start / cancel)
  //   hardwareReset → reset()
  const hwTimerRef = useRef<HardwareTimerAdapter | null>(null);
  const hwTimerSubRef = useRef<import("rxjs").Subscription | null>(null);

  useEffect(() => {
    // Clean up any existing hardware timer
    if (hwTimerSubRef.current) {
      hwTimerSubRef.current.unsubscribe();
      hwTimerSubRef.current = null;
    }
    if (hwTimerRef.current) {
      void hwTimerRef.current.disconnect();
      hwTimerRef.current = null;
    }

    const hwType = hardwareTimerPref;
    if (hwType === "none") return;

    const adapter: HardwareTimerAdapter =
      hwType === "stackmat" ? new StackmatAdapter() : new GanTimerAdapter();
    hwTimerRef.current = adapter;

    void adapter.connect().then(() => {
      // Subscribe to hardware events
      hwTimerSubRef.current = adapter.events$.subscribe((evt: HardwareTimerEvent) => {
        switch (evt.type) {
          case "hardwareDown":
            // emulate pressing the timer down
            engine.handleDown();
            break;
          case "hardwareUp":
            // emulate releasing the timer
            engine.handleUp();
            break;
          case "hardwareReset":
            engine.reset();
            setTime(0);
            break;
        }
      });
    }).catch((err) => {
      console.warn(`[HardwareTimer] Failed to connect ${hwType}:`, err);
    });

    return () => {
      if (hwTimerSubRef.current) {
        hwTimerSubRef.current.unsubscribe();
        hwTimerSubRef.current = null;
      }
      if (hwTimerRef.current) {
        void hwTimerRef.current.disconnect();
        hwTimerRef.current = null;
      }
    };
  }, [hardwareTimerPref, engine]);

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
      } else if (
        // Mode 1 (smart cube + scramble verification + inspection):
        // Auto-start inspection so the user does NOT need to press Space.
        // Without this path, the engine stays in IDLE and the
        // scramble-leak guard in the move subscriber (IDLE + isScrambledRef)
        // drops ALL solve moves — the timer never starts.
        smartCubeConnected &&
        scrambleVerificationPref &&
        inspectionPref &&
        engine.getState() === EngineState.IDLE
      ) {
        engine.startInspection();
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
      // ── BLE DEDUPLICATION: drop hardware-level retransmits ────────────
      // The GAN BLE stack occasionally sends the exact same physical move
      // twice with identical cubeTimestamp (the hardware's internal move
      // counter). Filtering here — before any state mutation — keeps
      // realCubeStateRef 100% in sync with the physical cube.
      //
      // Genuine 180° turns arrive as two 90° events with DIFFERENT
      // cubeTimestamps (the hardware increments per quarter-turn), so
      // they safely pass through and are later compacted by
      // compactCubeMoves.
      //
      // Guard: only dedup when cubeTimestamp is a valid number AND the
      // full (face, direction) tuple matches the previous move. The face+
      // direction check protects against firmware that sends static
      // cubeTimestamp=0 for every move (would otherwise drop all moves
      // after the first).
      if (
        move.cubeTimestamp != null &&
        lastCubeTimestampRef.current === move.cubeTimestamp &&
        lastMoveFaceRef.current === move.face &&
        lastMoveDirRef.current === move.direction
      ) {
        // Audit: log dropped dedup even though we return early
        bleAuditLogRef.current.push({
          move, notation: moveNotation(move), phase: 'dropped-dedup',
          engineState: EngineState[engine.getState()],
          isScrambledRef: isScrambledRef.current, bleIndex: bleAuditCounterRef.current++,
        });
        return; // hardware duplicate — drop silently
      }
      lastCubeTimestampRef.current = move.cubeTimestamp ?? null;
      lastMoveFaceRef.current = move.face;
      lastMoveDirRef.current = move.direction;

      const current = engine.getState();

      // GUARD: if in IDLE and the scramble validator has already confirmed
      // isScrambled=true, this move is a scramble-leak (settling noise or
      // the last scramble move emitted during the ~16ms race window). Drop
      // it entirely — do not apply to the tracker.
      if (current === EngineState.IDLE && isScrambledRef.current) {
        // Audit: log dropped scramble-leak
        bleAuditLogRef.current.push({
          move, notation: moveNotation(move), phase: 'dropped-leak',
          engineState: 'IDLE',
          isScrambledRef: true, bleIndex: bleAuditCounterRef.current++,
        });
        return;
      }

      // Track the real cube state from ALL legitimate moves, regardless of
      // timer state. This is the ground truth for timeline seeding — more
      // reliable than facelets because MOVE events are immediate (not
      // periodic).
      const notation = MoveTransformer.moveToNotation(move.face, move.direction);
      realCubeStateRef.current.applySequence(notation);

      // Buffer in IDLE (isScrambledRef may not have propagated yet — race
      // window). Multiple moves may arrive before the engine arms (e.g.
      // a double-turn D2 sent as two D90° events). The state subscription
      // will undo ALL buffered moves from the tracker if they turn out to
      // be scramble-leaks.
      if (current === EngineState.IDLE) {
        // Moves in IDLE when isScrambledRef is false are scramble moves
        // (the validator hasn't confirmed the scramble yet). Moves when
        // isScrambledRef is true would have been caught by the leak guard
        // above, so everything reaching here is pre-scramble or race-window.
        bleAuditLogRef.current.push({
          move, notation: moveNotation(move), phase: 'scramble',
          engineState: 'IDLE',
          isScrambledRef: isScrambledRef.current, bleIndex: bleAuditCounterRef.current++,
        });
        pendingMovesBufferRef.current.push(move);
        return;
      }

      // Collect moves while running
      if (current === EngineState.RUNNING) {
        bleAuditLogRef.current.push({
          move, notation: moveNotation(move), phase: 'running',
          engineState: 'RUNNING',
          isScrambledRef: isScrambledRef.current, bleIndex: bleAuditCounterRef.current++,
        });
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
        bleAuditLogRef.current.push({
          move, notation: moveNotation(move), phase: 'rfm-start',
          engineState: EngineState[current],
          isScrambledRef: isScrambledRef.current, bleIndex: bleAuditCounterRef.current++,
        });
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

  // ── Audio system: voice type + volume sync ───────────────────────────────
  // Sync the voice type preference to the global audio system whenever it
  // changes. The Web Speech API will use a voice matching the selected type.
  // Volume comes from Settings → Notifications and scales every playback.
  const soundVolumePref = useStore(preferencesStore, (s) => s.soundVolume);
  useEffect(() => {
    globalAudioSystem.setVoice(voiceTypePref);
    globalAudioSystem.setVolume(soundVolumePref);
  }, [voiceTypePref, soundVolumePref]);

  // ── Audio system: init on first user interaction ─────────────────────────
  // Browsers block audio playback until the user has interacted with the page.
  // This effect installs one-shot listeners on pointerdown and keydown to
  // initialise the embedded Audio objects at the earliest safe moment.
  useEffect(() => {
    const handler = () => {
      globalAudioSystem.init();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const press = useCallback(() => {
    let current = engine.getState();

    if (current === EngineState.STOPPED) {
      engine.reset();
      current = engine.getState();
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

    // Pure decision helper — exhaustive truth-table tests in
    // pressDispatch.test.ts lock the Mode 3 regression: with a Smart Cube
    // connected and Scramble Verification OFF, Space/tap must arm the cube
    // gate (READY_FOR_MOVE) even when Inspection (default ON) is enabled.
    // Otherwise the space key would launch the inspection ceremony and a
    // second press would start the timer without any cube move.
    const action = resolveIdlePress({
      smartCube: smartCubeConnected,
      scrambleVerif: scrambleVerificationPref,
      inspection: inspectionPref,
    });
    if (action === "arm") {
      engine.arm();
    } else if (action === "inspection") {
      engine.startInspection();
    } else {
      engine.handleDown();
    }
  }, [engine, inspectionPref, smartCubeConnected, scrambleVerificationPref]);

  const release = useCallback(() => {
    engine.handleUp();
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    setTime(0);
    setLastTime(null);
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

  useTimerKeyboard({
    onPress: press,
    onRelease: release,
    disabledRef: options.keyboardDisabledRef,
  });

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
    lastSolveOrientationTimeline,
  };
}

/** Re-export for consumers that need the analysis pipeline. */
export { runAnalysis };
