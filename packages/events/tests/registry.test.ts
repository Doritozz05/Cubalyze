import { describe, expect, it } from "vitest";
import { Penalty, SPEED_RULES, BLD_RULES, FMC_RULES, MBLD_RULES } from "@cubeforge/timer-engine";
import {
  DB_PUZZLE_TYPES,
  EVENT_REGISTRY,
  PUZZLE_TYPES,
  WCA_EVENT_CODES,
  getEvent,
  isDbPuzzleType,
  isPuzzleType,
  type EventSpec,
} from "../src";

/**
 * TDD-0021 §6 — validation rules for the WCA Event Registry.
 * Updated by ADR-002: the WCA event code IS the persisted puzzle_type.
 */

// Official WCA event codes as of August 2026 (17) + FTO (planned 2027).
const OFFICIAL_2026_CODES = [
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
] as const;

describe("registry — structure", () => {
  it("covers exactly the official 2026 list (17) plus FTO (18 specs)", () => {
    expect(WCA_EVENT_CODES).toHaveLength(18);
    expect(EVENT_REGISTRY).toHaveLength(18);
    for (const code of OFFICIAL_2026_CODES) {
      expect(getEvent(code), `missing official event ${code}`).toBeDefined();
    }
    expect(getEvent("fto")).toBeDefined();
  });

  it("has unique WCA event codes (the ids are unique)", () => {
    const ids = EVENT_REGISTRY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every spec carries a label key and a status", () => {
    for (const spec of EVENT_REGISTRY) {
      expect(spec.labelKey.length, `${spec.id} label`).toBeGreaterThan(0);
      expect(["available", "planned", "removed"]).toContain(spec.status);
    }
  });
});

describe("registry — SSoT with the database (ADR-002)", () => {
  it("the WCA event code IS the persisted puzzle_type — no separate field", () => {
    // ADR-002: one identifier everywhere. The EventSpec has no puzzleType
    // field anymore; `id` is what the DB stores.
    for (const spec of EVENT_REGISTRY) {
      expect(PUZZLE_TYPES).toContain(spec.id);
    }
    expect(getEvent("333")).toBeDefined();
    expect(getEvent("222")).toBeDefined();
    expect(getEvent("333oh")).toBeDefined();
  });

  it("OH has its own puzzle_type (333oh) — no legacy mixing with 3×3", () => {
    const oh = getEvent("333oh")!;
    expect(oh.id).toBe("333oh");
    expect(oh.rules).toBeDefined();
  });
});

describe("registry — WCA rules completeness (TDD §6.3)", () => {
  it("every available event declares a complete rules profile", () => {
    for (const spec of EVENT_REGISTRY) {
      if (spec.status !== "available") continue;
      const { rules } = spec;
      // Inspection defined for every event (null = no inspection, still a value).
      expect(rules.inspectionMs, `${spec.id} inspectionMs`).toBeDefined();
      // Speed events with inspection must define both thresholds.
      if (rules.inspectionMs !== null) {
        expect(rules.plusTwoAfterMs, `${spec.id} +2 threshold`).toBeDefined();
        expect(rules.dnfAfterMs, `${spec.id} DNF threshold`).toBeDefined();
      } else {
        // No-inspection events (FMC/BLD) must not carry speed thresholds.
        expect(rules.plusTwoAfterMs, `${spec.id} +2`).toBeUndefined();
        expect(rules.dnfAfterMs, `${spec.id} DNF`).toBeUndefined();
      }
      expect(rules.allowedPenalties.length, `${spec.id} penalties`).toBeGreaterThan(0);
      expect(rules.format, `${spec.id} format`).toMatch(/^(a5|bo3|bo1|mo3|bo2)$/);
      expect(rules.scoring, `${spec.id} scoring`).toMatch(/^(time|mbf-points|fmc-moves)$/);
    }
  });

  it("allows only real Penalty values", () => {
    const valid = new Set([Penalty.NONE, Penalty.PLUS_TWO, Penalty.DNF]);
    for (const spec of EVENT_REGISTRY) {
      for (const p of spec.rules.allowedPenalties) {
        expect(valid.has(p), `${spec.id} penalty ${p}`).toBe(true);
      }
    }
  });

  it("3×3/2×2 use the canonical SPEED_RULES — identical to the timer default (A5)", () => {
    // Phase A5: the timer engine defaults to SPEED_RULES, so the active
    // event's profile must be the very same object — no drift possible.
    expect(getEvent("333")!.rules).toBe(SPEED_RULES);
    expect(getEvent("222")!.rules).toBe(SPEED_RULES);
    expect(getEvent("333oh")!.rules).toBe(SPEED_RULES);
    expect(getEvent("333bf")!.rules).toBe(BLD_RULES);
    expect(getEvent("333fm")!.rules).toBe(FMC_RULES);
    expect(getEvent("333mbf")!.rules).toBe(MBLD_RULES);
  });

  it("BLD events allow no +2, MBLD has a 1h limit and points scoring", () => {
    for (const id of ["333bf", "444bf", "555bf"] as const) {
      const rules = getEvent(id)!.rules;
      expect(rules.allowedPenalties).not.toContain(Penalty.PLUS_TWO);
      expect(rules.inspectionMs).toBeNull();
    }
    const mbf = getEvent("333mbf")!.rules;
    expect(mbf.timeLimitMs).toBe(3_600_000);
    expect(mbf.scoring).toBe("mbf-points");
    const fmc = getEvent("333fm")!.rules;
    expect(fmc.format).toBe("mo3");
    expect(fmc.scoring).toBe("fmc-moves");
  });
});

