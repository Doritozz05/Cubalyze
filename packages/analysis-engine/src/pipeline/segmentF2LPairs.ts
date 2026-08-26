import type { CubeState, FaceLetter } from '@cubeforge/math-core';
import {
  applyFrameRotation,
  bestFrameRotationSequence,
  countCompletedF2LSlotsInFrame,
} from '@cubeforge/math-core';
import type { PhaseDetectionReport, SolveTimeline } from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { pickSlotFrame } from './slotFrame';

/**
 * A slot completion that dips at the next entry (killed by the 1-entry
 * persistence check) is re-examined against a window of this many FUTURE
 * entries: if the slot re-appears complete AND a DIFFERENT undedicated slot
 * completes inside the window, the first completion was a real pair boundary
 * that the next pair's insertion displaced, and it fires EARLY at its first
 * home (see the scan loop).
 *
 * reconz-5061: the first pair ("U R' U' R") finishes with FL home, the
 * second pair ("L' U' L") passes through it for two moves, and FL is home
 * again at its end — alongside BL. With only the 1-entry lookahead, FL fired
 * together with BL at the second pair's end: one stole the whole segment
 * ("F2L 1 BL — 7 moves") and the other got an empty one ("F2L 2 FL — 0
 * moves"). BL completing inside the window proves the displacement came from
 * the BL insertion, so FL fires at its first home (move 9) and the two
 * algorithms stay separate.
 *
 * A re-appearance WITHOUT another slot's completion is a pass-through of the
 * pair's OWN algorithm — reconz-12340's "U R U R' U R' F R F'" has FR home
 * mid-algorithm but only really completes at the F R F' tail, which carries
 * no other completion: the first home is killed and the pair fires at the
 * genuine re-completion. 3 covers the measured disturbance gap (5061: BL
 * completes exactly 3 entries after FL's first home) while keeping the
 * false-positive window tight.
 */
// Lookahead for the displacement heuristic: a completion whose slot dips
// and re-appears is a REAL pair boundary when a DIFFERENT undedicated slot
// completes inside the window (its insertion displaced the first slot).
// 3 covered reconz-5061 (FL dips 2 entries, BL completes 3 later);
// reconz-style solves with F-insertion passes through the just-finished
// slot need more (cuberoot-2388: FR dips 2 entries and FL completes 7
// entries after FR's first home). 8 covers both without spilling into the
// next-next pair.
const PERSISTENCE_WINDOW = 8;

/**
 * Raw entry state in the SOLVER's frame (no frame rotation applied): when P2
 * frame recovery rotated the timeline, the pre-recovery snapshots were
 * preserved on the timeline and must drive the slot analysis (piece-anchored
 * checks are only meaningful in the frame the reconstruction was written
 * in).
 */
