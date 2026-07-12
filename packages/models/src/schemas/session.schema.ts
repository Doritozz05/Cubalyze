import { z } from 'zod';
import { SolveSchema } from './solve.schema.js';

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  puzzleType: z.string().default('3x3x3'),
  createdAt: z.string().datetime(),
  solves: z.array(SolveSchema).default([]),
});

export type Session = z.infer<typeof SessionSchema>;
