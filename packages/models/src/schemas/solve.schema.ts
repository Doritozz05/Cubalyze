import { z } from 'zod';
import { isDbPuzzleType } from '@cubalyze/events';
import type { CubeMoveEvent } from '@cubalyze/types';

export const CubeMoveEventSchema = z.object({
  // Slice faces (M/E/S) appear on virtual-cube solves: wide moves are
  // expanded into their face + slice halves (r → "R M'"), matching what
  // per-layer smart-cube sensors report. See @cubalyze/types CubeFace.
  face: z.enum(['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S']),
  direction: z.union([z.literal(1), z.literal(-1), z.literal(2)]),
  cubeTimestamp: z.number(),
  hostTimestamp: z.number(),
}) as z.ZodType<CubeMoveEvent>;

export const SolveSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  timeMs: z.number().int().nonnegative(),
  /** Epoch ms of when the solve happened (single time format across the DB). */
  timestamp: z.number().int().nonnegative(),
  scramble: z.string(),
  penalty: z.enum(['none', '+2', 'dnf', 'DNF']).default('none'),
  method: z.string().optional(),
  /** How the solve was recorded: "smart" (cube hardware), "manual", or
   *  "virtual" (the Cube tab simulator — full move + orientation data,
   *  same analysis pipeline as smart-cube solves). */
  source: z.enum(['smart', 'manual', 'virtual']).default('manual'),
  note: z.string().nullable().optional(),
  /**
   * The Locker item this solve was done with (a `gear_items.id`), when the
   * active cube belonged to the event being solved. The label is denormalised
   * on purpose: it is what the history and the exports show, and it must
   * survive the item being renamed or deleted from the Locker.
   */
  cubeId: z.string().optional(),
  cubeLabel: z.string().optional(),
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
  /**
   * Puzzle type for this solve (e.g. '333', '222'). Optional for backward
   * compat. Validated against the WCA event registry (A2/ADR-002): the DB
   * only stores WCA event codes ('333', '222', '333oh', …). The column
   * stays TEXT in SQLite; the registry is the runtime source of truth.
   */
  puzzleType: z.string().refine(isDbPuzzleType, {
    message: 'Unknown puzzle_type — must be a WCA event code declared by the registry',
  }).optional(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
});

export type Solve = z.infer<typeof SolveSchema>;
