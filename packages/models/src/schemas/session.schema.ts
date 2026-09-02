import { z } from 'zod';

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type Session = z.infer<typeof SessionSchema>;