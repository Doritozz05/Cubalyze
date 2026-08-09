import type { FaceLetter } from '@cubeforge/math-core';
import {
  ColorPhaseDetector,
  countCompletedF2LSlotsInFrame,
  IDENTITY_SCHEME,
} from '@cubeforge/math-core';
import type { PhaseDetectionReport, SolveTimeline } from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

/**
 * Unified F2L pair segmentation — the ONLY place pairs are detected.
 *
 * This is the Fase 2 (state-based, solver-frame) logic that previously lived
 * in `analyzeSolveText.buildPairs`, extended with the per-pair timing fields
 * that `CFOPMetricsCalculator.analyzeF2LPairs` used to compute separately.
 * Both consumers now read from this single function, so the two routes can
 * never diverge:
 *
 *   - text route  → `analyzeSolveText` (displayTokens = raw notation)
 *   - smart route → `CFOPMetricsCalculator` (displayTokens = undefined)
 *
 * Solver-frame detection: slots are counted in the SOLVER's frame via
 * `countCompletedF2LSlotsInFrame` (scheme-aware). When `crossFace`/`scheme`
 * are not provided (smart route) they are derived with the same
 * `ColorPhaseDetector.detect` call the text route uses, guaranteeing
 * identical results for identical timelines.
 */
export interface SegmentF2LPairsOptions {
  /** Cross face in the solver's frame (text route passes it explicitly). */
  crossFace?: string;
  /** Solver scheme face → color (text route passes it explicitly). */
  scheme?: Record<string, string> | null;
  /** Raw notation tokens, one per timeline entry (text route). */
  displayTokens?: readonly string[];
  /** Tiebreak hint when deriving crossFace/scheme internally. */
  preferredCrossIdx?: number;
}

export interface UnifiedF2LPair {
  pairNumber: number;
  /** Slot name in the solver's cross frame, e.g. "FR". */
  slot: string;
  /** The pair's two side colors (canonical face letters). */
  colors: [FaceLetter, FaceLetter];
  /**
   * Moves that completed this pair, one token per timeline entry: the
   * SOLVER's raw notation when the caller provided displayTokens (text
   * route), otherwise derived from the timeline entries themselves (smart
   * route) — never null.
   */
  moves: string[];
  /** Number of timeline entries owned by this pair (== moves.length when
   *  displayTokens are 1:1 with entries, which is always). */
  movesCount: number;
  /** Timeline index where the pair completed. */
  completionIndex: number;
  /** First timeline entry of the pair (inclusive). */
  startIndex: number;
  /** Last timeline entry of the pair (inclusive). */
  endIndex: number;
  /** Leading U moves (AUF-style) at the start of the pair. */
  auf: string[];
  /** Wall-clock duration (ms) of the pair's entries. */
  timeMs: number;
  /** movesCount / (timeMs/1000). */
  tps: number;
  /** Gap between the previous pair's end and this pair's start. */
  pauseBeforeMs: number;
}

/**
 * Leading U moves (AUF-style) at the start of a move list.
 */
function leadingUMoves(moves: readonly string[]): string[] {
  const auf: string[] = [];
  for (const m of moves) {
    if (m[0] === 'U') auf.push(m);
    else break;
  }
  return auf;
}

/**
 * Rebuild the notation token for a timeline entry's move ("U", "U'", "U2").
 * Used to derive the pair's moves when the caller has no raw display tokens
 * (smart route): the timeline entries ARE the moves as performed, so the
 * auf/leading-U analysis must come from them, or the two routes would
 * diverge on identical timelines.
 */
function entryToken(move: SolveTimeline['entries'][number]['move']): string {
  if (move.direction === 2) return `${move.face}2`;
  if (move.direction === -1) return `${move.face}'`;
  return move.face;
}

function entriesToTokens(
  timeline: SolveTimeline,
  start: number,
  end: number,
): string[] {
  const out: string[] = [];
  for (let i = start; i <= end; i++) {
    const entry = timeline.entries[i];
    if (entry) out.push(entryToken(entry.move));
  }
  return out;
}

/**
 * Segment a timeline's F2L phase into per-pair results.
 *
 * Ported 1:1 from `analyzeSolveText.buildPairs` (same boundaries, same
 * auf/lateCross/trailing-moves semantics) and enriched with the timing
 * fields CFOPMetricsCalculator needs. Pairs already home when F2L started
 * (xcross) are NOT listed here — they surface via
 * `report.xcrossPairs`/`crossType` instead (see the unified-parity tests).
 * Empty when there is no F2L phase, when the cross completes in the last 4
 * entries (degenerate transcript), or when the report is missing.
 */
