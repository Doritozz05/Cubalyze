import { describe, it, expect } from "vitest";
import {
  FSRS_DEFAULTS,
  retrievability,
  nextDifficulty,
  nextStability,
  intervalFor,
  isDue,
  review,
} from "../fsrs.js";
import type { FSRSRecord } from "../fsrs.js";

const DAY_MS = 86_400_000;

describe("FSRS — retrievability", () => {
  it("is exactly 0.9 when elapsed === stability (retention anchor)", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 10);
    expect(retrievability(3, 3)).toBeCloseTo(0.9, 10);
  });

  it("is 1 at elapsed = 0 and for unscheduled cards", () => {
    expect(retrievability(10, 0)).toBe(1);
    expect(retrievability(0, 5)).toBe(1);
  });

  it("decays monotonically as elapsed grows", () => {
    const r1 = retrievability(10, 1);
    const r10 = retrievability(10, 10);
    const r20 = retrievability(10, 20);
    expect(r1).toBeGreaterThan(r10);
    expect(r10).toBeGreaterThan(r20);
    expect(r20).toBeLessThan(0.9);
  });
});

describe("FSRS — difficulty update", () => {
  it("keeps difficulty on good, drops to floor on easy", () => {
    expect(nextDifficulty(5, "good")).toBe(5);
    expect(nextDifficulty(5, "easy")).toBe(1); // 5 - 6 → clamp to 1
  });

  it("raises difficulty on again/hard, clamped to 10", () => {
    expect(nextDifficulty(5, "again")).toBe(10); // 5 + 12 → clamp to 10
    expect(nextDifficulty(5, "hard")).toBe(10); // 5 + 6 → clamp to 10
    expect(nextDifficulty(2, "hard")).toBe(8); // 2 + 6
  });
});

describe("FSRS — stability update (FSRS-4 formula)", () => {
  it("grows stability after a successful good review at the anchor", () => {
    // S' = S·(1 + e^F·(11−D)·S^0.5·(e^((1−R)·F) − 1)) with S=3, D=5, R=0.9
    // expected ≈ 3.9356
    expect(nextStability(3, 5, 0.9, "good")).toBeCloseTo(3.9356, 3);
  });

  it("orders easy > good > hard for identical inputs", () => {
    const easy = nextStability(3, 5, 0.9, "easy");
    const good = nextStability(3, 5, 0.9, "good");
    const hard = nextStability(3, 5, 0.9, "hard");
    expect(easy).toBeGreaterThan(good);
    expect(good).toBeGreaterThan(hard);
  });

  it("never drops below the 0.1 floor", () => {
    expect(nextStability(0.05, 10, 0.1, "again")).toBeGreaterThanOrEqual(0.1);
  });
});

describe("FSRS — interval", () => {
  it("maps stability to whole days with grade multipliers", () => {
    expect(intervalFor("good", 3.9356)).toBe(4);
    expect(intervalFor("hard", 3.7485)).toBe(4); // round(3.7485·1.2)
    expect(intervalFor("easy", 4.2163)).toBe(5); // round(4.2163·1.3)
  });

  it("always returns 0 days after an again (re-review same day)", () => {
    expect(intervalFor("again", 365)).toBe(0);
    expect(intervalFor("again", 0.1)).toBe(0);
  });

  it("clamps to the 365-day maximum", () => {
    expect(intervalFor("good", 500)).toBe(365);
  });
});

describe("FSRS — review state machine", () => {
  it("first good review: state review, 3-day interval, 1 review", () => {
    const now = 1_000_000;
    const next = review(FSRS_DEFAULTS, "good", now);
    expect(next.state).toBe("review");
    expect(next.stability).toBe(3.0);
    expect(next.intervalDays).toBe(3);
    expect(next.reviewCount).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.nextReviewAt).toBe(now + 3 * DAY_MS);
  });

  it("first again review: state learning, 1-day interval, no lapse", () => {
    const now = 1_000_000;
    const next = review(FSRS_DEFAULTS, "again", now);
    expect(next.state).toBe("learning");
    expect(next.stability).toBe(0.4);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(0); // first failure is not a lapse of a mature card
  });

  it("again on a review-state card: relearning + 1 lapse + 0-day interval", () => {
    const now = 1_000_000_000;
    const mature: FSRSRecord = {
      ...FSRS_DEFAULTS,
      stability: 8,
      difficulty: 5,
      state: "review",
      reviewCount: 2,
      lastReviewAt: now - 8 * DAY_MS, // exactly at the anchor
    };
    const next = review(mature, "again", now);
    expect(next.state).toBe("relearning");
    expect(next.lapses).toBe(1);
    expect(next.intervalDays).toBe(0);
    expect(next.nextReviewAt).toBe(now); // due for re-review the same day
    expect(next.reviewCount).toBe(3);
  });

  it("good after relearning returns to review without another lapse", () => {
    const now = 1_010_000_000;
    const relearning: FSRSRecord = {
      ...FSRS_DEFAULTS,
      stability: 2,
      difficulty: 8,
      state: "relearning",
      lapses: 1,
      reviewCount: 3,
      lastReviewAt: now - DAY_MS,
    };
    const next = review(relearning, "good", now);
    expect(next.state).toBe("review");
    expect(next.lapses).toBe(1);
  });

  it("hard keeps learning cards in learning with a 1-day interval (daily spacing cap)", () => {
    const now = 1_020_000_000;
    const learning: FSRSRecord = {
      ...FSRS_DEFAULTS,
      stability: 0.4,
      difficulty: 8,
      state: "learning",
      reviewCount: 1,
      lastReviewAt: now - DAY_MS,
    };
    const next = review(learning, "hard", now);
    expect(next.state).toBe("learning");
    // Learning phase must NOT stretch the interval — stays at daily spacing.
    expect(next.intervalDays).toBe(1);
  });

  it("again on a learning card stays learning at a 1-day interval", () => {
    const now = 1_025_000_000;
    const learning: FSRSRecord = {
      ...FSRS_DEFAULTS,
      stability: 0.4,
      difficulty: 8,
      state: "learning",
      reviewCount: 1,
      lastReviewAt: now - DAY_MS,
    };
    const next = review(learning, "again", now);
    expect(next.state).toBe("learning");
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(0); // early failures are not lapses of a mature card
  });

  it("good on a learning card graduates it to review (interval un-capped)", () => {
    const now = 1_030_000_000;
    const learning: FSRSRecord = {
      ...FSRS_DEFAULTS,
      stability: 3,
      difficulty: 5,
      state: "learning",
      reviewCount: 1,
      lastReviewAt: now - 3 * DAY_MS, // at the anchor → R ≈ 0.9
    };
    const next = review(learning, "good", now);
    expect(next.state).toBe("review");
    // Graduates out of the 1-day learning cap: 3.9356 → round to 4 days.
    expect(next.intervalDays).toBe(4);
  });
});

describe("FSRS — scheduling helpers", () => {
  it("isDue is false for never-scheduled cards", () => {
    expect(isDue(FSRS_DEFAULTS, Date.now())).toBe(false);
  });

  it("isDue respects the due timestamp", () => {
    const scheduled: FSRSRecord = { ...FSRS_DEFAULTS, nextReviewAt: 5_000_000 };
    expect(isDue(scheduled, 4_999_999)).toBe(false);
    expect(isDue(scheduled, 5_000_000)).toBe(true);
    expect(isDue(scheduled, 6_000_000)).toBe(true);
  });
});
