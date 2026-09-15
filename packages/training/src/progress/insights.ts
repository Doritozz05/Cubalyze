/**
 * @cubalyze/training — SRS insights
 *
 * Pure aggregation over the algorithm catalog + per-case FSRS progress
 * (the same LEFT JOIN payload the queue scheduler consumes). Produces the
 * data the insights view renders:
 *
 *   - Retention distribution  — current retrievability R(t) buckets across
 *     all FSRS-tracked cases (how much of your memory is still intact today).
 *   - Interval growth curve    — average stability/interval at each review
 *     count (cross-sectional view of the spacing effect: more reviews ⇒
 *     longer intervals).
 *   - State breakdown          — new / learning / review / relearning counts.
 *   - Due projection           — how many cases come due within 1/3/7/30 days.
 *
 * Pure logic (no I/O): the caller supplies the candidates.
 */

import { retrievability } from "./fsrs";
import type { QueueCandidateRecord } from "./progress-tracker";

const DAY_MS = 86_400_000;

export interface SRSStateCounts {
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

export interface RetentionBucket {
  label: string;
  min: number;
  count: number;
}

export interface IntervalPoint {
  /** Number of graded reviews for this cohort. */
  reviewCount: number;
  /** Average FSRS stability (days) at this review count. */
  avgStabilityDays: number;
  /** Average scheduled interval (days) at this review count. */
  avgIntervalDays: number;
  /** Cases in this cohort. */
  count: number;
}

export interface DueProjection {
  withinDays: number;
  count: number;
}

export interface SRSInsights {
  /** Total cases in the catalog (scoped to method when filtered). */
  totalCases: number;
  /** Cases with any practice or review history. */
  reviewed: number;
  stateCounts: SRSStateCounts;
  totalLapses: number;
  totalReviews: number;
  avgMastery: number;
  /** Current retention among FSRS-tracked cases (0-1). */
  retention: {
    average: number;
    buckets: RetentionBucket[];
  };
  /** Cross-sectional interval growth per review count. */
  intervalGrowth: IntervalPoint[];
  dueProjection: DueProjection[];
}

const BUCKETS: { label: string; min: number }[] = [
  { label: "<60%", min: 0 },
  { label: "60–80%", min: 0.6 },
  { label: "80–90%", min: 0.8 },
  { label: "90%+", min: 0.9 },
];

function bucketFor(r: number): number {
  for (let i = BUCKETS.length - 1; i >= 0; i--) {
    if (r >= BUCKETS[i].min) return i;
  }
  return 0;
}

/**
 * Compute SRS insights from catalog cases + their FSRS progress.
 * Never-practiced cases (progress === null) count toward the total but
 * fall into the "new" state bucket.
 */
export function computeSRSInsights(
  candidates: QueueCandidateRecord[],
  now: number = Date.now(),
): SRSInsights {
  const stateCounts: SRSStateCounts = { new: 0, learning: 0, review: 0, relearning: 0 };
  const bucketCounts = BUCKETS.map(() => 0);

  let reviewed = 0;
  let totalLapses = 0;
  let totalReviews = 0;
  let masterySum = 0;
  let retentionSum = 0;
  let retentionN = 0;

  // reviewCount → { stabilitySum, intervalSum, count }
  const growthByCount = new Map<number, { stabilitySum: number; intervalSum: number; count: number }>();

  const dueCounts = [1, 3, 7, 30].map((d) => ({ withinDays: d, count: 0 }));

  for (const c of candidates) {
    const p = c.progress;
    if (!p) {
      stateCounts.new++;
      continue;
    }

    reviewed++;
    masterySum += p.mastery ?? 0;
    totalLapses += p.srsLapses ?? 0;
    totalReviews += p.srsReviewCount ?? 0;

    const state = p.srsState ?? "new";
    stateCounts[state] = (stateCounts[state] ?? 0) + 1;

    // Retention: only cases with an actual FSRS schedule.
    if ((p.srsReviewCount ?? 0) >= 1 && (p.srsStability ?? 0) > 0 && (p.lastReviewAt ?? 0) > 0) {
      const elapsedDays = Math.max(0, (now - p.lastReviewAt) / DAY_MS);
      const r = retrievability(p.srsStability, elapsedDays);
      retentionSum += r;
      retentionN++;
      bucketCounts[bucketFor(r)]++;
    }

    // Interval growth curve (cross-sectional) — only graded reviews shape the
    // spacing-effect curve. Never-graded cases (reviewCount 0) carry the SM-2
    // bootstrap interval and 0 stability, which would inject a fake 0-days
    // point and flatten the growth signal.
    const rc = p.srsReviewCount ?? 0;
    if (rc >= 1) {
      const g = growthByCount.get(rc) ?? { stabilitySum: 0, intervalSum: 0, count: 0 };
      g.stabilitySum += p.srsStability ?? 0;
      g.intervalSum += p.srsIntervalDays ?? 0;
      g.count++;
      growthByCount.set(rc, g);
    }

    // Due projection.
    const next = p.srsNextReviewAt ?? 0;
    if (next > 0) {
      for (const d of dueCounts) {
        if (next <= now + d.withinDays * DAY_MS) d.count++;
      }
    }
  }

  const intervalGrowth = [...growthByCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([reviewCount, g]) => ({
      reviewCount,
      avgStabilityDays: g.count > 0 ? g.stabilitySum / g.count : 0,
      avgIntervalDays: g.count > 0 ? g.intervalSum / g.count : 0,
      count: g.count,
    }));

  return {
    totalCases: candidates.length,
    reviewed,
    stateCounts,
    totalLapses,
    totalReviews,
    avgMastery: reviewed > 0 ? Math.round(masterySum / reviewed) : 0,
    retention: {
      average: retentionN > 0 ? retentionSum / retentionN : 0,
      buckets: BUCKETS.map((b, i) => ({ label: b.label, min: b.min, count: bucketCounts[i] })),
    },
    intervalGrowth,
    dueProjection: dueCounts,
  };
}
