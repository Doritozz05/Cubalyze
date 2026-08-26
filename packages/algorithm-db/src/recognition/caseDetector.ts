/**
 * caseDetector.ts — Main detection engine.
 *
 * Given a cube state (already recolored to the solver's canonical frame),
 * a crossFace, and a slot name, returns the recognized F2L case.
 *
 * Architecture:
 *   1. Resolve the pair pieces BY COLOR for the slot → (C, E).
 *   2. Rotate the state onto the D-cross anchor (frame→D rotation).
 *   3. Compute the relational pair signature (minimized over y × AUF).
 *   4. Look up in the frame-agnostic catalog.
 *
 * The slot→FR normalization rotates the observed state into the anchor
 * frame; the relational signature (see pairSignature.ts) then minimizes
 * over all y-rotations × AUF, so the pair is recognized regardless of
 * which slot it sits in, its AUF, or which physical pieces carry the
 * pair's colors (a parked/mirror corner collapses onto the same case).
 *
 * Designed to be puzzle- / method- / subset-agnostic: the catalog
 * determines what can be recognized. Adding OLL or 2×2 cases means
 * loading their data into the same catalog structure.
 */
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { pairSignature } from './pairSignature';
import { resolveSlotPiecesByColor, slotToFRRotation } from './slotResolver';
import { lookupCatalog, createCatalog } from './caseCatalog';
import type {
  CatalogEntry,
  DetectionResult,
  SubsetManifest,
  CaseSeedData,
} from './types';

// ─── Detector ────────────────────────────────────────────────────────────────

/** Facelet index of each face's center (U:4, R:13, F:22, D:31, L:40, B:49). */
const CENTER_FACELET: Record<string, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

/** Facelet index of the center of a given face (undefined for unknown). */
function centerFacelet(face: string): number | undefined {
  return CENTER_FACELET[face];
}

/**
 * CaseDetector — recognizes algorithmic cases from cube states.
 *
 * Construct once with a set of subsets and a case loader, then call
 * `detect()` for each pair/slot to classify.
 *
 * @example
 *   const detector = CaseDetector.create([
 *     { methodId: '…cfop', subsetId: '…basic-f2l', label: 'Basic F2L',
 *       crossFaces: ['D', 'U'] },
 *   ], loadBasicF2L);
 *
 *   const result = detector.detect(state, 'U', 'FR');
 */
export class CaseDetector {
  private catalog: Map<string, CatalogEntry>;

  private constructor(catalog: Map<string, CatalogEntry>) {
    this.catalog = catalog;
  }

  /**
   * Factory: build a detector from subset manifests and a case loader.
   *
   * @param subsets — manifests describing what to recognize.
   * @param loadCases — (subsetId, crossFace) → seed case array.
   */
  static create(
    subsets: SubsetManifest[],
    loadCases: (subsetId: string, crossFace: string) => CaseSeedData[],
  ): CaseDetector {
    const catalog = createCatalog(subsets, loadCases);
    return new CaseDetector(catalog);
  }

  /**
   * Detect the algorithmic case for an F2L pair.
   *
   * @param state — Cube state at the pair's cut index, ALREADY recolored
   *                to the solver's canonical frame via `recolorState`.
   * @param crossFace — The solver's cross face (D, U, F, B, R, L).
   * @param slotName — The slot name in this cross frame (FR, BR, BL, FL).
   */
  detect(
    state: CubeState,
    crossFace: string,
    slotName: string,
  ): DetectionResult {
    // Resolve the pair pieces BY COLOR (the slot's {cross, sideA, sideB}
    // corner and {sideA, sideB} edge) wherever they sit in the state — a
    // corner parked in a neighboring slot still resolves to its own pair,
    // and the same color rule holds for every cross frame after the
    // pipeline's recolor.
    const pieces = resolveSlotPiecesByColor(state, crossFace, slotName);
    if (!pieces) {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: '',
      };
    }

    // Normalize the pair into the D-cross anchor frame: every cross face
    // rotates onto 'D' (U via x2, F via x', B via x, R via z, L via z',
    // D via identity). The relational signature additionally minimizes
    // over all y-rotations × AUF, so the pair is recognized regardless of
    // which slot it sits in or which AUF it has.
    const rotation = slotToFRRotation(crossFace, slotName);
    if (rotation === null) {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: '',
      };
    }

    const normalized = state.clone();
    if (rotation) normalized.applySequence(rotation);

    // The cross sticker's color in this state (the center of the cross
    // face): 'D' for D-cross solves, 'R' for R-cross, etc. The signature
    // identifies the pair's cross sticker by this color, then records it
    // by face POSITION — after the rotation above every cross face sits
    // on the D-cross anchor face, so the signature matches the 'D'-seeded
    // catalog regardless of the solver's cross color.
    const facelets = FaceletStringConverter.toFaceletString(state);
    const crossIdx = centerFacelet(crossFace);
    const crossColor =
      crossIdx !== undefined ? (facelets[crossIdx] ?? 'D') : 'D';

    let sig: string;
    try {
      sig = pairSignature(normalized, pieces.C, pieces.E, crossColor);
    } catch {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: '',
      };
    }

    const entry = lookupCatalog(this.catalog, crossFace, sig);
    if (!entry) {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: sig,
      };
    }

    return {
      entry,
      confidence: 'exact',
      queriedSignature: sig,
    };
  }

  /**
   * Return the size of the internal catalog (for diagnostics / tests).
   */
  get catalogSize(): number {
    return this.catalog.size;
  }
}
