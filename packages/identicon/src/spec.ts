/**
 * @cubeforge/identicon — CubeMark spec generation
 *
 * Turns a stable seed into a deterministic {@link CubeMarkSpec}:
 *
 *  1. Hash the seed → 32 bytes (hash.ts).
 *  2. PRNG seeded from the first 4 bytes.
 *  3. Grid: 5×5 with vertical mirror symmetry. The center cell is ALWAYS
 *     filled (the anchor) so the glyph reads as a designed emblem, not noise.
 *     Non-anchor decision cells are picked greedily with a connectivity bias
 *     (cells adjacent to the anchor are tried first → compact silhouettes).
 *  4. Fill density is chosen deterministically in [9..16] of the FULL mirrored
 *     grid (36–64%) and enforced by construction: each decision cell adds 1
 *     (center column) or 2 (columns 0/1 + their mirror) to the total.
 *  5. Hue quantized in 24 steps of 15°; an interior frame variant (0–2) adds
 *     per-user differentiation without touching the silhouette.
 */

import {
  GRID_SIZE,
  HUE_STEPS,
  HUE_STEP_DEG,
  FILL_ON_MIN,
  FILL_ON_MAX,
  FRAME_VARIANTS,
} from './constants.js';
import { hashSeed, mulberry32, readU32 } from './hash.js';

export interface CubeMarkSpec {
  /** The stable seed this spec was derived from (user_id). */
  seed: string;
  /** 25 cells, row-major, mirror symmetry already applied. Anchor always true. */
  cells: boolean[];
  /** Hue in degrees, quantized to 15° steps (0..345). */
  hue: number;
  /** Interior frame variant: 0 = none, 1 = thin, 2 = thick. */
  frame: 0 | 1 | 2;
}

/**
 * Index of the anchor inside the 3-column decision grid: the true center
 * (row 2, col 2) → 2 * 3 + 2 = 8. NOT ANCHOR_INDEX (which is a 5×5-grid
 * index).
 */
const ANCHOR_DECISION = 2 * 3 + 2;

/**
 * Deterministically choose the filled decision cells (columns 0–2, mirror
 * applied afterwards) so the FULL mirrored grid holds `targetOn` cells
 * (9..16 → 36–64%).
 *
 * Mirrored total: each picked decision cell adds 1 (center column) or 2
 * (columns 0/1, whose mirror column fills too). Greedy over the shuffled,
 * adjacency-biased order; cells that would overshoot 16 are skipped.
 * The invariant [FILL_ON_MIN, FILL_ON_MAX] holds by construction.
 */
function chooseCells(prng: () => number, targetOn: number): boolean[] {
  const anchorRow = 2;
  const anchorCol = 2;
  const adjacent: number[] = [];
  const rest: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      if (idx === ANCHOR_DECISION) continue;
      const isAdjacent = Math.max(Math.abs(r - anchorRow), Math.abs(c - anchorCol)) <= 1;
      (isAdjacent ? adjacent : rest).push(idx);
    }
  }
  // Deterministic Fisher–Yates shuffle (adjacency-biased starting order).
  const order = [...adjacent, ...rest];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const picked: number[] = [ANCHOR_DECISION];
  let total = 1; // mirrored total (the anchor is always on)
  for (const idx of order) {
    if (total >= targetOn || total >= FILL_ON_MAX) break;
    const inc = idx % 3 === 2 ? 1 : 2; // center column has no mirror
    if (total + inc > FILL_ON_MAX) continue; // skip cells that would overshoot
    picked.push(idx);
    total += inc;
  }

  const cells = new Array<boolean>(GRID_SIZE * GRID_SIZE).fill(false);
  for (const idx of picked) {
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    cells[r * GRID_SIZE + c] = true;
    cells[r * GRID_SIZE + (GRID_SIZE - 1 - c)] = true;
  }
  return cells;
}

/**
 * Generate the deterministic {@link CubeMarkSpec} for a seed.
 * Pure, synchronous, side-effect free.
 */
export function generateCubeMarkSpec(seed: string): CubeMarkSpec {
  const bytes = hashSeed(seed);
  const prng = mulberry32(readU32(bytes, 0));

  // Deterministic fill density within the legibility range (9..16 of 25).
  const targetOn = FILL_ON_MIN + Math.floor(prng() * (FILL_ON_MAX - FILL_ON_MIN + 1));
  const cells = chooseCells(prng, targetOn);

  const hueIndex = readU32(bytes, 4) % HUE_STEPS;
  const frame = readU32(bytes, 8) % FRAME_VARIANTS;

  return { seed, cells, hue: hueIndex * HUE_STEP_DEG, frame: frame as 0 | 1 | 2 };
}
