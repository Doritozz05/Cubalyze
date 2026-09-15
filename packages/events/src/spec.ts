import { type WcaRulesProfile } from "@cubalyze/timer-engine";
// Re-export the WCA rules types (single source of truth lives in
// @cubalyze/timer-engine since phase A5 — the timer consumes the profile).
export type { WcaAttemptFormat, WcaScoring, WcaRulesProfile } from "@cubalyze/timer-engine";

/**
 * WCA event codes — official list as of August 2026 (17 events), plus FTO
 * (added by the WCA Board in June 2026, effective 2027-01-02).
 *
 * Source: https://www.worldcubeassociation.org/posts/changes-to-the-wca-s-list-of-official-events-june-2026
 */
export const WCA_EVENT_CODES = [
  "222",
  "333",
  "333bf",
  "333fm",
  "333mbf",
  "333oh",
  "444",
  "444bf",
  "555",
  "555bf",
  "666",
  "777",
  "clock",
  "minx",
  "pyram",
  "skewb",
  "sq1",
  "fto", // effective 2027-01-02
] as const;
export type WcaEventCode = (typeof WCA_EVENT_CODES)[number];

/**
 * Canonical `puzzle_type` values persisted in the database
 * (solves.puzzle_type — the WCA event codes, ADR-002). A session can hold
 * solves of several puzzles, so sessions carry no puzzle_type of their own;
 * the per-solve column is the single source of truth. Runtime array — the
 * single source of truth used by consumers that must validate at runtime
 * (database repositories, zod schemas, migrations CHECK constraints).
 *
 * Before ADR-002 the DB stored `'3x3x3'`/`'2x2x2'` (and legacy `'3x3'`/`'2x2'`
 * written by older app code). Migration 027 converts every existing row to
 * the WCA codes; after it, no other value may be persisted.
 */
export const PUZZLE_TYPES = WCA_EVENT_CODES;
export type PuzzleType = WcaEventCode;

/** Type guard for the canonical set. */
export function isPuzzleType(value: string): value is PuzzleType {
  return (PUZZLE_TYPES as readonly string[]).includes(value);
}



/** Position of the event relative to the official WCA calendar. */
export type EventStatus = "available" | "planned" | "removed";



/**
 * Analysis capabilities currently available for the event. Declarative in
 * this phase; consumed by the analysis pipeline later. `methods` lists the
 * phase-detection methods implemented (e.g. CFOP/Roux for 3×3) — empty
 * means the event has no phase analysis TODAY, which is the honest state.
 */
export interface AnalysisCapability {
  /** Whether phase splits (timeline segmentation) are available. */
  phaseAnalysis: boolean;
  /** Methods with phase detection, e.g. ["CFOP", "Roux"]. Empty = none. */
  methods: readonly string[];
  /** Whether per-case recognition from real solves exists (gap today). */
  caseRecognition: boolean;
}

/**
 * Declarative specification of one WCA event / puzzle. The registry is the
 * single source of truth for "what each event IS" — identity, scramble
 * provider, rules, analysis and calendar status.
 *
 * The WCA event code (`id`) IS the `puzzle_type` persisted in the database
 * (ADR-002): one identifier everywhere — registry, DB, imports/exports.
 */
export interface EventSpec {
  /** WCA event code — also the canonical `puzzle_type` in the database. */
  id: WcaEventCode;
  /** i18n label key (resolved by the UI namespace in a later phase). */
  labelKey: string;
  /** Order for the 3D engine (2, 3, …); null = not renderable today. */
  cubeOrder: number | null;
  /** Registered ScrambleProvider id (wired in phase A4); null = none (honest). */
  scrambleProvider: string | null;
  /** Analysis capability (declared now, consumed later). */
  analysis: AnalysisCapability;
  /** WCA rules profile (declared now, consumed in phase A5). */
  rules: WcaRulesProfile;
  /** Position on the official WCA calendar. */
  status: EventStatus;
  /** WCA effective date (FTO: 2027-01-02). */
  effectiveFrom?: string;
  /** WCA removal date (Clock: 2027-07-18). */
  effectiveUntil?: string;
}
