/**
 * @file Pure data-derivation utilities for the Insights dashboard.
 *
 * These functions transform raw solve data (`Solve`, `SolveMetrics`,
 * `CubeMoveEvent[]`) into the shapes the visualizations consume (timeline
 * segments, sparkline arrays, histogram bins, heatmap grids, TPS series,
 * pause-cause annotations). They are framework-agnostic and side-effect-free
 * so they're trivially unit-testable.
 */

import { effectiveTime } from "@/types";
import type { Solve } from "@/types";
import type {
  CubeMoveEvent,
  PauseDetail,
  PhaseMetrics,
} from "@cubeforge/types";
import type { PauseCategory } from "./phaseColors";

// ─── deriveTimeline ────────────────────────────────────────────────────────

/** A vertical move tick on the timeline SVG. */
export interface MoveTick {
  /** 0-based move index. */
  index: number;
  /** Time offset from solve start (ms). */
  offsetMs: number;
  /** Notation label, e.g. "R", "U'", "R2". */
  label: string;
  /** True if this move is a cube rotation (x/y/z). */
  isRotation: boolean;
  /** Phase name this move belongs to (if known). */
  phaseName?: string;
}

/** A TPS sample for the area-chart overlay. */
export interface TpsSample {
  /** Time offset from solve start (ms). */
  offsetMs: number;
  /** Turns per second at this point. */
  tps: number;
}

/** A pause marker on the timeline. */
export interface PauseMark {
  /** Start offset (ms). */
  startMs: number;
  /** End offset (ms). */
  endMs: number;
  /** Duration (ms). */
  durationMs: number;
  /** Phase where the pause occurred (the phase of the move BEFORE the gap). */
  phase: string;
  /** Position category. */
  category: PauseCategory;
  /** Human-readable probable cause (derived). */
  probableCause: string;
  /** Move index where the pause starts (the move BEFORE the gap). */
  startIndex: number;
  /** Move index where the pause ends (the move AFTER the gap). */
  endIndex: number;
}

/** Type of a unified timeline segment. */
export type TimelineSegmentKind = "phase" | "pause";

/**
 * A unified timeline segment — phase execution blocks and pause blocks,
 * all on the SAME x-axis derived from real move timestamps.
 *
 * The sum of every segment's `durationMs` equals `totalMs` exactly, so the
 * timeline reads as: `[Cross][transition pause][F2L][mid-phase pause][F2L][pre-algorithm pause][OLL][PLL]`.
 * Transition/pre-algorithm pauses live in the GAPS between phase blocks
 * (between the last move of one phase and the first move of the next),
 * not inside any phase.
 */
export interface TimelineSegment {
  /** Discriminator. */
  kind: TimelineSegmentKind;
  /** Start offset (ms) from solve start. */
  startMs: number;
  /** End offset (ms) from solve start. */
  endMs: number;
  /** Duration (ms). */
  durationMs: number;
  /** Human-readable label (phase name / pause cause). */
  label: string;
  /**
   * Phase name this segment belongs to. For `"phase"` it's the phase name;
   * for `"pause"` it's the phase the pause was attributed to (the phase
   * of the move before the gap).
   */
  phaseName?: string;
  /** For pauses: the category. */
  pauseCategory?: PauseCategory;
  /** For pauses: the probable cause. */
  probableCause?: string;
  /** For pauses: move index where the pause starts (the move before the gap). */
  moveStartIndex?: number;
  /** For pauses: move index where the pause ends (the move after the gap). */
  moveEndIndex?: number;
}

/** A phase segment rendered as a colored rectangle on the timeline. */
export interface StageSegment {
  phaseName: string;
  /** Start offset (ms). */
  startMs: number;
  /** End offset (ms). */
  endMs: number;
  /** Duration (ms). */
  durationMs: number;
  /** Move count in this phase. */
  moveCount: number;
  /** Average TPS for this phase. */
  tps: number;
}

