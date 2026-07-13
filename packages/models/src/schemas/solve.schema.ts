import { z } from 'zod';
import type { CubeMoveEvent } from '@cubeforge/types';

export const CubeMoveEventSchema = z.object({
  face: z.enum(['U', 'D', 'R', 'L', 'F', 'B']),
  direction: z.union([z.literal(1), z.literal(-1), z.literal(2)]),
  cubeTimestamp: z.number(),
  hostTimestamp: z.number(),
}) as z.ZodType<CubeMoveEvent>;

export const SolveSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  timeMs: z.number().int().nonnegative(),
  date: z.string().datetime(),
  scramble: z.string(),
  penalty: z.enum(['none', '+2', 'dnf']).default('none'),
  method: z.string().optional(),
  moves: z.array(CubeMoveEventSchema).default([]),
  analysisEngineVersion: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Solve = z.infer<typeof SolveSchema>;
