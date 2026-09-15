/**
 * Distribution visualization data — histograms, sparklines, activity heatmaps.
 *
 * Pure functions that transform solve lists into chart-ready data arrays.
 * Framework-agnostic, zero UI dependencies.
 */

import { effectiveTime } from "@cubalyze/statistics";
import type { StatSolve } from "@cubalyze/statistics";

// ─── Types ────────────────────────────────────────────────────────────────

export interface HistogramBin {
  label: string;
  fromMs: number;
  toMs: number;
  count: number;
}

/** Minimal solve shape for distribution functions (extends StatSolve with timestamp). */
export interface DistribSolve extends StatSolve {
  timestamp: number;
}

// ─── deriveSparkline ─────────────────────────────────────────────────────

/**
 * Last N effective times (oldest → newest) for a sparkline.
 * DNFs are excluded.
 */
export function deriveSparkline(solves: StatSolve[], n = 20): number[] {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  return valid.slice(-n);
}

// ─── deriveHistogram ─────────────────────────────────────────────────────

function formatBinLabel(fromMs: number, toMs: number): string {
  const from = (fromMs / 1000).toFixed(1);
  const to = (toMs / 1000).toFixed(1);
  return `${from}–${to}`;
}

/**
 * Distribution of effective solve times into fixed-width bins.
 * DNFs are excluded. `binMs` defaults to 500ms.
 */
export function deriveHistogram(solves: StatSolve[], binMs = 500): HistogramBin[] {
  const valid = solves
    .filter((s) => s.penalty !== "DNF")
    .map((s) => effectiveTime(s))
    .filter((t) => Number.isFinite(t));
  if (valid.length === 0) return [];

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = Math.max(binMs, max - min + 1);
  const binCount = Math.ceil(span / binMs);
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * binMs;
    const to = from + binMs;
    return { label: formatBinLabel(from, to), fromMs: from, toMs: to, count: 0 };
  });

  for (const t of valid) {
    let idx = Math.floor((t - min) / binMs);
    if (idx >= bins.length) idx = bins.length - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}

// ─── deriveActivityHeatmap ───────────────────────────────────────────────

/**
 * Daily solve counts (oldest first) for the activity heatmap.
 * Returns a flat array of length `weeks * 7` where index 0 = oldest day.
 */
export function deriveActivityHeatmap(solves: DistribSolve[], weeks = 12): number[] {
  const total = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  const endSunday = new Date(monday);
  endSunday.setDate(monday.getDate() + 6);
  const startMonday = new Date(monday);
  startMonday.setDate(monday.getDate() - (weeks - 1) * 7);

  const counts = new Array(total).fill(0);
  for (const s of solves) {
    const d = new Date(s.timestamp);
    d.setHours(0, 0, 0, 0);
    if (d < startMonday || d > endSunday) continue;
    const dayDiff = Math.floor((d.getTime() - startMonday.getTime()) / 86_400_000);
    if (dayDiff >= 0 && dayDiff < total) counts[dayDiff]++;
  }
  return counts;
}