/** Output of `deriveTimeline`. */
export interface TimelineData {
  /** Total solve duration (ms) = span from first to last move. */
  totalMs: number;
  /** Per-move ticks (with BLE hostTimestamp offsets, kept for TPS curve). */
  moveTicks: MoveTick[];
  /**
   * Visual position (ms) for each move, aligned with the unified segment
   * coordinate system. Moves within exec blocks are evenly distributed.
   * Use this for SVG move tick lines and hover nearest-move search.
   * Same length as `moveTicks`.
   */
  moveVisualMs: number[];
  /** Rolling-window TPS samples (end at the last move = `totalMs`). */
  tpsSamples: TpsSample[];
  /** Pause markers (with probable cause + move indices). */
  pauseMarks: PauseMark[];
  /** Phase segments derived from REAL move offsets (for the legend). */
  stageSegments: StageSegment[];
  /**
   * Unified segments that tile the entire timeline: phase-execution blocks
   * interleaved with pause blocks. All positioned using REAL move
   * timestamps (not cumulative analysis durations). Sum of all
   * `durationMs` === `totalMs` exactly. No "tail" block — the last phase
   * ends at the last move, same as the TPS curve.
   */
  segments: TimelineSegment[];
}

/** Notation for a single CubeMoveEvent (face + direction → "R", "U'", "R2"). */
function moveLabel(ev: CubeMoveEvent): string {
  const suffix = ev.direction === 2 ? "2" : ev.direction === -1 ? "'" : "";
  return `${ev.face}${suffix}`;
}

/**
 * Compute a rolling-window TPS series from raw move timestamps.
 * Uses a window of `windowSize` moves; TPS = windowSize / (time span of window).
 */
function rollingTps(timestamps: number[], windowSize = 4): TpsSample[] {
  if (timestamps.length < 2) return [];
  const base = timestamps[0];
  const samples: TpsSample[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const span = timestamps[i] - timestamps[start];
    if (span > 0) {
      const count = i - start + 1;
      samples.push({ offsetMs: timestamps[i] - base, tps: (count / span) * 1000 });
    }
  }
  return samples;
}

/**
 * Derive all timeline visualization data from a single solve.
 *
 * **`totalMs` is the span from the first to the last move** (not the timer
 * time `solve.time`). The timer time includes the post-last-move stop
 * reaction — the time between the last physical turn and pressing Space to
 * stop the timer — which is NOT part of the solve execution. Representing
 * it as a "Stop" block was misleading and made PLL appear to end before the
 * right edge of the timeline. Now the last phase block and the TPS curve
 * both end at the last move = `totalMs`, and they align perfectly.
 *
 * **All segments use REAL move-timestamp coordinates** (from
 * `moveTicks[i].offsetMs`), not cumulative `phase.durationMs`. This
 * eliminates the coordinate-system mismatch that caused transition pauses
 * to be misplaced (a pause at the Cross→F2L boundary was rendered inside
 * the Cross block, followed by a spurious Cross block).
 *
 * The returned `segments` tile the timeline: `[Cross][transition pause][F2L][mid-phase pause][F2L][pre-algorithm pause][OLL][PLL]`.
 * `Σ segments[i].durationMs === totalMs` exactly. No "tail" / "Stop" block.
 */
