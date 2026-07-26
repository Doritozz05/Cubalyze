"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "zustand";
import type { TimerState, Penalty, SolveMethod } from "@/types";
import { TimerEngine, TimerState as EngineState } from "@cubeforge/timer-engine";
import { globalCubeAdapter } from "@/components/Hardware/CubeConnector";
import { globalAudioSystem } from "@/utils/audioSystem";
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
import type {
  CubeMoveDirection,
  CubeMoveEvent,
  CubeOrientation,
  OrientationTimeline,
  SolveMetrics,
  SolveTimeline,
} from "@cubeforge/types";
import {
  TimelineBuilder,
  PhaseSplitter,
  MetricsAggregator,
} from "@cubeforge/analysis-engine";
import {
  CFOPDefinition,
  compactCubeMoves,
  compactOrientationTimeline,
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

// ── BLE Move Audit Log types ──────────────────────────────────────────
type BleMovePhase = 'scramble' | 'race-idle' | 'dropped-dedup' | 'dropped-leak' | 'pending-idle' | 'rfm-start' | 'running';
interface BleAuditEntry {
  move: CubeMoveEvent;
  notation: string;
  phase: BleMovePhase;
  engineState: string;
  isScrambledRef: boolean;
  bleIndex: number;
}

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

// ─── End-of-solve diagnostic logging ──────────────────────────────────────
// Opt-in. Enable with either:
//   • URL flag   → append `?cfop_debug=1` to the page URL, OR
//   • localStorage → set `cubeforge:cfop-debug` to `"1"` / `"true"`.
//
// Each solve ends with one collapsed `console.group` block at
// `[Analysis Diagnostic] Solve …`. Expand to see scramble, moves,
// initial/final state (cp/co/ep/eo + facelets), detected phases, and
// the full CFOP metric breakdown. Use this to investigate issues like
// "CFOP metrics all 0.00" — the log exposes whether the
// reconstruction reached a solved state, where (if at all) phases
// were detected, and the initial/final state strings for manual
// comparison.
// Two opt-in debug levels, both re-evaluated on every call so the user
// can toggle them at runtime (URL hash or localStorage) without reloading
// the page. Set on init: also printed to console so the user can see the
// current state at page load.
//
//   cfop_debug  → end-of-solve console.group with full diagnostic
//   cfop_debug -> end-of-solve console.log of phase breakdown
//                 move counts (BLE double-send, scramble moves leaking
//                 through IDLE race, etc.)
//
// Enable via URL `?cfop_debug=1` or `?moves_debug=1`, OR via localStorage
// `cubeforge:cfop-debug = "1"` / `cubeforge:moves-debug = "1"`.
type DebugSource = "none" | "url" | "localStorage";

function readDebugFlag(
  paramNames: string[],
): { enabled: boolean; source: DebugSource } {
  if (typeof window === "undefined") return { enabled: false, source: "none" };
  try {
    const params = new URLSearchParams(window.location.search);
    for (const name of paramNames) {
      if (params.has(name)) {
        const raw = params.get(name);
        if (raw === null || raw === "" || raw === "1" || raw === "true") {
          return { enabled: true, source: "url" };
        }
      }
    }
    for (const name of paramNames) {
      const stored = window.localStorage.getItem(`cubeforge:${name}`);
      if (stored === "1" || stored === "true") {
        return { enabled: true, source: "localStorage" };
      }
    }
  } catch {
    /* ignore */
  }
  return { enabled: false, source: "none" };
}

const _debugInitState = (() => {
  const isDev = import.meta.env.DEV;
  const cfop = readDebugFlag(["cfop_debug", "cfop-debug"]);
  const moves = readDebugFlag(["moves_debug", "moves-debug"]);
  // In dev mode, CFOP debug logs are always ON (no URL flag needed).
  const cfopEffective = cfop.enabled || isDev;
  // Use console.log (always-visible) NOT console.debug — Chrome hides
  // console.debug by default unless "Verbose" is enabled, which is why
  // users kept seeing nothing in the console.
   
  console.log(
    "%c[CFOP Debug]%c init \u00b7 cfop=%s(%s) \u00b7 moves=%s(%s)",
    "color:#38bdf8;font-weight:bold",
    "color:inherit",
    cfopEffective ? "ON" : "off",
    isDev && !cfop.enabled ? "dev" : cfop.source,
    moves.enabled ? "ON" : "off",
    moves.source,
  );
  // Only show the "how to enable" hint when logs are actually OFF — in dev
  // mode they're always on, so this message would be misleading.
  if (!cfopEffective) {
    console.log(
      '%c[CFOP Debug]%c end-of-solve logs OFF \u2014 turn on with ?cfop_debug=1, or localStorage.setItem("cubeforge:cfop-debug","1")',
      "color:#facc15;font-weight:bold",
      "color:inherit",
    );
  }
   
  return { cfop: cfopEffective };
})();

function isCFOPDebugEnabled(): boolean {
  // In dev mode (vite dev server), the end-of-solve diagnostic logs are
  // ALWAYS enabled — the user no longer needs ?cfop_debug=1 or the
  // localStorage flag. Production builds keep the opt-in gate so user
  // consoles stay clean.
  if (import.meta.env.DEV) return true;
  return _debugInitState.cfop || readDebugFlag(["cfop_debug", "cfop-debug"]).enabled;
}

function moveNotation(m: CubeMoveEvent): string {
  if (m.direction === -1) return `${m.face}'`;
  if (m.direction === 2) return `${m.face}2`;
  return m.face;
}

function logSolveDiagnostic(args: {
  moves: CubeMoveEvent[];
  scramble: string;
  method: SolveMethod;
  timeline: SolveTimeline;
  metrics: SolveMetrics | null;
  initialStateProvided: boolean;
}): void {
  if (!isCFOPDebugEnabled()) return;
  const { moves, scramble, method, timeline, metrics, initialStateProvided: _initialStateProvided } = args;
  const first = moves[0];
  const last = moves[moves.length - 1];
  const durationMs =
    first && last ? Math.max(0, last.hostTimestamp - first.hostTimestamp) : 0;

  const initialEntryState = TimelineBuilder.fromSnapshot(
    timeline.entries[0]?.state ?? { cp: [], co: [], ep: [], eo: [] },
  );
  const finalState = TimelineBuilder.fromSnapshot(
    timeline.entries[timeline.entries.length - 1]?.state ?? {
      cp: [], co: [], ep: [], eo: [],
    },
  );
  // The pre-move-0 state is what the analyzer had as initial — available
  // via the snapshot BEFORE move 0 was applied. Reconstruct from move 0 by
  // undoing its notation. (NOTE: this only works for the first move; if
  // there's a scramble-leak via pendingFirstMoveRef, undoing move 0 gives
  // you state BEFORE the leaked scramble move → ideally what the analyst
  // would want to see.)
  const postMove0Facelets = FaceletStringConverter.toFaceletString(initialEntryState);
  const finalFacelets = FaceletStringConverter.toFaceletString(finalState);
  const preMove0Facelets = (() => {
    try {
      const inverse = TimelineBuilder.fromSnapshot(
        timeline.entries[0]?.state ?? { cp: [], co: [], ep: [], eo: [] },
      );
      const m0 = timeline.entries[0]?.move;
      if (!m0) return postMove0Facelets;
      const invDir: CubeMoveDirection =
        m0.direction === 1 ? -1 : m0.direction === -1 ? 1 : 2;
      inverse.applySequence(
        MoveTransformer.moveToNotation(m0.face, invDir),
      );
      return FaceletStringConverter.toFaceletString(inverse);
    } catch {
      return postMove0Facelets;
    }
  })();
  const finalIsSolved = finalState.isSolved();

  const phases = timeline.phases.map((p) => ({
    name: p.phaseName,
    moves: `${p.startIndex + 1}–${p.endIndex + 1}`,
    moveCount: p.moveCount,
    durationMs: p.durationMs,
  }));
  const phaseSummary =
    phases.length === 0
      ? "(no phases detected!)"
      : phases.map((p) => `${p.name}(${p.moveCount}m)`).join(" → ");

  const labelStyle = "color: #c084fc; font-weight: bold";

   
  console.groupCollapsed(
    `%c[Analysis Diagnostic] Solve · ${moves.length} moves / ${(durationMs / 1000).toFixed(2)}s · method=${method} · %c${finalIsSolved ? "✓ reached solved" : "✗ did NOT reach solved"} · phases=${phases.length}`,
    "color: #38bdf8; font-weight: bold",
    finalIsSolved
      ? "color: #4ade80; font-weight: bold"
      : "color: #f87171; font-weight: bold",
  );

  console.log("%cScramble", labelStyle, scramble || "(empty)");

  // Always show the full move list (this is what the user explicitly asked
  // for: "para ver que ha ocurrido si se han perdido movimientos").
  // ── Per-move detail + duplicate detection ───────────────────────
  // Useful to find the source of inflated move counts (BLE double-send,
  // scramble moves leaking into solve, etc.). Duplicate detection:
  // same (face, direction) within 120ms of a previous move.
  const moveRows = moves.map((m, i) => {
    const dt =
      i === 0 ? 0 : Math.max(0, m.hostTimestamp - moves[i - 1].hostTimestamp);
    return {
      "#": i + 1,
      notation: moveNotation(m),
      face: m.face,
      direction: m.direction,
      t_ms: Math.round(m.hostTimestamp),
      dt_prev_ms: Math.round(dt),
    };
  });
  const duplicates: Array<{
    duplicate_index: number;
    first_index: number;
    delta_ms: number;
  }> = [];
  const DUP_WINDOW_MS = 120;
  for (let i = 0; i < moves.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      const dt = moves[i].hostTimestamp - moves[j].hostTimestamp;
      if (dt > DUP_WINDOW_MS) break;
      if (
        moves[i].face === moves[j].face &&
        moves[i].direction === moves[j].direction
      ) {
        duplicates.push({
          duplicate_index: i + 1,
          first_index: j + 1,
          delta_ms: Math.round(dt),
        });
        break;
      }
    }
  }
  const movesPerFace: Record<string, number> = {};
  for (const m of moves) {
    const key = `${m.face}${moveNotation(m).slice(1)}`;
    movesPerFace[key] = (movesPerFace[key] || 0) + 1;
  }

  console.log(
    `%cMoves (${moves.length}) notation`,
    labelStyle,
    moves.map(moveNotation).join(" ") || "(none)",
  );
  console.log("%cMoves per face/direction", labelStyle, movesPerFace);
  if (moves.length <= 200) {
    console.log(
      "%cPer-move detail (#, notation, t_ms, dt_prev_ms)",
      labelStyle,
      moveRows,
    );
  } else {
    // Avoid spamming huge arrays — just first 20 + last 5.
    console.log(
      `%cPer-move detail (#, notation, t_ms, dt_prev_ms) — ${moves.length} moves, showing head + tail`,
      labelStyle,
      moveRows.slice(0, 20).concat(moveRows.slice(-5)),
    );
  }
  if (duplicates.length > 0) {
    console.log(
      "%c⚠ Duplicate moves (same face+direction within 120ms)",
      "color: #fb923c; font-weight: bold",
      duplicates,
    );
  }
  if (first) {
    console.log("%cFirst move", labelStyle, {
      ...first,
      notation: moveNotation(first),
    });
  }
  if (last && last !== first) {
    console.log("%cLast move", labelStyle, {
      ...last,
      notation: moveNotation(last),
    });
  }
  console.log(
    "%cTime range",
    labelStyle,
    first && last
      ? `[${first.hostTimestamp.toFixed(0)}ms → ${last.hostTimestamp.toFixed(0)}ms] = ${durationMs.toFixed(0)}ms`
      : "(n/a)",
  );

  console.log("%cInput sources", labelStyle, {
    method,
    colorNeutralDetection: true,
    seedSource: 'scramble', // deterministic — same source as ReplayEngine
    scrambleProvided: !!scramble,
  });

  // Log BOTH pre-move-0 (what the analyzer was seeded with) and
  // post-move-0 (the state at timeline.entries[0]) so the user can verify
  // whether move 0 was a real solve move or a scramble-leak from the
  // IDLE → READY_FOR_MOVE race.
  console.log("%cPre-move-0 state (analyzer seed)", labelStyle, {
    facelets: preMove0Facelets,
    note: "Reconstructed by undoing move 0 from timeline.entries[0].state. If the scramble validator already published isScrambled=true before the cube sent m0, this is the post-scramble state. If there was an IDLE→RFM race, this is state BEFORE that move.",
  });

  console.log("%cState at timeline.entries[0] (post move 0)", labelStyle, {
    cp: Array.from(initialEntryState.cp),
    co: Array.from(initialEntryState.co),
    ep: Array.from(initialEntryState.ep),
    eo: Array.from(initialEntryState.eo),
    facelets: postMove0Facelets,
    isSolved: initialEntryState.isSolved(),
    note: "Snapshot AFTER applying the FIRST logged move. Compare with pre-move-0 above: if they differ, a move was applied (as it should). If they match, the move was a no-op (cube saw same state twice).",
  });

  console.log("%cFinal state (Timeline entry N)", labelStyle, {
    cp: Array.from(finalState.cp),
    co: Array.from(finalState.co),
    ep: Array.from(finalState.ep),
    eo: Array.from(finalState.eo),
    facelets: finalFacelets,
    isSolved: finalIsSolved,
  });

  console.log("%cPhases detected", labelStyle, {
    summary: phaseSummary,
    detail: phases,
  });

  if (metrics) {
    console.log("%cAggregate metrics", labelStyle, {
      totalTimeMs: metrics.totalTimeMs,
      totalMoves: metrics.totalMoves,
      tps: metrics.tps,
      pauses: {
        count: metrics.pauses.totalCount,
        totalPauseTimeMs: metrics.pauses.totalPauseTimeMs,
        ratio: metrics.pauses.pauseRatio,
      },
      rotation: metrics.rotation
        ? {
            count: metrics.rotation.totalCount,
            byAxis: metrics.rotation.byAxis,
            estimatedTimeMs: metrics.rotation.estimatedRotationTimeMs,
          }
        : null,
      redundancy: metrics.redundancy
        ? {
            total: metrics.redundancy.totalRedundancies,
            rate: metrics.redundancy.redundancyRate,
          }
        : null,
    });
    if (metrics.cfop) {
      const cfop = metrics.cfop;
      console.log("%cCFOP details", labelStyle, {
        crossEfficiency: cfop.crossEfficiency,
        crossMoves: cfop.crossMoves,
        crossTPS: cfop.crossTPS,
        crossToF2LTransitionMs: cfop.crossToF2LTransitionMs,
        f2lPairs: cfop.f2lPairs.length,
        f2lLookaheadScore: cfop.f2lLookaheadScore,
        f2lPairTimes: cfop.f2lPairs.map((p) => `${p.timeMs}ms`),
        oll: {
          recognitionMs: cfop.ollRecognitionMs,
          executionMs: cfop.ollExecutionMs,
          tps: cfop.ollTPS,
          algorithmId: cfop.ollAlgorithmId,
        },
        pll: {
          recognitionMs: cfop.pllRecognitionMs,
          executionMs: cfop.pllExecutionMs,
          tps: cfop.pllTPS,
          algorithmId: cfop.pllAlgorithmId,
        },
      });
    } else {
      console.log(
        "%cCFOP details",
        labelStyle,
        "(none — method is not CFOP, or phase split returned 0 phases)",
      );
    }
  } else {
    console.log("%cMetrics", labelStyle, "(analysis pipeline failed)");
  }

  // Sanity warnings. These cover exactly the symptoms the user is
  // seeing: "CFOP all 0.00", "weird 11s cross / 11s F2L", "85 moves".
  const warnings: string[] = [];
  if (moves.length === 0) warnings.push("moves.length = 0");
  if (timeline.phases.length === 0 && moves.length > 0) {
    warnings.push(
      "no phases detected — reconstruction is likely wrong (initial state offset, wrong scramble, or lost moves)",
    );
  }
  if (!finalIsSolved && moves.length > 0) {
    warnings.push(
      "final state is NOT solved — reconstruction diverged from real cube (compare last 9 facelets above with the STOP facelets your cube sent)",
    );
  }
  if (metrics && metrics.cfop && timeline.phases.length > 0) {
    if (metrics.cfop.crossEfficiency === 0 && metrics.cfop.crossMoves === 0) {
      warnings.push(
        "Cross efficiency 0.00 with phases present — Cross phase likely matched on the wrong face (greedy lock) or at the wrong move",
      );
    }
  }
  if (duplicates.length > 0) {
    warnings.push(
      `${duplicates.length} duplicate moves within 120ms — likely BLE retransmits. Inflates TPS/wrong phase boundaries.`,
    );
  }
  if (warnings.length > 0) {
    console.warn(
      "%c[Analysis Diagnostic] Warnings",
      "color: #facc15; font-weight: bold",
      warnings,
    );
  }

  // Expose for ad-hoc inspection from the DevTools console.
  try {
    type DebugGlobal = { __cubeforgeLastSolve__?: unknown };
    const w = window as unknown as DebugGlobal;
    w.__cubeforgeLastSolve__ = {
      moveCount: moves.length,
      moves,
      moveNotations: moves.map(moveNotation),
      duplicateCount: duplicates.length,
      duplicates,
      movesPerFace,
      phaseNames: timeline.phases.map((p) => p.phaseName),
      finalIsSolved,
      // pre-move-0 state = the cube state the analyzer was seeded with
      // (reconstructed by undoing move 0 from entries[0].state).
      // This is what Time-lineBuilder’s analys-sis trajectory STARTS from.
      initialFacelets: preMove0Facelets,
      // Post-move-0 state = state at entries[0] (after applying first move).
      // Provided for debugging the IDLE → RUNNING race: if pre/post are
      // virtually identical, the first move was a no-op (or duplicate).
      postMove0Facelets,
      finalFacelets,
      firstMoveGapMs:
        moves.length >= 2
          ? Math.max(0, moves[1].hostTimestamp - moves[0].hostTimestamp)
          : null,
    };
  } catch {
    /* SSR / no window */
  }

  console.groupEnd();
   
}

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
): Promise<{ metrics: SolveMetrics; compactedMoves: CubeMoveEvent[]; compactedOrientationTimeline: OrientationTimeline | undefined } | null> {
  if (moves.length === 0) return null;

  try {
    const methodDef = METHOD_DEFS[method];

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

    // Pass the move-tracked CubeState as the ground truth for the
    // initial state. This is more reliable than facelets (works on Gen2
    // cubes and in all modes). TimelineBuilder uses initialState first,
    // then falls back to initialFacelets, then scramble.
    // Enable color-neutral detection so any cross face is recognized.
    // Initial state is now always derived from the scramble notation.
    // This is the SAME scramble the ReplayEngine uses, guaranteeing
    // analysis and replay start from identical initial states.
    const timeline = TimelineBuilder.build(
      compacted.moves,
      method,
      compacted.orientations,
      scramble,
    );
    PhaseSplitter.splitAndAnnotate(timeline, methodDef, { colorNeutral: true });
    const metrics = await MetricsAggregator.computeAll(timeline, scramble);

    // End-of-solve diagnostic. Gated behind URL/localStorage flag
    // (?cfop_debug=1 or localStorage.cubeforge:cfop-debug="1") so
    // production consoles stay clean.
    logSolveDiagnostic({
      moves,
      scramble,
      method,
      timeline,
      metrics,
      initialStateProvided: false,
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
  const scrambleVerificationPref = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const methodPref = useStore(preferencesStore, (s) => s.method);
  const voiceTypePref = useStore(preferencesStore, (s) => s.voiceType);
  const hardwareTimerPref = useStore(preferencesStore, (s) => s.hardwareTimer);

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
      // Compress orientations to ultra-compact keyframe timeline for storage
      const timeline = compactOrientationTimeline(lastSolveOrientationsRef.current);
      lastSolveOrientationTimelineRef.current = timeline;
      setLastSolveOrientationTimeline(timeline);

      // ── BLE Audit Log dump ────────────────────────────────────────────
      // Dump the FULL BLE move audit log at solve-stop so the user can
      // compare every move the cube sent vs what the analysis received.
      if (isCFOPDebugEnabled()) {
        const auditLog = bleAuditLogRef.current;
        const collected = collectedMovesRef.current;
         
        console.groupCollapsed(
          '%c[BLE Audit] %d total BLE moves · %d collected solve moves · phases: %s',
          'color: #22d3ee; font-weight: bold',
          auditLog.length,
          collected.length,
          [...new Set(auditLog.map(e => e.phase))].join(', '),
        );

        // Phase breakdown
        const phaseBreakdown: Record<string, number> = {};
        for (const e of auditLog) {
          phaseBreakdown[e.phase] = (phaseBreakdown[e.phase] || 0) + 1;
        }
        console.log('%cPhase breakdown', 'color: #c084fc; font-weight: bold', phaseBreakdown);

        // Full audit table
        if (auditLog.length <= 300) {
          console.log(
            '%cFull BLE audit (%d entries)',
            'color: #c084fc; font-weight: bold',
            auditLog.length,
            auditLog.map(e => ({
              '#': e.bleIndex + 1,
              notation: e.notation,
              phase: e.phase,
              engine: e.engineState,
              scrambled: e.isScrambledRef,
              cubeTs: e.move.cubeTimestamp,
              hostTs: Math.round(e.move.hostTimestamp),
            })),
          );
        } else {
          console.log(
            '%cFull BLE audit (%d entries, showing first 50 + last 20)',
            'color: #c084fc; font-weight: bold',
            auditLog.length,
            auditLog.slice(0, 50).concat(auditLog.slice(-20)).map(e => ({
              '#': e.bleIndex + 1,
              notation: e.notation,
              phase: e.phase,
              engine: e.engineState,
              scrambled: e.isScrambledRef,
            })),
          );
        }

        // Collected solve moves for comparison
        console.log(
          '%cCollected solve moves (%d):',
          'color: #c084fc; font-weight: bold',
          collected.length,
          collected.map((m, i) => ({ '#': i + 1, notation: moveNotation(m) })),
        );

        // Discrepancy check: collected moves vs audit "running" + "rfm-start" entries
        const expectedSolve = auditLog
          .filter(e => e.phase === 'running' || e.phase === 'rfm-start')
          .map(e => e.notation);
        const actualSolve = collected.map(moveNotation);
        const notationMatch = expectedSolve.length === actualSolve.length &&
          expectedSolve.every((n, i) => n === actualSolve[i]);
        console.log(
          `%cCollected vs Audit match: %c${notationMatch ? '✓ YES' : '✗ NO — DISCREPANCY DETECTED'}`,
          'color: #c084fc; font-weight: bold',
          notationMatch
            ? 'color: #4ade80; font-weight: bold'
            : 'color: #f87171; font-weight: bold',
        );
        if (!notationMatch) {
          console.log('%cExpected (from audit):', 'color: #f87171', expectedSolve.join(' '));
          console.log('%cActual (collected):', 'color: #f87171', actualSolve.join(' '));
        }

        // Pending buffer check
        const pendingBuf = pendingMovesBufferRef.current;
        if (pendingBuf.length > 0) {
          console.warn(
            '%c⚠ %d moves still in pending buffer at solve-stop! These were NOT replayed.',
            'color: #fb923c; font-weight: bold',
            pendingBuf.length,
            pendingBuf.map(m => moveNotation(m)),
          );
        }

        console.groupEnd();
         
      }

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
      // Read fresh value from store each time (avoids stale closure)
      const cues = preferencesStore.getState().audioCues;
      if (!cues) return;
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

  // ── Audio system: voice type sync ────────────────────────────────────────
  // Sync the voice type preference to the global audio system whenever it
  // changes. The Web Speech API will use a voice matching the selected type.
  useEffect(() => {
    globalAudioSystem.setVoice(voiceTypePref);
  }, [voiceTypePref]);

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
      if (options.keyboardDisabledRef?.current) return;
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
      if (options.keyboardDisabledRef?.current) return;
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
  }, [press, release, options.keyboardDisabledRef]);

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
