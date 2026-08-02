import { describe, it, expect } from 'vitest';
import { computeSRSInsights } from '../insights.js';
import type { QueueCandidateRecord, AlgorithmProgressRecord } from '../progress-tracker.js';

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;

/** Base progress with sensible FSRS defaults. */
function progress(overrides: Partial<AlgorithmProgressRecord>): AlgorithmProgressRecord {
  return {
    algorithmId: 'c1',
    mastery: 50,
    accuracy: 50,
    bestTimeMs: 0,
    avgTimeMs: 0,
    totalAttempts: 1,
    correctStreak: 0,
    lastPracticedAt: NOW - DAY_MS,
    srsNextReviewAt: 0,
    srsIntervalDays: 3,
    srsEaseFactor: 2.5,
    recognitionAccuracy: 50,
    recognitionAttempts: 1,
    srsStability: 0,
    srsDifficulty: 5,
    srsState: 'new',
    srsLapses: 0,
    srsReviewCount: 0,
    lastReviewAt: 0,
    ...overrides,
  };
}

function candidate(caseId: string, p: AlgorithmProgressRecord | null): QueueCandidateRecord {
  return {
    caseId,
    subsetId: 'subset-1',
    caseNumber: 'Aa',
    caseName: 'Case A',
    methodId: 'cfop',
    subsetName: 'OLL',
    progress: p,
  };
}

