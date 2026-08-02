/**
 * @cubeforge/training — SRS daily queue scheduler
 *
 * Builds the "Today's Queue" for spaced repetition from the real DB data:
 * per-case FSRS state + algorithm catalog (cases + subsets + methods).
 *
 * Scientific basis:
 * - Retrievability R(t) (FSRS) is the primary signal — how likely you are to
 *   forget the case TODAY (Cepeda et al. 2006 spacing effect).
 * - Overdue factor penalizes cases that already passed their review date.
 * - Mastery gap + recent fail rate + recognition accuracy capture the
 *   two-signal weakness model (declarative recognition vs procedural speed).
 * - Brand-new cases (never practiced) are excluded by default: the queue only
 *   contains what the user actually practiced, mirroring the solve stats.
 *   Daily new-case teaching can be re-enabled explicitly via `newPerDay`.
 * - Contextual interference: the final order round-robins across subsets so
 *   you never drill the same family (OLL/PLL/CMLL...) back-to-back
 *   (Shea & Morgan 1979 — random practice beats blocked practice).
 *
 * This module is pure logic — the caller supplies the catalog + progress.
 */

import { retrievability } from "./fsrs";
import type { FSRSRecord, SRSState } from "./fsrs";
import type { AlgorithmProgressRecord } from "./progress-tracker";

export type QueueReason = "overdue" | "weak" | "new" | "review";

/** Minimal case metadata the scheduler needs from the algorithm catalog. */
export interface QueueCaseMeta {
  algorithmId: string; // algorithm_cases.id
  subsetId: string;
  caseNumber: string;
  name?: string;
}

/** Minimal subset metadata to group/order by method. */
export interface QueueSubsetMeta {
  subsetId: string;
  methodId: string;
  name?: string;
}

/** One candidate: a catalog case + its FSRS progress (null if never practiced). */
export interface QueueCandidate {
  case: QueueCaseMeta;
  subset: QueueSubsetMeta | null;
  progress: AlgorithmProgressRecord | null;
}

/** A final queue item, prioritized and ready for the UI. */
export interface QueueItem {
  algorithmId: string;
  methodId: string;
  subsetId: string;
  caseNumber: string;
  name?: string;
  reason: QueueReason;
  /** Higher = more urgent. Computed by the priority formula. */
  priority: number;
  /** FSRS retrievability today (0-1). 1 = perfectly fresh, 0 = forgotten. */
  retrievability: number;
  /** Whole days past the scheduled review date (0 = on time). */
  overdueDays: number;
  mastery: number;
  recognitionAccuracy: number;
  srsState: SRSState;
  srsNextReviewAt: number;
}

export interface BuildQueueOptions {
  /** Timestamp for 'today' (injectable for tests). Defaults to Date.now(). */
  now?: number;
  /** Max items returned. Default 20. */
  limit?: number;
  /** Max brand-new cases injected per day. Default 0 = disabled (the queue only contains practiced cases). */
  newPerDay?: number;
  /** Only include cases belonging to this method. Default: all methods. */
  methodId?: string;
  /** Mastery % below which a not-yet-due case is flagged 'weak'. Default 60. */
  weakThreshold?: number;
}

const DAY_MS = 86_400_000;

// Priority weights (plan §2.3): retrievability dominates, then overdue.
const W = {
  retrievability: 0.35,
  overdue: 0.25,
  mastery: 0.15,
  failRate: 0.15,
  recognition: 0.1,
};

/** Baseline priority for brand-new cases so they interleave with weak ones. */
const NEW_PRIORITY_BASE = 0.5;
/** Not-yet-due review cases get a steep discount (they can wait). */
const NOT_DUE_DISCOUNT = 0.3;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function toFSRSRecord(p: AlgorithmProgressRecord): FSRSRecord {
  return {
    stability: p.srsStability ?? 0,
    difficulty: p.srsDifficulty ?? 5,
    state: p.srsState ?? "new",
    lapses: p.srsLapses ?? 0,
    reviewCount: p.srsReviewCount ?? 0,
    lastReviewAt: p.lastReviewAt ?? 0,
    intervalDays: p.srsIntervalDays ?? 0,
    nextReviewAt: p.srsNextReviewAt ?? 0,
  };
}

/**
 * Compute one candidate's queue metadata (reason + priority + signals).
 * Exported for unit testing of the priority formula in isolation.
 */
