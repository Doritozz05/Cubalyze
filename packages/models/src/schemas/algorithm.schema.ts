import { z } from 'zod';

// ─── Legacy Algorithm (backward compat for old `algorithms` table) ─────

export const LegacyAlgorithmSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  moves: z.array(z.string()),
  alternatives: z.array(z.array(z.string())).default([]),
  subset: z.string(),
  puzzleType: z.string().default('3x3x3'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type LegacyAlgorithm = z.infer<typeof LegacyAlgorithmSchema>;

// Re-export as `Algorithm` for backward compat with database/repositories/types.ts
export type Algorithm = LegacyAlgorithm;

// ─── New canonical schema (from algorithm-db) ──────────────────────────

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
