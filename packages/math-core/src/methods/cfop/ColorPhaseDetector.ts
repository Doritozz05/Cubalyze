import { CubeState } from '../../CubeState';
import {
  cornerFacelet,
  edgeFacelet,
  cornerColor,
  edgeColor,
  FaceletStringConverter,
} from '../../FaceletStringConverter';
import { FACE_LAYERS } from './cfopMasks';

/**
 * ColorPhaseDetector — CFOP phase detection by COLOR, not by piece anchors.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The piece-anchored masks (CrossMask / F2LMask / OLLMask / PLLMask and the
 * 6-face COLOR_NEUTRAL_CFOP_MASKS) require the cross edges of a FIXED color at
 * FIXED positions (e.g. the yellow edges on D). A solver who builds a white
 * cross on D — the standard style — is invisible to all 24 masks, because
 * piece identities are rotation-invariant: rotating the cube can never turn
 * the white edges (UR/UF/UL/UB) into the yellow edges (DR/DF/DL/DB).
 *
 * ── How it works ───────────────────────────────────────────────────────────
 * Phases are recognized from the GEOMETRY of the stickers:
 *
 *   Cross done — the 4 edge stickers of SOME face are all the same color C.
 *                (Exactly "the 4 C-colored edges sit on that face with their
 *                C sticker facing out", for ANY face and ANY color — so a
 *                white cross on D, a yellow cross on U, any CN style all
 *                register.)
 *   F2L done   — every sticker that does NOT belong to a last-layer piece
 *                matches the solved layout, after re-coloring the state into
 *                the solver's color scheme (derived from the completed cross).
 *   OLL done   — F2L done and the 8 non-center stickers of the last-layer
 *                face are all the last-layer color.
 *   PLL done   — the cube is actually solved.
 *
 * The last layer of the solver is always the layer OPPOSITE the cross color,
 * so the detector is fully independent of both the cross color and the cross
 * face. Rotated frames (reconstructions written in the solver's grip) are
 * handled by the caller trying the 24 cube rotations.
 *
 * ── Cross alignment (AUF) ──────────────────────────────────────────────────
 * A cross is detected the moment its 4 edges sit on the cross face — but the
 * solver usually completes it DISALIGNED and only aligns it with a U/U'/U2
 * immediately after. The color scheme is derived from the cross edges' side
 * stickers, which are wrong until the cross is aligned; the derived scheme
 * can therefore be rotated by any of the 4 AUF rotations. We try all 4 and
 * keep the one that yields the best downstream phase chain.
 *
 * ── Output ─────────────────────────────────────────────────────────────────
 * `detect()` scans all 6 faces as potential cross faces, keeps every candidate
 * that ever holds a completed cross, and returns the best one (complete 4
 * phases > more phases > closest to the solver's written cross segment (when
 * the caller provides it) > non-spurious F2L/OLL > longest-lived cross >
 * earlier cross > earlier progress) — mirroring PhaseSplitter.compareRuns so
 * a spurious face cross never wins over the solver's real one.
 */
export const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type FaceLetter = (typeof FACE_LETTERS)[number];

const OPPOSITE: Record<FaceLetter, FaceLetter> = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F',
};

const FACE_OFFSET: Record<FaceLetter, number> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

/** Canonical solved facelet string (9× each face letter in U,R,F,D,L,B order). */
const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const CENTER_FACELETS = [4, 13, 22, 31, 40, 49];

function faceOfFacelet(i: number): FaceLetter {
  if (i < 9) return 'U';
  if (i < 18) return 'R';
  if (i < 27) return 'F';
  if (i < 36) return 'D';
  if (i < 45) return 'L';
  return 'B';
}

/** For each face F, the 4 facelet indices of F's edge ring that lie ON F. */
export const CROSS_EDGE_FACELETS: Record<FaceLetter, number[]> = (() => {
  const out = {} as Record<FaceLetter, number[]>;
  for (const face of FACE_LETTERS) {
    out[face] = FACE_LAYERS[face].crossEdges.map((pos) => {
      const [a, b] = edgeFacelet[pos];
      return faceOfFacelet(a) === face ? a : b;
    });
  }
  return out;
})();

