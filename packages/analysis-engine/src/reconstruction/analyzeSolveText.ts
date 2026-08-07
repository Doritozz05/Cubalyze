/**
 * analyzeSolveText.ts — Fase 2 reconstruction API (headless).
 *
 * Given a raw reconstruction string (exactly like the smartcube path does
 * with physical moves), rebuild the cube state and let the STANDARD stats
 * pipeline produce the reconstruction "a nuestra manera":
 *
 *   setup + inspection + solution  →  SolveTimeline + SolveReconstruction
 *
 * The `//` comments are parsed ONLY to keep the raw phase labels for display
 * and for the Fase 2 contrast (raw labels vs what our splitter detects by
 * STATE). They are never trusted for detection.
 *
 * The smartcube flow (useSolveSession) is NOT touched: this module builds a
 * standard SolveTimeline with the same shape, so PhaseSplitter, metrics and
 * ReplaySection consume it without changes.
 */
import {
  ColorPhaseDetector,
  conjugatePhaseStream,
  countCompletedF2LSlotsInFrame,
  IDENTITY_SCHEME,
  isRotation,
  tokenize,
  CFOPDefinition,
  type FaceLetter,
  type F2LSlotInfo,
} from '@cubeforge/math-core';
import type {
  CubeFace,
  CubeMoveDirection,
  CubeMoveEvent,
  PhaseDetectionReport,
  SolveTimeline,
} from '@cubeforge/types';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';

// ─── Input / output types ───────────────────────────────────────────────────

export interface SolveTextInput {
  /** Scramble as it appears ("B' R2 D' L2 …"). */
  setup: string;
  /** Inspection rotations ("x2 y'") — the solver's starting grip. Never
   *  counts as a solve move (same as the smartcube). */
  inspection?: string;
  /** Full solution with or without "//" phase comments. */
  solution: string;
  method?: 'CFOP';
  /** Optional total solve time → only used for TPS. */
  totalTimeMs?: number;
}

export interface F2LPairResult {
  /** Slot name in the solver's cross frame: FR/BR/BL/FL. */
  slot: string;
  /** The pair's two side colors (canonical face letters). */
  colors: [FaceLetter, FaceLetter];
  /** Face moves (cube frame) that completed this pair. */
  moves: string[];
  /** Timeline index where the pair completed. */
  completionIndex: number;
  /** Leading U moves before the pair's insertion. */
  auf: string[];
  /** True when the pair was already home when F2L started. */
  premade: boolean;
}

export interface SolveReconstruction {
  method: 'CFOP';
  inspection: string;
  crossColor: FaceLetter | undefined;
  cross: {
    moves: string[];
    type: 'plain' | 'xcross' | 'xxcross';
    xcrossPair?: F2LSlotInfo;
  };
  pairs: F2LPairResult[];
  /** Rotations (x/y/z) with the index of the move they happened before —
   *  silent orientation changes, exactly like the smartcube. */
  rotations: { token: string; moveIndex: number }[];
  oll: { moves: string[]; skipped: boolean } | null;
  pll: { moves: string[]; skipped: boolean } | null;
  finalSolved: boolean;
  warnings: PhaseDetectionReport['warnings'];
  /** Raw `//` segments as parsed from the input text (for the contrast). */
  rawPhases: { label: string; moves: string[] }[];
  totalTimeMs?: number;
  tps?: number;
}

