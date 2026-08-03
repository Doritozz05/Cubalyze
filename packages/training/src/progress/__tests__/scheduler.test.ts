import { describe, it, expect } from "vitest";
import {
  buildDailyQueue,
  scoreCandidate,
  DEFAULT_NEW_PER_DAY,
} from "../scheduler.js";
import type {
  QueueCandidate,
  QueueItem,
} from "../scheduler.js";
import type { AlgorithmProgressRecord } from "../progress-tracker.js";

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;

function caseMeta(id: string, subsetId: string, caseNumber: string) {
  return { algorithmId: id, subsetId, caseNumber, name: caseNumber };
}

function subsetMeta(subsetId: string, methodId: string) {
  return { subsetId, methodId, name: subsetId };
}

function makeCandidate(
  id: string,
  subsetId: string,
  methodId: string,
  progress: AlgorithmProgressRecord | null,
): QueueCandidate {
  return {
    case: caseMeta(id, subsetId, id),
    subset: subsetMeta(subsetId, methodId),
    progress,
  };
}

function progress(overrides: Partial<AlgorithmProgressRecord> = {}): AlgorithmProgressRecord {
  return {
    algorithmId: "x",
    mastery: 80,
    accuracy: 100,
    bestTimeMs: 1200,
    avgTimeMs: 1300,
    totalAttempts: 10,
    execAttempts: 5,
    execCorrect: 5,
    recognitionCorrect: 3,
    recognitionStreak: 3,
    correctStreak: 5,
    lastPracticedAt: NOW - 2 * DAY_MS,
    srsNextReviewAt: NOW + DAY_MS, // not due yet by default
    srsIntervalDays: 4,
    srsEaseFactor: 2.5,
    recognitionAccuracy: 100,
    recognitionAttempts: 5,
    srsStability: 4,
    srsDifficulty: 5,
    srsState: "review",
    srsLapses: 0,
    srsReviewCount: 3,
    lastReviewAt: NOW - 2 * DAY_MS,
    ...overrides,
  };
}

describe("SRS scheduler — priority formula (scoreCandidate)", () => {
  it("flags never-practiced cases as 'new'", () => {
    const item = scoreCandidate(makeCandidate("c1", "s1", "m1", null), NOW, 60);
    expect(item.reason).toBe("new");
    expect(item.priority).toBe(0.5);
    expect(item.srsState).toBe("new");
  });

  it("flags overdue cases (past review date) as 'overdue'", () => {
    const item = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW - 3 * DAY_MS })),
      NOW,
      60,
    );
    expect(item.reason).toBe("overdue");
    expect(item.overdueDays).toBe(3);
  });

  it("flags due-but-on-time cases as 'review'", () => {
    const item = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW })),
      NOW,
      60,
    );
    expect(item.reason).toBe("review");
    expect(item.overdueDays).toBe(0);
  });

  it("flags not-due weak cases (low mastery) as 'weak'", () => {
    const item = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW + DAY_MS, mastery: 30 })),
      NOW,
      60,
    );
    expect(item.reason).toBe("weak");
  });

  it("discounts not-due, non-weak cases so they sink in the queue", () => {
    // lastReviewAt = NOW → elapsed 0 → R exactly 1 (deterministic math).
    const onTime = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ lastReviewAt: NOW })),
      NOW,
      60,
    );
    expect(onTime.reason).toBe("review");
    // Its priority is the weighted sum times the NOT_DUE_DISCOUNT (0.3).
    const raw =
      0.35 * 0 + // R = 1 → (1−R) = 0
      0.25 * 0 + // overdue 0
      0.15 * (1 - 80 / 100) +
      0.15 * 0 + // failRate 0 (accuracy 100)
      0.1 * 0; // recognition 100
    expect(onTime.priority).toBeCloseTo(raw * 0.3, 6);
  });

  it("computes retrievability from FSRS stability and elapsed days", () => {
    const item = scoreCandidate(
      makeCandidate(
        "c1",
        "s1",
        "m1",
        progress({ srsStability: 4, lastReviewAt: NOW - 4 * DAY_MS }),
      ),
      NOW,
      60,
    );
    // elapsed === stability → R ≈ 0.9 (the FSRS anchor)
    expect(item.retrievability).toBeCloseTo(0.9, 4);
  });

  it("raises priority when recognition accuracy is low (two-signal weakness)", () => {
    const goodRec = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW, recognitionAccuracy: 100 })),
      NOW,
      60,
    );
    const badRec = scoreCandidate(
      makeCandidate("c2", "s1", "m1", progress({ srsNextReviewAt: NOW, recognitionAccuracy: 40 })),
      NOW,
      60,
    );
    expect(badRec.priority).toBeGreaterThan(goodRec.priority);
  });
});

