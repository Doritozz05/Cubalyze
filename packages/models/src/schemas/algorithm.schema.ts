import { z } from 'zod';

export const AlgorithmSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  moves: z.string(),
  subset: z.string(),
  puzzleType: z.string().default('3x3x3'),
});

export type Algorithm = z.infer<typeof AlgorithmSchema>;
