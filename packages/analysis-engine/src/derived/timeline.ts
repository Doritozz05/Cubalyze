/**
 * Timeline visualization data derivation.
 *
 * Transforms raw solve data (moves, phase metrics, pause details) into
 * the shapes consumed by timeline visualization components (move ticks,
 * TPS samples, pause marks, unified phase/pause segments).
 *
 * All functions are pure and framework-agnostic.
 */

import type { CubeMoveEvent, PhaseMetrics, PauseDetail, SolveMetrics, TPSMetrics } from "@cubeforge/types";
import type { PauseCategory } from "./phase-colors";

// ─── Public Types ─────────────────────────────────────────────────────────

/** A vertical move tick on the timeline SVG. */
export interface MoveTick {
  index: number;
  offsetMs: number;
  label: string;
  isRotation: boolean;
  phaseName?: string;
}

/** A TPS sample for the area-chart overlay. */
export interface TpsSample {
  offsetMs: number;
  tps: number;
}

/** A pause marker on the timeline. */
export interface PauseMark {
  startMs: number;
  endMs: number;
  durationMs: number;
  phase: string;
  category: PauseCategory;
  probableCause: string;
  startIndex: number;
  endIndex: number;
}

export type TimelineSegmentKind = "phase" | "pause";

export interface TimelineSegment {
  kind: TimelineSegmentKind;
  startMs: number;
  endMs: number;
  durationMs: number;
  label: string;
  phaseName?: string;
  pauseCategory?: PauseCategory;
  probableCause?: string;
  moveStartIndex?: number;
  moveEndIndex?: number;
}

export interface StageSegment {
  phaseName: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  moveCount: number;
  tps: number;
}

export interface TimelineData {
  totalMs: number;
  moveTicks: MoveTick[];
  moveVisualMs: number[];
  tpsSamples: TpsSample[];
  pauseMarks: PauseMark[];
  stageSegments: StageSegment[];
  segments: TimelineSegment[];
}

/** Minimal input for deriveTimeline. */
export interface TimelineSolveInput {
  time: number;
  moves?: CubeMoveEvent[];
  analysis?: SolveMetrics;
}

// ─── derivePauseCause ────────────────────────────────────────────────────

/** Heuristic cause for a pause, based on phase + category. */
export function derivePauseCause(pause: PauseDetail, phases: PhaseMetrics[]): string {
  const phase = pause.phase.toLowerCase();
  const cat = pause.category;

  // Recognition pauses are attributed to the phase being recognized.
  if (cat === "recognition") {
    if (phase.includes("oll")) return "OLL recognition";
    if (phase.includes("pll")) return "PLL recognition";
    if (phase.includes("cmll")) return "CMLL recognition";
    if (phase.includes("lse") || phase.includes("lr")) return "LSE recognition";
    if (phase.includes("f2l")) return "F2L pair recognition";
    if (phase.includes("cross")) return "Cross planning";
    if (phase.includes("block")) return "Block building search";
    if (phase.includes("eoline") || phase.includes("eole")) return "Edge orientation";
    return `${pause.phase} recognition`;
  }

  // Pause INSIDE a last-layer algorithm — recalling/hesitating, not
  // recognizing the case.
  if (cat === "mid-algorithm") {
    return `${pause.phase} hesitation`;
  }

  // mid-phase: search/recognition pauses within a phase.
  if (phase.includes("f2l")) return "F2L pair recognition";
  if (phase.includes("cross")) return "Cross piece search";
  if (phase.includes("block")) return "Block building search";
  if (phase.includes("eoline") || phase.includes("eole")) return "Edge orientation";
  return `${pause.phase} hesitation`;
}

// ─── derivePairSegments ──────────────────────────────────────────────────

/**
 * One F2L pair as a timeline sub-segment — lets the phase bar paint the F2L
 * phase as 4 sub-bars (one per pair) and seek the replay to the pair's start.
 */
