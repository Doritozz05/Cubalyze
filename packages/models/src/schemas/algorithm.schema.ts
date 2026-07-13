import { z } from 'zod';

export const AlgorithmSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  moves: z.array(z.string()),
  alternatives: z.array(z.array(z.string())).default([]),
  subset: z.string(),
  puzzleType: z.string().default('3x3x3'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Algorithm = z.infer<typeof AlgorithmSchema>;