export function deriveTimeline(solve: Solve): TimelineData {
  const moves = solve.moves ?? [];
  const analysis = solve.analysis;

  const baseTime = moves.length > 0 ? moves[0].hostTimestamp : 0;
  // totalMs = move span (first→last move) when moves exist. This GUARANTEES
  // the last phase block and the TPS curve both end at the same x = totalMs,
  // with no "Stop"/tail gap. analysis.totalTimeMs is computed by the
  // pipeline as endTimestamp − startTimestamp (last move − first move), so
  // it equals the move span in practice — but we compute it directly from
  // moves to avoid any drift. Falls back to analysis/solve.time only for
  // manual entries with no moves.
  const totalMs =
    moves.length > 0
      ? moves[moves.length - 1].hostTimestamp - baseTime
      : (analysis?.totalTimeMs ?? solve.time);

  // Per-move ticks (offsets relative to solve start).
  const moveTicks: MoveTick[] = moves.map((ev, i) => ({
    index: i,
    offsetMs: ev.hostTimestamp - baseTime,
    label: moveLabel(ev),
    isRotation: false,
    phaseName: phaseForMove(analysis?.phases ?? [], i),
  }));

  // TPS samples: prefer the analysis instantaneousWindow if present,
  // otherwise compute a rolling window from raw timestamps. Both end at
  // the last move's offset = totalMs, so no tail extension is needed.
  const windowLen = analysis?.tps.instantaneousWindow?.length ?? 0;
  const tpsSamples: TpsSample[] =
    windowLen > 1
      ? analysis!.tps.instantaneousWindow!.map((tps, i) => ({
          offsetMs:
            i < moveTicks.length
              ? moveTicks[i].offsetMs
              : moves.length > 0
                ? (i / moves.length) * totalMs
                : (i / Math.max(1, windowLen)) * totalMs,
          tps,
        }))
      : rollingTps(moves.map((m) => m.hostTimestamp));

  // Flat 0-TPS baseline when there are no TPS samples (0-1 moves).
  const tpsFinal: TpsSample[] =
    tpsSamples.length === 0 && totalMs > 0
      ? [{ offsetMs: 0, tps: 0 }, { offsetMs: totalMs, tps: 0 }]
      : tpsSamples;

  // Phase runs: consecutive moves sharing the same phaseName. Each run's
  // time window = [firstMove.offsetMs, lastMove.offsetMs] using REAL
  // timestamps — no cumulative durationMs.
  const phaseRuns = computePhaseRuns(moveTicks);

  // Stage segments from REAL move offsets (for the legend + table).
  // Falls back to cumulative durationMs when there are no moves (e.g. a
  // solve with analysis loaded from DB but moves not yet hydrated).
  const stageSegments: StageSegment[] =
    phaseRuns.length > 0
      ? phaseRuns.map((run) => {
          const startMs = moveTicks[run.startIdx].offsetMs;
          const endMs = moveTicks[run.endIdx].offsetMs;
          const phase = analysis?.phases.find((p) => p.phaseName === run.phaseName);
          return {
            phaseName: run.phaseName,
            startMs,
            endMs,
            durationMs: Math.max(0, endMs - startMs),
            moveCount: run.endIdx - run.startIdx + 1,
            tps: phase?.tps ?? 0,
          };
        })
      : analysis
        ? buildStageSegments(analysis.phases, baseTime)
        : [];

  // Pause marks with move indices + real offsets.
  // Filter out pauses at or after the last move (post-solve "stop" gap).
  // The timeline now ends at the last move, so pauses beyond it would
  // collapse to zero width (startMs === endMs === totalMs).
  const pauseMarks: PauseMark[] = analysis
    ? analysis.pauses.pauses
        .filter((p) => moveTicks.length === 0 || p.startIndex < moveTicks.length - 1)
        .map((p) => ({
          startMs: p.startIndex < moveTicks.length ? moveTicks[p.startIndex].offsetMs : 0,
          endMs: p.endIndex < moveTicks.length ? moveTicks[p.endIndex].offsetMs : totalMs,
          durationMs: p.durationMs,
          phase: p.phase,
          category: p.category,
          probableCause: derivePauseCause(p, analysis.phases),
          startIndex: p.startIndex,
          endIndex: p.endIndex,
        }))
    : [];

  // Unified segments + visual move positions from a single pass so both
  // coordinate systems are derived from the same proportional distribution.
  const { segments, moveVisualMs } = buildUnifiedSegments(moveTicks, phaseRuns, pauseMarks, totalMs);

  // Reposition TPS samples to use visual move positions so the TPS curve
  // aligns with the visual segment timeline. Uses tpsFinal (which includes
  // the 0-TPS baseline fallback for 0-1 moves) as the source.
  const tpsSamplesVisual: TpsSample[] = tpsFinal.length > 0 && moveVisualMs.length > 0
    ? tpsFinal.map((s, i) => ({
        offsetMs: i < moveVisualMs.length ? moveVisualMs[i] : s.offsetMs,
        tps: s.tps,
      }))
    : tpsFinal;

  return { totalMs, moveTicks, moveVisualMs, tpsSamples: tpsSamplesVisual, pauseMarks, stageSegments, segments };
}

