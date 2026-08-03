"use client";

import type { ProfileStats } from "@/hooks/useProfileStats";
import { normalizePuzzleKey } from "@/hooks/useProfileStats";

/**
 * Sub-X milestone badges ("Sub 5 · 3×3", "Sub 2 · 2×2"…).
 *
 * For every puzzle the user has solves in, the PB single determines the
 * fastest milestone crossed (the smallest threshold strictly above the PB).
 * For now these are pure PB-derived badges — the future achievements /
 * unlock system will build on top of them (docs: plan_profile).
 */

export interface SubBadge {
  /** Normalized puzzle key (e.g. '3x3x3'). */
  puzzle: string;
  /** Short display label (e.g. '3×3'). */
  puzzleLabel: string;
  /** Milestone threshold in seconds (e.g. 5 → "Sub 5"). */
  seconds: number;
  /** Formatted threshold ('5' under a minute, '1:00' at or above). */
  thresholdLabel: string;
  /** True when this puzzle is the user's declared main puzzle. */
  mainPuzzle: boolean;
  /** Rainbow phase token (e.g. 'phase-blue') from the design-system palette. */
  color: string;
}

/** Milestones per puzzle (seconds, ascending). Fastest-first = the PB. */
const SUB_THRESHOLDS: Record<string, number[]> = {
  "2x2x2": [1, 2, 3, 4, 5, 8, 10],
  "3x3x3": [5, 6, 7, 8, 9, 10, 12, 15, 17, 20, 25, 30],
  "3x3oh": [10, 12, 15, 17, 20, 25, 30, 40],
  "4x4x4": [30, 40, 45, 50, 60, 75, 90, 120],
  "5x5x5": [60, 75, 90, 105, 120, 150, 180],
  "6x6x6": [120, 150, 180, 210, 240, 300, 360],
  "7x7x7": [180, 210, 240, 300, 360, 420, 480],
  megaminx: [60, 75, 90, 120, 150, 180],
  pyraminx: [3, 4, 5, 6, 8, 10, 12],
  skewb: [3, 4, 5, 6, 8, 10, 12],
};

/** Sensible default ladder for any puzzle without a curated list. */
const FALLBACK_THRESHOLDS = [30, 45, 60, 90, 120, 180, 300];

/**
 * Rainbow palette: one `--phase-*` token per puzzle, so each puzzle keeps a
 * stable color (same family as the CFOP timeline / phase dots).
 */
const PUZZLE_COLORS: Record<string, string> = {
  "2x2x2": "phase-blue",
  "3x3x3": "phase-emerald",
  "4x4x4": "phase-teal",
  "5x5x5": "phase-amber",
  "6x6x6": "phase-violet",
  "7x7x7": "phase-purple",
  "3x3oh": "phase-indigo",
  megaminx: "phase-rose",
  pyraminx: "phase-cyan",
  skewb: "phase-orange",
};

/** Fallback rainbow for unknown puzzles — cycled by a stable key hash. */
const FALLBACK_COLORS = [
  "phase-blue",
  "phase-emerald",
  "phase-teal",
  "phase-amber",
  "phase-violet",
  "phase-rose",
  "phase-cyan",
  "phase-orange",
  "phase-sky",
  "phase-pink",
];

/** Stable string hash so an unknown puzzle always resolves to one color. */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Resolve a puzzle's rainbow token color (deterministic, stable). */
export function badgeColor(puzzle: string): string {
  return (
    PUZZLE_COLORS[puzzle] ??
    FALLBACK_COLORS[hashString(puzzle) % FALLBACK_COLORS.length]
  );
}

const PUZZLE_LABELS: Record<string, string> = {
  "2x2x2": "2×2",
  "3x3x3": "3×3",
  "3x3oh": "3×3 OH",
  "4x4x4": "4×4",
  "5x5x5": "5×5",
  "6x6x6": "6×6",
  "7x7x7": "7×7",
  megaminx: "Megaminx",
  pyraminx: "Pyraminx",
  skewb: "Skewb",
};

/** Short puzzle label for badges ("3x3x3" → "3×3"). */
export function puzzleShortLabel(key: string): string {
  return PUZZLE_LABELS[key] ?? key;
}

/** Threshold display: '5' under a minute, '1:00' at or above. */
export function formatThresholdLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compute the fastest Sub-X badge achieved per puzzle with solves.
 * The declared main puzzle ranks first; the rest follow most-solved first
 * (the order of `stats.byPuzzle`).
 */
export function computeSubBadges(
  stats: ProfileStats | null,
  mainPuzzle?: string,
): SubBadge[] {
  if (!stats) return [];

  const mainKey = mainPuzzle ? normalizePuzzleKey(mainPuzzle) : undefined;
  const rest: SubBadge[] = [];
  let main: SubBadge | null = null;

  for (const p of stats.byPuzzle) {
    const best = p.stats.best;
    // null → no solves; Infinity → all DNF.
    if (best === null || !Number.isFinite(best) || best <= 0) continue;

    const bestSec = best / 1000;
    const thresholds = SUB_THRESHOLDS[p.puzzle] ?? FALLBACK_THRESHOLDS;
    // Fastest milestone crossed = smallest threshold strictly above the PB.
    const milestone = thresholds.find((t) => bestSec < t);
    if (milestone === undefined) continue;

    const badge: SubBadge = {
      puzzle: p.puzzle,
      puzzleLabel: puzzleShortLabel(p.puzzle),
      seconds: milestone,
      thresholdLabel: formatThresholdLabel(milestone),
      mainPuzzle: p.puzzle === mainKey,
      color: badgeColor(p.puzzle),
    };
    if (badge.mainPuzzle) main = badge;
    else rest.push(badge);
  }

  return main ? [main, ...rest] : rest;
}