/**
 * For each face F, the TWO facelet indices of each edge sitting at F's cross
 * positions (one sticker on F, one on the adjacent side face). Used by the
 * RELAXED cross check, which only needs each edge to CONTAIN the cross color
 * somewhere (permutation), not to show it on the cross face (orientation).
 */
const CROSS_EDGE_POSITIONS: Record<FaceLetter, [number, number][]> = (() => {
  const out = {} as Record<FaceLetter, [number, number][]>;
  for (const face of FACE_LETTERS) {
    out[face] = FACE_LAYERS[face].crossEdges.map(
      (pos) => edgeFacelet[pos] as [number, number],
    );
  }
  return out;
})();

/**
 * The side face adjacent to each cross-edge POSITION, in the same order as
 * FACE_LAYERS[face].crossEdges. Used both to derive the color scheme (which
 * color each side face shows) and to generate the 4 AUF-aligned variants.
 */
const CROSS_SIDE_FACES: Record<FaceLetter, FaceLetter[]> = (() => {
  const out = {} as Record<FaceLetter, FaceLetter[]>;
  for (const face of FACE_LETTERS) {
    out[face] = FACE_LAYERS[face].crossEdges.map((pos) => {
      const [a, b] = edgeColor[pos];
      return (a === face ? b : a) as FaceLetter;
    });
  }
  return out;
})();

/**
 * For each FACE f: the facelet indices of the 8 pieces that sit on that face
 * in the solved state (4 corners × 3 stickers + 4 edges × 2 stickers) PLUS
 * all 6 centers.
 *
 * This is the "last layer" exclusion set for the F2L test. It is keyed by
 * FACE (not by the last-layer color!): at F2L completion the last-layer
 * pieces physically occupy the facelets of the face opposite the cross face,
 * and those positions are exactly the home facelets of the pieces containing
 * that face's canonical color.
 *
 * The centers are added because after re-coloring to the solver's scheme they
 * no longer match the canonical solved layout; centers are fixed and carry no
 * piece information, so comparing them is meaningless.
 */
const LAST_LAYER_FACELETS: Record<FaceLetter, Set<number>> = (() => {
  const out = {} as Record<FaceLetter, Set<number>>;
  for (const color of FACE_LETTERS) {
    const set = new Set<number>();
    for (let c = 0; c < 8; c++) {
      if (cornerColor[c].includes(color)) cornerFacelet[c].forEach((i) => set.add(i));
    }
    for (let e = 0; e < 12; e++) {
      if (edgeColor[e].includes(color)) edgeFacelet[e].forEach((i) => set.add(i));
    }
    CENTER_FACELETS.forEach((i) => set.add(i));
    out[color] = set;
  }
  return out;
})();

export interface ColorDetectionResult {
  /** Face where the cross was detected. */
  crossFace: FaceLetter;
  /** The cross color (a face letter). */
  crossColor: FaceLetter;
  /** Entry indices [cross, f2l, oll, pll]; -1 when a phase never completed. */
  completions: [number, number, number, number];
  /**
   * Number of timeline indices (from the cross completion onward) where the
   * cross of `crossColor` stays complete on `crossFace`. The solver's REAL
   * cross persists until the end of the solve (it is never disturbed), so a
   * long-lived cross is the genuine one; a cross that only existed for a
   * move or two is a coincidence of the scrambled state.
   */
  crossDuration: number;
  /**
   * The winning AUF-corrected color scheme: solver face → color letter.
   * This is the frame the solver's F2L slots are defined in — XCross and
   * per-pair analysis re-color the state with it before checking slots.
   */
  scheme: Record<FaceLetter, FaceLetter>;
}

/**
 * Read the cross edges' side stickers at the cross state: `sideColors[j]` is
 * the color the cross edge at cross-edge position j shows on its adjacent
 * side face. For an ALIGNED cross this IS the solver's color scheme (rotated
 * by 0); for a disaligned one it is rotated by some AUF (handled by trying
 * the 4 rotations).
 */
