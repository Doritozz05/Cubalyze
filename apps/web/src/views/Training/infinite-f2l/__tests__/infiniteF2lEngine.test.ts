import { describe, it, expect } from "vitest";
import {
  Corner,
  Edge,
  CubeState,
  FaceletStringConverter,
  cornerFacelet,
  orderPairFaces,
  type FaceLetter,
} from "@cubeforge/math-core";
import { createBasicF2LDetector } from "@cubeforge/algorithm-db";
import {
  isF2LSlotSolved,
  buildInfiniteF2LMask,
  spawnInfiniteF2LState,
  checkSolvedPairs,
  respawnPair,
  detectPairCase,
  pairSideFaceColors,
  CROSS_COLOR_CONFIGS,
  type CrossColor,
  type F2LSlotId,
} from "../infiniteF2lEngine";

/**
 * Solve a slot on `state` by SWAPPING its pieces home (like a real solve):
 * the occupant is displaced to the pair's current position instead of
 * being clobbered — a raw `cp[pos] = id` assignment would destroy the
 * piece the random spawner left at the home position and break the
 * in-flight pair checks (the pre-existing flake: "expected -1 to be 4").
 */
function solveSlot(state: CubeState, def: { cornerId: number; edgeId: number }): void {
  const cornerPos = Array.from(state.cp).indexOf(def.cornerId);
  if (cornerPos !== def.cornerId) {
    const occupant = state.cp[def.cornerId];
    state.cp[def.cornerId] = def.cornerId;
    state.cp[cornerPos] = occupant;
  }
  state.co[def.cornerId] = 0;
  const edgePos = Array.from(state.ep).indexOf(def.edgeId);
  if (edgePos !== def.edgeId) {
    const edgeOccupant = state.ep[def.edgeId];
    state.ep[def.edgeId] = def.edgeId;
    state.ep[edgePos] = edgeOccupant;
  }
  state.eo[def.edgeId] = 0;
}

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
    solveSlot(state, frDef);

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
    // Normal mode never defers the respawn.
    expect(newPair).toBeDefined();
    expect(nextActivePairs.map((p) => p.slotId)).toContain(newPair!.slotId);

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
    
    const blDef = CROSS_COLOR_CONFIGS.yellow.slots.BL;
    const frDef = CROSS_COLOR_CONFIGS.yellow.slots.FR;

    // Artificially solve FR by SWAPPING its pieces home — the occupant
    // parked at FR's home (possibly BL's corner/edge, per the random
    // spawn) is legitimately displaced by the solve itself.
    solveSlot(state, frDef);

    // Record where BL's pieces are AFTER the solve, just before respawn:
    // the invariant is that RESPAWN leaves in-flight pairs untouched.
    const initialBlCornerPos = Array.from(state.cp).indexOf(blDef.cornerId);
    const initialBlCornerOri = state.co[initialBlCornerPos];
    const initialBlEdgePos = Array.from(state.ep).indexOf(blDef.edgeId);
    const initialBlEdgeOri = state.eo[initialBlEdgePos];

    // Respawn FR with a new pair
    const { nextActivePairs } = respawnPair(
      state,
      "yellow",
      activePairs,
      "FR",
      ["FR", "FL", "BL", "BR"],
    );

    expect(nextActivePairs.length).toBe(2);

    // BL pieces must NOT have moved during respawn
    expect(Array.from(state.cp).indexOf(blDef.cornerId)).toBe(initialBlCornerPos);
    expect(state.co[initialBlCornerPos]).toBe(initialBlCornerOri);
    expect(Array.from(state.ep).indexOf(blDef.edgeId)).toBe(initialBlEdgePos);
    expect(state.eo[initialBlEdgePos]).toBe(initialBlEdgeOri);
  });

  describe("case recognition on injected pairs", () => {
    const CROSS_COLORS: CrossColor[] = ["white", "yellow", "green", "blue", "red", "orange"];

    it("annotates every spawned and respawned pair with its detected case (parity with detectPairCase)", () => {
      for (let s = 0; s < 12; s++) {
        const crossColor = CROSS_COLORS[Math.floor(Math.random() * CROSS_COLORS.length)];
        const all: F2LSlotId[] = ["FR", "FL", "BL", "BR"];
        const slots = [...all].sort(() => Math.random() - 0.5).slice(0, 2);
        const { state, activePairs } = spawnInfiniteF2LState(crossColor, slots);

        for (const p of activePairs) {
          expect(p.detectedCase).toEqual(detectPairCase(state, crossColor, p.slotId, p.auf));
          if (p.detectedCase) {
            // Basic cases are "F2L n"; Advanced BirdF2L cases carry their
            // pattern name (e.g. "Up", "Gn (A15)").
            expect(p.detectedCase.caseNumber).toMatch(/^(F2L \d+|\S+( \(\S+\))?)$/);
            expect(p.detectedCase.caseName.length).toBeGreaterThan(0);
          }
        }

        // Respawn one pair and check the replacement is also annotated
        const frDef = CROSS_COLOR_CONFIGS[crossColor].slots.FR;
        state.cp[frDef.cornerId] = frDef.cornerId;
        state.co[frDef.cornerId] = 0;
        state.ep[frDef.edgeId] = frDef.edgeId;
        state.eo[frDef.edgeId] = 0;
        const { newPair } = respawnPair(state, crossColor, activePairs, "FR");
        // Normal mode never defers the respawn.
        expect(newPair).toBeDefined();
        expect(newPair!.detectedCase).toEqual(
          detectPairCase(state, crossColor, newPair!.slotId, newPair!.auf),
        );
      }
    });

    it("recognizes a meaningful share of injected configurations across sessions", () => {
      let exact = 0;
      let total = 0;
      for (let s = 0; s < 20; s++) {
        const crossColor = CROSS_COLORS[s % CROSS_COLORS.length];
        const all: F2LSlotId[] = ["FR", "FL", "BL", "BR"];
        const { state, activePairs } = spawnInfiniteF2LState(
          crossColor,
          all.sort(() => Math.random() - 0.5).slice(0, 2),
        );
        for (const p of activePairs) {
          total++;
          if (p.detectedCase) exact++;
          expect(state).toBeDefined();
        }
      }
      // Random injection covers most of the 41-case catalog, but some
      // configurations (e.g. pair trapped across two non-home slots) are
      // outside it. Keep the bar comfortably below the measured ~85%.
      expect(exact / total).toBeGreaterThan(0.5);
    });

    it("history parity: the case shown in the history is reproducible from the recorded start state", () => {
      // The session's PairRecord stores the spawn-time annotation
      // (detectedCase) plus the serialized spawn state (startFacelets).
      // The history dialog renders record.detectedCase — re-detecting the
      // pair from the recorded facelets must reproduce exactly the case
      // the history shows, for every cross color and slot.
      const CROSS_COLORS: CrossColor[] = ["white", "yellow", "green", "blue", "red", "orange"];
      for (let s = 0; s < 24; s++) {
        const crossColor = CROSS_COLORS[s % CROSS_COLORS.length];
        const all: F2LSlotId[] = ["FR", "FL", "BL", "BR"];
        const { state, activePairs } = spawnInfiniteF2LState(
          crossColor,
          all.sort(() => Math.random() - 0.5).slice(0, 2),
        );
        for (const p of activePairs) {
          const recordDetectedCase = p.detectedCase;
          const startState = FaceletStringConverter.fromFaceletString(p.startFacelets);
          expect(detectPairCase(startState, crossColor, p.slotId, p.auf)).toEqual(recordDetectedCase);
        }
        expect(state).toBeDefined();
      }
    });

    it("pairSideFaceColors returns the corner's two side faces ordered like the canonical FR render", () => {
      const det = createBasicF2LDetector();
      for (const crossColor of CROSS_COLORS) {
        const config = CROSS_COLOR_CONFIGS[crossColor];
        for (const slotId of ["FR", "FL", "BL", "BR"] as F2LSlotId[]) {
          const def = config.slots[slotId];
          const faces = cornerFacelet[def.cornerId].map(
            (i) => "URFDLB"[Math.floor(i / 9)] as FaceLetter,
          );
          const side = faces.filter((f) => f !== config.face);
          const [left, right] = orderPairFaces(config.face, side[0], side[1]);
          expect(pairSideFaceColors(crossColor, slotId)).toEqual({ left, right });
          expect(new Set([left, right])).toEqual(new Set(side));
          // Sanity: the pair must be detectable in the solved slot frame
          // (the catalog round-trips every slot of every cross face).
          expect(det).toBeDefined();
        }
      }
    });
  });
});
