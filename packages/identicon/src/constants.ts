/**
 * @cubeforge/identicon — CubeMark constants
 *
 * The identity system of the platform: a deterministic, symmetric identicon
 * rendered as an SVG glyph. Design spec lives in docs/plan_profile (Fase 8).
 */

/** Grid is 5×5 with vertical mirror symmetry (columns 3/4 mirror 1/0). */
export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE; // 25

/** Center cell (row 2, col 2) — always filled, the visual anchor. */
export const ANCHOR_INDEX = Math.floor(CELL_COUNT / 2); // 12

/** Hue is quantized in 24 steps of 15° → well-separated palettes between users. */
export const HUE_STEPS = 24;
export const HUE_STEP_DEG = 360 / HUE_STEPS; // 15

/** HSL constraints for the glyph. Lightness is auto-tuned per hue to
 *  guarantee the contrast floor (see color.ts). */
export const GLYPH_SATURATION = 72;
export const GLYPH_LIGHTNESS = 58;

/** Filled-cell ratio over the full 25-cell grid (legibility guarantee). */
export const FILL_RATIO_MIN = 0.35;
export const FILL_RATIO_MAX = 0.65;
/** Deterministic range of on-cells chosen per spec: 9..16 of 25 (36–64%). */
export const FILL_ON_MIN = 9;
export const FILL_ON_MAX = 16;

/** Interior frame variants (2 bits from the hash). */
export const FRAME_VARIANTS = 3 as const; // 0 = none, 1 = thin, 2 = thick

/** Contrast guarantee: glyph vs surface ≥ 3:1 in both themes (WCAG UI text). */
export const MIN_CONTRAST = 3;

/** Design-system surface tokens used by the contrast guarantee. */
export const SURFACE_LIGHT = '#ffffff';
export const SURFACE_DARK = '#1b1f23';
