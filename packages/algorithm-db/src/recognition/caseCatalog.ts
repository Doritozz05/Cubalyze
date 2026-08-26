/**
 * caseCatalog.ts — Frame-agnostic recognition catalog.
 *
 * Builds the catalog from the seed cases in the canonical D-cross frame,
 * keyed by the pair signature of the D-cross FR slot (pieces 4 and 8).
 *
 * WHY frame-agnostic:
 *   The pair signature is position-anchored: it records WHERE the pair's
 *   corner and edge sit (position + orientation at that position), not
 *   which physical pieces they are. A U-cross solver's white pair, after
 *   the slot→FR normalization (see `slotToFrrRotation`), lands on the
 *   same canonical positions as the D-cross catalog pair of the same
 *   case — so the same signature string identifies the case in every
 *   solver frame whose slots share the E-slice edge homes (D and U).
 *
 * The result is a flat Map:
 *
 *   "crossFace|signature" → CatalogEntry
 *
 * Lookups are O(1): `lookupCatalog(catalog, crossFace, sig)`. The same
 * signatures are registered under every crossFace the manifest declares —
 * future crossFaces whose slots need different normalization can register
 * their own signature values without migrating the schema.
 *
 * Extensible: adding OLL, PLL, COLL, 2×2 Ortega, etc. means adding new
 * SubsetManifests — the catalog builder is subset-agnostic.
 */
import { CaseStateGenerator } from '../caseGenerator';
import { pairSignature } from './pairSignature';
import type {
  CatalogEntry,
  SubsetManifest,
  CaseSeedData,
} from './types';

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build the recognition catalog for one or more subsets.
 *
 * For each case in the seed data:
 *   1. Generate the D-cross state from the setup scramble.
 *   2. Compute the FR-slot pair signature (corner 4, edge 8) — the
 *      canonical anchor slot of the seed catalog.
 *   3. Register it under every crossFace in the subset manifest.
 *
 * Setups are always D-cross; slot normalization happens at DETECTION time
 * (the observed state is rotated to the FR anchor), never here.
 */
export function buildCatalog(
  subsets: SubsetManifest[],
  loadCases: (subsetId: string, crossFace: string) => CaseSeedData[],
): Map<string, CatalogEntry> {
  const index = new Map<string, CatalogEntry>();

  for (const subset of subsets) {
    const cases = loadCases(subset.subsetId, 'D');
    const crossFaces = subset.crossFaces.length > 0
      ? subset.crossFaces
      : ['D'];

    for (const c of cases) {
      const entry: CatalogEntry = {
        methodId: subset.methodId,
        subsetId: subset.subsetId,
        caseNumber: c.caseNumber,
        caseName: c.caseName,
        setupScramble: c.setupScramble,
      };

      // Generate the D-cross state and compute the FR anchor signature.
      // The seed states are D-cross (cross sticker color 'D'), and the
      // observed states are normalized onto this same anchor by the
      // detector's slot→anchor rotation, so crossColor is always 'D' here.
      const state = CaseStateGenerator.generateFromScramble(c.setupScramble);
      let sig: string;
      try {
        sig = pairSignature(state, 4, 8, 'D');
      } catch {
        // Setup does not contain the FR pair — skip.
        continue;
      }

      // Register under every supported crossFace (same signature values;
      // the observed state is normalized to the anchor frame at detect time).
      for (const crossFace of crossFaces) {
        const key = `${crossFace}|${sig}`;
        if (!index.has(key)) {
          index.set(key, entry);
        }
      }
    }
  }

  return index;
}

// ─── Lookup ──────────────────────────────────────────────────────────────────

/**
 * Look up a case by crossFace + signature.
 * Returns the CatalogEntry if found, null otherwise.
 */
export function lookupCatalog(
  catalog: Map<string, CatalogEntry>,
  crossFace: string,
  signature: string,
): CatalogEntry | null {
  return catalog.get(`${crossFace}|${signature}`) ?? null;
}

/**
 * Convenience: build an empty catalog from a list of subsets + loader,
 * ready for lookups.
 */
export function createCatalog(
  subsets: SubsetManifest[],
  loadCases: (subsetId: string, crossFace: string) => CaseSeedData[],
): Map<string, CatalogEntry> {
  return buildCatalog(subsets, loadCases);
}