export function scoreCandidate(
  candidate: QueueCandidate,
  now: number,
  weakThreshold: number,
): QueueItem {
  const { case: c, subset } = candidate;
  const p = candidate.progress;
  const mastery = p?.mastery ?? 0;
  const recognitionAccuracy = p?.recognitionAccuracy ?? 0;

  const isNew =
    !p || (p.srsState === "new" && p.srsReviewCount === 0 && p.totalAttempts === 0);

  if (isNew) {
    return {
      algorithmId: c.algorithmId,
      methodId: subset?.methodId ?? "",
      subsetId: c.subsetId,
      caseNumber: c.caseNumber,
      name: c.name,
      reason: "new",
      priority: NEW_PRIORITY_BASE,
      retrievability: 1,
      overdueDays: 0,
      mastery: 0,
      recognitionAccuracy: 0,
      srsState: "new",
      srsNextReviewAt: 0,
    };
  }

  const fsrs = toFSRSRecord(p!);
  const lastReviewAt = fsrs.lastReviewAt > 0 ? fsrs.lastReviewAt : p!.lastPracticedAt;
  const elapsedDays = lastReviewAt > 0 ? Math.max(0, (now - lastReviewAt) / DAY_MS) : 0;
  const stability = fsrs.stability > 0 ? fsrs.stability : fsrs.intervalDays;
  const R = stability > 0 ? retrievability(stability, elapsedDays) : 1;

  const intervalDays = Math.max(fsrs.intervalDays, 1);
  const dueAt = fsrs.nextReviewAt > 0 ? fsrs.nextReviewAt : p!.lastPracticedAt;
  const overdueDays = Math.max(0, (now - dueAt) / DAY_MS);
  const overdueFactor = clamp(overdueDays / intervalDays, 0, 2);

  const failRate = clamp(1 - (p!.accuracy ?? 0) / 100, 0, 1);

  const isDue = fsrs.nextReviewAt > 0 && fsrs.nextReviewAt <= now;
  const isWeak = mastery < weakThreshold;
  let reason: QueueReason;
  if (isDue) {
    reason = overdueDays >= 1 ? "overdue" : "review";
  } else if (isWeak) {
    reason = "weak";
  } else {
    reason = "review";
  }

  let priority =
    W.retrievability * (1 - R) +
    W.overdue * overdueFactor +
    W.mastery * (1 - mastery / 100) +
    W.failRate * failRate +
    W.recognition * (1 - recognitionAccuracy / 100);

  // Not due yet and not weak → can wait; push it far down the queue.
  if (!isDue && reason === "review") priority *= NOT_DUE_DISCOUNT;

  return {
    algorithmId: c.algorithmId,
    methodId: subset?.methodId ?? "",
    subsetId: c.subsetId,
    caseNumber: c.caseNumber,
    name: c.name,
    reason,
    priority,
    retrievability: R,
    overdueDays,
    mastery,
    recognitionAccuracy,
    srsState: fsrs.state,
    srsNextReviewAt: fsrs.nextReviewAt,
  };
}

/**
 * Build the daily review queue:
 *   1. Filter by method, score every candidate.
 *   2. Cap brand-new injections to `newPerDay` (0 = disabled).
 *   3. Sort by priority (desc).
 *   4. Round-robin across subsets for contextual interference.
 */
export function buildDailyQueue(
  candidates: QueueCandidate[],
  options: BuildQueueOptions = {},
): QueueItem[] {
  const now = options.now ?? Date.now();
  const limit = options.limit ?? 20;
  const newPerDay = options.newPerDay ?? DEFAULT_NEW_PER_DAY;
  const weakThreshold = options.weakThreshold ?? 60;

  let scored = candidates
    .filter((c) => !options.methodId || c.subset?.methodId === options.methodId)
    .map((c) => scoreCandidate(c, now, weakThreshold));

  // New-case cap: keep only the top `newPerDay` 'new' items (by priority).
  const newItems = scored.filter((i) => i.reason === "new").sort((a, b) => b.priority - a.priority);
  const keptNew = new Set(newItems.slice(0, newPerDay).map((i) => i.algorithmId));
  scored = scored.filter((i) => i.reason !== "new" || keptNew.has(i.algorithmId));

  // Sort by priority descending.
  scored.sort((a, b) => b.priority - a.priority);

  // Contextual interference: round-robin across subsets so consecutive items
  // belong to different families whenever possible.
  const bySubset = new Map<string, QueueItem[]>();
  for (const item of scored) {
    const bucket = bySubset.get(item.subsetId) ?? [];
    bucket.push(item);
    bySubset.set(item.subsetId, bucket);
  }
  const buckets = [...bySubset.values()];
  const interleaved: QueueItem[] = [];
  const maxLen = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) interleaved.push(bucket[i]);
      if (interleaved.length >= limit) break;
    }
  }

  return interleaved.slice(0, limit);
}

/**
 * Canonical default for brand-new case injection: OFF. The queue only
 * contains cases the user actually practiced — never-practiced cases are
 * only injected when a consumer opts in explicitly via `newPerDay`.
 */
export const DEFAULT_NEW_PER_DAY = 0;