function crossSideColors(
  state: CubeState,
  crossFace: FaceLetter,
  crossColor: FaceLetter,
): FaceLetter[] | null {
  const sideColors: FaceLetter[] = [];
  for (const pos of FACE_LAYERS[crossFace].crossEdges) {
    const pieceColors = edgeColor[state.ep[pos]];
    const sideColor = pieceColors[0] === crossColor ? pieceColors[1] : pieceColors[0];
    if (sideColor === crossColor) return null;
    sideColors.push(sideColor as FaceLetter);
  }
  // The 4 C-colored edges have 4 distinct side colors; any collision means the
  // state is inconsistent and cannot anchor a scheme.
  if (new Set(sideColors).size !== 4) return null;
  return sideColors;
}

/**
 * Build the full color scheme (face → color) for one AUF rotation of the
 * derived side colors. `rotation` 0 is the scheme as-read; 1..3 are the AUF
 * variants. Returns null when the scheme is not a bijection.
 */
function buildScheme(
  crossFace: FaceLetter,
  crossColor: FaceLetter,
  sideFaces: readonly FaceLetter[],
  sideColors: readonly FaceLetter[],
  rotation: number,
): Record<FaceLetter, FaceLetter> | null {
  const scheme = {} as Record<FaceLetter, FaceLetter>;
  scheme[crossFace] = crossColor;
  for (let j = 0; j < 4; j++) {
    scheme[sideFaces[j]] = sideColors[(j + rotation) % 4];
  }
  const assigned = new Set(Object.values(scheme));
  const remaining = FACE_LETTERS.find((f) => !assigned.has(f));
  if (remaining === undefined) return null;
  scheme[OPPOSITE[crossFace]] = remaining;
  if (new Set(Object.values(scheme)).size !== FACE_LETTERS.length) return null;
  return scheme;
}

/** Re-color a facelet string into the canonical color scheme. */
function canonicalize(facelets: string, inverseScheme: Record<string, string>): string {
  let out = '';
  for (let i = 0; i < facelets.length; i++) {
    out += inverseScheme[facelets[i]] ?? facelets[i];
  }
  return out;
}

/** The cross color shown by face F's 4 edge stickers, or null if not a cross. */
function crossColorAt(facelets: string, face: FaceLetter): FaceLetter | null {
  const idxs = CROSS_EDGE_FACELETS[face];
  const c = facelets[idxs[0]];
  for (const i of idxs) {
    if (facelets[i] !== c) return null;
  }
  return c as FaceLetter;
}

/**
 * RELAXED cross check (permutation, orientation free): every edge sitting at
 * face F's 4 cross positions contains `crossColor` on ONE of its two visible
 * stickers. An edge flipped in its slot (cross color showing on the side
 * face instead of on F) still counts — the cross is "built" even though the
 * solver still has to fix the orientation (reconstructionists mark the cross
 * done at that point; the flip fix lands in the first F2L pair).
 *
 * The permutation is validated separately by `crossSideColors` (the 4 edges
 * must be the 4 DISTINCT cross edges) and by `buildScheme` (their side
 * colors must form a rotation of the correct order, or the scheme is not a
 * bijection and the candidate is discarded).
 */
function relaxedCrossColorAt(
  facelets: string,
  face: FaceLetter,
  crossColor: FaceLetter,
): boolean {
  for (const [a, b] of CROSS_EDGE_POSITIONS[face]) {
    if (facelets[a] !== crossColor && facelets[b] !== crossColor) return false;
  }
  return true;
}

/**
 * F2L complete: every sticker not on the last-layer layer (the face opposite
 * the cross face) matches the solved layout.
 */
function f2lComplete(facelets: string, lastLayerFace: FaceLetter): boolean {
  const excluded = LAST_LAYER_FACELETS[lastLayerFace];
  for (let i = 0; i < 54; i++) {
    if (!excluded.has(i) && facelets[i] !== SOLVED_FACELETS[i]) return false;
  }
  return true;
}

/** OLL complete: the 8 non-center stickers of the last-layer face are all its color. */
function ollComplete(facelets: string, lastLayerFace: FaceLetter): boolean {
  const base = FACE_OFFSET[lastLayerFace];
  for (let j = 0; j < 9; j++) {
    if (j === 4) continue; // center
    if (facelets[base + j] !== lastLayerFace) return false;
  }
  return true;
}

