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
  getOrientationAtIndex,
  OrientationTable,
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
  /**
   * The moves that completed this pair, in the SOLVER's raw notation
   * (wide moves as written: r', u2, …), one token per timeline entry —
   * exactly what the reconstructor wrote, so the panel reads 1:1 with
   * the raw text. Rotations are not included (they are reported
   * separately in `rotations`).
   */
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
  /** Synthetic orientation keyframes ([moveIndex, orientationIndex]) so the
   *  3D replay rotates the cube to the solver's perspective, exactly like
   *  the smartcube path (empty when no rotations).
   *
   *  CONTRACT: indices are in FACE-MOVE space (slices / wide / garbage
   *  tokens are excluded from counting, same as conjugatePhaseStream).
   *  Consumers must index a moves array that contains ONLY face moves,
   *  or they will drift off-index. */
  orientationTimeline: [number, number][];
  /** The solver's color scheme: solver face → color letter (derived from the
   *  detected cross). Used to name F2L slots and derive up/front colors. */
  scheme: Record<FaceLetter, FaceLetter> | undefined;
  /** Colors on the U and F faces of the SOLVER after the inspection grip
   *  (e.g. { up: 'U', front: 'F' } for the canonical white-on-top frame) —
   *  the "Orientation" row of the reconstruction. */
  orientation: { up: FaceLetter; front: FaceLetter } | undefined;
  crossColor: FaceLetter | undefined;
  cross: {
    /** The cross moves in the SOLVER's raw notation (wides as written),
     *  one token per timeline entry. */
    moves: string[];
    type: 'plain' | 'xcross' | 'xxcross' | 'xxxcross';
    xcrossPair?: F2LSlotInfo;
  };
  pairs: F2LPairResult[];
  /** Rotations (x/y/z) with the index of the move they happened before —
   *  silent orientation changes, exactly like the smartcube. */
  rotations: { token: string; moveIndex: number }[];
  /** Last-layer phases in the SOLVER's raw notation (empty when skipped). */
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

/** Valid face + slice tokens — the state path may consume these (garbage is
 *  dropped so `CubeState.applySequence` never throws on noisy transcripts). */