describe("SRS scheduler — buildDailyQueue", () => {
  it("excludes brand-new cases by default (no auto-injection)", () => {
    const candidates = [
      makeCandidate("overdue1", "s1", "m1", progress({ srsNextReviewAt: NOW - DAY_MS })),
      makeCandidate("new1", "s2", "m1", null),
      makeCandidate("new2", "s3", "m1", null),
    ];
    const queue = buildDailyQueue(candidates, { now: NOW });
    // Never-practiced cases are NOT injected unless newPerDay is set explicitly.
    expect(queue.some((i) => i.reason === "new")).toBe(false);
    expect(queue.length).toBe(1);
    expect(queue[0].reason).toBe("overdue");
  });

  it("injects brand-new cases only when newPerDay is set explicitly", () => {
    expect(DEFAULT_NEW_PER_DAY).toBe(0);
    const candidates = Array.from({ length: 7 }, (_, i) =>
      makeCandidate(`new${i}`, `s${i}`, "m1", null),
    );
    const queue = buildDailyQueue(candidates, { now: NOW, limit: 20, newPerDay: 3 });
    expect(queue.filter((i) => i.reason === "new").length).toBe(3);
    expect(queue.length).toBe(3);
    // Explicit 0 (the default) disables injection entirely.
    const none = buildDailyQueue(candidates, { now: NOW, limit: 20, newPerDay: 0 });
    expect(none).toEqual([]);
  });

  it("orders overdue items above weak, weak above fresh", () => {
    const candidates = [
      makeCandidate("fresh", "s1", "m1", progress()), // not due, mastery 80
      makeCandidate("weak", "s2", "m1", progress({ srsNextReviewAt: NOW + DAY_MS, mastery: 30 })),
      makeCandidate("overdue", "s3", "m1", progress({ srsNextReviewAt: NOW - 2 * DAY_MS })),
    ];
    const queue = buildDailyQueue(candidates, { now: NOW });
    const reasons = queue.map((i) => i.reason);
    expect(reasons.indexOf("overdue")).toBeLessThan(reasons.indexOf("weak"));
    expect(reasons.indexOf("weak")).toBeLessThan(reasons.indexOf("review"));
  });

  it("interleaves across subsets (contextual interference)", () => {
    // 3 due cases in subset s1, 3 due in subset s2 — interleave must alternate.
    const candidates = [
      makeCandidate("a1", "s1", "m1", progress({ srsNextReviewAt: NOW })),
      makeCandidate("a2", "s1", "m1", progress({ srsNextReviewAt: NOW })),
      makeCandidate("a3", "s1", "m1", progress({ srsNextReviewAt: NOW })),
      makeCandidate("b1", "s2", "m1", progress({ srsNextReviewAt: NOW })),
      makeCandidate("b2", "s2", "m1", progress({ srsNextReviewAt: NOW })),
      makeCandidate("b3", "s2", "m1", progress({ srsNextReviewAt: NOW })),
    ];
    const queue = buildDailyQueue(candidates, { now: NOW });
    const subsets = queue.map((i) => i.subsetId);
    // Round-robin: a1,b1,a2,b2,... → no two consecutive share a subset.
    for (let i = 1; i < subsets.length; i++) {
      expect(subsets[i]).not.toBe(subsets[i - 1]);
    }
    expect(queue.length).toBe(6);
  });

  it("filters by method", () => {
    const candidates = [
      makeCandidate("m1due", "s1", "method-a", progress({ srsNextReviewAt: NOW })),
      makeCandidate("m2due", "s2", "method-b", progress({ srsNextReviewAt: NOW })),
    ];
    const queue = buildDailyQueue(candidates, { now: NOW, methodId: "method-a" });
    expect(queue.length).toBe(1);
    expect(queue[0].methodId).toBe("method-a");
  });

  it("respects the limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate(`c${i}`, `s${i}`, "m1", progress({ srsNextReviewAt: NOW })),
    );
    const queue = buildDailyQueue(candidates, { now: NOW, limit: 4 });
    expect(queue.length).toBe(4);
  });

  it("sorts by priority descending", () => {
    const candidates = [
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW - 10 * DAY_MS })),
      makeCandidate("c2", "s2", "m1", progress({ srsNextReviewAt: NOW - 1 * DAY_MS })),
      makeCandidate("c3", "s3", "m1", progress({ srsNextReviewAt: NOW })),
    ];
    const queue = buildDailyQueue(candidates, { now: NOW });
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i - 1].priority).toBeGreaterThanOrEqual(queue[i].priority);
    }
  });
});

describe("SRS scheduler — QueueItem shape", () => {
  it("exposes the fields the queue UI needs", () => {
    const item = scoreCandidate(
      makeCandidate("c1", "s1", "m1", progress({ srsNextReviewAt: NOW, mastery: 45 })),
      NOW,
      60,
    );
    expect(item).toMatchObject({
      algorithmId: "c1",
      methodId: "m1",
      subsetId: "s1",
      caseNumber: "c1",
      reason: "review",
      srsState: "review",
    });
    expect(typeof item.priority).toBe("number");
    expect(typeof item.retrievability).toBe("number");
    expect(typeof item.overdueDays).toBe("number");
  });
});

describe("SRS scheduler — tracker.getTodayQueue mapping", () => {
  it("maps QueueCandidateRecord rows (incl. null progress) into the scheduler", async () => {
    // This test guards the ProgressTracker.getTodayQueue adapter: raw repo rows
    // (with null progress for new cases) must become valid scheduler candidates.
    const { ProgressTracker } = await import("../progress-tracker.js");
    const candidates = [
      makeCandidate("new1", "s2", "m1", null),
      makeCandidate("due1", "s1", "m1", progress({ srsNextReviewAt: NOW - DAY_MS })),
    ];
    const fakeRepo = {
      insertAttempt: async () => ({ id: "x" }),
      getQueueCandidates: async () =>
        candidates.map((c) => ({
          caseId: c.case.algorithmId,
          subsetId: c.case.subsetId,
          caseNumber: c.case.caseNumber,
          caseName: c.case.caseNumber,
          methodId: c.subset?.methodId ?? "",
          subsetName: c.subset?.name ?? "",
          progress: c.progress,
        })),
    };
    // srsNextReviewAt is always in the past and new1 has no progress, so the
    // result is deterministic regardless of the wall clock.
    const tracker = new ProgressTracker(fakeRepo as never);
    // Explicit newPerDay so the never-practiced candidate is still mapped.
    const queue = await tracker.getTodayQueue({ newPerDay: 1 });
    const reasons = queue.map((i: QueueItem) => i.reason).sort();
    expect(reasons).toEqual(["new", "overdue"]);
  });
});