describe("registry — WCA calendar (TDD §6.4)", () => {
  it("FTO is planned with effectiveFrom 2027-01-02", () => {
    const fto = getEvent("fto")!;
    expect(fto.status).toBe("planned");
    expect(fto.effectiveFrom).toBe("2027-01-02");
  });

  it("Clock is removed with effectiveUntil 2027-07-18", () => {
    const clock = getEvent("clock")!;
    expect(clock.status).toBe("removed");
    expect(clock.effectiveUntil).toBe("2027-07-18");
  });

  it("planned/removed events carry their calendar dates", () => {
    for (const spec of EVENT_REGISTRY) {
      if (spec.status === "planned") expect(spec.effectiveFrom).toBeDefined();
      if (spec.status === "removed") expect(spec.effectiveUntil).toBeDefined();
    }
  });
});

describe("registry — honest providers (TDD §6.5)", () => {
  it("only events with a real provider declare one (2×2, 3×3, OH, Pyraminx)", () => {
    // As of phase D2: the 3×3 family + the Pyraminx random-state port.
    const withProvider = EVENT_REGISTRY.filter((s) => s.scrambleProvider !== null);
    expect(withProvider.map((s) => s.id).sort()).toEqual(["222", "333", "333oh", "pyram"]);
  });

  it("every spec without a provider is declared as such (no silent 3×3 default)", () => {
    // The ghost-puzzle bug was: unknown events fell back to the 3×3 generator.
    // Here null is EXPLICIT — a consumer must handle it, never default silently.
    for (const spec of EVENT_REGISTRY) {
      if (spec.scrambleProvider === null) continue;
      // Providers must be among the known registered ids (wired in phase A4/D2).
      expect(spec.scrambleProvider).toMatch(
        /^(min2phase-random-state|two-by-two-random-state|pyraminx-random-state)$/,
      );
    }
  });

  it("3×3 declares CFOP/Roux analysis; 2×2 honestly declares none", () => {
    const s333 = getEvent("333")!;
    expect(s333.analysis.phaseAnalysis).toBe(true);
    expect(s333.analysis.methods).toEqual(["CFOP", "Roux"]);
    expect(s333.analysis.caseRecognition).toBe(false);

    const s222 = getEvent("222")!;
    expect(s222.analysis.phaseAnalysis).toBe(false);
    expect(s222.analysis.methods).toEqual([]);
  });
});

describe("registry — database validation set (A2 / ADR-002)", () => {
  it("PUZZLE_TYPES are the 18 WCA codes, including 333/222", () => {
    expect(PUZZLE_TYPES).toHaveLength(18);
    expect(PUZZLE_TYPES).toContain("333");
    expect(PUZZLE_TYPES).toContain("222");
    expect(PUZZLE_TYPES).toEqual(WCA_EVENT_CODES);
  });

  it("isPuzzleType / isDbPuzzleType accept every WCA code and reject old schemes", () => {
    for (const t of PUZZLE_TYPES) {
      expect(isPuzzleType(t), `${t} canonical`).toBe(true);
      expect(isDbPuzzleType(t), `${t} db`).toBe(true);
    }
    // Pre-ADR-002 values are NOT valid anymore (migration 027 converts them).
    for (const old of ["3x3x3", "2x2x2", "3x3", "2x2", "9x9x9", "pyraminx", ""]) {
      expect(isDbPuzzleType(old), `${old} rejected`).toBe(false);
      expect(isPuzzleType(old), `${old} rejected`).toBe(false);
    }
  });

  it("DB_PUZZLE_TYPES contains every canonical type with no duplicates", () => {
    for (const t of PUZZLE_TYPES) {
      expect(DB_PUZZLE_TYPES, `missing ${t}`).toContain(t);
    }
    expect(new Set(DB_PUZZLE_TYPES).size).toBe(DB_PUZZLE_TYPES.length);
  });
});

describe("registry — lookups", () => {
  it("getEvent resolves every spec by its code", () => {
    for (const spec of EVENT_REGISTRY) {
      expect(getEvent(spec.id)).toBe(spec);
    }
  });

  it("returns undefined for unknown codes", () => {
    expect(getEvent("nope" as never)).toBeUndefined();
    expect(getEvent("9x9x9" as never)).toBeUndefined();
  });
});

// Type-level sanity: the registry is fully typed (compile-time check).
const _typed: readonly EventSpec[] = EVENT_REGISTRY;
void _typed;
