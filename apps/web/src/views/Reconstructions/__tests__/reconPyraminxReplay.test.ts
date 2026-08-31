/**
 * Pyraminx reconstruction → replay pipeline tests.
 *
 * The pyraminx records in the dataset replay on the Pyraminx 3D engine
 * (main-thread path in ReplaySection). This suite pins the conversion
 * contract:
 *   • pyraminxNotationToReplayMoves keeps EVERY token verbatim in
 *     displayNotation — including lowercase TIP turns, which the cube
 *     converter would corrupt (it re-cases lowercase letters as wides)
 *   • reconToSolve marks pyraminx records with puzzleType "pyram" so the
 *     replay section builds the Pyraminx engine instead of the placeholder
 */
import { describe, expect, it } from "vitest";
import {
  pyraminxNotationToReplayMoves,
  reconToSolve,
  type ReconFullRecord,
} from "../reconData";

describe("pyraminxNotationToReplayMoves", () => {
  it("keeps every layer and tip token verbatim, including primes", () => {
    const events = pyraminxNotationToReplayMoves("U L' R B' u l' b");
    expect(events.map((e) => e.displayNotation)).toEqual([
      "U",
      "L'",
      "R",
      "B'",
      "u",
      "l'",
      "b",
    ]);
  });

  it("never re-cases or wide-marks lowercase tip turns (cube converter would)", () => {
    const events = pyraminxNotationToReplayMoves("u U");
    expect(events[0].displayNotation).toBe("u");
    expect(events[0].wide).toBeUndefined();
    expect(events[1].displayNotation).toBe("U");
  });

  it("drops rotations and garbage tokens (x/y/z are not pyraminx moves)", () => {
    const events = pyraminxNotationToReplayMoves("U x y' U2 R' BAD");
    expect(events.map((e) => e.displayNotation)).toEqual(["U", "R'"]);
  });

  it("carries inert cube-event fields and a fixed timeline spacing", () => {
    const events = pyraminxNotationToReplayMoves("U L");
    expect(events).toHaveLength(2);
    expect(events[0].face).toBe("U");
    expect(events[0].direction).toBe(1);
    expect(events[1].cubeTimestamp - events[0].cubeTimestamp).toBe(550);
  });

  it("parses a full WCA scramble with tips as the last tokens", () => {
    const scramble = "B' L' R' U L' B R U L U' B l'";
    const events = pyraminxNotationToReplayMoves(scramble);
    expect(events.map((e) => e.displayNotation)).toEqual(scramble.split(" "));
  });
});

describe("reconToSolve (pyraminx records)", () => {
  const base: ReconFullRecord = {
    key: "pyra-1",
    source: "cuberoot",
    id: 1,
    solver: "Tester",
    time: 3.5,
    date: "2024-01-01",
    competition: "Test Comp",
    method: "LBL",
    methodGroup: "Other",
    puzzle: "pyraminx",
    stm: 12,
    tps: 3.4,
    tags: [],
    url: null,
    scramble: "U L' B u'",
    text: "U L' B u'",
    phases: [
      {
        label: "Full solve",
        moves: "U L' B u'",
        moveCount: 4,
      },
    ],
    reconstructor: null,
    record: null,
    average: null,
    solveNum: null,
    cube: null,
    country: null,
    official: null,
    stats: {},
    recognition: { inspection: null, finalSolved: true, crossVerified: false },
    rotationCount: 0,
    orientationTimeline: [],
  } as unknown as ReconFullRecord;

  it("resolves to puzzleType pyram (renderable by the pyraminx engine)", () => {
    const solve = reconToSolve(base);
    expect(solve.puzzleType).toBe("pyram");
  });

  it("carries the verbatim tokens in displayNotation for the replay engine", () => {
    const solve = reconToSolve(base);
    expect(solve.moves?.map((m) => m.displayNotation)).toEqual([
      "U",
      "L'",
      "B",
      "u'",
    ]);
  });

  it("phase move counts are preserved", () => {
    const solve = reconToSolve(base);
    expect(solve.analysis?.phases?.[0]?.moveCount).toBe(4);
  });
});
