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
  /** Phase where the pause occurred. */
  phase: string;
  /** Position category. */
  category: PauseCategory;
  /** Human-readable probable cause (derived). */
  probableCause: string;
}

/** Type of a unified timeline segment. */
export type TimelineSegmentKind = "phase" | "pause" | "tail";

/**
 * A unified timeline segment — phases (execution time only), pauses, and an
 * optional tail (post-last-move stop reaction) all live on the SAME x-axis.
 *
 * The sum of every segment's `durationMs` equals `totalMs` exactly, so the
 * timeline reads as: `[Cross][pause][F2L][pause][F2L][OLL][pause][PLL][tail]`.
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
  /** Human-readable label (phase name / pause cause / "Stop"). */
  label: string;
  /**
   * Phase name this segment belongs to. For `"phase"` it's the phase name;
   * for `"pause"` it's the phase the pause happened in; for `"tail"` it's
   * `undefined`.
   */
  phaseName?: string;
  /** For pauses: the category. */
  pauseCategory?: PauseCategory;
  /** For pauses: the probable cause. */
  probableCause?: string;
  /** For phases: the move count. */
  moveCount?: number;
  /** For phases: the average TPS (execution TPS, pause time excluded). */
  tps?: number;
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
  /** Total solve duration (ms). Always equal to solve timer time. */
  totalMs: number;
  /** Per-move ticks. */
  moveTicks: MoveTick[];
  /** Rolling-window TPS samples, extended to end at `totalMs` with a 0-TPS tail. */
  tpsSamples: TpsSample[];
  /** Pause markers (with probable cause). */
  pauseMarks: PauseMark[];
  /** Legacy phase segments (kept for the `PhaseBreakdownSection` table). */
  stageSegments: StageSegment[];
  /**
   * Unified segments that tile the entire timeline: execution-phase blocks
   * interleaved with pause blocks, plus an optional `"tail"` block for the
   * post-last-move stop reaction. Sum of all `durationMs` === `totalMs`.
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
 * `totalMs` is ALWAYS the solve's timer time (`solve.time` or
 * `analysis.totalTimeMs`), never the span between first and last move — so
 * the x-axis is consistent across solves and the post-last-move "stop
 * reaction" gap is represented as a `"tail"` segment.
 *
 * The returned `segments` array tiles the entire timeline: execution-phase
 * blocks interleaved with pause blocks, plus an optional `"tail"` block.
 * `Σ segments[i].durationMs === totalMs` exactly.
 */
export function deriveTimeline(solve: Solve): TimelineData {
  const moves = solve.moves ?? [];
  const analysis = solve.analysis;

  // Total duration: ALWAYS the timer time. We prefer analysis.totalTimeMs
  // (computed by the pipeline), then fall back to solve.time (the timer
  // reading). We do NOT derive from move timestamps — that would silently
  // drop the post-last-move stop-reaction gap and make the TPS curve end
  // before the right edge of the timeline.
  const totalMs = analysis?.totalTimeMs ?? solve.time;

  const baseTime = moves.length > 0 ? moves[0].hostTimestamp : 0;
  const lastMoveOffsetMs =
    moves.length > 0 ? moves[moves.length - 1].hostTimestamp - baseTime : 0;

  // Per-move ticks (offsets relative to solve start).
  // `isRotation` is always false for CubeMoveEvent — rotations (x/y/z) are
  // tracked separately in RotationMetrics, not as move events. The field is
  // kept on the type for future extensibility if the protocol evolves.
  const moveTicks: MoveTick[] = moves.map((ev, i) => ({
    index: i,
    offsetMs: ev.hostTimestamp - baseTime,
    label: moveLabel(ev),
    isRotation: false,
    phaseName: phaseForMove(analysis?.phases ?? [], i),
  }));

  // TPS samples: prefer the analysis instantaneousWindow if present,
  // otherwise compute a rolling window from raw timestamps.
  const windowLen = analysis?.tps.instantaneousWindow?.length ?? 0;
  const rawTpsSamples: TpsSample[] =
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

  // Extend TPS samples to `totalMs` with a 0-TPS tail, so the curve always
  // reaches the right edge of the timeline. After the last move, no more
  // turns happen → TPS drops to 0 (the "stop reaction" gap).
  const tpsSamples: TpsSample[] = extendTpsToTotal(rawTpsSamples, totalMs, lastMoveOffsetMs);

  // Phase segments (from analysis). Used by the phase-breakdown TABLE.
  const stageSegments: StageSegment[] = analysis
    ? buildStageSegments(analysis.phases, baseTime)
    : [];

  // Pause marks (from analysis pauses, with probable cause).
  const pauseMarks: PauseMark[] = analysis
    ? analysis.pauses.pauses.map((p) => ({
        startMs: p.startIndex < moveTicks.length ? moveTicks[p.startIndex].offsetMs : 0,
        endMs: p.endIndex < moveTicks.length ? moveTicks[p.endIndex].offsetMs : totalMs,
        durationMs: p.durationMs,
        phase: p.phase,
        category: p.category,
        probableCause: derivePauseCause(p, analysis.phases),
      }))
    : [];

  // Unified segments: execution phases interleaved with pauses, plus an
  // optional tail block. Sums to `totalMs` exactly.
  const segments = buildUnifiedSegments(analysis, pauseMarks, totalMs, lastMoveOffsetMs);

  return { totalMs, moveTicks, tpsSamples, pauseMarks, stageSegments, segments };
}

