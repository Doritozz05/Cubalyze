import type { AlgorithmMethod, AlgorithmSubset } from './schema';

// ─── UUID v4-like deterministic IDs (stable across sessions) ───────────────
// These use a namespaced pattern: 00000000-0000-4000-XXXX-XXXXXXXXXXXX
// where X varies per entity so they're unique but predictable.

function mid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
function sid(n: number): string {
  return `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
}

// ─── Methods ───────────────────────────────────────────────────────────────

export const METHODS: AlgorithmMethod[] = [
  { id: mid(1), name: 'CFOP', description: 'Cross, F2L, OLL, PLL — the most popular speedsolving method.', sortOrder: 1, puzzleType: '3x3x3' },
  { id: mid(2), name: 'Roux', description: 'Blockbuilding method with CMLL and LSE. Very efficient move count.', sortOrder: 2, puzzleType: '3x3x3' },
  { id: mid(3), name: 'ZZ', description: 'Edge orientation first, then blockbuilding. No cube rotations needed.', sortOrder: 3, puzzleType: '3x3x3' },
  { id: mid(4), name: 'Petrus', description: 'Blockbuilding method: 2x2x2 → 2x2x3 → EO → F2L → LL.', sortOrder: 4, puzzleType: '3x3x3' },
];

// ─── Subsets ───────────────────────────────────────────────────────────────

export const SUBSETS: AlgorithmSubset[] = [
  // CFOP
  { id: sid(1), methodId: mid(1), name: 'PLL', description: 'Permutation of Last Layer — 21 cases to permute the last layer pieces.', sortOrder: 1, puzzleType: '3x3x3' },
  { id: sid(2), methodId: mid(1), name: 'OLL', description: 'Orientation of Last Layer — 57 cases to orient all last layer pieces.', sortOrder: 2, puzzleType: '3x3x3' },
  { id: sid(3), methodId: mid(1), name: 'F2L', description: 'First Two Layers — algorithmic pairs for each slot.', sortOrder: 3, puzzleType: '3x3x3' },
  { id: sid(4), methodId: mid(1), name: 'COLL', description: 'Corners of Last Layer — orient + permute corners when edges are oriented.', sortOrder: 4, puzzleType: '3x3x3' },
  { id: sid(5), methodId: mid(1), name: 'Winter Variation', description: 'Orient LL corners while inserting last F2L pair. 27 cases.', sortOrder: 5, puzzleType: '3x3x3' },
  { id: sid(6), methodId: mid(1), name: 'VLS', description: 'Valk Last Slot — orient LL edges while inserting last F2L pair.', sortOrder: 6, puzzleType: '3x3x3' },
  { id: sid(7), methodId: mid(1), name: 'ZBLL', description: 'Zborowski-Bruchem Last Layer — 493 cases solving LL in one alg when edges are oriented.', sortOrder: 7, puzzleType: '3x3x3' },
  { id: sid(8), methodId: mid(1), name: 'Cross', description: 'Cross patterns and X-Cross techniques.', sortOrder: 0, puzzleType: '3x3x3' },

  // Roux
  { id: sid(20), methodId: mid(2), name: 'CMLL', description: 'Corners of Last Layer (Roux) — 42 cases ignoring M-slice.', sortOrder: 1, puzzleType: '3x3x3' },
  { id: sid(21), methodId: mid(2), name: 'LSE', description: 'Last Six Edges — EO, UL/UR, M-slice finish.', sortOrder: 2, puzzleType: '3x3x3' },
  { id: sid(22), methodId: mid(2), name: 'First Block', description: 'Roux First Block techniques and patterns.', sortOrder: 0, puzzleType: '3x3x3' },
  { id: sid(23), methodId: mid(2), name: 'Second Block', description: 'Roux Second Block techniques and patterns.', sortOrder: 0, puzzleType: '3x3x3' },

  // ZZ
  { id: sid(30), methodId: mid(3), name: 'OCLL', description: 'Orient Corners of Last Layer (ZZ) — 7 cases (edges already oriented).', sortOrder: 1, puzzleType: '3x3x3' },
  { id: sid(31), methodId: mid(3), name: 'EOLine', description: 'Edge Orientation + Line placement.', sortOrder: 0, puzzleType: '3x3x3' },
  { id: sid(32), methodId: mid(3), name: 'ZZLL', description: 'ZZ Last Layer — ZBLL subset for ZZ.', sortOrder: 2, puzzleType: '3x3x3' },

  // Petrus
  { id: sid(40), methodId: mid(4), name: '2x2x2 Block', description: 'Building the first 2x2x2 block.', sortOrder: 0, puzzleType: '3x3x3' },
  { id: sid(41), methodId: mid(4), name: '2x2x3 Block', description: 'Extending to a 2x2x3 block.', sortOrder: 1, puzzleType: '3x3x3' },
  { id: sid(42), methodId: mid(4), name: 'EO', description: 'Edge orientation for Petrus.', sortOrder: 2, puzzleType: '3x3x3' },
];

/** Get all subsets for a method. */
export function getSubsetsForMethod(methodId: string): AlgorithmSubset[] {
  return SUBSETS.filter((s) => s.methodId === methodId).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get a method by ID. */
export function getMethod(methodId: string): AlgorithmMethod | undefined {
  return METHODS.find((m) => m.id === methodId);
}

/** Get a subset by ID. */
export function getSubset(subsetId: string): AlgorithmSubset | undefined {
  return SUBSETS.find((s) => s.id === subsetId);
}
