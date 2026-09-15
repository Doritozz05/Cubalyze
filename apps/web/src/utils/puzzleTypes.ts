/**
 * Shared puzzle-type vocabulary (Phase A3 — SSoT).
 *
 * The canonical `PuzzleType` union comes from `@cubalyze/events` (the WCA
 * event registry). This module is the ONE place the app defines the display
 * labels and ordering for the puzzle types that have content today — it was
 * previously duplicated in three Algorithm UI files.
 */
import type { PuzzleType } from "@cubalyze/events";

export type { PuzzleType } from "@cubalyze/events";

/**
 * Display labels for every WCA event code (the UI never shows the raw code
 * — "333" is the internal puzzle_type, ADR-002). Single source of truth:
 * subBadges and the profile resolve labels from here.
 */
export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  "222": "2×2",
  "333": "3×3",
  "333oh": "3×3 OH",
  "444": "4×4",
  "555": "5×5",
  "666": "6×6",
  "777": "7×7",
  "333bf": "3×3 BLD",
  "444bf": "4×4 BLD",
  "555bf": "5×5 BLD",
  "333fm": "FMC",
  "333mbf": "MBLD",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  fto: "FTO",
};

/**
 * Legacy spellings (pre-ADR-002 and old UI aliases) → canonical WCA code.
 * Lets any stored/exported value resolve to a human label without leaking
 * the raw DB code ("3x3x3"/"3x3" → "333", "2x2x2"/"2x2" → "222").
 */
const PUZZLE_TYPE_ALIASES: Record<string, PuzzleType> = {
  '3x3': '333',
  '3x3x3': '333',
  '2x2': '222',
  '2x2x2': '222',
  '3x3oh': '333oh',
};

/** Human label for any puzzle type spelling ("333"/"3x3x3" → "3×3"), raw value as fallback. */
export function puzzleTypeLabel(type: string): string {
  const key = type.trim().toLowerCase().replace(/\s+/g, '');
  const canonical = PUZZLE_TYPE_ALIASES[key] ?? key;
  return PUZZLE_LABELS[canonical as PuzzleType] ?? type;
}

/** Display order for puzzle-type grouping. */
export const PUZZLE_ORDER: PuzzleType[] = ["333", "222"];

/** Selector list ({ value, label }) for puzzle-type dropdowns. */
export const PUZZLE_TYPES: { value: PuzzleType; label: string }[] = PUZZLE_ORDER.map(
  (value) => ({ value, label: PUZZLE_LABELS[value] ?? value }),
);