/**
 * Extend a TPS sample series to end exactly at `totalMs`.
 *
 * If the last sample is before `totalMs`, append two synthetic samples:
 *   1. A 0-TPS sample at the last move's offset (the curve drops to 0 right
 *      when turning stops).
 *   2. A 0-TPS sample at `totalMs` (so the area fill closes at the right
 *      edge of the timeline).
 *
 * If `rawSamples` is empty (no moves), returns a single 0-TPS sample at
 * `totalMs` so the chart still renders a flat baseline.
 */
function extendTpsToTotal(
  rawSamples: TpsSample[],
  totalMs: number,
  lastMoveOffsetMs: number,
): TpsSample[] {
  if (rawSamples.length === 0) {
    return totalMs > 0 ? [{ offsetMs: 0, tps: 0 }, { offsetMs: totalMs, tps: 0 }] : [];
  }
  const last = rawSamples[rawSamples.length - 1];
  // Gap between the last move and the timer stop → tail at TPS 0.
  const tailMs = Math.max(0, totalMs - lastMoveOffsetMs);
  if (tailMs <= 0) return rawSamples;
  // Drop to 0 at the last move, then hold 0 until totalMs.
  return [
    ...rawSamples,
    { offsetMs: lastMoveOffsetMs, tps: 0 },
    { offsetMs: totalMs, tps: 0 },
  ];
}

/**
 * Build the unified timeline segments: execution-phase blocks interleaved
 * with pause blocks, plus an optional tail block.
 *
 * Each phase's `durationMs` (as reported by analysis) INCLUDES the pauses
 * that happened inside it. To get "execution time" per phase, we subtract
 * the pause durations attributed to that phase. The pauses then become
 * their own blocks, positioned at their actual time offsets.
 *
 * Layout per phase (e.g. F2L with 2 pauses):
 *   [F2L-exec-part1][pause][F2L-exec-part2][pause][F2L-exec-part3]
 *
 * We approximate the pause positions WITHIN a phase by distributing them
 * proportionally, since PauseDetail only carries start/end move indices
 * (and we already map those to time offsets in `pauseMarks`). We use the
 * pause marks' time offsets to slice the phase execution into the gaps
 * between consecutive pauses.
 *
 * Finally, if there's leftover time between the last segment and `totalMs`
 * (the post-last-move stop reaction), we emit a `"tail"` segment.
 */
