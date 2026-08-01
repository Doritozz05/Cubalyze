import { describe, expect, it } from "vitest";
import { processSolveAnalysisJob } from "./solveAnalysisCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("solve analysis coordinator", () => {
  it("keeps concurrent analyses attached to their own solves", async () => {
    const saveA = deferred<string | null>();
    const saveB = deferred<string | null>();
    const results: string[] = [];

    const jobA = processSolveAnalysisJob({
      solveId: "solve-a",
      save: saveA.promise,
      analyze: async () => "analysis-a",
      onResult: (result) => {
        results.push(result);
      },
    });
    const jobB = processSolveAnalysisJob({
      solveId: "solve-b",
      save: saveB.promise,
      analyze: async () => "analysis-b",
      onResult: (result) => {
        results.push(result);
      },
    });

    // Resolve out of order to reproduce the original race.
    saveB.resolve("solve-b");
    saveA.resolve("solve-a");

    await expect(Promise.all([jobA, jobB])).resolves.toEqual([true, true]);
    expect(results).toEqual(["analysis-b", "analysis-a"]);
  });

  it("does not analyze when the save resolves with another solve ID", async () => {
    const analyze = async () => "should-not-run";
    let analyzed = false;

    const processed = await processSolveAnalysisJob({
      solveId: "expected",
      save: Promise.resolve("different"),
      analyze: async () => {
        analyzed = true;
        return analyze();
      },
      onResult: () => undefined,
    });

    expect(processed).toBe(false);
    expect(analyzed).toBe(false);
  });
});