/** A run of consecutive moves belonging to the same phase. */
interface PhaseRun {
  phaseName: string;
  /** Index of the first move in this run. */
  startIdx: number;
  /** Index of the last move in this run (inclusive). */
  endIdx: number;
}

/**
 * Group consecutive moves by phaseName into runs. Each run is one phase
 * block on the timeline, bounded by REAL move offsets.
 */
function computePhaseRuns(moveTicks: MoveTick[]): PhaseRun[] {
  if (moveTicks.length === 0) return [];
  const runs: PhaseRun[] = [];
  let runStart = 0;
  let currentPhase = moveTicks[0].phaseName;
  for (let i = 1; i <= moveTicks.length; i++) {
    const phase = i < moveTicks.length ? moveTicks[i].phaseName : undefined;
    if (phase !== currentPhase) {
      if (currentPhase) {
        runs.push({ phaseName: currentPhase, startIdx: runStart, endIdx: i - 1 });
      } else if (runs.length > 0) {
        // Unassigned gap between valid phases: absorb into previous run
        // so no move gets left with moveVisualMs = 0 (which would cause
        // the TPS curve to jump backward).
        runs[runs.length - 1].endIdx = i - 1;
      }
      runStart = i;
      currentPhase = phase;
    }
  }
  // Absorb trailing unassigned moves into the last run, and leading
  // unassigned moves into the first run, so no move is left uncovered.
  if (runs.length > 0) {
    runs[runs.length - 1].endIdx = moveTicks.length - 1;
    if (runs[0].startIdx > 0) runs[0].startIdx = 0;
  }
  return runs;
}

/**
 * Build unified timeline segments.
 *
 * **Phase boundaries** still use moveTicks offsets (they're reliable —
 * inter-phase gaps are large enough to survive BLE batching).
 * **Mid-phase pause widths** use `durationMs` from the PauseDetector
 * instead of `moveTicks[end].offsetMs - moveTicks[start].offsetMs`,
 * because BLE packet batching compresses intra-phase hostTimestamp gaps
 * even when the cube's hardware clock records the correct pause duration.
 *
 * Exec (phase) blocks fill the remaining budget within each phase run,
 * distributed proportionally to move count so that phases with more moves
 * between pauses get wider exec blocks.
 */
