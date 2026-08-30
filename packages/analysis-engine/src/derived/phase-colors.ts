/**
 * Phase and pause color mappings — single source of truth.
 *
 * Phase colors are **semantic** (keyed by phase NAME), not positional.
 * Pause colors are by **category** (purple family).
 *
 * Consumed by the derived visualization module and by UI components.
 */

/**
 * Pause position category.
 *   - "recognition": boundary gap before a phase — the phase's recognition
 *     time (violet).
 *   - "mid-algorithm": hesitation inside a last-layer algorithm.
 *   - "mid-phase": hesitation inside a phase (pair search, piece search).
 */
export type PauseCategory = "recognition" | "mid-algorithm" | "mid-phase";

/**
 * Maps a phase name → hex color, grouped by ROLE across methods:
 *   - foundation (Cross / FB / EOLine / Petrus Block) → blue
 *   - main work  (F2L / SB / ZZ-F2L / Petrus F2L)     → green
 *   - recognition (OLL / CMLL / ZZ-LL / Petrus LL)    → amber
 *   - finish      (PLL / LSE)                          → red
 */
const PHASE_COLOR_BY_NAME: Record<string, string> = {
  // CFOP
  Cross: "#4F8CF7",
  F2L: "#22C55E",
  OLL: "#F59E0B",
  PLL: "#EF4444",
  // Roux
  FB: "#4F8CF7",
  SB: "#22C55E",
  CMLL: "#F59E0B",
  LSE: "#EF4444",
  // ZZ
  EOLine: "#4F8CF7",
  "ZZ-F2L": "#22C55E",
  "ZZ-LL": "#F59E0B",
  // Petrus
  "Petrus block": "#4F8CF7",
  "Petrus F2L": "#22C55E",
  "Petrus LL": "#F59E0B",
};

/** Fallback palette for unknown phase names (cycled by index). */
const FALLBACK_PHASE_COLORS = [
  "#4F8CF7",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#06B6D4",
];

/**
 * Pause colors by category — all violet-family so pauses never collide
 * with phase colors (blue/green/amber/red).
 */
export const PAUSE_COLOR_BY_CATEGORY: Record<PauseCategory, string> = {
  recognition: "#8B5CF6",
  "mid-algorithm": "#A78BFA",
  "mid-phase": "#6D28D9",
};

/** Tail block (post-last-move stop reaction). */
export const TAIL_COLOR = "#6B7280";

/**
 * Resolve a phase color by name. Falls back to a deterministic palette.
 */
export function phaseColorHex(phaseName: string, fallbackIndex = 0): string {
  const exact = PHASE_COLOR_BY_NAME[phaseName];
  if (exact) return exact;
  const idx = fallbackIndex % FALLBACK_PHASE_COLORS.length;
  return FALLBACK_PHASE_COLORS[idx];
}

/** Pause color by category (always purple-family). */
export function pauseColorHex(category: PauseCategory): string {
  return PAUSE_COLOR_BY_CATEGORY[category];
}

/** Tail (stop reaction) color. */
export function tailColorHex(): string {
  return TAIL_COLOR;
}
