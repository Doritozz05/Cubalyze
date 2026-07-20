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
  category: PauseDetail["category"];
  /** Human-readable probable cause (derived). */
  probableCause: string;
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
  /** Total solve duration (ms). */
  totalMs: number;
  /** Per-move ticks. */
  moveTicks: MoveTick[];
  /** Rolling-window TPS samples. */
  tpsSamples: TpsSample[];
  /** Pause markers (with probable cause). */
  pauseMarks: PauseMark[];
  /** Phase segments. */
  stageSegments: StageSegment[];
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
 * Requires `solve.moves` (raw CubeMoveEvent[]) and optionally
 * `solve.analysis` (SolveMetrics with phases + pauses). When analysis is
 * missing, `stageSegments` and `pauseMarks` are empty and `tpsSamples` is
 * computed from raw move timestamps.
 */
export function deriveTimeline(solve: Solve): TimelineData {
  const moves = solve.moves ?? [];
  const analysis = solve.analysis;

  // Total duration: prefer analysis.totalTimeMs, else derive from last move.
  const baseTime = moves.length > 0 ? moves[0].hostTimestamp : 0;
  const totalMs = analysis?.totalTimeMs
    ?? (moves.length > 0 ? moves[moves.length - 1].hostTimestamp - baseTime : solve.time);

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

  // Phase segments (from analysis).
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

  return { totalMs, moveTicks, tpsSamples, pauseMarks, stageSegments };
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


