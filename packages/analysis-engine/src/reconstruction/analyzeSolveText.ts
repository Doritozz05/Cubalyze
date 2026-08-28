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
  f2lSlotNames,
  applyFrameRotation,
  bestFrameRotationSequence,
  type CubeState,
  type FaceLetter,
  type F2LSlotInfo,
} from '@cubeforge/math-core';
import {
  CaseDetector,
  createBasicF2LDetector,
  createCFOPDetector,
  recolorState,
  type DetectionResult,
} from '@cubeforge/algorithm-db';
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
  /**
   * Relax the cross-completion criterion to permutation-only (edges in
   * their slots even if flipped) — matches how reconstructionists mark the
   * cross. Default false = strict (position + orientation).
   */
  relaxedCross?: boolean;
  /** Optional total solve time → only used for TPS. */
  totalTimeMs?: number;
}

export interface F2LPairResult {
  /** Slot name in the solver's cross frame: FR/BR/BL/FL. */
  slot: string;
  /** The pair's two side colors (canonical face letters). */
  colors: [FaceLetter, FaceLetter];
  /**
   * The pair's two side colors ALREADY ORDERED for the canonical FR mini
   * case render — `leftColor` goes on the render's F face (LEFT of the
   * image), `rightColor` on the render's R face. Derived from the ACTUAL
   * sticker faces in the detection frame (see segmentF2LPairs
   * pairDisplayColors), so they are the pair's real physical colors —
   * scheme-applied and rotation independent, never duplicated across
   * mirror pairs — for ANY cross or scheme. Absent when the completion
   * state cannot be read (defensive; the caller falls back to `colors`
   * with the same L→F→R ordering rule).
   */
  leftColor?: FaceLetter;
  rightColor?: FaceLetter;
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
  /**
   * The recognized algorithmic case for this pair (Basic F2L — 41 cases).
   * Present only when the modular case detector is available and matched;
   * `confidence: 'unknown'` when the pair is not in the basic catalog
   * (e.g. advanced F2L techniques).
   */
  detectedCase?: {
    /** Case number from the catalog, e.g. "F2L 1". */
    caseNumber: string;
    /** BirdF2L case name, e.g. "Jb". */
    caseName: string;
    /** 'exact' when the pair signature matched the catalog. */
    confidence: 'exact' | 'unknown';
  };
}

