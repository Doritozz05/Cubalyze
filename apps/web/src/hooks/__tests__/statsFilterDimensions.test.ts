import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  freshFilters,
  passesSourceFilter,
  penaltyFilterCounts,
  sourceFilterOptions,
  passesPenaltyFilter,
} from "../useStatsFilters";
import type { Penalty, Solve, SolveSource } from "@/types";

/** A solve row with only the fields these filters look at. */
function solve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: "s1",
    sessionId: "ses",
    time: 10_000,
    penalty: "none",
    timestamp: 1000,
    scramble: "R U R'",
    puzzleType: "333",
    ...overrides,
  } as Solve;
}

const sources = (...values: SolveSource[]) => new Set<SolveSource>(values);

describe("passesPenaltyFilter", () => {
  it('"all" is the absence of a filter, not a fourth state', () => {
    for (const penalty of ["none", "+2", "DNF"] as Penalty[]) {
      expect(passesPenaltyFilter({ penalty }, "all")).toBe(true);
    }
  });

  it("clean means no penalty at all — a +2 is excluded, not rounded", () => {
    expect(passesPenaltyFilter({ penalty: "none" }, "clean")).toBe(true);
    expect(passesPenaltyFilter({ penalty: "+2" }, "clean")).toBe(false);
    expect(passesPenaltyFilter({ penalty: "DNF" }, "clean")).toBe(false);
  });

  it("compares through normalizePenalty, so legacy casing still matches", () => {
    // Rows written by older importers store "dnf" / "plus2".
    expect(passesPenaltyFilter({ penalty: "dnf" as Penalty }, "DNF")).toBe(true);
    expect(passesPenaltyFilter({ penalty: "plus2" as Penalty }, "+2")).toBe(true);
    expect(passesPenaltyFilter({ penalty: "dnf" as Penalty }, "clean")).toBe(false);
  });

  it("does not leak a DNF into +2 or the other way round", () => {
    expect(passesPenaltyFilter({ penalty: "DNF" }, "+2")).toBe(false);
    expect(passesPenaltyFilter({ penalty: "+2" }, "DNF")).toBe(false);
  });
});

describe("passesSourceFilter", () => {
  it("an empty selection is not a filter", () => {
    expect(passesSourceFilter({ source: "smart" }, sources())).toBe(true);
    expect(passesSourceFilter({ source: undefined }, sources())).toBe(true);
  });

  it("keeps only the selected sources", () => {
    expect(passesSourceFilter({ source: "smart" }, sources("smart"))).toBe(true);
    expect(passesSourceFilter({ source: "virtual" }, sources("smart"))).toBe(false);
  });

  it("excludes solves with no source, like every other dimension", () => {
    // An unattributed solve is not a vote for Smart; letting it through would
    // make the list disagree with the count next to the option.
    expect(passesSourceFilter({ source: undefined }, sources("smart", "virtual"))).toBe(false);
  });

  it("accepts any of several selected sources", () => {
    const picked = sources("smart", "virtual");
    expect(passesSourceFilter({ source: "virtual" }, picked)).toBe(true);
    expect(passesSourceFilter({ source: "manual" }, picked)).toBe(false);
  });
});

describe("penaltyFilterCounts", () => {
  it("counts each state and totals everything as `all`", () => {
    const counts = penaltyFilterCounts([
      solve({ penalty: "none" }),
      solve({ penalty: "none" }),
      solve({ penalty: "+2" }),
      solve({ penalty: "DNF" }),
      solve({ penalty: "dnf" as Penalty }),
    ]);
    expect(counts).toEqual({ all: 5, clean: 2, "+2": 1, DNF: 2 });
  });

  it("is all zeroes for an empty set", () => {
    expect(penaltyFilterCounts([])).toEqual({ all: 0, clean: 0, "+2": 0, DNF: 0 });
  });
});

describe("sourceFilterOptions", () => {
  it("counts what is really there, most used first", () => {
    expect(
      sourceFilterOptions([
        solve({ source: "smart" }),
        solve({ source: "smart" }),
        solve({ source: "virtual" }),
        solve({ source: undefined }),
      ]),
    ).toEqual([
      { source: "smart", count: 2 },
      { source: "virtual", count: 1 },
    ]);
  });

  it("is empty when nothing ever recorded a source", () => {
    expect(sourceFilterOptions([solve({ source: undefined })])).toEqual([]);
  });
});