const STATE_TOKEN_RE = /^[URFDLBMES][2']?$/;

/** Wide moves as the solver writes them (r', u2, Rw, …) — each expands to
 *  a face + slice pair in the conjugated stream, but is ONE entry.
 *
 *  CASE-SENSITIVE on the lowercase forms: with the `i` flag, "U" would match
 *  as the wide "u" and every face move would be treated as a 2-token wide
 *  (the "display tokens duplicated" bug). Only the uppercase Rw-style forms
 *  are case-insensitive on the w. */
const WIDE_MOVE_RE = /^[rludfb][2']?$|^[RLUDFB][wW][2']?$/;

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
  let inspection = input.inspection ?? '';
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
        inspection = inspectionTokens.join(' ');
      }
      rawPhases = rawPhases.filter((p) => p !== embeddedInspection);
    }
  }

  // Conjugate inspection + every phase with a running grip. Rotations are
  // consumed (folded into the moves), so perPhase[0] (inspection) yields no
  // face moves and every later phase is already in the cube-fixed frame.
  const { perPhase, orientationTimeline } = conjugatePhaseStream([
    inspectionTokens,
    ...rawPhases.map((p) => p.tokens),
  ]);
  const solveTokens = perPhase.slice(1).flat();
  const faceTokens = solveTokens.filter((t) => FACE_MOVE_RE.test(t));
  // `solveTokens` is the FULL conjugated stream — it still contains the slice
  // half of wide moves (r → R M') and any explicit M/E/S moves. The state
  // path consumes faces AND slices so the reconstructed states are EXACT
  // (previously the slices were dropped and M/E/S/wide solves ended
  // inconsistent), while timeline entries stay face-move indexed. Garbage
  // tokens are filtered out so `CubeState.applySequence` never throws.
  const stateTokens = solveTokens.filter((t) => STATE_TOKEN_RE.test(t));

  // ── Display tokens + rotations (entry space) ─────────────────────────────
  // Timeline entries are CONJUGATED face tokens (cube frame). For the panel
  // to read 1:1 with the raw text, every entry maps back to the RAW token
  // that produced it — wide moves keep their written form (r' not "R' M")
  // — and rotations get the entry index of the move they precede (the same
  // convention as conjugatePhaseStream's orientation timeline).
  const displayTokens: string[] = [];
  const solveRotations: { token: string; moveIndex: number }[] = [];
  {
    let entryCursor = 0;
    for (let k = 0; k < rawPhases.length; k++) {
      const rawTokens = tokenize(rawPhases[k].raw, { expandWide: false });
      const conjPhase = perPhase[k + 1];
      let ci = 0;
      for (const rawToken of rawTokens) {
        if (isRotation(rawToken)) {
          // A rotation between moves applies to the NEXT move's index.
          solveRotations.push({ token: rawToken, moveIndex: entryCursor });
          continue;
        }
        const n = WIDE_MOVE_RE.test(rawToken) ? 2 : 1; // face+slice, or one
        for (let j = 0; j < n && ci + j < conjPhase.length; j++) {
          if (FACE_MOVE_RE.test(conjPhase[ci + j])) {
            displayTokens.push(rawToken);
            entryCursor++;
          }
        }
        ci += n;
      }
    }
  }
  const rotations = [
    ...inspectionTokens.map((t) => ({ token: t, moveIndex: 0 })),
    ...solveRotations,
  ];

  // Invariant: every timeline entry (conjugated face token) maps back to
  // exactly one raw display token. A mismatch here means the walk above is
  // misaligned (e.g. a notation quirk mis-tokenized as a 2-token wide) and
  // every phase's displayed moves would silently drift — fail loudly.
  if (displayTokens.length !== faceTokens.length) {
    throw new Error(
      `analyzeSolveText: display token walk misaligned (` +
        `${displayTokens.length} display vs ${faceTokens.length} face entries)`,
    );
  }

  // ── Preferred cross index (tiebreak only) ────────────────────────────────
  // The solver's written cross segment (the first non-rotation raw phase) is
  // the ONLY signal that tells apart two crosses that are indistinguishable
  // by state — e.g. a persistent coincidental cross on a layer the solve
  // never touches vs the real cross. It is a TIEBREAK over equally-valid
  // candidates, never a detector: no label is trusted, only the segment
  // LENGTH. The index is measured in ENTRY space (conjugated FACE tokens,
  // one per timeline entry) — with the wide-slice fix the cross completion
  // materializes exactly where the written segment ends, so the face count
  // of the segments up to and including the cross phase gives the index.
  const firstFacePhase = rawPhases.find((p) =>
    p.tokens.some((t) => FACE_MOVE_RE.test(t)),
  );
  let preferredCrossIdx: number | undefined;
  // Only meaningful when the written cross segment is a PROPER PREFIX of the
  // solve (there is at least one later phase). For a flat solution (no `//`
  // comments → a single phase holding every move) the "written cross end" is
  // the end of the whole solve, and preferring a cross that completes at the
  // last entry would let a coincidental end-of-solve cross ([last,last,last,
  // last] — every solved final state shows a cross on all 6 faces) win every
  // tie. Disable the tiebreak there and let the spurious/duration tests decide.
  if (firstFacePhase && rawPhases.indexOf(firstFacePhase) < rawPhases.length - 1) {
    const idx = rawPhases.indexOf(firstFacePhase);
    let faceCount = 0;
    for (let k = 0; k <= idx; k++) {
      faceCount += perPhase[k + 1].filter((t) => FACE_MOVE_RE.test(t)).length;
    }
    preferredCrossIdx = faceCount - 1;
  }

  const solveMoves = movesFromTokens(faceTokens);
  let timeline = PhaseSplitter.splitAndAnnotate(
    TimelineBuilder.build(solveMoves, 'CFOP', undefined, setup, undefined, stateTokens),
    CFOPDefinition,
    { colorNeutral: true, preferredCrossIdx },
  );
  if (input.totalTimeMs !== undefined && Number.isFinite(input.totalTimeMs)) {
    timeline.solveTimeMs = Math.max(0, input.totalTimeMs);
  }
  let report = timeline.detectionReport ??
    PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, { colorNeutral: true });

  // ── P2: frame recovery ──────────────────────────────────────────────────
  // Text reconstructions can end PERFECT but in a rotated frame (the stored
  // scramble and the solver's frame differ by one whole-cube rotation — the
  // known recon.nz quirk). The base analysis then runs on a rotated cube:
  // spurious early crosses win, slots read as UF/DF/UB/DB garbage, and the
  // Orientation row gets a wrong scheme. When the final state is uniform but
  // NOT canonically solved, rotate EVERY snapshot by the rotation that
  // resolves the final state and re-detect: with an exactly solved end state,
  // the real cross completes the full 4-phase chain and wins the detector's
  // heuristic over any spurious cross.
  let states = timeline.entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
  const finalState = states[states.length - 1];
  if (report.finalStateSolved && finalState && !finalState.isSolved()) {
    const recovery = finalState.findRecoveryRotation();
    if (recovery) {
      for (const entry of timeline.entries) {
        const c = TimelineBuilder.fromSnapshot(entry.state);
        c.multiply(recovery);
        entry.state = TimelineBuilder.toSnapshot(c);
      }
      const rotated = PhaseSplitter.splitAndAnnotate(
        timeline,
        CFOPDefinition,
        { colorNeutral: true, preferredCrossIdx },
      );
      if (rotated.detectionReport) {
        report = rotated.detectionReport;
      }
    }
  }

  // Re-run the color detection to obtain the solver's scheme (cross color /
  // frame) — needed to name F2L slots in the SOLVER's frame. Same call the
  // PhaseSplitter makes internally; no duplicated math. (Recomputed AFTER the
  // P2 frame recovery: the snapshots may have been rotated above.)
  states = timeline.entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
  const detection = ColorPhaseDetector.detect(states, preferredCrossIdx);
  const scheme = detection?.scheme;
  const crossFace = (detection?.crossFace ?? report.crossFace ?? 'D') as string;

  // Up/front colors after the inspection grip: the grip is the orientation
  // active at move 0 of the synthetic timeline; its faceMap tells which
  // physical face now sits at each solver position, and the scheme gives
  // that face's color letter.
  const gripIndex = getOrientationAtIndex(orientationTimeline, 0);
  const grip = OrientationTable.ENTRIES[gripIndex] ?? OrientationTable.IDENTITY;
  const schemeToUse = scheme ?? IDENTITY_SCHEME;
  const orientation = {
    up: schemeToUse[grip.faceMap.U] ?? 'U',
    front: schemeToUse[grip.faceMap.F] ?? 'F',
  };

  const reconstruction: SolveReconstruction = {
    method: 'CFOP',
    inspection,
    orientationTimeline,
    scheme,
    orientation,
    // crossColor is always an outer face (the cross lives on a face); the
    // report types it as CubeFace for historical reasons, so narrow it.
    crossColor:
      (detection?.crossColor as FaceLetter | undefined) ??
      (report.crossColor as FaceLetter | undefined),
    cross: buildCross(report, displayTokens),
    pairs: buildPairs(timeline, report, crossFace, scheme, displayTokens),
    rotations,
    oll: buildLLPhase(report, 'OLL', displayTokens),
    pll: buildLLPhase(report, 'PLL', displayTokens),
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
  displayTokens: readonly string[],
): SolveReconstruction['cross'] {
  const phase = report.phases.find((p) => p.phaseName === 'Cross');
  const start = phase?.startIndex ?? 0;
  const end = phase?.endIndex ?? start;
  const moves = phase
    ? displayTokens.slice(start, end + 1)
    : [];
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
  displayTokens: readonly string[],
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

  type PairAcc = F2LPairResult & { segStart: number };
  const pairs: PairAcc[] = [];
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
  // Slots already solved when F2L began are the XCross pairs — they are NOT
  // new pairs even if they dip and re-complete (advanced solves temporarily
  // break the cross during F2L: the insertion moves displace a cross edge and
  // restore it, which would otherwise fabricate a "pair" for every slot the
  // cross-breaking touched). Only the slots UNSOLVED at the cross end count.
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
        const rangeMoves = displayTokens.slice(segmentStart, i + 1);
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
  // restore a temporarily-displaced cross edge, or a VLS finish), the trailing
  // moves belong to it — the raw phase wrote them as the insertion.
  if (pairs.length > 0) {
    const last = pairs[pairs.length - 1];
    if (last.completionIndex < end) {
      last.moves = displayTokens.slice(last.segStart, end + 1);
    }
  }

  return pairs.map(({ segStart: _seg, ...pair }) => pair);
}

function buildLLPhase(
  report: PhaseDetectionReport,
  name: 'OLL' | 'PLL',
  displayTokens: readonly string[],
): { moves: string[]; skipped: boolean } | null {
  const phase = report.phases.find((p) => p.phaseName === name);
  if (!phase) return null;
  // A skipped phase owns no move (its completion index equals the previous
  // phase's) — showing the completion move under it double-counts it.
  const moves = phase.skipped
    ? []
    : displayTokens.slice(
        phase.startIndex ?? 0,
        (phase.endIndex ?? phase.startIndex ?? 0) + 1,
      );
  return { moves, skipped: !!phase.skipped };
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