export interface LastLayerDetectedCase {
  /** Case number from the catalog, e.g. "OLL 24" / "Tb". */
  caseNumber: string;
  /** Case name, e.g. "OLL 24" / "Tb Perm". */
  caseName: string;
  /** 'exact' when the state matched the catalog. */
  confidence: 'exact' | 'unknown';
  /**
   * The sticker on the U face that sits at the solver's F position in the
   * state we detected. The catalog renders the case at its canonical AUF;
   * rotating the diagram by this face shows the case from the solver's
   * exact angle.
   */
  aufFace?: string;
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
    type: 'plain' | 'xcross' | 'xxcross' | 'xxxcross' | 'pseudo xcross';
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
  /** Standalone slice moves (M/E/S, NOT the half of a wide move) with the
   *  entry index of the move they precede. Slices update the cube state but
   *  produce no timeline entry (entries are face-move indexed), so they are
   *  reported separately — consumers interleave them into the phase moves
   *  for display exactly like rotations, so the algorithm reads 1:1 with
   *  the raw text (e.g. an OLL "U' S R …" keeps its S visible). */
  slices: { token: string; moveIndex: number }[];
  /** Last-layer phases in the SOLVER's raw notation (empty when skipped). */
  oll: {
    moves: string[];
    skipped: boolean;
    /** The recognized OLL case (state-based), when detected. */
    detectedCase?: LastLayerDetectedCase;
  } | null;
  pll: {
    moves: string[];
    skipped: boolean;
    /** The recognized PLL case (state-based), when detected. */
    detectedCase?: LastLayerDetectedCase;
  } | null;
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
  const solveSlices: { token: string; moveIndex: number }[] = [];
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
        let pushed = false;
        for (let j = 0; j < n && ci + j < conjPhase.length; j++) {
          if (FACE_MOVE_RE.test(conjPhase[ci + j])) {
            displayTokens.push(rawToken);
            entryCursor++;
            pushed = true;
          }
        }
        if (!pushed) {
          // A standalone slice (M/E/S — not the half of a wide move): it
          // moves the state but produces no timeline entry. Record it with
          // the index of the move it precedes so the panel can interleave
          // it into the phase's moves (the algorithm reads 1:1 with the
          // raw text, e.g. "U' S R …" keeps its S).
          solveSlices.push({ token: rawToken, moveIndex: entryCursor });
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
  // candidates, never a detector. The index is measured in ENTRY space
  // (conjugated FACE tokens, one per timeline entry) — with the wide-slice
  // fix the cross completion materializes exactly where the written segment
  // ends, so the face count of the segments up to and including the cross
  // phase gives the index.
  // IMPORTANT: the index must be measured on the FILTERED rawPhases (the
  // embedded inspection was already consumed above) — `perPhase[k + 1]`
  // aligns 1:1 with rawPhases[k] after the filter, so counting a leftover
  // inspection phase here would shift the tiebreak by one phase and the
  // written cross segment would end past its real entries.
  //
  // REGION: recon.nz splits a pseudo cross into a setup block + the block
  // that finishes it (cuberoot-1419 "W psT" then "xcross (BO)"; also
  // "W P"/"Y P"/"W T"/"W 222" → "xcross"/"xxcross" runs). The written
  // cross END is the end of the FIRST block whose label names a cross —
  // mirroring the divergence harness's rawCrossEnd (findIndex(/cross/i)) so
  // the two never disagree. Setup-shorthand blocks BEFORE that block
  // ("W psT", "W P" — no "cross" in the label) are included in the region;
  // a second cross-named block AFTER it ("Y pscross" → "xcross") is NOT: the
  // reconstructionist ended the cross at the pscross block (cuberoot-1359,
  // 1748 — measured cross end @6, not @10). Labels bound the region only,
  // they never detect anything.
  let preferredCrossIdx: number | undefined;
  const firstFacePhaseIndex = rawPhases.findIndex((p) =>
    p.tokens.some((t) => FACE_MOVE_RE.test(t)),
  );
  const crossNamedPhase = rawPhases.findIndex(
    (p, i) => i >= firstFacePhaseIndex && /cross/i.test(p.label),
  );
  const regionEndPhase =
    crossNamedPhase >= 0 ? crossNamedPhase : firstFacePhaseIndex;
  // Only meaningful when the written cross segment is a PROPER PREFIX of the
  // solve (there is at least one later phase). For a flat solution (no `//`
  // comments → a single phase holding every move) the "written cross end" is
  // the end of the whole solve, and preferring a cross that completes at the
  // last entry would let a coincidental end-of-solve cross ([last,last,last,
  // last] — every solved final state shows a cross on all 6 faces) win every
  // tie. Disable the tiebreak there and let the spurious/duration tests decide.
  if (firstFacePhaseIndex >= 0 && regionEndPhase < rawPhases.length - 1) {
    let faceCount = 0;
    for (let k = 0; k <= regionEndPhase; k++) {
      faceCount += perPhase[k + 1].filter((t) => FACE_MOVE_RE.test(t)).length;
    }
    preferredCrossIdx = faceCount - 1;
  }

  // ── Written PLL block (AUF-reclass guard) ─────────────────────────────
  // The reconstructionist's own PLL/AUF block is the ONLY signal that tells
  // a genuine AUF from a real PLL algorithm whose OLL boundary detection
  // lags into the block (both leave the state one U-turn from solved at the
  // OLL completion — reconz-11559's "EPLL" vs reconz-5061's "AUF"). A
  // written PLL block of >=5 face moves is a real last-layer algorithm (the
  // shortest is the 9-STM U-perm) and blocks the "PLL skip" reclassification
  // in the PhaseSplitter; an explicit "PLL Skip"/"solved" label means there
  // is no written algorithm at all (0 — never blocks); no PLL/AUF-named
  // block (flat solutions, 1LLL finishes) leaves the guard inert.
  const writtenPllPhase = [...rawPhases]
    .reverse()
    .find((p) => /pll|perm|auf/i.test(p.label));
  let writtenPllMoves: number | undefined;
  if (writtenPllPhase) {
    writtenPllMoves = /skip|solved/i.test(writtenPllPhase.label)
      ? 0
      : writtenPllPhase.tokens.filter((t) => FACE_MOVE_RE.test(t)).length;
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
  // carries synthetic timestamps, so the report keeps the synthetic span as
  // its duration baseline (the 'unattributed-time' warning is measured from
  // the timeline span, never the timer duration — see PhaseSplitter). The
  // smart route passes it through the core (real timestamps) — duration
  // semantics stay per route while phases/report/pairs come from one shared
  // pipeline.
  const timeline = buildAnnotatedTimeline({
    moves: solveMoves,
    method: 'CFOP',
    scramble: setup,
    stateTokens,
    preferredCrossIdx,
    relaxedCross: input.relaxedCross,
    // Raw display tokens (one per timeline entry) so the shared core can
    // track wide d (Dw) regrips for the solver-frame F2L slot analysis, and
    // the inspection grip so the solver-frame states are rotated into the
    // frame the solver actually held (the conjugated timeline is in the
    // scramble frame).
    displayTokens,
    solverGrip: inspectionTokens.filter(isRotation),
    writtenPllMoves,
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
  const detection = ColorPhaseDetector.detect(states, preferredCrossIdx, {
    relaxedCross: input.relaxedCross,
  });
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
    up: schemeToUse[grip.faceMap.U as FaceLetter] ?? 'U',
    front: schemeToUse[grip.faceMap.F as FaceLetter] ?? 'F',
  };

  // ── State-based last-layer case detection (OLL + PLL) ────────────────
  // The SAME modular detector the F2L pairs use, wired for the last-layer
  // probes. The state is read at the phase's completion — the exact frame
  // the solver held, with the solver's AUF applied — so the detected case
  // carries the AUF face (see LastLayerDetectedCase.aufFace) that lets the
  // renderer show the case from the solver's exact angle.
  const llDetector = createCFOPDetector();
  const llStateAt = (index: number | undefined): CubeState | null => {
    if (index === undefined || index < 0 || index >= timeline.entries.length) {
      return null;
    }
    // Read the POST-P2 timeline entries, NOT solverFrameStates: the
    // crossFace from the detection report is measured on these entries, and
    // the probe must see the state in the same frame as its crossFace.
    // solverFrameStates can be rotated relative to the entries (P2 recovery
    // vs the solver-grip rotation), so probing them with the report's
    // crossFace feeds a state whose cross sits on a DIFFERENT face — the
    // reconz-3008/4996/2463 B-cross PLL misses (Ja/Ua states rejected while
    // the entries state detects cleanly).
    const snap = timeline.entries[index]?.state;
    if (!snap) return null;
    return TimelineBuilder.fromSnapshot(snap);
  };
  // The state at the phase's start (the last entry BEFORE its first move)
  // is the case the solver faced. `startIndex - 1` is the previous phase's
  // completion — exactly the frame with the solver's AUF applied.
  const llCaseStateAt = (phase: PhaseDetectionReport['phases'][number] | undefined): CubeState | null => {
    const start = phase?.startIndex;
    return llStateAt(start !== undefined ? start - 1 : undefined);
  };
  const detectLL = (
    phase: PhaseDetectionReport['phases'][number] | undefined,
    probe: 'last-layer-orientation' | 'last-layer-permutation',
  ): LastLayerDetectedCase | undefined => {
    if (!phase || phase.skipped) return undefined;
    // The CASE is the state the solver FACED at the phase's start — the
    // last entry before the first move of the phase (startIndex - 1). The
    // completion index is where the phase's mask matches (already
    // oriented / solved), so detecting there would always see the solved
    // pattern, never the case.
    const state = llCaseStateAt(phase);
    if (!state) return undefined;
    // NOTE: do NOT recolorState() here. The probe + native multi-crossFace
    // catalog detect the PHYSICAL state directly for all 6 cross faces (see
    // pll-crossface-24.test.ts: 24 rotations x 6 faces, 0 misses). Recoloring
    // with a rotation-type scheme (cross on F/B/R/L) corrupts the piece
    // permutation (the recolored state's cross pieces land on no single
    // face), which is why side-cross PLLs like reconz-9679 (Ja) were missed
    // while the un-recolored state detects cleanly. The aufFace is then
    // relative to the physical frame; the D-cross identity scheme is a
    // no-op, so canonical solves are unaffected.
    const canon = state;
    try {
      const result = llDetector.detectWith(canon, { probe, crossFace });
      if (result.entry && result.confidence === 'exact') {
        return {
          caseNumber: result.entry.caseNumber,
          caseName: result.entry.caseName,
          confidence: result.confidence,
          aufFace: result.aufFace,
        };
      }
    } catch {
      // Detection must never break the reconstruction.
    }
    return undefined;
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
    cross: buildCross(report, displayTokens, crossFace),
    pairs: buildPairs(
      timeline,
      crossFace,
      scheme,
      displayTokens,
      preferredCrossIdx,
      input.relaxedCross,
    ),
    rotations,
    slices: solveSlices,
    oll: buildLLPhase(report, 'OLL', displayTokens, detectLL(
      report.phases.find((p) => p.phaseName === 'OLL'),
      'last-layer-orientation',
    )),
    pll: buildLLPhase(report, 'PLL', displayTokens, detectLL(
      report.phases.find((p) => p.phaseName === 'PLL'),
      'last-layer-permutation',
    )),
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
  crossFace: string,
): SolveReconstruction['cross'] {
  const phase = report.phases.find((p) => p.phaseName === 'Cross');
  const start = phase?.startIndex ?? 0;
  const end = phase?.endIndex ?? start;
  const moves = phase
    ? displayTokens.slice(start, end + 1)
    : [];
  const type = report.crossType ?? 'plain';
  // The report's xcrossPairs carry {slot, colors}; normalize into a real
  // F2LSlotInfo (slotIndex + name) so consumers (the panel tooltip) never
  // read a missing field.
  const xcrossEntry = report.xcrossPairs?.[0];
  const slotNames = f2lSlotNames(crossFace);
  const xcrossPair: F2LSlotInfo | undefined = xcrossEntry
    ? {
        slotIndex: Math.max(0, slotNames.indexOf(xcrossEntry.slot)),
        name: xcrossEntry.slot,
        // Slot colors are always outer faces (never M/E/S).
        colors: xcrossEntry.colors as [FaceLetter, FaceLetter],
      }
    : undefined;
  return {
    moves,
    type,
    xcrossPair,
  };
}

/**
 * Build the state at a pair's CUT index — the frame just before the pair's
 * first move — in the same solver frame the pair scan used.
 *
 * Mirrors the frame measurement in segmentF2LPairs: solverFrameStates +
 * bestFrameRotationSequence (the D/E frame DP). The pair's start index is
 * `completionIndex - moves.length + 1` (the completion entry minus the
 * owned moves, in ENTRY space).
 */
function pairCutState(
  timeline: SolveTimeline,
  crossFace: string,
  scheme: Record<string, string> | null,
  start: number,
  end: number,
  cut: number,
): CubeState | null {
  if (cut < 0) return null;
  const spanStart = Math.max(0, start - 1);
  const spanStates: CubeState[] = [];
  for (let i = spanStart; i <= end; i++) {
    const snap = timeline.solverFrameStates?.[i] ?? timeline.entries[i]?.state;
    if (!snap) return null;
    spanStates.push(TimelineBuilder.fromSnapshot(snap));
  }
  const frames = bestFrameRotationSequence(
    spanStates,
    0,
    spanStates.length - 1,
    crossFace,
    scheme ?? IDENTITY_SCHEME,
  );
  const j = cut - spanStart;
  if (j < 0 || j >= frames.length) return null;
  const snap = timeline.solverFrameStates?.[cut] ?? timeline.entries[cut]?.state;
  if (!snap) return null;
  return applyFrameRotation(TimelineBuilder.fromSnapshot(snap), frames[j]);
}

function buildPairs(
  timeline: SolveTimeline,
  crossFace: string,
  scheme: Record<string, string> | undefined,
  displayTokens: readonly string[],
  preferredCrossIdx?: number,
  relaxedCross?: boolean,
): F2LPairResult[] {
  // UNIFIED segmentation — the same function the smart route consumes via
  // CFOPMetricsCalculator. Pass the solver-frame crossFace/scheme (already
  // detected after P2), the raw notation so the pairs read 1:1 with the
  // reconstruction text, and the written-cross tiebreak so the solver-frame
  // detection picks the SAME cross as the PhaseSplitter did (without it, a
  // spurious cross on an untouched layer can win the tie and the pair scan
  // sees the wrong frame — the reconz-12564 empty-pairs regression).
  const pairs = segmentF2LPairs(timeline, {
    crossFace,
    scheme,
    displayTokens,
    preferredCrossIdx,
    relaxedCross,
  });

  // ── Modular case detection (Basic F2L — 41 cases) ────────────────────
  // The detector is created lazily per call: the catalog build reads the
  // 41 seed setups and computes ~164 signatures, which is cheap but not
  // free, and most reconstructions have 4 pairs. The detector itself is
  // stateless after construction, so it could be hoisted to module scope
  // if hot-path profiling ever demands it.
  const f2l = timeline.detectionReport?.phases.find(
    (p) => p.phaseName === 'F2L',
  );
  const cross = timeline.detectionReport?.phases.find(
    (p) => p.phaseName === 'Cross',
  );
  const f2lStart = f2l?.startIndex ?? 0;
  const f2lEnd = f2l?.endIndex ?? timeline.entries.length - 1;
  const pairScanStart = (cross?.endIndex ?? f2lStart - 1) + 1;
  let detector: CaseDetector | null = null;

  return pairs.map((p) => {
    const base: F2LPairResult = {
      slot: p.slot,
      colors: p.colors as [FaceLetter, FaceLetter],
      leftColor: p.leftColor,
      rightColor: p.rightColor,
      moves: p.moves,
      completionIndex: p.completionIndex,
      auf: p.auf,
    };

    // Detection only applies to real F2L pairs (non-empty slots).
    if (!p.slot || p.slot.startsWith('SLOT-')) return base;

    if (!detector) {
      detector = createBasicF2LDetector();
    }

    try {
      const startIdx = p.completionIndex - p.moves.length + 1;
      const cut = startIdx - 1;
      const state = pairCutState(
        timeline,
        crossFace,
        scheme ?? null,
        pairScanStart,
        f2lEnd,
        cut,
      );
      if (!state) return base;

      const canon = scheme
        ? recolorState(state, scheme)
        : state;

      const result: DetectionResult = detector.detect(canon, crossFace, p.slot);
      if (result.entry && result.confidence === 'exact') {
        base.detectedCase = {
          caseNumber: result.entry.caseNumber,
          caseName: result.entry.caseName,
          confidence: result.confidence,
        };
      }
    } catch {
      // Detection must never break the reconstruction.
    }

    return base;
  });
}

function buildLLPhase(
  report: PhaseDetectionReport,
  name: 'OLL' | 'PLL',
  displayTokens: readonly string[],
  detectedCase?: LastLayerDetectedCase,
): { moves: string[]; skipped: boolean; detectedCase?: LastLayerDetectedCase } | null {
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
  return { moves, skipped: !!phase.skipped, detectedCase };
}


