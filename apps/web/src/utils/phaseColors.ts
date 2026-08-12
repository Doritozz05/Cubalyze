/**
 * Single source of truth for phase + pause colors across Insights.
 *
 * Color mappings are now in the headless @cubeforge/analysis-engine package.
 * This file re-exports them for backward compatibility with existing UI code.
 *
 * New code should import directly from @cubeforge/analysis-engine.
 */

export {
  PAUSE_COLOR_BY_CATEGORY,
  phaseColorHex,
  pauseColorHex,
} from "@cubeforge/analysis-engine";
