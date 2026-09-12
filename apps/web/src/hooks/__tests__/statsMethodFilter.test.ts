import { describe, it, expect } from "vitest";
import { passesMethodFilter } from "../useStatsFilters";
import type { SolveMethod } from "@/types";

const set = (...methods: SolveMethod[]) => new Set<SolveMethod>(methods);

describe("passesMethodFilter", () => {
  it("lets everything through when no method is selected", () => {
    expect(passesMethodFilter({ method: "CFOP" }, set())).toBe(true);
    // A solve with no method is fine too — there is no filter in force.
    expect(passesMethodFilter({ method: undefined }, set())).toBe(true);
  });

  it("keeps solves whose method is selected", () => {
    expect(passesMethodFilter({ method: "CFOP" }, set("CFOP", "Roux"))).toBe(true);
  });

  it("drops solves with a different method", () => {
    expect(passesMethodFilter({ method: "ZZ" }, set("CFOP"))).toBe(false);
  });

  it("drops solves with NO method when a method filter is active", () => {
    // 2×2 and Pyraminx solves carry no method: filtering by CFOP must not
    // show them (the old `if (s.method && …)` guard let them through).
    expect(passesMethodFilter({ method: undefined }, set("CFOP"))).toBe(false);
  });
});