function buildUnifiedSegments(
  analysis: SolveMetrics | undefined,
  pauseMarks: PauseMark[],
  totalMs: number,
  lastMoveOffsetMs: number,
): TimelineSegment[] {
  // No analysis → at most a tail block.
  if (!analysis || analysis.phases.length === 0) {
    const segs: TimelineSegment[] = [];
    if (totalMs > lastMoveOffsetMs && lastMoveOffsetMs >= 0) {
      segs.push({
        kind: "tail",
        startMs: Math.max(0, lastMoveOffsetMs),
        endMs: totalMs,
        durationMs: totalMs - Math.max(0, lastMoveOffsetMs),
        label: "Stop",
      });
    } else if (totalMs > 0) {
      segs.push({
        kind: "tail",
        startMs: 0,
        endMs: totalMs,
        durationMs: totalMs,
        label: "Stop",
      });
    }
    return segs;
  }

  const phases = analysis.phases;
  // Group pauses by phase name.
  const pausesByPhase = new Map<string, PauseMark[]>();
  for (const pm of pauseMarks) {
    const arr = pausesByPhase.get(pm.phase) ?? [];
    arr.push(pm);
    pausesByPhase.set(pm.phase, arr);
  }

  const segments: TimelineSegment[] = [];
  let cursorMs = 0;

  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    const phase = phases[phaseIdx];
    const phaseEndMs = cursorMs + phase.durationMs;
    const pausesInPhase = (pausesByPhase.get(phase.phaseName) ?? []).slice().sort((a, b) => a.startMs - b.startMs);

    if (pausesInPhase.length === 0) {
      // No pauses inside this phase → one solid execution block.
      segments.push({
        kind: "phase",
        startMs: cursorMs,
        endMs: phaseEndMs,
        durationMs: phase.durationMs,
        label: phase.phaseName,
        phaseName: phase.phaseName,
        moveCount: phase.moveCount,
        tps: phase.tps,
      });
    } else {
      // Slice the phase into execution parts separated by pause blocks.
      //
      // NOTE on coordinate systems: phase boundaries come from cumulative
      // `phase.durationMs` (analysis-derived), while pause positions come
      // from `moveTicks[startIndex/endIndex].offsetMs` (raw move
      // timestamps). These two clocks can disagree slightly, so a pause
      // attributed to "F2L" may have a time offset that falls outside the
      // F2L segment window. We clamp pauses to the phase's
      // [cursorMs, phaseEndMs] window below — this prevents crashes and
      // preserves Σ segments === totalMs, but a pause could be visually
      // misplaced or zero-clamped out of existence in pathological cases.
      let execStart = cursorMs;
      for (const pm of pausesInPhase) {
        const pauseStart = Math.max(cursorMs, Math.min(phaseEndMs, pm.startMs));
        const pauseEnd = Math.max(cursorMs, Math.min(phaseEndMs, pm.endMs));
        const pauseDur = Math.max(0, pauseEnd - pauseStart);
        if (pauseDur <= 0) continue;

        // Execution part before this pause.
        const execDur = pauseStart - execStart;
        if (execDur > 0) {
          segments.push({
            kind: "phase",
            startMs: execStart,
            endMs: pauseStart,
            durationMs: execDur,
            label: phase.phaseName,
            phaseName: phase.phaseName,
            tps: phase.tps,
          });
        }
        // Pause block.
        segments.push({
          kind: "pause",
          startMs: pauseStart,
          endMs: pauseEnd,
          durationMs: pauseDur,
          label: pm.probableCause,
          phaseName: phase.phaseName,
          pauseCategory: pm.category,
          probableCause: pm.probableCause,
        });
        execStart = pauseEnd;
      }
      // Trailing execution part after the last pause in this phase.
      // Move-count attribution is approximate when a phase is sliced; the
      // table view still uses the phase's full move count via
      // stageSegments.
      if (phaseEndMs > execStart) {
        const execDur = phaseEndMs - execStart;
        segments.push({
          kind: "phase",
          startMs: execStart,
          endMs: phaseEndMs,
          durationMs: execDur,
          label: phase.phaseName,
          phaseName: phase.phaseName,
          tps: phase.tps,
        });
      }
    }

    cursorMs = phaseEndMs;
  }

  // Tail: post-last-move stop reaction. The phase cursor lands at
  // Σ phase.durationMs which may be < totalMs (timer time includes the
  // reaction gap). Emit a tail block for the remainder.
  if (totalMs > cursorMs) {
    segments.push({
      kind: "tail",
      startMs: cursorMs,
      endMs: totalMs,
      durationMs: totalMs - cursorMs,
      label: "Stop",
    });
  }

  return segments;
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