export interface PairSegment {
  phaseName: "F2L";
  pairNumber: number;
  /** Slot name in the solver's cross frame ("FR", "FL", "BR", "BL"). */
  slot: string | null;
  /** Recognized Basic F2L case (41-case catalog), when matched. */
  caseName?: string;
  caseNumber?: string;
  /** Milliseconds from the solve start to the pair's first move. */
  startMs: number;
  /** startMs + the pair's wall-clock duration. */
  endMs: number;
  /** Wall-clock duration of the pair's entries (timeMs from the pipeline). */
  durationMs: number;
  /** Timeline entry of the pair's FIRST move (for replay seek). */
  moveStartIndex: number;
  /** Timeline entry of the pair's LAST move (the completion). */
  moveEndIndex: number;
  /** Timeline entry where the pair completed. */
  completionIndex: number;
  /** Number of moves owned by the pair. */
  moves: number;
  tps: number;
  /** Gap between the previous pair's end and this pair's start. */
  pauseBeforeMs: number;
}

/**
 * Derive one timeline sub-segment per F2L pair from an analysis.
 *
 * Pure + framework-agnostic. Move indices come from the shared
 * `segmentF2LPairs` output (`completionIndex - moves + 1` = first entry,
 * `completionIndex` = last), so the same boundaries the case table shows are
 * the ones painted here. Milliseconds use the move timestamps when provided
 * (same base as `deriveTimeline`); without moves they fall back to a
 * sequential layout from each pair's `timeMs`.
 */
export function derivePairSegments(
  analysis: SolveMetrics | undefined,
  moves?: CubeMoveEvent[],
): PairSegment[] {
  const pairs = analysis?.cfop?.f2lPairs;
  if (!pairs || pairs.length === 0) return [];

  const baseTime = moves && moves.length > 0 ? moves[0].hostTimestamp : 0;
  const offsetOf = (idx: number): number | null =>
    moves && idx >= 0 && idx < moves.length
      ? Math.max(0, moves[idx].hostTimestamp - baseTime)
      : null;

  const segments: PairSegment[] = [];
  let accMs = 0;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    const moveCount = Math.max(0, p.moves ?? 0);
    const completionIndex = p.completionIndex ?? -1;
    const moveStartIndex =
      completionIndex >= 0 ? completionIndex - moveCount + 1 : -1;
    const durationMs = Math.max(0, p.timeMs ?? 0);
    const startMs = offsetOf(moveStartIndex) ?? accMs;

    segments.push({
      phaseName: "F2L",
      pairNumber: p.pairNumber,
      slot: p.slotId ?? null,
      caseName: p.detectedCase?.caseName,
      caseNumber: p.detectedCase?.caseNumber,
      startMs,
      endMs: startMs + durationMs,
      durationMs,
      moveStartIndex,
      moveEndIndex: completionIndex,
      completionIndex,
      moves: moveCount,
      tps: p.tps ?? 0,
      pauseBeforeMs: i > 0 ? Math.max(0, p.pauseBeforeMs ?? 0) : 0,
    });
    accMs = startMs + durationMs;
  }
  return segments;
}

// ─── deriveTimeline ──────────────────────────────────────────────────────

function moveLabel(ev: CubeMoveEvent): string {
  const suffix = ev.direction === 2 ? "2" : ev.direction === -1 ? "'" : "";
  return `${ev.face}${suffix}`;
}

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

interface PhaseRun {
  phaseName: string;
  startIdx: number;
  endIdx: number;
}

/** Group consecutive moves by phaseName into runs. */
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
        runs[runs.length - 1].endIdx = i - 1;
      }
      runStart = i;
      currentPhase = phase;
    }
  }
  if (runs.length > 0) {
    runs[runs.length - 1].endIdx = moveTicks.length - 1;
    if (runs[0].startIdx > 0) runs[0].startIdx = 0;
  }
  return runs;
}

function phaseForMove(phases: PhaseMetrics[], moveIndex: number): string | undefined {
  let cumulative = 0;
  for (const p of phases) {
    cumulative += p.moveCount;
    if (moveIndex < cumulative) return p.phaseName;
  }
  return undefined;
}