function buildUnifiedSegments(
  moveTicks: MoveTick[],
  phaseRuns: PhaseRun[],
  pauseMarks: PauseMark[],
  totalMs: number,
): { segments: TimelineSegment[]; moveVisualMs: number[] } {
  const moveVisualMs = new Array<number>(moveTicks.length).fill(0);
  if (phaseRuns.length === 0) return { segments: [], moveVisualMs };

  const segments: TimelineSegment[] = [];

  for (let r = 0; r < phaseRuns.length; r++) {
    const run = phaseRuns[r];
    const phaseStartMs = moveTicks[run.startIdx].offsetMs;
    const nextPhaseStartMs =
      r + 1 < phaseRuns.length
        ? moveTicks[phaseRuns[r + 1].startIdx].offsetMs
        : totalMs;
    const phaseBudget = Math.max(0, nextPhaseStartMs - phaseStartMs);

    // ── Mid-phase pauses ─────────────────────────────────────────────
    const midPhasePauses = pauseMarks
      .filter((pm) => pm.startIndex >= run.startIdx && pm.startIndex < run.endIdx)
      .sort((a, b) => a.startMs - b.startMs);

    const boundaryPause = pauseMarks.find(
      (pm) => pm.startIndex === run.endIdx && r + 1 < phaseRuns.length,
    );

    // Total pause time from the analysis engine (correct), not from
    // moveTicks (BLE-compressed). Capped at phaseBudget so corrupted
    // data can't overflow past the phase boundary.
    const totalPauseMs = Math.min(
      phaseBudget,
      midPhasePauses.reduce((s, pm) => s + pm.durationMs, 0),
    );
    const totalExecMs = Math.max(0, phaseBudget - totalPauseMs);

    // Move counts per exec block (for proportional time distribution).
    const execMoveCounts: number[] = [];
    let prevEnd = run.startIdx;
    for (const pm of midPhasePauses) {
      // +1 includes the move at pm.startIndex — the last move executed
      // BEFORE this pause gap begins.
      execMoveCounts.push(pm.startIndex - prevEnd + 1);
      prevEnd = pm.endIndex;
    }
    // Final exec block: from last pause (or phase start) to the
    // boundary pause / phase end.
    execMoveCounts.push(
      (boundaryPause ? boundaryPause.startIndex : run.endIdx) - prevEnd + 1,
    );
    const totalExecMoves = execMoveCounts.reduce((s, c) => s + c, 0);

    let pos = phaseStartMs;
    // Separate index tracker for the rendering loop — prevEnd was already
    // advanced by the pre-computation pass above.
    let blkStart = run.startIdx;

    for (let i = 0; i < midPhasePauses.length; i++) {
      const pm = midPhasePauses[i];
      const execMs =
        totalExecMoves > 0 && totalExecMs > 0
          ? (execMoveCounts[i] / totalExecMoves) * totalExecMs
          : 0;

      if (execMs > 0) {
        // Assign visual positions to moves in this exec block (evenly
        // distributed). The block covers moves from blkStart to
        // pm.startIndex (inclusive).
        const execMoveCount = execMoveCounts[i];
        if (execMoveCount > 0) {
          const msPerMove = execMs / execMoveCount;
          for (let m = 0; m < execMoveCount; m++) {
            moveVisualMs[blkStart + m] = pos + m * msPerMove;
          }
        }
        segments.push({
          kind: "phase",
          startMs: pos,
          endMs: pos + execMs,
          durationMs: execMs,
          label: run.phaseName,
          phaseName: run.phaseName,
        });
        pos += execMs;
      }
      blkStart = pm.endIndex;

      // Mid-phase pause: visual width = analysis duration (correct).
      segments.push({
        kind: "pause",
        startMs: pos,
        endMs: pos + pm.durationMs,
        durationMs: pm.durationMs,
        label: pm.probableCause,
        phaseName: run.phaseName,
        pauseCategory: pm.category,
        probableCause: pm.probableCause,
        moveStartIndex: pm.startIndex,
        moveEndIndex: pm.endIndex,
      });
      pos += pm.durationMs;
    }

    // ── Final exec block + boundary pause ────────────────────────────
    const finalExecMs =
      totalExecMoves > 0 && totalExecMs > 0
        ? (execMoveCounts[execMoveCounts.length - 1] / totalExecMoves) * totalExecMs
        : 0;
    const finalMoveCount = execMoveCounts[execMoveCounts.length - 1];

    if (boundaryPause) {
      if (finalExecMs > 0) {
        if (finalMoveCount > 0) {
          const msPerMove = finalExecMs / finalMoveCount;
          for (let m = 0; m < finalMoveCount; m++) {
            moveVisualMs[blkStart + m] = pos + m * msPerMove;
          }
        }
        segments.push({
          kind: "phase",
          startMs: pos,
          endMs: pos + finalExecMs,
          durationMs: finalExecMs,
          label: run.phaseName,
          phaseName: run.phaseName,
        });
        pos += finalExecMs;
      }
      // Boundary pause fills the remaining gap to the next phase.
      const gapMs = Math.max(0, nextPhaseStartMs - pos);
      if (gapMs > 0) {
        segments.push({
          kind: "pause",
          startMs: pos,
          endMs: nextPhaseStartMs,
          durationMs: gapMs,
          label: boundaryPause.probableCause,
          phaseName: run.phaseName,
          pauseCategory: boundaryPause.category,
          probableCause: boundaryPause.probableCause,
          moveStartIndex: boundaryPause.startIndex,
          moveEndIndex: boundaryPause.endIndex,
        });
      }
    } else {
      // No boundary pause → fill the rest with exec time.
      const remaining = Math.max(0, nextPhaseStartMs - pos);
      if (remaining > 0) {
        if (finalMoveCount > 0) {
          const msPerMove = remaining / finalMoveCount;
          for (let m = 0; m < finalMoveCount; m++) {
            moveVisualMs[blkStart + m] = pos + m * msPerMove;
          }
        }
        segments.push({
          kind: "phase",
          startMs: pos,
          endMs: nextPhaseStartMs,
          durationMs: remaining,
          label: run.phaseName,
          phaseName: run.phaseName,
        });
      }
    }
  }

  return { segments, moveVisualMs };
}

