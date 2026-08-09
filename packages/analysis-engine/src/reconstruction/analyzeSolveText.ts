/**
 * analyzeSolveText.ts — Fase 2/3 reconstruction API (headless thin adapter).
 *
 * Given a raw reconstruction string (exactly like the smartcube path does
 * with physical moves), rebuild the cube state and let the SHARED pipeline
 * produce the reconstruction "a nuestra manera":
 *
 *   setup + inspection + solution  →  SolveTimeline + SolveReconstruction
 *
 * The `//` comments are parsed ONLY to keep the raw phase labels for display
 * and for the Fase 2 contrast (raw labels vs what our splitter detects by
 * STATE). They are never trusted for detection.
 *
 * Detection is DELEGATED (Fase 3): build + split + P2 frame recovery run in
 * `buildAnnotatedTimeline` — the same sync core `analyzeSolve` wraps for the
 * smart route. This module keeps only parsing (phases, inspection,
 * conjugation, displayTokens, stateTokens, preferredCrossIdx) and the
 * reconstruction formatting; it never re-implements detection.
 */
import {
  ColorPhaseDetector,
  conjugatePhaseStream,
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
import { buildAnnotatedTimeline } from '../pipeline/analyzeSolve';
import { segmentF2LPairs } from '../pipeline/segmentF2LPairs';

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
   *  silent orientation changes, exactly like the smartcube.
   *
   *  CONTRACT: the inspection grip rotations come FIRST, all at moveIndex 0,
   *  and their count equals the rotation tokens in `inspection` — consumers
   *  (OurDetectionPanel) slice `rotations` by that count to separate the
   *  grip from the mid-solve rotations. */
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

/**
 * Normalize the `2'` suffix (reco.nz / CubeRoot quirk — "U2'" ≡ "U2",
 * "r2'" ≡ "r2", "y2'" ≡ "y2"). `tokenize`'s DISPLAY path keeps the raw `2'`
 * form while the expanded/conjugated stream normalizes it to `2`; the
 * display walk must mirror that normalization BEFORE classifying a token as
 * a rotation / wide, or its entry count drifts and the strict
 * "display token walk misaligned" invariant fires (rotations written `y2'`
 * were misread as moves; wides written `r2'` consumed one conjugated half
 * instead of two).
 */
function normalizeTwoPrimeSuffix(token: string): string {
  return token.length >= 3 && token.endsWith("'") && token[token.length - 2] === "2"
    ? token.slice(0, -1)
    : token;
}

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

  // CubeRoot text embeds the inspection as a "// Inspection"-style phase.
  // The label varies across the dataset ("insp", "Inspection",
  // "Inpsection", "Inspección", … — and sometimes no comment at all), so
  // recognition is by POSITION, not by label: the leading rotations-only
  // phase — the one before the first face move — is by definition the
  // solver's grip (a rotation can never be a solve move). Mid-solve
  // rotations-only phases ("// regrip y") are NOT the inspection. If the
  // caller ALSO passes `inspection`, applying both would rotate the grip
  // twice and produce a wrong frame: prefer the explicit parameter and drop
  // the embedded phase.
  // The leading rotations-only phase is the grip — recognized by POSITION
  // (it precedes the first face move), never by label.
  const firstFaceIdx = rawPhases.findIndex((p) =>
    p.tokens.some((t) => FACE_MOVE_RE.test(t)),
  );
  const embeddedInspection = rawPhases.find(
    (p, i) =>
      i < firstFaceIdx &&
      p.tokens.length > 0 &&
      p.tokens.every((t) => isRotation(t)),
  );
  if (embeddedInspection) {
    if (inspectionTokens.length === 0) {
      inspectionTokens = embeddedInspection.tokens;
      inspection = inspectionTokens.join(' ');
    }
    rawPhases = rawPhases.filter((p) => p !== embeddedInspection);
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
        // Classify on the normalized form ("2'" → "2") so rotations and
        // wides written with the reco.nz `2'` quirk line up 1:1 with the
        // conjugated stream; keep the RAW token for display fidelity.
        const norm = normalizeTwoPrimeSuffix(rawToken);
        if (isRotation(norm)) {
          // A rotation between moves applies to the NEXT move's index.
          solveRotations.push({ token: rawToken, moveIndex: entryCursor });
          continue;
        }
        const n = WIDE_MOVE_RE.test(norm) ? 2 : 1; // face+slice, or one
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
  // IMPORTANT: the index must be measured on the FILTERED rawPhases (the
  // embedded inspection was already consumed above) — `perPhase[k + 1]`
  // aligns 1:1 with rawPhases[k] after the filter, so counting a leftover
  // inspection phase here would shift the tiebreak by one phase and the
  // written cross segment would end past its real entries.
  let preferredCrossIdx: number | undefined;
  const firstFacePhaseIndex = rawPhases.findIndex((p) =>
    p.tokens.some((t) => FACE_MOVE_RE.test(t)),
  );
  // Only meaningful when the written cross segment is a PROPER PREFIX of the
  // solve (there is at least one later phase). For a flat solution (no `//`
  // comments → a single phase holding every move) the "written cross end" is
  // the end of the whole solve, and preferring a cross that completes at the
  // last entry would let a coincidental end-of-solve cross ([last,last,last,
  // last] — every solved final state shows a cross on all 6 faces) win every
  // tie. Disable the tiebreak there and let the spurious/duration tests decide.
  if (firstFacePhaseIndex >= 0 && firstFacePhaseIndex < rawPhases.length - 1) {
    let faceCount = 0;
    for (let k = 0; k <= firstFacePhaseIndex; k++) {
      faceCount += perPhase[k + 1].filter((t) => FACE_MOVE_RE.test(t)).length;
    }
    preferredCrossIdx = faceCount - 1;
  }

  const solveMoves = movesFromTokens(faceTokens);
  // DETECTION DELEGATED to the shared core: build + split + P2 frame
  // recovery all run inside `buildAnnotatedTimeline` — the EXACT synchronous
  // core the smart route's `analyzeSolve` wraps. This adapter keeps ONLY
  // parsing (phases, inspection, conjugation, displayTokens, stateTokens,
  // preferredCrossIdx) and the reconstruction formatting; it never
  // re-implements detection.
  //
  // solveTimeMs is applied AFTER detection on purpose: the text timeline
  // carries synthetic timestamps, so building the report with the override
  // would fabricate an 'unattributed-time' warning. The smart route passes
  // it through the core (real timestamps) — duration semantics stay per
  // route while phases/report/pairs come from one shared pipeline.
  const timeline = buildAnnotatedTimeline({
    moves: solveMoves,
    method: 'CFOP',
    scramble: setup,
    stateTokens,
    preferredCrossIdx,
  });
  if (input.totalTimeMs !== undefined && Number.isFinite(input.totalTimeMs)) {
    timeline.solveTimeMs = Math.max(0, input.totalTimeMs);
  }
  // splitAndAnnotate (inside the core) ALWAYS attaches a detection report,
  // so this fallback is unreachable today — kept defensively so a future
  // change to the core can never break the reconstruction. Same data, never
  // re-detects.
  const report = timeline.detectionReport ??
    PhaseSplitter.getDetectionReport(timeline, CFOPDefinition, { colorNeutral: true });

  // Re-run the color detection to obtain the solver's scheme (cross color /
  // frame) — needed to name F2L slots in the SOLVER's frame. Same call the
  // PhaseSplitter makes internally; no duplicated math. (Recomputed AFTER the
  // P2 frame recovery: the snapshots may have been rotated above.)
  const states = timeline.entries.map((e) => TimelineBuilder.fromSnapshot(e.state));
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
    pairs: buildPairs(timeline, crossFace, scheme, displayTokens),
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
  crossFace: string,
  scheme: Record<string, string> | undefined,
  displayTokens: readonly string[],
): F2LPairResult[] {
  // UNIFIED segmentation — the same function the smart route consumes via
  // CFOPMetricsCalculator. Pass the solver-frame crossFace/scheme (already
  // detected after P2) and the raw notation so the pairs read 1:1 with the
  // reconstruction text.
  return segmentF2LPairs(timeline, { crossFace, scheme, displayTokens }).map(
    (p) => ({
      slot: p.slot,
      colors: p.colors as [FaceLetter, FaceLetter],
      moves: p.moves,
      completionIndex: p.completionIndex,
      auf: p.auf,
    }),
  );
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