export interface AnalyzeSolveTextResult {
  timeline: SolveTimeline;
  reconstruction: SolveReconstruction;
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/** Valid outer-face moves — the only tokens the replay/analysis use. */
const FACE_MOVE_RE = /^[URFDLB][2']?$/;

interface RawPhase {
  label: string;
  /** Raw (un-tokenized) moves segment, e.g. "R' D R". */
  raw: string;
  tokens: string[];
}

/**
 * Split a reconstruction text into `//`-marked phases.
 *
 * Tolerates both "moves // label" and a standalone "// label" line. A
 * solution without any `//` yields a single phase with an empty label.
 */
function parseRawPhases(solution: string): RawPhase[] {
  const phases: RawPhase[] = [];
  let current = { label: '', raw: '' };

  const flush = () => {
    const tokens = tokenize(current.raw);
    if (tokens.length > 0) phases.push({ ...current, tokens });
  };

  for (const line of solution.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const commentIdx = trimmed.indexOf('//');
    const movesPart =
      commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;
    const labelPart = commentIdx >= 0 ? trimmed.slice(commentIdx + 2).trim() : '';

    if (commentIdx >= 0 && movesPart === '') {
      // "// label" on its own line → start a new labelled phase.
      flush();
      current = { label: labelPart, raw: '' };
    } else if (commentIdx >= 0) {
      // "moves // label" → one phase per labelled line.
      flush();
      current = { label: labelPart, raw: movesPart };
    } else {
      // Plain moves line → append to the current phase (flat solutions and
      // multi-line continuations stay a SINGLE phase).
      current.raw = current.raw ? `${current.raw} ${movesPart}` : movesPart;
    }
  }
  flush();
  return phases;
}

/** Convert notation tokens to synthetic CubeMoveEvents (uniform timestamps). */
function movesFromTokens(tokens: string[], base = 1000, gapMs = 100): CubeMoveEvent[] {
  const faceMoves = tokens.filter((t) => FACE_MOVE_RE.test(t));
  return faceMoves.map((token, i) => {
    const face = token[0] as CubeFace;
    let direction: CubeMoveDirection = 1;
    if (token.includes("'")) direction = -1;
    else if (token.includes('2')) direction = 2;
    return {
      face,
      direction,
      cubeTimestamp: base + i * gapMs,
      hostTimestamp: base + i * gapMs,
    };
  });
}

/** Rotations as silent orientation changes with their preceding move index. */
function collectRotations(inspectionTokens: string[], solutionTokens: string[]): {
  token: string;
  moveIndex: number;
}[] {
  const rotations: { token: string; moveIndex: number }[] = [];
  let faceMoves = 0;
  for (const token of [...inspectionTokens, ...solutionTokens]) {
    if (isRotation(token)) rotations.push({ token, moveIndex: faceMoves });
    else if (FACE_MOVE_RE.test(token)) faceMoves++;
  }
  return rotations;
}

// ─── Main API ───────────────────────────────────────────────────────────────

/**
 * Analyze a raw reconstruction text through the standard stats pipeline.
 *
 * The initial state comes from the scramble (same as TimelineBuilder does
 * for the smartcube); inspection rotations are folded into the moves by
 * conjugation (they are the solver's grip, never solve moves); the solution
 * is applied token by token with mid-solve rotations applied to the state.
 */
export function analyzeSolveText(input: SolveTextInput): AnalyzeSolveTextResult {
  const setup = tokenize(input.setup)
    .filter((t) => FACE_MOVE_RE.test(t))
    .join(' ');
  const inspection = input.inspection ?? '';
  let inspectionTokens = tokenize(inspection);
  let rawPhases = parseRawPhases(input.solution);

  // CubeRoot text embeds the inspection as a "// Inspection" phase. If the
  // caller ALSO passes `inspection`, applying both would rotate the grip
  // twice and produce a wrong frame. Prefer the explicit `inspection`
  // parameter and drop the embedded phase; if no explicit inspection was
  // given, the embedded phase IS the inspection (rotations only).
  const embeddedInspection = rawPhases.find((p) => /inspect/i.test(p.label));
  if (embeddedInspection) {
    const embeddedIsRotationsOnly =
      embeddedInspection.tokens.length > 0 &&
      embeddedInspection.tokens.every((t) => isRotation(t));
    if (embeddedIsRotationsOnly) {
      if (inspectionTokens.length === 0) {
        inspectionTokens = embeddedInspection.tokens;
      }
      rawPhases = rawPhases.filter((p) => p !== embeddedInspection);
    }
  }

  // Conjugate inspection + every phase with a running grip. Rotations are
  // consumed (folded into the moves), so perPhase[0] (inspection) yields no
  // face moves and every later phase is already in the cube-fixed frame.
  const { perPhase } = conjugatePhaseStream([
    inspectionTokens,
    ...rawPhases.map((p) => p.tokens),
  ]);
  const solveTokens = perPhase.slice(1).flat();
  const faceTokens = solveTokens.filter((t) => FACE_MOVE_RE.test(t));

  const solveMoves = movesFromTokens(faceTokens);
  const timeline = PhaseSplitter.splitAndAnnotate(
    TimelineBuilder.build(solveMoves, 'CFOP', undefined, setup),
    CFOPDefinition,
    { colorNeutral: true },
  );
  if (input.totalTimeMs !== undefined && Number.isFinite(input.totalTimeMs)) {
    timeline.solveTimeMs = Math.max(0, input.totalTimeMs);
  }
  const report = timeline.detectionReport ??
    PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, { colorNeutral: true });

  // Re-run the color detection to obtain the solver's scheme (cross color /
  // frame) — needed to name F2L slots in the SOLVER's frame. Same call the
  // PhaseSplitter makes internally; no duplicated math.
  const states = timeline.entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
  const detection = ColorPhaseDetector.detect(states);
  const scheme = detection?.scheme;
  const crossFace = (detection?.crossFace ?? report.crossFace ?? 'D') as string;

  const reconstruction: SolveReconstruction = {
    method: 'CFOP',
    inspection,
    crossColor: (detection?.crossColor as FaceLetter | undefined) ?? report.crossColor,
    cross: buildCross(report, timeline),
    pairs: buildPairs(timeline, report, crossFace, scheme),
    rotations: collectRotations(inspectionTokens, rawPhases.flatMap((p) => p.tokens)),
    oll: buildLLPhase(timeline, report, 'OLL'),
    pll: buildLLPhase(timeline, report, 'PLL'),
    finalSolved: report.finalStateSolved,
    warnings: report.warnings,
    rawPhases: rawPhases.map((p) => ({ label: p.label, moves: tokenize(p.raw) })),
  };
  if (input.totalTimeMs !== undefined && input.totalTimeMs > 0) {
    reconstruction.totalTimeMs = input.totalTimeMs;
    reconstruction.tps = faceTokens.length / (input.totalTimeMs / 1000);
  }

  return { timeline, reconstruction };
}

// ─── Builders ───────────────────────────────────────────────────────────────

function buildCross(
  report: PhaseDetectionReport,
  timeline: SolveTimeline,
): SolveReconstruction['cross'] {
  const moves = phaseFaceMoves(timeline, report, 'Cross');
  const type = report.crossType ?? 'plain';
  return {
    moves,
    type,
    xcrossPair: report.xcrossPairs?.[0] as F2LSlotInfo | undefined,
  };
}

function buildPairs(
  timeline: SolveTimeline,
  report: PhaseDetectionReport,
  crossFace: string,
  scheme: Record<string, string> | undefined,
): F2LPairResult[] {
  const f2l = report.phases.find((p) => p.phaseName === 'F2L');
  const cross = report.phases.find((p) => p.phaseName === 'Cross');
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

  const schemeToUse = scheme ?? IDENTITY_SCHEME;
  const start = (cross?.endIndex ?? f2l.startIndex - 1) + 1;
  const end = f2l.endIndex ?? timeline.entries.length - 1;

  const pairs: F2LPairResult[] = [];
  // Seed prevMask with the state just before F2L starts (the cross end) so
  // a pair already home when F2L begins is correctly flagged `premade`.
  let prevMask = 0;
  if (start - 1 >= 0 && timeline.entries[start - 1]) {
    prevMask = countCompletedF2LSlotsInFrame(
      TimelineBuilder.fromSnapshot(timeline.entries[start - 1].state),
      crossFace,
      schemeToUse,
    ).slotMask;
  }
  let segmentStart = start;

  for (let i = start; i <= end; i++) {
    const state = TimelineBuilder.fromSnapshot(timeline.entries[i].state);
    const comp = countCompletedF2LSlotsInFrame(state, crossFace, schemeToUse);

    // A new slot completed → the pair finished at this entry.
    const newBits = comp.slotMask & ~prevMask;
    if (newBits) {
      for (let b = 0; b < 4; b++) {
        if (!(newBits & (1 << b))) continue;
        const slotInfo = comp.slots.find((s) => s.slotIndex === b);
        const rangeMoves = phaseFaceMovesByIndex(timeline, segmentStart, i);
        const auf = leadingUMoves(rangeMoves);
        pairs.push({
          slot: slotInfo?.name ?? `SLOT-${b}`,
          colors: slotInfo
            ? slotInfo.colors
            : (['?', '?'] as unknown as [FaceLetter, FaceLetter]),
          moves: rangeMoves,
          completionIndex: i,
          auf,
          premade: (prevMask & (1 << b)) !== 0,
        });
        segmentStart = i + 1;
      }
      prevMask = comp.slotMask;
    }
    // A slot count can never exceed 4; stop scanning once every slot is
    // accounted for so LL moves can't fabricate extra pairs.
    if (pairs.length >= 4) break;
  }

  return pairs;
}

function buildLLPhase(
  timeline: SolveTimeline,
  report: PhaseDetectionReport,
  name: 'OLL' | 'PLL',
): { moves: string[]; skipped: boolean } | null {
  const phase = report.phases.find((p) => p.phaseName === name);
  if (!phase) return null;
  return { moves: phaseFaceMovesByIndex(timeline, phase), skipped: !!phase.skipped };
}

// ─── Timeline range helpers ─────────────────────────────────────────────────

function phaseFaceMoves(timeline: SolveTimeline, report: PhaseDetectionReport, name: string): string[] {
  const phase = report.phases.find((p) => p.phaseName === name);
  return phase ? phaseFaceMovesByIndex(timeline, phase) : [];
}

function phaseFaceMovesByIndex(
  timeline: SolveTimeline,
  phase: { startIndex?: number; endIndex?: number } | number,
  explicitEnd?: number,
): string[] {
  let start: number;
  let end: number;
  if (typeof phase === 'number') {
    start = phase;
    end = explicitEnd ?? phase;
  } else {
    start = phase.startIndex ?? -1;
    end = phase.endIndex ?? -1;
  }
  const moves: string[] = [];
  for (let i = start; i <= end; i++) {
    const entry = timeline.entries[i];
    if (!entry) break;
    const { face, direction } = entry.move;
    const notation = face + (direction === 2 ? '2' : direction === -1 ? "'" : '');
    moves.push(notation);
  }
  return moves;
}

/** Leading U moves (AUF-style) at the start of a move list. */
function leadingUMoves(moves: string[]): string[] {
  const auf: string[] = [];
  for (const m of moves) {
    if (m[0] === 'U') auf.push(m);
    else break;
  }
  return auf;
}