/** Find the phase name for a given move index (inclusive ranges). */
function phaseForMove(phases: PhaseMetrics[], moveIndex: number): string | undefined {
  // PhaseMetrics doesn't carry start/end indices, so we reconstruct by
  // cumulative move counts.
  let cumulative = 0;
  for (const p of phases) {
    cumulative += p.moveCount;
    if (moveIndex < cumulative) return p.phaseName;
  }
  return undefined;
}

/** Build stage segments from PhaseMetrics, computing cumulative offsets. */
function buildStageSegments(phases: PhaseMetrics[], _baseTime: number): StageSegment[] {
  let offsetMs = 0;
  return phases.map((p) => {
    const seg: StageSegment = {
      phaseName: p.phaseName,
      startMs: offsetMs,
      endMs: offsetMs + p.durationMs,
      durationMs: p.durationMs,
      moveCount: p.moveCount,
      tps: p.tps,
    };
    offsetMs += p.durationMs;
    return seg;
  });
}

// ─── derivePauseCauses ─────────────────────────────────────────────────────

/** Heuristic cause for a pause, based on phase + category. */
export function derivePauseCause(
  pause: PauseDetail,
  phases: PhaseMetrics[],
): string {
  const phase = pause.phase.toLowerCase();
  const cat = pause.category;

  // Transition between phases.
  if (cat === "transition") {
    const idx = phases.findIndex((x) => x.phaseName === pause.phase);
    const next = idx >= 0 ? phases[idx + 1] : undefined;
    return next
      ? `${pause.phase} → ${next.phaseName} transition`
      : `${pause.phase} transition`;
  }

  // Pre-algorithm recognition (OLL/PLL/CMLL).
  if (cat === "pre-algorithm") {
    if (phase.includes("oll")) return "OLL recognition";
    if (phase.includes("pll")) return "PLL recognition";
    if (phase.includes("cmll")) return "CMLL recognition";
    if (phase.includes("lse") || phase.includes("lr")) return "LSE recognition";
    return `${pause.phase} algorithm recognition`;
  }

  // Mid-phase pause: look-ahead / pair search.
  if (phase.includes("f2l")) return "F2L pair recognition";
  if (phase.includes("cross")) return "Cross piece search";
  if (phase.includes("block")) return "Block building search";
  if (phase.includes("eoline") || phase.includes("eole")) return "Edge orientation";
  return `${pause.phase} hesitation`;
}

// ─── deriveSparkline ───────────────────────────────────────────────────────

/**
 * Last N effective times (oldest → newest) for a sparkline.
 * DNFs are excluded (they'd flatten the chart to Infinity).
 */
export function deriveSparkline(solves: Solve[], n = 20): number[] {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  return valid.slice(-n);
}

// ─── deriveHistogram ───────────────────────────────────────────────────────

/** A histogram bin. */
export interface HistogramBin {
  /** Bin label, e.g. "12.0–12.5". */
  label: string;
  /** Lower bound (ms). */
  fromMs: number;
  /** Upper bound (ms). */
  toMs: number;
  /** Count of solves in this bin. */
  count: number;
}

/**
 * Distribution of effective solve times into fixed-width bins.
 * DNFs are excluded. `binMs` defaults to 500ms (0.5s bins).
 */
export function deriveHistogram(solves: Solve[], binMs = 500): HistogramBin[] {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  if (valid.length === 0) return [];

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  // Ensure at least one bin even when min === max.
  const span = Math.max(binMs, max - min + 1);
  const binCount = Math.ceil(span / binMs);
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * binMs;
    const to = from + binMs;
    return {
      label: formatBinLabel(from, to),
      fromMs: from,
      toMs: to,
      count: 0,
    };
  });

  for (const t of valid) {
    let idx = Math.floor((t - min) / binMs);
    // Clamp the max value into the last bin.
    if (idx >= bins.length) idx = bins.length - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}

function formatBinLabel(fromMs: number, toMs: number): string {
  const from = (fromMs / 1000).toFixed(1);
  const to = (toMs / 1000).toFixed(1);
  return `${from}–${to}`;
}

