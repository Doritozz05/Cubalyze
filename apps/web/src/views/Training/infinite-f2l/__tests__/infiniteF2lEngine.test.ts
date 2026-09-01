import { describe, it, expect } from "vitest";
import { Corner, Edge, CubeState, FaceletStringConverter } from "@cubeforge/math-core";
import {
  isF2LSlotSolved,
  buildInfiniteF2LMask,
  spawnInfiniteF2LState,
  checkSolvedPairs,
  respawnPair,
  CROSS_COLOR_CONFIGS,
} from "../infiniteF2lEngine";

describe("infiniteF2lEngine", () => {
  it("correctly identifies a solved White F2L slot on a solved cube", () => {
    const solved = new CubeState();
    const frDef = CROSS_COLOR_CONFIGS.white.slots.FR;
    expect(isF2LSlotSolved(solved, frDef)).toBe(true);
  });

  it("correctly identifies a solved Yellow F2L slot on a solved cube", () => {
    const solved = new CubeState();
    const frDef = CROSS_COLOR_CONFIGS.yellow.slots.FR;
    expect(isF2LSlotSolved(solved, frDef)).toBe(true);
  });

  it("detects when an F2L slot corner is misoriented", () => {
    const state = new CubeState();
    state.co[Corner.URF] = 1;
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
    state.eo[Edge.UF] = 1; // adjacent cross edge flipped
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

    // Must convert to a valid 54-char facelet string for 3D engine
    const facelets = FaceletStringConverter.toFaceletString(state);
    expect(facelets.length).toBe(54);
  });

  it("spawns valid Yellow cross state with intact cross", () => {
    const { state, activePairs } = spawnInfiniteF2LState("yellow", ["FR", "FL"]);
    expect(activePairs.length).toBe(2);

    for (const ce of CROSS_COLOR_CONFIGS.yellow.crossEdges) {
      expect(state.ep[ce]).toBe(ce);
      expect(state.eo[ce]).toBe(0);
    }

    const facelets = FaceletStringConverter.toFaceletString(state);
    expect(facelets.length).toBe(54);
  });

  it("builds correct PhaseMask with cross edges and active pairs", () => {
    const { activePairs } = spawnInfiniteF2LState("white", ["FR", "BL"]);
    const mask = buildInfiniteF2LMask("white", activePairs);

    // 4 cross edges + 2 active pair edges = 6 edges
    expect(mask.edges?.length).toBe(6);
    // 2 active pair corners = 2 corners
    expect(mask.corners?.length).toBe(2);
  });

  it("detects solved pairs and respawns them cleanly while maintaining cross", () => {
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

    // Cross remains intact
    for (const ce of CROSS_COLOR_CONFIGS.white.crossEdges) {
      expect(state.ep[ce]).toBe(ce);
      expect(state.eo[ce]).toBe(0);
    }

    // Converts to facelets cleanly
    const facelets = FaceletStringConverter.toFaceletString(state);
    expect(facelets.length).toBe(54);
  });

  it("preserves exact positions of in-flight active pairs on respawn (lookahead preservation)", () => {
    const { state, activePairs } = spawnInfiniteF2LState("yellow", ["FR", "BL"]);
    
    // Record where BL's pieces currently are
    const blDef = CROSS_COLOR_CONFIGS.yellow.slots.BL;
    const initialBlCornerPos = Array.from(state.cp).indexOf(blDef.cornerId);
    const initialBlCornerOri = state.co[initialBlCornerPos];
    const initialBlEdgePos = Array.from(state.ep).indexOf(blDef.edgeId);
    const initialBlEdgeOri = state.eo[initialBlEdgePos];

    // Artificially solve FR
    const frDef = CROSS_COLOR_CONFIGS.yellow.slots.FR;
    state.cp[frDef.cornerId] = frDef.cornerId;
    state.co[frDef.cornerId] = 0;
    state.ep[frDef.edgeId] = frDef.edgeId;
    state.eo[frDef.edgeId] = 0;

    // Respawn FR with a new pair
    const { nextActivePairs } = respawnPair(
      state,
      "yellow",
      activePairs,
      "FR",
      ["FR", "FL", "BL", "BR"],
    );

    expect(nextActivePairs.length).toBe(2);

    // BL pieces must NOT have moved at all
    expect(Array.from(state.cp).indexOf(blDef.cornerId)).toBe(initialBlCornerPos);
    expect(state.co[initialBlCornerPos]).toBe(initialBlCornerOri);
    expect(Array.from(state.ep).indexOf(blDef.edgeId)).toBe(initialBlEdgePos);
    expect(state.eo[initialBlEdgePos]).toBe(initialBlEdgeOri);
  });
});
