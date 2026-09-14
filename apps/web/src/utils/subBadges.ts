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
 *      the ao100 (drop 5 + 5) when there are ≥ 100 solves, else the ao12
 *      (drop 1 + 1) when there are ≥ 12.
 *   2. Below 12 solves there is no badge: a trimmed average is the smallest
 *      honest claim, and 5 solves cannot support one.
 *   3. The badge is the fastest ladder threshold strictly above that average.
 *   4. Only if the ao100 crosses NO rung (a beginner whose typical 100 solves
 *      are slower than the last rung, or a puzzle whose ladder stops early)
 *      does the provisional ao12 get a turn — and `windowSize` says so, so the
 *      UI never sells a hot session as a durable rank. When both cross, the
 *      ao100 wins: the durable claim beats the flashier one.
 *
 * The ladders carry deliberately slow rungs (3×3 goes up to Sub 1:00). Rungs
 * are what decide whether "sub-X" is a claim or a wall: with the old ladder
 * ending at Sub 30, an improving solver with a 34s ao100 could not earn the
 * FIRST badge no matter how much they practiced.
 *
 * "Best ever" rather than "current" on purpose: a badge is an achievement, and
 * an achievement you can lose by having a bad week is not one. `currentMs`
 * carries today's rolling average alongside it so the UI can show the gap
 * between what you have earned and what you are right now.
 *
 * Performance: the peak ao100 scans every 100-solve window over the history,
 * so cost grows with the number of solves (a few thousand solves is a few
 * milliseconds). The windows are evaluated lazily and in order, so a history
 * whose ao100 already crosses a rung never pays for the ao12 as well, and a
 * puzzle with fewer than 12 solves pays for nothing.
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

/**
 * Milestones per puzzle (seconds, ascending). Keys are WCA codes (ADR-002).
 *
 * Each ladder runs from "fast" to "first one you can actually reach". The slow
 * tail is not padding: without it a new solver has no first badge to earn, and
 * the badge only ever speaks to people who are already fast.
 */
const SUB_THRESHOLDS: Record<string, number[]> = {
  "222": [1, 2, 3, 4, 5, 8, 10, 15, 20, 30],
  "333": [5, 6, 7, 8, 9, 10, 12, 15, 17, 20, 25, 30, 35, 40, 45, 50, 60],
  "333oh": [10, 12, 15, 17, 20, 25, 30, 40, 50, 60, 90],
  "444": [30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240],
  "555": [60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360],
  "666": [120, 150, 180, 210, 240, 300, 360, 420, 480, 600],
  "777": [180, 210, 240, 300, 360, 420, 480, 600, 720, 900],
  minx: [60, 75, 90, 120, 150, 180, 240, 300, 360],
  pyram: [3, 4, 5, 6, 8, 10, 12, 15, 20, 30],
  skewb: [3, 4, 5, 6, 8, 10, 12, 15, 20, 30],
};

/** Sensible default ladder for any puzzle without a curated list. */
const FALLBACK_THRESHOLDS = [30, 45, 60, 90, 120, 180, 300];

/** Short puzzle label for badges ("333" → "3×3"). Resolved from the shared
 * label map (puzzleTypes.ts, phase A3 SSoT) — never the raw DB code. */
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

/** One window's peak: the average and the window it was measured over. */
interface PeakAverage {
  ms: number;
  window: typeof SUB_BADGE_WINDOW | typeof SUB_BADGE_FALLBACK_WINDOW;
}

/**
 * The windows that could support a claim, in the order they get to speak:
 * the durable ao100 first, the provisional ao12 second.
 *
 * A generator, not an array, so the caller can stop at the first window that
 * crosses a rung without paying for the other one. Yields nothing when the
 * history is too short for either.
 */
function* peakCandidates(puzzle: PuzzleStats): Generator<PeakAverage> {
  // The history is already newest-first (see aggregateByPuzzle), which is the
  // order every rolling average in the shared engine expects.
  const solves = puzzle.solves.map((solve) => ({
    time: solve.time,
    penalty: solve.penalty,
  }));

  if (solves.length >= SUB_BADGE_WINDOW) {
    const ao100 = getBestRollingAverage(solves, SUB_BADGE_WINDOW);
    if (ao100 !== null && Number.isFinite(ao100)) {
      yield { ms: ao100, window: SUB_BADGE_WINDOW };
    }
  }

  if (solves.length >= SUB_BADGE_FALLBACK_WINDOW) {
    const ao12 = getBestRollingAverage(solves, SUB_BADGE_FALLBACK_WINDOW);
    if (ao12 !== null && Number.isFinite(ao12)) {
      yield { ms: ao12, window: SUB_BADGE_FALLBACK_WINDOW };
    }
  }
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
    const thresholds = SUB_THRESHOLDS[p.puzzle] ?? FALLBACK_THRESHOLDS;

    // Fastest milestone crossed = smallest threshold strictly above the
    // average. Only the average earns it; the single never enters here. The
    // ao100 gets first refusal; the provisional ao12 only speaks when the
    // durable window crosses nothing at all.
    let peak: PeakAverage | null = null;
    let milestone: number | undefined;
    for (const candidate of peakCandidates(p)) {
      const crossed = thresholds.find((t) => candidate.ms / 1000 < t);
      if (crossed === undefined) continue;
      peak = candidate;
      milestone = crossed;
      break;
    }
    if (peak === null || milestone === undefined) continue;

    // The next faster milestone is the fastest threshold still below the
    // average — the one you are currently chasing.
    const peakSec = peak.ms / 1000;
    const faster = thresholds.filter((t) => t < peakSec);

    const current =
      peak.window === SUB_BADGE_WINDOW ? p.stats.ao100 : p.stats.ao12;

    const badge: SubBadge = {
      puzzle: p.puzzle,
      puzzleLabel: puzzleShortLabel(p.puzzle),
      seconds: milestone,
      thresholdLabel: formatThresholdLabel(milestone),
      mainPuzzle: p.puzzle === mainKey,
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