describe("countActiveFilters", () => {
  it("is zero for a fresh filter set", () => {
    expect(countActiveFilters(freshFilters())).toBe(0);
  });

  it("counts one per active dimension", () => {
    expect(countActiveFilters(freshFilters({ penalty: "DNF" }))).toBe(1);
    expect(countActiveFilters(freshFilters({ sources: sources("smart") }))).toBe(1);
    expect(countActiveFilters(freshFilters({ cubeId: "gan" }))).toBe(1);
    expect(
      countActiveFilters(
        freshFilters({
          penalty: "clean",
          sources: sources("smart", "virtual"),
          cubeId: "gan",
        }),
      ),
    ).toBe(3);
  });

  it("counts a date range as ONE dimension, not two", () => {
    expect(countActiveFilters(freshFilters({ dateFrom: 1 }))).toBe(1);
    expect(countActiveFilters(freshFilters({ dateFrom: 1, dateTo: 2 }))).toBe(1);
  });
});

describe("freshFilters", () => {
  it("hands out independent Sets every time", () => {
    // The old shared DEFAULT_FILTERS object gave every hook instance and every
    // reset() the SAME Set; mutating one would have corrupted the defaults.
    const a = freshFilters();
    const b = freshFilters();
    a.sources.add("smart");
    a.methods.add("CFOP");
    expect(b.sources.size).toBe(0);
    expect(b.methods.size).toBe(0);
  });

  it("defaults to the 3×3 event with nothing narrowing it", () => {
    const f = freshFilters();
    expect(f).toMatchObject({
      penalty: "all",
      sort: "newest",
      search: "",
      puzzleType: "333",
      cubeId: null,
    });
    expect(countActiveFilters(f)).toBe(0);
  });

  it("lets a caller override any default without losing the others", () => {
    const f = freshFilters({ puzzleType: "222", penalty: "clean" });
    expect(f.puzzleType).toBe("222");
    expect(f.penalty).toBe("clean");
    expect(f.cubeId).toBeNull();
  });
});

describe("the two dimensions are independent (the bug the old model had)", () => {
  // The old `activeFilter` union mixed the penalty of a solve with how it was
  // recorded, in ONE mutually-exclusive choice: picking "Smart" hid every +2
  // solve, whatever the user meant. These are different questions and now
  // apply as an AND.
  const history: Solve[] = [
    solve({ id: "clean-smart", penalty: "none", source: "smart" }),
    solve({ id: "plus2-smart", penalty: "+2", source: "smart" }),
    solve({ id: "plus2-manual", penalty: "+2", source: "manual" }),
    solve({ id: "dnf-virtual", penalty: "DNF", source: "virtual" }),
    solve({ id: "clean-none", penalty: "none", source: undefined }),
  ];

  it("penalty=clean + source=smart keeps exactly the clean smart solve", () => {
    const kept = history.filter(
      (s) => passesPenaltyFilter(s, "clean") && passesSourceFilter(s, sources("smart")),
    );
    expect(kept.map((s) => s.id)).toEqual(["clean-smart"]);
  });

  it("source=smart alone no longer hides the +2 solves of that source", () => {
    const kept = history.filter((s) => passesSourceFilter(s, sources("smart")));
    expect(kept.map((s) => s.id)).toEqual(["clean-smart", "plus2-smart"]);
  });

  it("a +2 filter can still be narrowed by source", () => {
    const kept = history.filter(
      (s) => passesPenaltyFilter(s, "+2") && passesSourceFilter(s, sources("manual")),
    );
    expect(kept.map((s) => s.id)).toEqual(["plus2-manual"]);
  });

  it("an active source filter never admits an unattributed solve", () => {
    const kept = history.filter((s) => passesSourceFilter(s, sources("smart", "virtual")));
    expect(kept.some((s) => s.id === "clean-none")).toBe(false);
  });
});
