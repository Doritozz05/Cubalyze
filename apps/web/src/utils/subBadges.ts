"use client";

import type { ProfileStats } from "@/hooks/useProfileStats";
import { normalizePuzzleKey } from "@/hooks/useProfileStats";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";

/**
 * Sub-X milestone badges ("Sub 5 · 3×3", "Sub 2 · 2×2"…).
 *
 * For every puzzle the user has solves in, the PB single determines the
 * fastest milestone crossed (the smallest threshold strictly above the PB).
 * For now these are pure PB-derived badges — the future achievements /
 * unlock system will build on top of them (docs: plan_profile).
 */

export interface SubBadge {
  /** Normalized puzzle key (e.g. '333'). */
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

/** Milestones per puzzle (seconds, ascending). Keys are WCA codes (ADR-002). */
const SUB_THRESHOLDS: Record<string, number[]> = {
  "222": [1, 2, 3, 4, 5, 8, 10],
  "333": [5, 6, 7, 8, 9, 10, 12, 15, 17, 20, 25, 30],
  "333oh": [10, 12, 15, 17, 20, 25, 30, 40],
  "444": [30, 40, 45, 50, 60, 75, 90, 120],
  "555": [60, 75, 90, 105, 120, 150, 180],
  "666": [120, 150, 180, 210, 240, 300, 360],
  "777": [180, 210, 240, 300, 360, 420, 480],
  minx: [60, 75, 90, 120, 150, 180],
  pyram: [3, 4, 5, 6, 8, 10, 12],
  skewb: [3, 4, 5, 6, 8, 10, 12],
};

/** Sensible default ladder for any puzzle without a curated list. */
const FALLBACK_THRESHOLDS = [30, 45, 60, 90, 120, 180, 300];

/**
 * Rainbow palette: one `--phase-*` token per puzzle, so each puzzle keeps a
 * stable color (same family as the CFOP timeline / phase dots).
 */
const PUZZLE_COLORS: Record<string, string> = {
  "222": "phase-blue",
  "333": "phase-emerald",
  "444": "phase-teal",
  "555": "phase-amber",
  "666": "phase-violet",
  "777": "phase-purple",
  "333oh": "phase-indigo",
  minx: "phase-rose",
  pyram: "phase-cyan",
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

/**
 * Short puzzle label for badges ("333" → "3×3"). Resolved from the shared
 * label map (puzzleTypes.ts, phase A3 SSoT) — never the raw DB code.
 */
export function puzzleShortLabel(key: string): string {
  return puzzleTypeLabel(key);
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