export function segmentF2LPairs(
  timeline: SolveTimeline,
  options: SegmentF2LPairsOptions = {},
): UnifiedF2LPair[] {
  const report: PhaseDetectionReport | undefined = timeline.detectionReport;
  const f2l = report?.phases.find((p) => p.phaseName === 'F2L');
  const cross = report?.phases.find((p) => p.phaseName === 'Cross');
  if (!f2l || f2l.startIndex === undefined) return [];

  // Degenerate transcripts: when the cross never completes until the very
  // end of the solve, the F2L segment is noise (the PhaseSplitter pushed the
  // boundary forward). Report no pairs instead of fabricating them.
  if (cross?.completionIndex !== undefined) {
    const lateCross =
      timeline.entries.length > 0 &&
      cross.completionIndex >= Math.max(0, timeline.entries.length - 4);
    if (lateCross) return [];
  }

  // Solver frame: derive crossFace/scheme when not provided (smart route).
  // Same call the text route makes, so identical timelines → identical pairs.
  let crossFace = options.crossFace ?? report?.crossFace;
  let scheme = options.scheme ?? null;
  if (crossFace === undefined || scheme === null) {
    const states = timeline.entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
    const detection = ColorPhaseDetector.detect(states, options.preferredCrossIdx);
    crossFace = crossFace ?? detection?.crossFace ?? 'D';
    scheme = scheme ?? detection?.scheme ?? IDENTITY_SCHEME;
  }
  const schemeToUse = scheme ?? IDENTITY_SCHEME;

  const start = (cross?.endIndex ?? f2l.startIndex - 1) + 1;
  const end = f2l.endIndex ?? timeline.entries.length - 1;
  const displayTokens = options.displayTokens;

  type PairAcc = UnifiedF2LPair & { segStart: number };
  const pairs: PairAcc[] = [];
  // Seed prevMask with the state just before F2L starts (the cross end).
  // Slots already solved then are the XCross pairs — excluded from the F2L
  // scan (via unsolvedMask below) and reported through xcrossPairs instead.
  let prevMask = 0;
  if (start - 1 >= 0 && timeline.entries[start - 1]) {
    prevMask = countCompletedF2LSlotsInFrame(
      TimelineBuilder.fromSnapshot(timeline.entries[start - 1].state),
      crossFace,
      schemeToUse,
    ).slotMask;
  }
  // Slots already solved when F2L began are the XCross pairs — they are NOT
  // new pairs even if they dip and re-complete (advanced solves temporarily
  // break the cross during F2L).
  const unsolvedMask = 0xf & ~prevMask;
  let segmentStart = start;

  for (let i = start; i <= end; i++) {
    const state = TimelineBuilder.fromSnapshot(timeline.entries[i].state);
    const comp = countCompletedF2LSlotsInFrame(state, crossFace, schemeToUse);

    // A previously-unsolved slot completed → the pair finished at this entry.
    const newBits = (comp.slotMask & unsolvedMask) & ~prevMask;
    if (newBits) {
      for (let b = 0; b < 4; b++) {
        if (!(newBits & (1 << b))) continue;
        const slotInfo = comp.slots.find((s) => s.slotIndex === b);
        const rangeMoves = displayTokens
          ? displayTokens.slice(segmentStart, i + 1)
          : entriesToTokens(timeline, segmentStart, i);
        pairs.push({
          pairNumber: pairs.length + 1,
          slot: slotInfo?.name ?? `SLOT-${b}`,
          colors: slotInfo
            ? slotInfo.colors
            : (['?', '?'] as unknown as [FaceLetter, FaceLetter]),
          moves: rangeMoves,
          movesCount: i - segmentStart + 1,
          auf: leadingUMoves(rangeMoves),
          completionIndex: i,
          startIndex: segmentStart,
          endIndex: i,
          timeMs: 0,
          tps: 0,
          pauseBeforeMs: 0,
          segStart: segmentStart,
        });
        segmentStart = i + 1;
      }
      prevMask = comp.slotMask;
    }
    // A slot count can never exceed 4; stop scanning once every slot is
    // accounted for so LL moves can't fabricate extra pairs.
    if (pairs.length >= 4) break;
  }

  // The last pair owns the REST of the F2L segment: when a pair is home
  // before F2L completes (e.g. an XCross solve where the remaining moves
  // restore a temporarily-displaced cross edge, or a VLS finish), the
  // trailing moves belong to it.
  if (pairs.length > 0) {
    const last = pairs[pairs.length - 1];
    if (last.completionIndex < end) {
      last.moves = displayTokens
        ? displayTokens.slice(last.segStart, end + 1)
        : entriesToTokens(timeline, last.segStart, end);
      last.endIndex = end;
      last.movesCount = end - last.segStart + 1;
    }
  }

  // ── Per-pair timing (wall-clock, from timeline entry timestamps) ────────
  let prevPairEndTs = timeline.entries[start]?.hostTimestamp ?? 0;
  for (const p of pairs) {
    const startTs = timeline.entries[p.startIndex]?.hostTimestamp ?? 0;
    const endTs = timeline.entries[p.endIndex]?.hostTimestamp ?? startTs;
    p.timeMs = Math.max(0, endTs - startTs);
    p.tps =
      p.timeMs > 0 && p.movesCount > 0
        ? Math.round((p.movesCount / (p.timeMs / 1000)) * 100) / 100
        : 0;
    p.pauseBeforeMs = p === pairs[0] ? 0 : Math.max(0, startTs - prevPairEndTs);
    prevPairEndTs = endTs;
  }

  return pairs.map(({ segStart: _seg, ...pair }) => pair);
}
