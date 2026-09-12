import { describe, expect, it } from "vitest";
import {
  cubeFilterOptions,
  freshFilters,
  mergeStatsFilters,
  methodFilterOptions,
  passesCubeFilter,
  passesMethodFilter,
} from "../useStatsFilters";
import type { Solve, SolveMethod } from "@/types";

/** A solve row with only the fields the filters look at. */
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

const set = (...methods: SolveMethod[]) => new Set<SolveMethod>(methods);

describe("passesCubeFilter", () => {
  it("lets everything through when no cube is selected", () => {
    expect(passesCubeFilter({ cubeId: "gan" }, null)).toBe(true);
    expect(passesCubeFilter({ cubeId: undefined }, null)).toBe(true);
  });

  it("keeps only the selected cube's solves", () => {
    expect(passesCubeFilter({ cubeId: "gan" }, "gan")).toBe(true);
    expect(passesCubeFilter({ cubeId: "valk" }, "gan")).toBe(false);
  });

  it("excludes solves with no cube, exactly like the method filter does", () => {
    // "I solved with the GAN 12" must not also show solves whose cube nobody
    // recorded — otherwise the list would not match the count on the option.
    expect(passesCubeFilter({ cubeId: undefined }, "gan")).toBe(false);
  });

  it("agrees with its own option counts", () => {
    const history = [
      solve({ id: "1", cubeId: "gan", cubeLabel: "GAN 12" }),
      solve({ id: "2", cubeId: "gan", cubeLabel: "GAN 12" }),
      solve({ id: "3", cubeId: undefined }),
    ];
    const gan = cubeFilterOptions(history).find((o) => o.id === "gan");
    const kept = history.filter((s) => passesCubeFilter(s, "gan"));
    expect(gan?.count).toBe(kept.length);
  });
});

describe("cubeFilterOptions", () => {
  it("counts per cube, most used first, using the label frozen on the rows", () => {
    const options = cubeFilterOptions([
      solve({ cubeId: "gan", cubeLabel: "GAN 12" }),
      solve({ cubeId: "gan", cubeLabel: "GAN 12" }),
      solve({ cubeId: "valk", cubeLabel: "Valk 2" }),
    ]);
    expect(options).toEqual([
      { id: "gan", label: "GAN 12", count: 2 },
      { id: "valk", label: "Valk 2", count: 1 },
    ]);
  });

  it("ignores solves with no cube — there is nothing to filter them by", () => {
    expect(cubeFilterOptions([solve({ cubeId: undefined }), solve({ cubeId: "" })])).toEqual([]);
  });

  it("falls back to the id when a row has no frozen label", () => {
    expect(cubeFilterOptions([solve({ cubeId: "item_123" })])).toEqual([
      { id: "item_123", label: "item_123", count: 1 },
    ]);
  });

  it("keeps a cube whose item is gone from the Locker", () => {
    // The history is the source of the options, so a sold cube stays reachable.
    expect(cubeFilterOptions([solve({ cubeId: "sold", cubeLabel: "Sold cube" })])).toEqual([
      { id: "sold", label: "Sold cube", count: 1 },
    ]);
  });
});

describe("methodFilterOptions", () => {
  it("lists the methods that actually appear, most used first", () => {
    const options = methodFilterOptions([
      solve({ method: "CFOP" }),
      solve({ method: "CFOP" }),
      solve({ method: "ZZ" }),
      solve({ method: undefined }),
    ]);
    expect(options).toEqual([
      { method: "CFOP", count: 2 },
      { method: "ZZ", count: 1 },
    ]);
  });

  it("is empty for an event with no methods at all (2×2, Pyraminx)", () => {
    expect(methodFilterOptions([solve({ puzzleType: "222" }), solve({ puzzleType: "pyram" })])).toEqual(
      [],
    );
  });
});

