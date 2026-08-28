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
 * The slot→D normalization rotates the observed state into the anchor
 * frame; the relational signature (see pairSignature.ts) then minimizes
 * over all y-rotations × AUF, so the pair is recognized regardless of
 * which slot it occupies, its crossFace, or which physical pieces carry
 * the pair's colors (a parked/mirrored pair collapses onto the same
 * case).
 *
 * Designed to be puzzle- / method- / subset-agnostic: the catalog
 * determines what can be recognized. Adding OLL, PLL or 2×2 cases means
 * loading their data into the same catalog structure.
 */
import { CubeState } from '@cubeforge/math-core';
import { lookupCatalog, createCatalog } from './caseCatalog';
import { getProbe } from './probes';
import type {
  CatalogEntry,
  DetectionResult,
  SubsetManifest,
  CaseSeedData,
} from './types';
import type { ProbeContext } from './probes';

// ─── Detector ────────────────────────────────────────────────────────────────

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
 *   const result = detector.detect(state, 'D', 'FR');
 */
export class CaseDetector {
  private readonly catalog: Map<string, CatalogEntry>;

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
    return this.detectWith(state, {
      probe: 'f2l-slot',
      crossFace,
      slotName,
    });
  }

  /**
   * Detect a case with an explicit probe context.
   *
   * This is the generic entry point: F2L slots (the original `detect`),
   * the last-layer orientation (OLL) and the last-layer permutation (PLL)
   * are all dispatched here. The probe is chosen from the context, and the
   * signature is computed by that probe — so the catalog and the lookup
   * always agree on the signature format.
   */
  detectWith(state: CubeState, ctx: ProbeContext): DetectionResult {
    const probe = getProbe(ctx.probe);
    const sig = probe.signature(state, ctx);
    if (!sig) {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: '',
      };
    }
    const entry = lookupCatalog(this.catalog, ctx.crossFace, sig);
    if (!entry) {
      return {
        entry: null,
        confidence: 'unknown',
        queriedSignature: sig,
      };
    }
    // Last-layer probes report the AUF face of the observed state so the
    // renderer can show the case from the solver's exact angle. The F2L
    // slot probe has no AUF (its relational signature is already
    // slot-minimized), so aufFace stays undefined there.
    const aufFace = probe.aufFace?.(state, ctx, sig);
    return {
      entry,
      confidence: 'exact',
      queriedSignature: sig,
      aufFace,
    };
  }

  /**
   * Return the size of the internal catalog (for diagnostics / tests).
   */
  get catalogSize(): number {
    return this.catalog.size;
  }
}