// ─── deriveActivityHeatmap ─────────────────────────────────────────────────

/**
 * Daily solve counts (oldest first) for the activity heatmap.
 * Returns a flat array of length `weeks * 7` where index 0 = the oldest day
 * in the window and the last index = today.
 *
 * Days are aligned to the start of the week (Monday). Missing days are 0.
 */
export function deriveActivityHeatmap(solves: Solve[], weeks = 12): number[] {
  const total = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find the Monday of the current week.
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  // The grid's last day is Sunday of the current week.
  const endSunday = new Date(monday);
  endSunday.setDate(monday.getDate() + 6);
  // The grid's first day is `weeks` weeks before that Monday.
  const startMonday = new Date(monday);
  startMonday.setDate(monday.getDate() - (weeks - 1) * 7);

  const counts = new Array(total).fill(0);
  for (const s of solves) {
    const d = new Date(s.timestamp);
    d.setHours(0, 0, 0, 0);
    if (d < startMonday || d > endSunday) continue;
    const dayDiff = Math.floor((d.getTime() - startMonday.getTime()) / 86_400_000);
    if (dayDiff >= 0 && dayDiff < total) counts[dayDiff]++;
  }
  return counts;
}

// ─── deriveTpsSeries ───────────────────────────────────────────────────────

/** A point in the TPS-over-time series (one per analysed solve). */
export interface TpsPoint {
  /** Solve index in the session (0 = oldest shown). */
  solveIdx: number;
  /** Global TPS for this solve (NaN if no analysis). */
  tps: number;
  /** Solve effective time (ms), for tooltip context. */
  timeMs: number;
}

/**
 * TPS across analysed solves, oldest → newest.
 * Solves without analysis are included as NaN so the chart shows gaps
 * rather than skipping them (which would mislead the trend).
 */
export function deriveTpsSeries(solves: Solve[]): TpsPoint[] {
  // Reverse to oldest-first for the x-axis.
  const ordered = [...solves].reverse();
  return ordered.map((s, i) => ({
    solveIdx: i,
    tps: s.analysis?.tps.global ?? NaN,
    timeMs: effectiveTime(s),
  }));
}

// ─── derivePhaseDistribution ───────────────────────────────────────────────

/** Average phase share across analysed solves (for the stacked bar + rings). */
export interface PhaseShare {
  phaseName: string;
  /** Average duration (ms). */
  avgDurationMs: number;
  /** Average move count. */
  avgMoveCount: number;
  /** Share of total solve time (0–1). */
  share: number;
  /** Average TPS. */
  avgTps: number;
}

/**
 * Average per-phase distribution across all analysed solves.
 * Only solves with `analysis.phases` are considered.
 */
export function derivePhaseDistribution(solves: Solve[]): PhaseShare[] {
  const analysed = solves.filter((s) => s.analysis && s.analysis.phases.length > 0);
  if (analysed.length === 0) return [];

  // Collect per-phase accumulators.
  const acc = new Map<string, { dur: number; moves: number; tps: number; n: number }>();
  for (const s of analysed) {
    const phases = s.analysis!.phases;
    for (const p of phases) {
      const cur = acc.get(p.phaseName) ?? { dur: 0, moves: 0, tps: 0, n: 0 };
      cur.dur += p.durationMs;
      cur.moves += p.moveCount;
      cur.tps += p.tps;
      cur.n += 1;
      acc.set(p.phaseName, cur);
    }
  }

  const grandDur = Array.from(acc.values()).reduce((s, v) => s + v.dur, 0) || 1;
  return Array.from(acc.entries())
    .map(([phaseName, v]) => ({
      phaseName,
      avgDurationMs: v.dur / v.n,
      avgMoveCount: v.moves / v.n,
      share: v.dur / grandDur,
      avgTps: v.tps / v.n,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs);
}

// ─── deriveAvgTime ─────────────────────────────────────────────────────────

/**
 * Session average effective time (excluding DNFs).
 * Returns null when there are no valid solves.
 */
export function deriveAvgTime(solves: Solve[]): number | null {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}


