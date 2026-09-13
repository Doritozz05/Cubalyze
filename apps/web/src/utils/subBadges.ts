"use client";

import type { ProfileStats, PuzzleStats } from "@/hooks/useProfileStats";
import { normalizePuzzleKey } from "@/hooks/useProfileStats";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import { getBestRollingAverage } from "@/utils/pbDetection";

/**
 * Sub-X milestone badges ("Sub 5 · 3×3", "Sub 2 · 2×2"…).
 *
 * WHAT "SUB-X" MEANS (community consensus, not our invention)
 * ----------------------------------------------------------
 * A single is as much luck as skill: one free-cross scramble can hand anyone a
 * time they cannot repeat. So the cubing community never judges "sub-X" by the
 * single — it judges it by a TRIMMED AVERAGE, which drops the luck in both
 * directions (the best and worst solves out) and leaves what you can do on
 * demand. The canonical form is the ao100 (drop the 5 best and 5 worst of 100),
 * the yardstick people mean when they say "I'm sub-20"; an ao12 (drop 1 + 1) is
 * what a session shows in the moment.
 *
 * The old rule here used `stats.best` — the fastest SINGLE ever, DNF excluded.
 * That gave a permanent "Sub 20" badge to anyone who landed one 19.4 in a sea
 * of 28s, which is exactly the claim the community would reject. This module
 * now asks the average instead.
 *
 * THE RULE
 * --------
 *   1. Compute the BEST trimmed average over the puzzle's whole history:
 *      ao100 when there are ≥ 100 solves, else ao12 when there are ≥ 12.
 *   2. Below 12 solves there is no badge: a trimmed average is the smallest
 *      honest claim, and 5 solves cannot support one.
 *   3. The badge is the fastest ladder threshold strictly above that average.
 *
 * "Best ever" rather than "current" on purpose: a badge is an achievement, and
 * an achievement you can lose by having a bad week is not one. `currentMs`
 * carries today's rolling average alongside it so the UI can show the gap
 * between what you have earned and what you are right now.
 *
 * Performance: the peak ao100 scans every 100-solve window over the history,
 * so cost grows with the number of solves (a few thousand solves is a few
 * milliseconds); the short-circuit below means puzzles without 100 solves never
 * pay for it.
 */

/** Window that decides whether you are sub-X: the longest standard average. */
export const SUB_BADGE_WINDOW = 100;

/**
 * Shorter window used only while the ao100 does not exist yet (or while every
 * 100-window is a DNF). It is the other form the community accepts, and the
 * badge says which one it stands on so nobody reads more into it than it says.
 */
export const SUB_BADGE_FALLBACK_WINDOW = 12;

export interface SubBadge {
  /** Normalized puzzle key (e.g. '333'). */
  puzzle: string;
  /** Short display label (e.g. '3×3'). */
  puzzleLabel: string;
  /** Milestone threshold in seconds (e.g. 20 → "Sub 20"). */
  seconds: number;
  /** Formatted threshold ('20' under a minute, '1:00' at or above). */
  thresholdLabel: string;
  /** True when this puzzle is the user's declared main puzzle. */
  mainPuzzle: boolean;
  /** Rainbow phase token (e.g. 'phase-blue') from the design-system palette. */
  color: string;
  /** The trimmed average that earned the badge, in ms (best ever). */
  averageMs: number;
  /** Which average earned it: the durable ao100, or the provisional ao12. */
  windowSize: typeof SUB_BADGE_WINDOW | typeof SUB_BADGE_FALLBACK_WINDOW;
  /** Solves recorded for this puzzle (what the average was drawn from). */
  solveCount: number;
  /** Current rolling average of the same window, if it exists yet. */
  currentMs: number | null;
  /** Next faster milestone in the ladder, if any (e.g. Sub 20 → Sub 17). */
  nextSeconds: number | null;
  /** Formatted next milestone ('17', '1:00'). */
  nextThresholdLabel: string | null;
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
 * The best trimmed average this puzzle ever held, and the window it came from.
 * `null` when there is not enough history to make the claim at all.
 */
function peakAverage(puzzle: PuzzleStats): {
  ms: number;
  window: typeof SUB_BADGE_WINDOW | typeof SUB_BADGE_FALLBACK_WINDOW;
} | null {
  // The history is already newest-first (see aggregateByPuzzle), which is the
  // order every rolling average in the shared engine expects.
  const solves = puzzle.solves.map((solve) => ({
    time: solve.time,
    penalty: solve.penalty,
  }));

  if (solves.length >= SUB_BADGE_WINDOW) {
    const ao100 = getBestRollingAverage(solves, SUB_BADGE_WINDOW);
    if (ao100 !== null && Number.isFinite(ao100)) {
      return { ms: ao100, window: SUB_BADGE_WINDOW };
    }
  }

  if (solves.length >= SUB_BADGE_FALLBACK_WINDOW) {
    const ao12 = getBestRollingAverage(solves, SUB_BADGE_FALLBACK_WINDOW);
    if (ao12 !== null && Number.isFinite(ao12)) {
      return { ms: ao12, window: SUB_BADGE_FALLBACK_WINDOW };
    }
  }

  return null;
}

/**
 * Compute the Sub-X badge each puzzle has actually earned.
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
    const peak = peakAverage(p);
    if (!peak) continue;

    const peakSec = peak.ms / 1000;
    const thresholds = SUB_THRESHOLDS[p.puzzle] ?? FALLBACK_THRESHOLDS;
    // Fastest milestone crossed = smallest threshold strictly above the
    // average. Only the average earns it; the single never enters here.
    const milestone = thresholds.find((t) => peakSec < t);
    if (milestone === undefined) continue;

    // The next faster milestone is the fastest threshold still below the
    // average — the one you are currently chasing.
    const faster = thresholds.filter((t) => t < peakSec);

    const current =
      peak.window === SUB_BADGE_WINDOW ? p.stats.ao100 : p.stats.ao12;

    const badge: SubBadge = {
      puzzle: p.puzzle,
      puzzleLabel: puzzleShortLabel(p.puzzle),
      seconds: milestone,
      thresholdLabel: formatThresholdLabel(milestone),
      mainPuzzle: p.puzzle === mainKey,
      color: badgeColor(p.puzzle),
      averageMs: peak.ms,
      windowSize: peak.window,
      solveCount: p.count,
      currentMs: current !== null && Number.isFinite(current) ? current : null,
      nextSeconds: faster.length > 0 ? Math.max(...faster) : null,
      nextThresholdLabel:
        faster.length > 0 ? formatThresholdLabel(Math.max(...faster)) : null,
    };
    if (badge.mainPuzzle) main = badge;
    else rest.push(badge);
  }

  return main ? [main, ...rest] : rest;
}
