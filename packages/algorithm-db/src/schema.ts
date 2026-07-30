import { z } from 'zod';

// ─── Diagram types ─────────────────────────────────────────────────────────

export const ArrowDefSchema = z.object({
  from: z.tuple([z.number(), z.number()]),
  to: z.tuple([z.number(), z.number()]),
  color: z.string().optional(),
  label: z.string().optional(),
});

export const Diagram2DSchema = z.object({
  /** 54 facelet colors: U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53).
   *  '#' = gray (hidden/irrelevant piece).
   *  Optional — when omitted, the CaseDiagram component generates colors
   *  dynamically from the algorithm moves via CaseStateGenerator. */
  faceletColors: z.array(z.string()).optional(),
  /** Indices of pieces that are highlighted (bright). */
  highlightedPieces: z.array(z.number()).optional(),
  /** Permutation arrows for PLL-style diagrams. */
  arrows: z.array(ArrowDefSchema).optional(),
});

export const Diagram3DSchema = z.object({
  cameraAngle: z.tuple([z.number(), z.number(), z.number()]),
  highlightedSlots: z.array(z.string()).optional(),
});

// ─── Algorithm (the move sequence) ─────────────────────────────────────────

export const AlgorithmSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  moves: z.array(z.string()),
  moveCount: z.object({
    htm: z.number().int().nonnegative(), // Half-Turn Metric
    qtm: z.number().int().nonnegative(), // Quarter-Turn Metric
    stm: z.number().int().nonnegative(), // Slice-Turn Metric
  }),
  isDefault: z.boolean().default(false),
  source: z.string().optional(),
  attributionName: z.string().optional(),
  attributionUrl: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  triggers: z.array(z.string()).default([]),
  notes: z.string().optional(),
  isMirror: z.boolean().default(false),
  mirrorOf: z.string().optional(),
  isInverse: z.boolean().default(false),
  votes: z.number().int().nonnegative().optional(),
});

// ─── Case (the cube state / recognition target) ────────────────────────────

export const AlgorithmCaseSchema = z.object({
  id: z.string().uuid(),
  subsetId: z.string().uuid(),
  caseNumber: z.string(),
  name: z.string(),
  recognitionPatterns: z.array(z.string()),
  setupScramble: z.string(),
  setupAlgorithm: z.string().optional(),
  diagramType: z.enum(['2d-top', '3d-isometric', '3d', '2d-net', 'none']),
  diagram2D: Diagram2DSchema.optional(),
  diagram3D: Diagram3DSchema.optional(),
  probability: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  category: z.string().optional(),
  relatedCases: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  puzzleType: z.string().default('3x3x3'),
});

// ─── Subset (e.g. "OLL", "PLL", "CMLL") ────────────────────────────────────

export const AlgorithmSubsetSchema = z.object({
  id: z.string().uuid(),
  methodId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string(),
  sortOrder: z.number().int().default(0),
  puzzleType: z.string().default('3x3x3'),
});

// ─── Method (e.g. "CFOP", "Roux", "ZZ") ────────────────────────────────────

export const AlgorithmMethodSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  sortOrder: z.number().int().default(0),
  puzzleType: z.string().default('3x3x3'),
});

// ─── Derived types ─────────────────────────────────────────────────────────

export type ArrowDef = z.infer<typeof ArrowDefSchema>;
export type Diagram2D = z.infer<typeof Diagram2DSchema>;
export type Diagram3D = z.infer<typeof Diagram3DSchema>;
export type Algorithm = z.infer<typeof AlgorithmSchema>;
export type AlgorithmCase = z.infer<typeof AlgorithmCaseSchema>;
export type AlgorithmSubset = z.infer<typeof AlgorithmSubsetSchema>;
export type AlgorithmMethod = z.infer<typeof AlgorithmMethodSchema>;

/** Full denormalized view of a case with its algorithms. */
export interface CaseWithAlgorithms extends AlgorithmCase {
  algorithms: Algorithm[];
  subsetName: string;
  methodName: string;
}
