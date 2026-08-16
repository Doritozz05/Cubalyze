import { SPEED_RULES, BLD_RULES, FMC_RULES, MBLD_RULES } from "@cubeforge/timer-engine";
import { PUZZLE_TYPES, type EventSpec, type WcaEventCode } from "./spec";

// ── Shared rules profiles ──────────────────────────────────────────────────
// Canonical profiles live in @cubeforge/timer-engine (phase A5): the timer
// consumes them and the registry declares which profile each event uses.
// The timer's default profile IS SPEED_RULES, so 3×3/2×2 behave identically.

// ── Analysis capability ────────────────────────────────────────────────────
// 3×3-family: CFOP/Roux phase analysis exists. Everything else: none today
// (honest state — the analysis engine only implements 3×3 phases).
const NONE_ANALYSIS = {
  phaseAnalysis: false,
  methods: [],
  caseRecognition: false,
} as const;

const THREE_BY_THREE_ANALYSIS = {
  phaseAnalysis: true,
  methods: ["CFOP", "Roux"],
  caseRecognition: false,
} as const;

// ── Scramble providers (ids wired to implementations in phase A4) ─────────
export const MIN2PHASE_PROVIDER = "min2phase-random-state";
export const TWO_BY_TWO_PROVIDER = "two-by-two-random-state";
export const PYRAMINX_PROVIDER = "pyraminx-random-state"; // phase D2

// ── The registry ───────────────────────────────────────────────────────────

/** All 18 WCA event specs (17 official as of Aug 2026 + FTO planned). */
export const EVENT_REGISTRY: readonly EventSpec[] = [
  {
    id: "222",
    labelKey: "events.222",
    cubeOrder: 2,
    scrambleProvider: TWO_BY_TWO_PROVIDER,
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "333",
    labelKey: "events.333",
    cubeOrder: 3,
    scrambleProvider: MIN2PHASE_PROVIDER,
    analysis: THREE_BY_THREE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "333oh",
    labelKey: "events.333oh",
    cubeOrder: 3,
    scrambleProvider: MIN2PHASE_PROVIDER, // OH uses standard 3×3 scrambles
    analysis: THREE_BY_THREE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "444",
    labelKey: "events.444",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D5 — no ghost scrambles
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "555",
    labelKey: "events.555",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D5
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "666",
    labelKey: "events.666",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D6
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "777",
    labelKey: "events.777",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D6
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "333bf",
    labelKey: "events.333bf",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D8
    analysis: NONE_ANALYSIS,
    rules: BLD_RULES,
    status: "available",
  },
  {
    id: "444bf",
    labelKey: "events.444bf",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D8
    analysis: NONE_ANALYSIS,
    rules: BLD_RULES,
    status: "available",
  },
  {
    id: "555bf",
    labelKey: "events.555bf",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D8
    analysis: NONE_ANALYSIS,
    rules: BLD_RULES,
    status: "available",
  },
  {
    id: "333fm",
    labelKey: "events.333fm",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D10
    analysis: NONE_ANALYSIS,
    rules: FMC_RULES,
    status: "available",
  },
  {
    id: "333mbf",
    labelKey: "events.333mbf",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D9
    analysis: NONE_ANALYSIS,
    rules: MBLD_RULES,
    status: "available",
  },
  {
    id: "clock",
    labelKey: "events.clock",
    cubeOrder: null,
    scrambleProvider: null,
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "removed", // WCA Board (June 2026): Clock leaves after WC 2027
    effectiveUntil: "2027-07-18",
  },
  {
    id: "minx",
    labelKey: "events.minx",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D7
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "pyram",
    labelKey: "events.pyram",
    cubeOrder: null,
    scrambleProvider: PYRAMINX_PROVIDER, // phase D2 — random-state, port of the official scrambler
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "skewb",
    labelKey: "events.skewb",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D3
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "sq1",
    labelKey: "events.sq1",
    cubeOrder: null,
    scrambleProvider: null, // pending phase D4
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "available",
  },
  {
    id: "fto",
    labelKey: "events.fto",
    cubeOrder: null,
    scrambleProvider: null,
    analysis: NONE_ANALYSIS,
    rules: SPEED_RULES,
    status: "planned", // first new official event since Skewb (2014)
    effectiveFrom: "2027-01-02",
  },
];

const byId = new Map<WcaEventCode, EventSpec>(EVENT_REGISTRY.map((s) => [s.id, s]));

/** Look up an event spec by WCA event code (= canonical puzzle_type, ADR-002). */
export function getEvent(id: WcaEventCode): EventSpec | undefined {
  return byId.get(id);
}

// ── Database-valid puzzle_type values (A2, ADR-002) ────────────────────────
//
// The DB accepts exactly the WCA event codes. Pre-ADR-002 values
// ('3x3x3'/'2x2x2', legacy '3x3'/'2x2') are converted by migration 027;
// after it, nothing else may be persisted.

/** All puzzle_type values the database may persist (the WCA codes). */
export const DB_PUZZLE_TYPES: readonly string[] = [...PUZZLE_TYPES];

/**
 * Whether a value may be persisted as `puzzle_type` (solves/sessions).
 * Rejects unknown strings — the database never stores a type the registry
 * does not declare.
 */
export function isDbPuzzleType(value: string): boolean {
  return (DB_PUZZLE_TYPES as readonly string[]).includes(value);
}
