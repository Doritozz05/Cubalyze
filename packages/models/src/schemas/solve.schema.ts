import { z } from 'zod';

export const SolveSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  timeMs: z.number().int().nonnegative(),
  date: z.string().datetime(),
  scramble: z.string(),
  penalty: z.enum(['none', '+2', 'dnf']).default('none'),
  method: z.string().optional(),
});

export type Solve = z.infer<typeof SolveSchema>;