describe('SRS insights — computeSRSInsights', () => {
  it('counts never-practiced cases as new and excludes them from retention', () => {
    const insights = computeSRSInsights([
      candidate('c1', null),
      candidate('c2', null),
    ], NOW);

    expect(insights.totalCases).toBe(2);
    expect(insights.reviewed).toBe(0);
    expect(insights.stateCounts).toEqual({ new: 2, learning: 0, review: 0, relearning: 0 });
    expect(insights.retention.average).toBe(0);
    expect(insights.retention.buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
    expect(insights.intervalGrowth).toEqual([]);
  });

  it('bucketizes retention by current retrievability', () => {
    // Reviewed 4 days ago with stability 3 → R = (1 + 19/81·4/3)^-0.5 ≈ 0.87 → 80-90% bucket.
    // (Deliberately not exactly 0.9/0.8 so the bucket boundary is float-safe.)
    const mature = progress({
      algorithmId: 'c1',
      srsState: 'review',
      srsStability: 3,
      srsReviewCount: 2,
      srsIntervalDays: 3,
      lastReviewAt: NOW - 4 * DAY_MS,
      srsNextReviewAt: NOW - DAY_MS, // overdue
      mastery: 90,
    });
    // Fresh: reviewed just now → R = 1 → 90%+ bucket
    const fresh = progress({
      algorithmId: 'c2',
      srsState: 'review',
      srsStability: 3,
      srsReviewCount: 3,
      srsIntervalDays: 5,
      lastReviewAt: NOW,
      srsNextReviewAt: NOW + 5 * DAY_MS,
      mastery: 80,
    });
    // New case: never reviewed
    const insights = computeSRSInsights([
      candidate('c1', mature),
      candidate('c2', fresh),
      candidate('c3', null),
    ], NOW);

    expect(insights.reviewed).toBe(2);
    expect(insights.totalReviews).toBe(5);
    // R(mature) ≈ 0.87 → 80-90% bucket; R(fresh) = 1 → 90%+ bucket
    const buckets = Object.fromEntries(insights.retention.buckets.map((b) => [b.label, b.count]));
    expect(buckets['80–90%']).toBe(1);
    expect(buckets['90%+']).toBe(1);
    expect(insights.retention.average).toBeCloseTo(0.94, 2);
  });

  it('builds a cross-sectional interval-growth curve per review count', () => {
    const a = progress({
      algorithmId: 'c1', srsState: 'review', srsStability: 3, srsReviewCount: 1,
      srsIntervalDays: 3, lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + 2 * DAY_MS,
    });
    const b = progress({
      algorithmId: 'c2', srsState: 'review', srsStability: 9, srsReviewCount: 2,
      srsIntervalDays: 9, lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + 8 * DAY_MS,
    });
    const c = progress({
      algorithmId: 'c3', srsState: 'review', srsStability: 27, srsReviewCount: 3,
      srsIntervalDays: 27, lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + 26 * DAY_MS,
    });

    const insights = computeSRSInsights([candidate('c1', a), candidate('c2', b), candidate('c3', c)], NOW);

    expect(insights.intervalGrowth.map((g) => g.reviewCount)).toEqual([1, 2, 3]);
    expect(insights.intervalGrowth[0].avgStabilityDays).toBe(3);
    expect(insights.intervalGrowth[2].avgIntervalDays).toBe(27);
    // Monotonically increasing → the spacing effect shows up.
    for (let i = 1; i < insights.intervalGrowth.length; i++) {
      expect(insights.intervalGrowth[i].avgIntervalDays)
        .toBeGreaterThan(insights.intervalGrowth[i - 1].avgIntervalDays);
    }
  });

  it('excludes never-graded cases (reviewCount 0) from the interval-growth curve', () => {
    // Practiced via drills but never FSRS-graded: carries only the SM-2
    // bootstrap interval + 0 stability. It must NOT add a fake 0-days point.
    const practicedOnly = progress({
      algorithmId: 'c1', srsState: 'new', srsStability: 0, srsReviewCount: 0,
      srsIntervalDays: 3, lastReviewAt: 0, srsNextReviewAt: NOW + DAY_MS,
    });
    const graded = progress({
      algorithmId: 'c2', srsState: 'review', srsStability: 3, srsReviewCount: 1,
      srsIntervalDays: 3, lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + 2 * DAY_MS,
    });

    const insights = computeSRSInsights(
      [candidate('c1', practicedOnly), candidate('c2', graded)],
      NOW,
    );

    expect(insights.intervalGrowth.map((g) => g.reviewCount)).toEqual([1]);
    expect(insights.intervalGrowth[0].count).toBe(1);
  });

  it('aggregates due projection across 1/3/7/30 day horizons', () => {
    const dueToday = progress({
      algorithmId: 'c1', srsState: 'review', srsStability: 3, srsReviewCount: 1,
      srsIntervalDays: 3, lastReviewAt: NOW - 3 * DAY_MS, srsNextReviewAt: NOW - DAY_MS,
    });
    const dueIn5 = progress({
      algorithmId: 'c2', srsState: 'review', srsStability: 3, srsReviewCount: 1,
      srsIntervalDays: 3, lastReviewAt: NOW - 3 * DAY_MS, srsNextReviewAt: NOW + 5 * DAY_MS,
    });
    const dueIn40 = progress({
      algorithmId: 'c3', srsState: 'review', srsStability: 40, srsReviewCount: 2,
      srsIntervalDays: 40, lastReviewAt: NOW - 3 * DAY_MS, srsNextReviewAt: NOW + 40 * DAY_MS,
    });

    const insights = computeSRSInsights(
      [candidate('c1', dueToday), candidate('c2', dueIn5), candidate('c3', dueIn40)],
      NOW,
    );

    const byDay = Object.fromEntries(insights.dueProjection.map((d) => [d.withinDays, d.count]));
    expect(byDay[1]).toBe(1); // dueToday
    expect(byDay[3]).toBe(1);
    expect(byDay[7]).toBe(2); // dueToday + dueIn5
    expect(byDay[30]).toBe(2); // dueToday + dueIn5
  });

  it('rolls up mastery, lapses, and state counts across cases', () => {
    const learning = progress({
      algorithmId: 'c1', srsState: 'learning', srsStability: 0.4, srsReviewCount: 1,
      srsIntervalDays: 1, mastery: 30, srsLapses: 0,
      lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + DAY_MS,
    });
    const relearning = progress({
      algorithmId: 'c2', srsState: 'relearning', srsStability: 1, srsReviewCount: 4,
      srsIntervalDays: 1, mastery: 60, srsLapses: 2,
      lastReviewAt: NOW - DAY_MS, srsNextReviewAt: NOW + DAY_MS,
    });

    const insights = computeSRSInsights([candidate('c1', learning), candidate('c2', relearning)], NOW);

    expect(insights.stateCounts).toEqual({ new: 0, learning: 1, review: 0, relearning: 1 });
    expect(insights.totalLapses).toBe(2);
    expect(insights.totalReviews).toBe(5);
    expect(insights.avgMastery).toBe(45);
  });
});