function solverFrameCubeAt(
  timeline: SolveTimeline,
  idx: number,
): CubeState | null {
  const entry = timeline.entries[idx];
  if (!entry) return null;
  const solverStates = timeline.solverFrameStates;
  const snapshot = solverStates?.[idx] ?? entry.state;
  return TimelineBuilder.fromSnapshot(snapshot);
}

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
  /** Relax the cross criterion to permutation-only (see PhaseSplitter). */
  relaxedCross?: boolean;
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

  // PSEUDO/PARTIAL CROSS (reconz-11663 "pseudo xcross", reconz-4319 "pseudo
  // cross", reconz-3467 "partial cross"): the solver never built a real cross
  // in the written block — the edges were left misordered (or partial) and
  // the order is fixed inside the F2L, so the pairs are non-standard
  // (edge-control / ZBLS insertions) and never complete classic slots during
  // F2L: all 4 slots land TOGETHER at the F2L end, which the slot scan would
  // fabricate as N pairs at the same index with meaningless slot names.
  // Report ONE undifferentiated F2L row over the whole phase instead — the
  // panel keeps its move accounting and stays honest (the raw "Steps" table
  // beside it already shows the reconstructor's pair blocks).
  if (report?.crossType === 'pseudo xcross') {
    const start = f2l.startIndex;
    const end = f2l.endIndex ?? timeline.entries.length - 1;
    const moves = options.displayTokens
      ? options.displayTokens.slice(start, end + 1)
      : entriesToTokens(timeline, start, end);
    const startTs = timeline.entries[start]?.hostTimestamp ?? 0;
    const endTs = timeline.entries[end]?.hostTimestamp ?? startTs;
    const timeMs = Math.max(0, endTs - startTs);
    return [{
      pairNumber: 1,
      slot: '',
      colors: [] as unknown as [FaceLetter, FaceLetter],
      moves,
      movesCount: moves.length,
      auf: [],
      completionIndex: end,
      startIndex: start,
      endIndex: end,
      timeMs,
      tps:
        timeMs > 0 && moves.length > 0
          ? Math.round((moves.length / (timeMs / 1000)) * 100) / 100
          : 0,
      pauseBeforeMs: 0,
    }];
  }

  // Degenerate transcripts: when the cross never completes until the very
  // end of the solve, the F2L segment is noise (the PhaseSplitter pushed the
  // boundary forward). Report no pairs instead of fabricating them.
  if (cross?.completionIndex !== undefined) {
    const lateCross =
      timeline.entries.length > 0 &&
      cross.completionIndex >= Math.max(0, timeline.entries.length - 4);
    if (lateCross) return [];
  }

  // Solver frame: the crossFace/scheme come from pickSlotFrame — the labeling
  // under which the solver's pairs are home, chosen between the report's
  // scheme (post-recovery detection) and the detection re-derived from the
  // preserved solver-frame states. The SAME picker drives the PhaseSplitter's
  // xcross check, so identical timelines → identical pairs.
  const picked = pickSlotFrame(
    timeline,
    options.crossFace ?? report?.crossFace,
    options.scheme ?? null,
    options.preferredCrossIdx,
    f2l.startIndex,
    f2l.endIndex ?? timeline.entries.length - 1,
    options.relaxedCross,
  );
  const crossFace = picked.crossFace;
  const schemeToUse = picked.scheme;

  const start = (cross?.endIndex ?? f2l.startIndex - 1) + 1;
  const end = f2l.endIndex ?? timeline.entries.length - 1;
  const displayTokens = options.displayTokens;

  type PairAcc = UnifiedF2LPair & { segStart: number };
  const pairs: PairAcc[] = [];

  // ── Frame measurement (one DP over the whole F2L span, state-based) ─────
  // The D/E frame rotation is MEASURED from the preserved solver-frame
  // states instead of accumulated from raw tokens: a wide `u` regrip rotates
  // U+E together, so D and E do not always rotate as a unit and a token
  // accumulator is wrong whenever a `u` precedes a `d` (reconz-9068 — the
  // cross's `u'` leaves D/E rotated, and the F2L `d'` COMPENSATES it). The
  // DP (bestFrameRotationSequence) maximizes the completed-slot SUM over the
  // whole span, which disambiguates per-index ties (9068 @7) and reads both
  // real persistent regrips (reconz-12340) and compensated ones (9068). The
  // span starts one index BEFORE F2L (the cross-end state): the xcross
  // exclusion mask below reads its frame here too, so the two agree.
  const spanStart = Math.max(0, start - 1);
  const spanStates: CubeState[] = [];
  let spanOk = true;
  for (let i = spanStart; i <= end; i++) {
    const cube = solverFrameCubeAt(timeline, i);
    if (!cube) {
      spanOk = false;
      break;
    }
    spanStates.push(cube);
  }
  const frames = spanOk
    ? bestFrameRotationSequence(
        spanStates,
        0,
        spanStates.length - 1,
        crossFace,
        schemeToUse,
      )
    : [];
  /** Entry state in the solver's frame, aligned to the DP's optimal frame. */
  const frameStateAt = (idx: number): CubeState | null => {
    const j = idx - spanStart;
    // Guard on `frames`, not `spanStates`: when the span build bailed early
    // (spanOk false) the state list is partial but `frames` is empty, and
    // applying an undefined rotation would throw.
    if (j < 0 || j >= frames.length) return null;
    return applyFrameRotation(spanStates[j], frames[j]);
  };

  // Seed prevMask with the state just before F2L starts (the cross end).
  // Slots already solved then are the XCross pairs — excluded from the F2L
  // scan (via unsolvedMask below) and reported through xcrossPairs instead.
  let prevMask = 0;
  const preF2L = frameStateAt(start - 1);
  if (preF2L) {
    prevMask = countCompletedF2LSlotsInFrame(
      preF2L,
      crossFace,
      schemeToUse,
    ).slotMask;
  }
  // Slots already solved when F2L began are the XCross pairs — they are NOT
  // new pairs even if they dip and re-complete (advanced solves temporarily
  // break the cross during F2L).
  const unsolvedMask = 0xf & ~prevMask;
  // Slots already reported as a pair never fire again: a solved slot that
  // temporarily dips (the next insertion passes through it) would otherwise
  // re-fire as a duplicate pair.
  let declaredMask = 0;
  let segmentStart = start;

  for (let i = start; i <= end; i++) {
    const state = frameStateAt(i);
    if (!state) break;
    const comp = countCompletedF2LSlotsInFrame(state, crossFace, schemeToUse);

    // A previously-unsolved, not-yet-reported slot completed → the pair
    // finished at this entry. Persistence: the completion must survive the
    // NEXT entry — an insertion often passes through the home position
    // mid-algorithm (e.g. R U R' U R' F R F' shows FR home at move 20 but
    // it dips and only really completes at 23); firing the dip would
    // fabricate a pair and burn the 4-pair cap. The F2L-span end has no
    // lookahead and fires directly.
    let newBits = (comp.slotMask & unsolvedMask & ~declaredMask) & ~prevMask;
    if (newBits && i < end) {
      // Persistence, phase 1 — the completion must survive the NEXT entry:
      // an insertion often passes through the home position mid-algorithm
      // (e.g. "R U R' U R' F R F'" shows FR home at its 4th move but dips
      // and only really completes at its last); firing the dip would
      // fabricate a pair. The F2L-span end has no lookahead and fires
      // directly.
      const next = frameStateAt(i + 1);
      const survivedBits = next
        ? countCompletedF2LSlotsInFrame(next, crossFace, schemeToUse)
            .slotMask & newBits
        : 0;
      if (survivedBits) {
        // Per-bit persistence: only the completions that survive the NEXT
        // entry fire here — a simultaneous completion that dips re-fires at
        // its own real completion (it stays excluded via prevMask).
        newBits = survivedBits;
      } else {
        // Phase 2 — the completion dipped at the next entry. It is either
        // a mid-algorithm pass-through (killed here; it re-fires at its
        // real completion) or a REAL pair boundary that the NEXT pair's
        // insertion displaced (reconz-5061: "U R' U' R" finishes with FL
        // home, then the "L' U' L" insertion passes through it, and both
        // FL and BL are home at the second pair's end — firing both there
        // merged the two algorithms into "F2L1 BL 7 moves" + "F2L2 FL 0
        // moves"). Distinguish with the window: fire at the FIRST home only
        // when the slot re-appears AND a DIFFERENT (undedicated) slot
        // completed inside the window — the displacement came from that
        // other pair's insertion. A re-appearance with no other completion
        // (reconz-12340's "F R F'" tail) is a pass-through of this pair's
        // own algorithm — wait for the genuine re-completion.
        let reappears = 0;
        let otherCompletes = 0;
        let prevInWindow = comp.slotMask;
        const hi = Math.min(end, i + PERSISTENCE_WINDOW);
        for (let j = i + 1; j <= hi; j++) {
          const later = frameStateAt(j);
          if (!later) break;
          const laterComp = countCompletedF2LSlotsInFrame(
            later,
            crossFace,
            schemeToUse,
          );
          reappears |= laterComp.slotMask;
          otherCompletes |=
            laterComp.slotMask & unsolvedMask & ~declaredMask & ~prevInWindow;
          prevInWindow = laterComp.slotMask;
        }
        if (reappears & newBits) {
          // The slot came back inside the window. Fire at the first home
          // only if another slot's completion displaced it.
          if ((otherCompletes & ~newBits) === 0) newBits = 0;
        } else {
          // Never came back inside the window: pure pass-through, killed.
          newBits = 0;
        }
      }
    }
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
      declaredMask |= newBits;
    }
    // prevMask tracks the LAST entry (fired or not): a slot that completed
    // mid-algorithm and dipped (killed by the persistence lookahead) must be
    // able to re-fire when it really completes — pinning prevMask to the last
    // FIRING entry would carry its un-declared bits forward and silently
    // suppress the re-fire (the reconz-1296 missing 4th pair).
    prevMask = comp.slotMask;
    // A slot count can never exceed 4; stop scanning once every slot is
    // accounted for so LL moves can't fabricate extra pairs.
    if (pairs.length >= 4 || declaredMask === unsolvedMask) break;
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
