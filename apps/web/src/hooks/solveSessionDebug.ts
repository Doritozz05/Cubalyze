"use client";

/**
 * End-of-solve diagnostic logging for the solve session hook.
 *
 * Extracted from `useSolveSession.ts` to keep the orchestration hook focused.
 * Everything here is OPT-IN: it only logs when the user enables the debug
 * flags (URL `?cfop_debug=1` / `?moves_debug=1`, or localStorage keys
 * `cubeforge:cfop-debug` / `cubeforge:moves-debug`), or automatically on the
 * localhost Vite dev server. Production consoles stay clean by default.
 */

import type {
  CubeMoveDirection,
  CubeMoveEvent,
  SolveMetrics,
  SolveTimeline,
} from "@cubeforge/types";
import type { SolveMethod } from "@/types";
import { TimelineBuilder } from "@cubeforge/analysis-engine";
import {
  FaceletStringConverter,
  MoveTransformer,
} from "@cubeforge/math-core";
import { isLocalhost } from "@/utils/env";

// ── BLE Move Audit Log types ──────────────────────────────────────────
export type BleMovePhase =
  | "scramble"
  | "race-idle"
  | "dropped-dedup"
  | "dropped-leak"
  | "pending-idle"
  | "rfm-start"
  | "running";
export interface BleAuditEntry {
  move: CubeMoveEvent;
  notation: string;
  phase: BleMovePhase;
  engineState: string;
  isScrambledRef: boolean;
  bleIndex: number;
}

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
  const isAutoDev = isLocalhost() && import.meta.env.DEV;
  const cfop = readDebugFlag(["cfop_debug", "cfop-debug"]);
  const moves = readDebugFlag(["moves_debug", "moves-debug"]);
  // On localhost dev, CFOP debug logs are automatically ON.
  // In prod (Vercel / Tauri), debug is manual opt-in via ?cfop_debug=1 or localStorage.
  const cfopEffective = cfop.enabled || isAutoDev;
  // Use console.log (always-visible) NOT console.debug — Chrome hides
  // console.debug by default unless "Verbose" is enabled.

  if (isLocalhost() && import.meta.env.DEV) {
    console.log(
      "%c[CFOP Debug]%c init \u00b7 cfop=%s(%s) \u00b7 moves=%s(%s)",
      "color:#38bdf8;font-weight:bold",
      "color:inherit",
      cfopEffective ? "ON" : "off",
      isAutoDev && !cfop.enabled ? "dev" : cfop.source,
      moves.enabled ? "ON" : "off",
      moves.source,
    );
    // Only show the "how to enable" hint when logs are actually OFF.
    if (!cfopEffective) {
      console.log(
        '%c[CFOP Debug]%c end-of-solve logs OFF \u2014 turn on with ?cfop_debug=1, or localStorage.setItem("cubeforge:cfop-debug","1")',
        "color:#facc15;font-weight:bold",
        "color:inherit",
      );
    }
  }

  return { cfop: cfopEffective };
})();

export function isCFOPDebugEnabled(): boolean {
  // On localhost Vite dev server, diagnostic logs are automatically ON.
  // In production builds (Vercel, Tauri), debug is manual opt-in via URL or localStorage.
  if (isLocalhost() && import.meta.env.DEV) return true;
  return _debugInitState.cfop || readDebugFlag(["cfop_debug", "cfop-debug"]).enabled;
}

export function moveNotation(m: CubeMoveEvent): string {
  if (m.direction === -1) return `${m.face}'`;
  if (m.direction === 2) return `${m.face}2`;
  return m.face;
}

export function logSolveDiagnostic(args: {
  moves: CubeMoveEvent[];
  scramble: string;
  method: SolveMethod;
  timeline: SolveTimeline;
  metrics: SolveMetrics | null;
}): void {
  if (!isCFOPDebugEnabled()) return;
  const { moves, scramble, method, timeline, metrics } = args;
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
    seedSource: 'scramble',
    scrambleProvided: !!scramble,
  });

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
        },
        pll: {
          recognitionMs: cfop.pllRecognitionMs,
          executionMs: cfop.pllExecutionMs,
          tps: cfop.pllTPS,
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
      initialFacelets: preMove0Facelets,
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
 * Dumps the full BLE move audit log at solve-stop so the user can compare
 * every move the cube sent vs what the analysis received. Opt-in (see
 * {@link isCFOPDebugEnabled}).
 */
export function logBleAudit(args: {
  auditLog: BleAuditEntry[];
  collected: CubeMoveEvent[];
  pendingMoves: CubeMoveEvent[];
}): void {
  if (!isCFOPDebugEnabled()) return;
  const { auditLog, collected, pendingMoves } = args;

  console.groupCollapsed(
    '%c[BLE Audit] %d total BLE moves · %d collected solve moves · phases: %s',
    'color: #22d3ee; font-weight: bold',
    auditLog.length,
    collected.length,
    [...new Set(auditLog.map(e => e.phase))].join(', '),
  );

  const phaseBreakdown: Record<string, number> = {};
  for (const e of auditLog) {
    phaseBreakdown[e.phase] = (phaseBreakdown[e.phase] || 0) + 1;
  }
  console.log('%cPhase breakdown', 'color: #c084fc; font-weight: bold', phaseBreakdown);

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

  console.log(
    '%cCollected solve moves (%d):',
    'color: #c084fc; font-weight: bold',
    collected.length,
    collected.map((m, i) => ({ '#': i + 1, notation: moveNotation(m) })),
  );

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

  if (pendingMoves.length > 0) {
    console.warn(
      '%c⚠ %d moves still in pending buffer at solve-stop! These were NOT replayed.',
      'color: #fb923c; font-weight: bold',
      pendingMoves.length,
      pendingMoves.map(m => moveNotation(m)),
    );
  }

  console.groupEnd();
}