/**
 * Within ONE (face, color) candidate family: prefer the most complete chain,
 * then (when the solver's written cross end is known) the completion CLOSEST
 * to it — reconstructionists write the cross boundary where THEY consider it
 * done, which is exactly the boundary relaxed mode is matching. A solver
 * builds the cross once, and the written end separates the true completion
 * from an earlier coincidental permutation (a scramble can leave the 4 cross
 * edges permuted in their slots for a move or two). On full tie, EARLIEST
 * wins (the first state where the 4 edges occupy their slots).
 */
function betterSameCross(
  a: ColorDetectionResult,
  b: ColorDetectionResult,
  preferredCrossIdx?: number,
): boolean {
  const aComplete = a.completions.every((c) => c >= 0);
  const bComplete = b.completions.every((c) => c >= 0);
  if (aComplete !== bComplete) return aComplete;
  const aCount = a.completions.filter((c) => c >= 0).length;
  const bCount = b.completions.filter((c) => c >= 0).length;
  if (aCount !== bCount) return aCount > bCount;
  if (preferredCrossIdx !== undefined) {
    const aDist = Math.abs(a.completions[0] - preferredCrossIdx);
    const bDist = Math.abs(b.completions[0] - preferredCrossIdx);
    if (aDist !== bDist) return aDist < bDist;
  }
  return a.completions[0] < b.completions[0];
}

/**
 * Prefer (strict): complete 4 phases > more phases > closest to the solver's
 * written cross segment > non-spurious F2L/OLL > longest-lived cross >
 * earlier cross > earlier progress.
 *
 * Prefer (relaxed): the written cross segment FIRST (when available), then
 * complete 4 phases > more phases > non-spurious > duration > earlier. The
 * relaxed criterion admits far more candidate families, and a spurious
 * scheme can "complete" all 4 phases only at the final solved state (f2l@
 * last, oll@last — e.g. a COLL/EO solve whose real cross never completes the
 * canonical OLL chain). The reconstructor's written cross boundary is the
 * strongest signal available and reliably separates the real cross from such
 * end-of-solve artifacts, so it outranks the phase count in relaxed mode.
 * Strict mode keeps the original order — a strict 4/4 chain is already the
 * real cross (far fewer candidates), so phase count first is safe there.
 * Without `preferredCrossIdx` (smart-cube route) both modes fall back to the
 * phase-count-first order.
 */
function better(
  a: ColorDetectionResult,
  b: ColorDetectionResult,
  lastIndex: number,
  preferredCrossIdx?: number,
  relaxed?: boolean,
): boolean {
  // Relaxed: written segment first (see doc comment).
  if (relaxed && preferredCrossIdx !== undefined) {
    const aDist = Math.abs(a.completions[0] - preferredCrossIdx);
    const bDist = Math.abs(b.completions[0] - preferredCrossIdx);
    if (aDist !== bDist) return aDist < bDist;
  }
  const aComplete = a.completions.every((c) => c >= 0);
  const bComplete = b.completions.every((c) => c >= 0);
  if (aComplete !== bComplete) return aComplete;
  const aCount = a.completions.filter((c) => c >= 0).length;
  const bCount = b.completions.filter((c) => c >= 0).length;
  if (aCount !== bCount) return aCount > bCount;
  // The solver's written cross segment (when known) is the strongest signal:
  // it separates the real cross (completed exactly where the reconstructor
  // stopped writing moves) from a coincidental cross that happens to produce
  // an equally complete chain. Placed BEFORE the spurious heuristic because
  // one-look LL (ZBLL) legitimately completes OLL on the final move, which
  // the spurious test would penalize. NEVER used to detect — tiebreak only.
  if (!relaxed && preferredCrossIdx !== undefined) {
    const aDist = Math.abs(a.completions[0] - preferredCrossIdx);
    const bDist = Math.abs(b.completions[0] - preferredCrossIdx);
    if (aDist !== bDist) return aDist < bDist;
  }
  // A completion of F2L/OLL at the very last entry is only ever legitimate
  // for a solve that reaches F2L/OLL on the final move; in practice it marks
  // a scheme that merely "fits" the solved state (any face works there).
  const aSpurious =
    (a.completions[1] >= 0 && a.completions[1] >= lastIndex) ||
    (a.completions[2] >= 0 && a.completions[2] >= lastIndex);
  const bSpurious =
    (b.completions[1] >= 0 && b.completions[1] >= lastIndex) ||
    (b.completions[2] >= 0 && b.completions[2] >= lastIndex);
  if (aSpurious !== bSpurious) return !aSpurious;
  // The solver's cross is never disturbed after it is built, so it stays
  // complete for (nearly) the whole solve; a cross that only coincides for a
  // couple of moves is spurious. Decides when two crosses produce equally
  // valid full chains (e.g. after frame recovery) and no written segment is
  // available. Note this rewards EARLIER crosses that persist (a genuine
  // persistent coincidence can beat the real one — the preferred index
  // above is the stronger signal when it exists).
  if (a.crossDuration !== b.crossDuration) return a.crossDuration > b.crossDuration;
  if (a.completions[0] !== b.completions[0]) return a.completions[0] < b.completions[0];
  const aSum = a.completions.filter((c) => c >= 0).reduce((s, c) => s + c, 0);
  const bSum = b.completions.filter((c) => c >= 0).reduce((s, c) => s + c, 0);
  return aSum < bSum;
}

