// ─── Canonical schema re-exported from @cubeforge/algorithm-db ──────────
// (The legacy `algorithms` table + its Algorithm/LegacyAlgorithm types were
// removed with the baseline v2 DB wipe — the canonical catalog lives in
// algorithm-db now.)

export {
  AlgorithmSchema,
  AlgorithmCaseSchema,
  AlgorithmSubsetSchema,
  AlgorithmMethodSchema,
} from '@cubeforge/algorithm-db';

export type {
  ArrowDef,
  Diagram2D,
  Diagram3D,
  AlgorithmCase,
  AlgorithmSubset,
  AlgorithmMethod,
  CaseWithAlgorithms,
  Algorithm as NewAlgorithm,
} from '@cubeforge/algorithm-db';
