/**
 * @cubeforge/identicon — CubeMark
 *
 * Deterministic, symmetric, contrast-guaranteed identicons for the platform
 * identity system. Headless (no React), fully synchronous and testable.
 *
 * Usage:
 *   const spec = generateCubeMarkSpec(userId);
 *   const svg  = renderCubeMark(spec, { tile: 'surface-2' });
 *
 * See docs/plan_profile (Fase 8) for the design spec.
 */

export { GRID_SIZE, CELL_COUNT, ANCHOR_INDEX, HUE_STEPS, HUE_STEP_DEG, FILL_RATIO_MIN, FILL_RATIO_MAX, MIN_CONTRAST } from './constants.js';
export { generateCubeMarkSpec } from './spec.js';
export type { CubeMarkSpec } from './spec.js';
export { renderCubeMark, cubeMarkToDataUri } from './render.js';
export type { CubeMarkRenderOptions } from './render.js';
export { resolveGlyphHsl, toCssHsl, contrastRatio, relativeLuminance } from './color.js';
export type { Hsl } from './color.js';
export { hashSeed, fnv1a32, mulberry32 } from './hash.js';