/** Compute the full phase chain for one (crossFace, scheme) candidate. */
function evaluateCandidate(
  raw: string[],
  states: CubeState[],
  crossIdx: number,
  crossFace: FaceLetter,
  crossColor: FaceLetter,
  scheme: Record<FaceLetter, FaceLetter>,
  relaxed: boolean,
): ColorDetectionResult {
  // How long the cross of `crossColor` stays complete on `crossFace` — the
  // solver's real cross is built once and never disturbed afterwards, so it
  // survives to (near) the end of the solve; a coincidental cross vanishes
  // within a few moves. In relaxed mode the same relaxed check measures the
  // persistence (a flipped-edge cross stays permuted for the whole solve).
  const crossHeld = (j: number): boolean =>
    relaxed
      ? relaxedCrossColorAt(raw[j], crossFace, crossColor)
      : crossColorAt(raw[j], crossFace) === crossColor;
  let crossDuration = 0;
  for (let j = crossIdx; j < raw.length; j++) {
    if (crossHeld(j)) crossDuration++;
  }

  const inverseScheme: Record<string, string> = {};
  for (const f of FACE_LETTERS) inverseScheme[scheme[f]] = f;
  const canonical = raw.map((s, i) => (i >= crossIdx ? canonicalize(s, inverseScheme) : s));
  const lastLayerFace = OPPOSITE[crossFace];

  let f2lIdx = -1;
  for (let i = crossIdx; i < raw.length; i++) {
    if (f2lComplete(canonical[i], lastLayerFace)) {
      f2lIdx = i;
      break;
    }
  }

  let ollIdx = -1;
  if (f2lIdx >= 0) {
    for (let i = f2lIdx; i < raw.length; i++) {
      if (
        f2lComplete(canonical[i], lastLayerFace) &&
        ollComplete(canonical[i], lastLayerFace)
      ) {
        ollIdx = i;
        break;
      }
    }
  }

  let pllIdx = -1;
  if (ollIdx >= 0) {
    for (let i = ollIdx; i < states.length; i++) {
      if (states[i].isSolved()) {
        pllIdx = i;
        break;
      }
    }
  }

  return {
    crossFace,
    crossColor,
    completions: [crossIdx, f2lIdx, ollIdx, pllIdx],
    crossDuration,
    scheme,
  };
}

