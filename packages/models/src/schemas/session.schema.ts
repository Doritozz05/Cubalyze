import { z } from 'zod';

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  puzzleType: z.string().default('3x3x3'),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type Session = z.infer<typeof SessionSchema>;