describe("mergeStatsFilters — the event/cube rule", () => {
  it("drops the cube filter when the event changes", () => {
    const withCube = { ...freshFilters(), puzzleType: "333", cubeId: "gan" };
    expect(mergeStatsFilters(withCube, { puzzleType: "222" }).cubeId).toBeNull();
  });

  it("keeps the cube filter when any other filter changes", () => {
    const withCube = { ...freshFilters(), puzzleType: "333", cubeId: "gan" };
    expect(mergeStatsFilters(withCube, { sort: "best" }).cubeId).toBe("gan");
    expect(mergeStatsFilters(withCube, { search: "gan" }).cubeId).toBe("gan");
    // Re-selecting the SAME event is not a change.…
    expect(mergeStatsFilters(withCube, { puzzleType: "333" }).cubeId).toBe("gan");
  });

  it("lets a caller set the event and the cube in one update", () => {
    const merged = mergeStatsFilters(freshFilters(), { puzzleType: "222", cubeId: "valk" });
    expect(merged).toMatchObject({ puzzleType: "222", cubeId: "valk" });
  });

  it("leaves everything else alone", () => {
    const current = { ...freshFilters(), methods: new Set<SolveMethod>(["CFOP"]), search: "x" };
    const merged = mergeStatsFilters(current, { sort: "oldest" });
    expect(merged.methods).toEqual(new Set(["CFOP"]));
    expect(merged.search).toBe("x");
    expect(merged.sort).toBe("oldest");
  });

  it("does not mutate the previous filters", () => {
    const withCube = { ...freshFilters(), puzzleType: "333", cubeId: "gan" };
    mergeStatsFilters(withCube, { puzzleType: "222" });
    expect(withCube.cubeId).toBe("gan");
  });
});

describe("the filter combination a method filter has to get right", () => {
  // The exact bug the phase-1 rule fixed: a 2×2 stores no method, and the old
  // `if (s.method && !methods.has(s.method))` guard let it through a CFOP filter
  // precisely BECAUSE it had no method.
  const history: Solve[] = [
    solve({ id: "a", puzzleType: "333", method: "CFOP", cubeId: "gan", cubeLabel: "GAN 12" }),
    solve({ id: "b", puzzleType: "333", method: "ZZ", cubeId: "gan", cubeLabel: "GAN 12" }),
    solve({ id: "c", puzzleType: "333", method: "CFOP", cubeId: "valk", cubeLabel: "Valk 3" }),
    solve({ id: "d", puzzleType: "222", method: undefined, cubeId: undefined }),
  ];

  it("a 2×2 never slips past a CFOP filter", () => {
    const kept = history.filter((s) => passesMethodFilter(s, set("CFOP")));
    expect(kept.map((s) => s.id)).toEqual(["a", "c"]);
    expect(kept.some((s) => s.puzzleType === "222")).toBe(false);
  });

  it("an empty method selection is not a filter", () => {
    expect(history.filter((s) => passesMethodFilter(s, set())).length).toBe(4);
  });

  it("combines method + cube into an AND", () => {
    const kept = history.filter(
      (s) => passesMethodFilter(s, set("CFOP")) && passesCubeFilter(s, "gan"),
    );
    expect(kept.map((s) => s.id)).toEqual(["a"]);
  });

  it("the cube filter alone never resurrects a no-method solve into a method view", () => {
    // Both filters are applied by the hook, in order; this pins that neither
    // one can undo the other.
    const kept = history.filter(
      (s) => passesCubeFilter(s, "gan") && passesMethodFilter(s, set("Roux")),
    );
    expect(kept).toEqual([]);
  });

  it("an unattributed solve is neither a method vote nor a cube vote", () => {
    const kept = history.filter(
      (s) => passesCubeFilter(s, "gan") && passesMethodFilter(s, set("CFOP", "ZZ")),
    );
    // Only the two 3×3 solves on the GAN survive; the 2×2 with no cube and no
    // method is excluded by BOTH filters, not admitted by either.
    expect(kept.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("the options offered match what the event actually contains", () => {
    const threeByThree = history.filter((s) => s.puzzleType === "333");
    expect(methodFilterOptions(threeByThree)).toEqual([
      { method: "CFOP", count: 2 },
      { method: "ZZ", count: 1 },
    ]);
    expect(cubeFilterOptions(threeByThree).map((o) => o.id)).toEqual(["gan", "valk"]);
    // The 2×2 contributes nothing: no method, no cube.
    expect(methodFilterOptions([history[3]])).toEqual([]);
    expect(cubeFilterOptions([history[3]])).toEqual([]);
  });
});