export class ColorPhaseDetector {
  /**
   * Detect the best CFOP phase sequence by color.
   *
   * Returns null when no face ever holds a completed cross (e.g. an
   * incoherent reconstruction) — callers fall back to canonical masks.
   *
   * `options.relaxedCross` switches the cross-completion criterion from
   * "4 cross edges on the cross face, oriented" to "the 4 cross edges in
   * their 4 slots (permutation), orientation free" — a cross the solver
   * built but left with a flipped edge counts as done at that point, exactly
   * where reconstructionists mark it. Flipped edges surface the cross EARLIER
   * (and on the correct face), so solves whose strict cross never registers
   * until late (or on a spurious side face) lock onto the real cross via the
   * usual tiebreaks (written cross segment, chain completeness, duration).
   */
  static detect(
    states: CubeState[],
    preferredCrossIdx?: number,
    options?: { relaxedCross?: boolean },
  ): ColorDetectionResult | null {
    if (states.length === 0) return null;
    const raw = states.map((s) => FaceletStringConverter.toFaceletString(s));
    const lastIndex = states.length - 1;
    const relaxed = options?.relaxedCross === true;

    let best: ColorDetectionResult | null = null;

    for (const face of FACE_LETTERS) {
      if (!relaxed) {
        // ── Strict mode: first state where the cross face holds a completed
        // (oriented) cross. One candidate per face, exactly as before.
        let crossIdx = -1;
        let crossColor: FaceLetter | null = null;
        for (let i = 0; i < raw.length; i++) {
          const c = crossColorAt(raw[i], face);
          if (c !== null) {
            crossIdx = i;
            crossColor = c;
            break;
          }
        }
        if (crossIdx < 0 || crossColor === null) continue;

        const sideColors = crossSideColors(states[crossIdx], face, crossColor);
        if (sideColors === null) continue;
        const sideFaces = CROSS_SIDE_FACES[face];

        // The cross may be complete but disaligned; try all 4 AUF rotations
        // of the scheme and keep the best chain for this face.
        let faceBest: ColorDetectionResult | null = null;
        for (let rotation = 0; rotation < 4; rotation++) {
          const scheme = buildScheme(face, crossColor, sideFaces, sideColors, rotation);
          if (scheme === null) continue;
          const candidate = evaluateCandidate(
            raw,
            states,
            crossIdx,
            face,
            crossColor,
            scheme,
            false,
          );
          if (
            faceBest === null ||
            better(candidate, faceBest, lastIndex, preferredCrossIdx, false)
          ) {
            faceBest = candidate;
          }
          if (
            best === null ||
            better(candidate, best, lastIndex, preferredCrossIdx, false)
          ) {
            best = candidate;
          }
        }
        continue;
      }

      // ── Relaxed mode: evaluate EVERY valid relaxed completion per color.
      // The first hit can lock onto a spurious early state (a scramble
      // occasionally leaves the 4 cross edges permuted in the slots); the
      // real cross completes a state or two later. Per (face, color) keep the
      // best chain, EARLIEST completion on tie (true completion), then the
      // winning (face, color) competes globally with the usual tiebreaks
      // (written cross segment, chain completeness, duration).
      const sideFaces = CROSS_SIDE_FACES[face];
      for (const color of FACE_LETTERS) {
        let colorBest: ColorDetectionResult | null = null;
        for (let i = 0; i < raw.length; i++) {
          if (!relaxedCrossColorAt(raw[i], face, color)) continue;
          // Distinctness of the 4 edges is the permutation gate: the 4 C
          // edges must be the 4 DISTINCT cross edges, in an order that forms
          // a rotation of the correct one (buildScheme's bijection check).
          const sideColors = crossSideColors(states[i], face, color);
          if (sideColors === null) continue;
          for (let rotation = 0; rotation < 4; rotation++) {
            const scheme = buildScheme(face, color, sideFaces, sideColors, rotation);
            if (scheme === null) continue;
            const candidate = evaluateCandidate(
              raw,
              states,
              i,
              face,
              color,
              scheme,
              true,
            );
            if (
              colorBest === null ||
              betterSameCross(candidate, colorBest, preferredCrossIdx)
            ) {
              colorBest = candidate;
            }
          }
        }
        if (
          colorBest !== null &&
          (best === null ||
            better(colorBest, best, lastIndex, preferredCrossIdx, true))
        ) {
          best = colorBest;
        }
      }
    }

    return best;
  }
}
