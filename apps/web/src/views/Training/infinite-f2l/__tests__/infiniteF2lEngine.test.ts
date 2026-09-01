import { describe, it, expect } from "vitest";
import { Corner, Edge, CubeState } from "@cubeforge/math-core";
import {
  isF2LSlotSolved,
  buildInfiniteF2LMask,
  spawnInfiniteF2LState,
  checkSolvedPairs,
  respawnPair,
  CROSS_COLOR_CONFIGS,
} from "../infiniteF2lEngine";

describe("infiniteF2lEngine", () => {
  it("correctly identifies a solved F2L slot on a solved cube", () => {
    const solved = new CubeState();
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    expect(isF2LSlotSolved(solved, frDef)).toBe(true);
  });

  it("detects when an F2L slot corner is misoriented", () => {
    const state = new CubeState();
    state.co[Corner.DFR] = 1;
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    expect(isF2LSlotSolved(state, frDef)).toBe(false);
  });

  it("detects when an F2L slot edge is flipped", () => {
    const state = new CubeState();
    state.eo[Edge.FR] = 1;
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    expect(isF2LSlotSolved(state, frDef)).toBe(false);
  });

  it("fails slot solved check when adjacent cross edge is missing/flipped", () => {
    const state = new CubeState();
    state.eo[Edge.DF] = 1; // adjacent cross edge flipped
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    expect(isF2LSlotSolved(state, frDef)).toBe(false);
  });

  it("spawns initial state with non-solved active pairs and intact cross", () => {
    const { state, activePairs } = spawnInfiniteF2LState("white", ["FR", "BL"]);
    expect(activePairs.length).toBe(2);

    // Cross edges must be in place
    for (const ce of CROSS_COLOR_CONFIGS.white.crossEdges) {
      expect(state.ep[ce]).toBe(ce);
      expect(state.eo[ce]).toBe(0);
    }

    // Active pairs must NOT be simultaneously solved in their own slot
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    const blDef = CROSS_COLOR_CONFIGS.white.slots.BL;
    expect(isF2LSlotSolved(state, frDef) && isF2LSlotSolved(state, blDef)).toBe(false);
  });

  it("builds correct PhaseMask with cross edges and active pairs", () => {
    const { activePairs } = spawnInfiniteF2LState("white", ["FR", "BL"]);
    const mask = buildInfiniteF2LMask("white", activePairs);

    // 4 cross edges + 2 active pair edges = 6 edges
    expect(mask.edges?.length).toBe(6);
    // 2 active pair corners = 2 corners
    expect(mask.corners?.length).toBe(2);
  });

  it("detects solved pairs and respawns them cleanly", () => {
    const { state, activePairs } = spawnInfiniteF2LState("white", ["FR", "BL"]);
    
    // Artificially solve the FR slot
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    state.cp[frDef.cornerId] = frDef.cornerId;
    state.co[frDef.cornerId] = 0;
    state.ep[frDef.edgeId] = frDef.edgeId;
    state.eo[frDef.edgeId] = 0;

    const solved = checkSolvedPairs(state, activePairs);
    expect(solved).toContain("FR");

    const { nextActivePairs, newPair } = respawnPair(
      state,
      "white",
      activePairs,
      "FR",
      ["FR", "FL", "BL", "BR"],
    );

    expect(nextActivePairs.length).toBe(2);
    expect(nextActivePairs.map((p) => p.slotId)).toContain(newPair.slotId);
  });
});