function buildStageSegments(phases: PhaseMetrics[]): StageSegment[] {
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

    const midPhasePauses = pauseMarks
      .filter((pm) => pm.startIndex >= run.startIdx && pm.startIndex < run.endIdx)
      .sort((a, b) => a.startMs - b.startMs);

    const boundaryPause = pauseMarks.find(
      (pm) => pm.startIndex === run.endIdx && r + 1 < phaseRuns.length,
    );

    const totalPauseMs = Math.min(
      phaseBudget,
      midPhasePauses.reduce((s, pm) => s + pm.durationMs, 0),
    );
    const totalExecMs = Math.max(0, phaseBudget - totalPauseMs);

    const execMoveCounts: number[] = [];
    let prevEnd = run.startIdx;
    for (const pm of midPhasePauses) {
      execMoveCounts.push(pm.startIndex - prevEnd + 1);
      prevEnd = pm.endIndex;
    }
    execMoveCounts.push(
      (boundaryPause ? boundaryPause.startIndex : run.endIdx) - prevEnd + 1,
    );
    const totalExecMoves = execMoveCounts.reduce((s, c) => s + c, 0);

    let pos = phaseStartMs;
    let blkStart = run.startIdx;

    for (let i = 0; i < midPhasePauses.length; i++) {
      const pm = midPhasePauses[i];
      const execMs =
        totalExecMoves > 0 && totalExecMs > 0
          ? (execMoveCounts[i] / totalExecMoves) * totalExecMs
          : 0;

      if (execMs > 0) {
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
      } else if (finalMoveCount > 0) {
        for (let m = 0; m < finalMoveCount; m++) {
          moveVisualMs[blkStart + m] = pos;
        }
      }
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
      } else if (finalMoveCount > 0) {
        for (let m = 0; m < finalMoveCount; m++) {
          moveVisualMs[blkStart + m] = pos;
        }
      }
    }
  }

  return { segments, moveVisualMs };
}

/**
 * Derive all timeline visualization data from a single solve.
 *
 * `totalMs` is `solve.time` (the authoritative timer time).
 * All segments use REAL move-timestamp coordinates.
 * `Σ segments[i].durationMs === totalMs` exactly.
 */
export function deriveTimeline(solve: TimelineSolveInput): TimelineData {
  const moves = solve.moves ?? [];
  const analysis = solve.analysis;

  const baseTime = moves.length > 0 ? moves[0].hostTimestamp : 0;
  const totalMs =
    solve.time > 0
      ? solve.time
      : moves.length > 0
        ? moves[moves.length - 1].hostTimestamp - baseTime
        : (analysis?.totalTimeMs ?? 0);

  const moveTicks: MoveTick[] = moves.map((ev, i) => ({
    index: i,
    offsetMs: ev.hostTimestamp - baseTime,
    label: moveLabel(ev),
    isRotation: false,
    phaseName: phaseForMove(analysis?.phases ?? [], i),
  }));

  const windowLen = analysis?.tps.instantaneousWindow?.length ?? 0;
  const tpsSamples: TpsSample[] =
    windowLen > 1
      ? analysis!.tps.instantaneousWindow!.map((tps: number, i: number) => ({
          offsetMs:
            i < moveTicks.length
              ? moveTicks[i].offsetMs
              : moves.length > 0
                ? (i / moves.length) * totalMs
                : (i / Math.max(1, windowLen)) * totalMs,
          tps,
        }))
      : rollingTps(moves.map((m) => m.hostTimestamp));

  const tpsFinal: TpsSample[] =
    tpsSamples.length === 0 && totalMs > 0
      ? [{ offsetMs: 0, tps: 0 }, { offsetMs: totalMs, tps: 0 }]
      : tpsSamples;

  const phaseRuns = computePhaseRuns(moveTicks);

  const stageSegments: StageSegment[] =
    phaseRuns.length > 0
      ? phaseRuns.map((run) => {
          const startMs = moveTicks[run.startIdx].offsetMs;
          const endMs = moveTicks[run.endIdx].offsetMs;
          const phase = analysis?.phases.find((p: PhaseMetrics) => p.phaseName === run.phaseName);
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
        ? buildStageSegments(analysis.phases)
        : [];

  const pauseMarks: PauseMark[] = analysis
    ? analysis.pauses.pauses.map((p: PauseDetail) => ({
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

  const { segments, moveVisualMs } = buildUnifiedSegments(moveTicks, phaseRuns, pauseMarks, totalMs);

  const tpsSamplesVisual: TpsSample[] =
    tpsFinal.length > 0 && moveVisualMs.length > 0
      ? tpsFinal.map((s, i) => ({
          offsetMs: i < moveVisualMs.length ? moveVisualMs[i] : s.offsetMs,
          tps: s.tps,
        }))
      : tpsFinal;

  return {
    totalMs,
    moveTicks,
    moveVisualMs,
    tpsSamples: tpsSamplesVisual,
    pauseMarks,
    stageSegments,
    segments,
  };
}
