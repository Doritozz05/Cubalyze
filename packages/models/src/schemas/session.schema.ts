import { z } from 'zod';
import { isDbPuzzleType } from '@cubeforge/events';

export const SessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  // Validated against the WCA event registry (A2/ADR-002): unknown
  // puzzle_type values are rejected; the DB only stores WCA event codes
  // ('333', '222', '333oh', …).
  puzzleType: z.string().refine(isDbPuzzleType, {
    message: 'Unknown puzzle_type — must be a WCA event code declared by the registry',
  }).default('333'),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type Session = z.infer<typeof SessionSchema>;
