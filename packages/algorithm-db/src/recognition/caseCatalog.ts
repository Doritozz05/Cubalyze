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
import { getProbe } from './probes';
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
 *   1. Generate the D-anchored state from the setup scramble (setups are
 *      always D-cross: cross on D, last layer on U).
 *   2. Compute the probe's signature in its ANCHOR context — the FR slot
 *      of the D-cross frame for F2L, the D-cross frame itself for the
 *      last-layer probes.
 *   3. Register it under every crossFace in the subset manifest.
 *
 * The crossFace is part of the catalog key, so every frame's lookups are
 * isolated even when two frames would produce the same signature (e.g. a
 * U-cross OLL state vs a D-cross OLL state — the observed state is
 * normalized onto the D-cross anchor at DETECTION time, so lookups always
 * use the D-anchored signature under the solver's own crossFace key).
 */
export function buildCatalog(
  subsets: SubsetManifest[],
  loadCases: (subsetId: string, crossFace: string) => CaseSeedData[],
): Map<string, CatalogEntry> {
  const index = new Map<string, CatalogEntry>();

  for (const subset of subsets) {
    const probe = getProbe(subset.probe ?? 'f2l-slot');
    const anchorCtx = probe.catalogContext();
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

      // The seed states are D-anchored — the probe's own catalog context
      // (D-cross FR slot for F2L, D-cross frame for LL probes).
      const state = CaseStateGenerator.generateFromScramble(c.setupScramble);
      const sig = probe.signature(state, anchorCtx);
      if (!sig) {
        // No signature derivable from the setup (e.g. the setup does not
        // produce the case's anchor configuration) — skip.
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
