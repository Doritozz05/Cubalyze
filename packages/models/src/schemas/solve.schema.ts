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
  penalty: z.enum(['none', '+2', 'dnf', 'DNF']).default('none'),
  method: z.string().optional(),
  /** How the solve was recorded: "smart" (cube hardware) or "manual". */
  source: z.enum(['smart', 'manual']).default('manual'),
  note: z.string().nullable().optional(),
  moves: z.array(CubeMoveEventSchema).default([]),
  /**
   * Compact gyro/orientation timeline for smart cube solves with IMU.
   * Array of [moveIndex, orientationIndex] keyframes where orientationIndex
   * is 0-23 (index into OrientationTable.ENTRIES). Only present when
   * source='smart' and the cube has gyro/IMU support.
   *
   * Between keyframes, the orientation is assumed constant.
   * For a solve with 3 rotations: 4 keyframes ≈ 16 bytes.
   */
  orientationTimeline: z.array(z.tuple([z.number(), z.number()])).optional(),
  analysisEngineVersion: z.string().optional(),
  analysis: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Solve = z.infer<typeof SolveSchema>;
