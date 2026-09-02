/**
 * spawnMode tests — case-pool spawning (normal | basic | advanced) with
 * folded AUF.
 *
 *   • basic    — every spawned pair is labeled "F2L n", never a BirdF2L
 *                pattern (and never undefined): the 41-case pool.
 *   • advanced — every spawned pair is a BirdF2L code, never "F2L n":
 *                the 19 distinct advanced signatures.
 *   • normal   — byte-identical legacy random injection (existing suites
 *                already pin its behavior).
 *
 * The AUF is FOLDED into the injected configuration (only the pair's own
 * two positions/orientations change; nothing else moves, no animation).
 * Detection receives `auf` and returns the base case's label — verified
 * for all 6 cross frames by the invariance tests below.
 */
import { describe, it, expect } from "vitest";
import { CubeState, FaceletStringConverter } from "@cubeforge/math-core";
import {
  spawnInfiniteF2LState,
  respawnPair,
  detectPairCase,
  sampleSpawnConfig,
  foldSpawnConfig,
  CROSS_COLOR_CONFIGS,
  getPairCaseTable,
  type CrossColor,
  type F2LSlotId,
  type AufTurn,
  type SpawnMode,
} from "../infiniteF2lEngine";

const CROSS_COLORS: CrossColor[] = ["white", "yellow", "green", "blue", "red", "orange"];
const ALL_SLOTS: F2LSlotId[] = ["FR", "FL", "BL", "BR"];
const BASIC_RE = /^F2L \d+$/;

function assertCrossIntact(state: CubeState, crossColor: CrossColor): void {
  const config = CROSS_COLOR_CONFIGS[crossColor];
  for (const ce of config.crossEdges) {
    expect(state.ep[ce]).toBe(ce);
    expect(state.eo[ce]).toBe(0);
  }
}

function assertPermutation(state: CubeState): void {
  expect(new Set(state.cp).size).toBe(8);
  expect(new Set(state.ep).size).toBe(12);
}

describe("infiniteF2l spawnMode", () => {
  it(
    "basic mode spawns only 'F2L n' cases (defined, never BirdF2L) for all 6 crosses",
    { timeout: 120_000 },
    () => {
      for (const crossColor of CROSS_COLORS) {
        // Random AUF on and off exercise both sampling paths.
        for (const aufEnabled of [true, false]) {
          for (let s = 0; s < 3; s++) {
            const slots = ALL_SLOTS.sort(() => Math.random() - 0.5).slice(0, 2);
            const { state, activePairs } = spawnInfiniteF2LState(
              crossColor,
              slots,
              true,
              { spawnMode: "basic", aufEnabled },
            );
            for (const p of activePairs) {
              expect(p.detectedCase, `${crossColor} auF=${aufEnabled} ${p.slotId}`).toBeDefined();
              expect(p.detectedCase!.caseNumber).toMatch(BASIC_RE);
            }
            assertCrossIntact(state, crossColor);
            assertPermutation(state);
            expect(FaceletStringConverter.toFaceletString(state).length).toBe(54);
          }
        }
      }
    },
  );

  it(
    "advanced mode spawns only BirdF2L codes (never 'F2L n') for all 6 crosses",
    { timeout: 120_000 },
    () => {
      for (const crossColor of CROSS_COLORS) {
        for (const aufEnabled of [true, false]) {
          for (let s = 0; s < 3; s++) {
            const slots = ALL_SLOTS.sort(() => Math.random() - 0.5).slice(0, 2);
            const { state, activePairs } = spawnInfiniteF2LState(
              crossColor,
              slots,
              true,
              { spawnMode: "advanced", aufEnabled },
            );
            for (const p of activePairs) {
              expect(p.detectedCase, `${crossColor} auf=${aufEnabled} ${p.slotId}`).toBeDefined();
              expect(p.detectedCase!.caseNumber, `${crossColor} ${p.slotId}`).not.toMatch(BASIC_RE);
            }
            assertCrossIntact(state, crossColor);
            assertPermutation(state);
          }
        }
      }
    },
  );

  it(
    "basic/advanced respawn keeps the pool guarantee mid-session (deferral never spawns outside the pool)",
    { timeout: 120_000 },
    () => {
      for (const mode of ["basic", "advanced"] as SpawnMode[]) {
        for (const crossColor of CROSS_COLORS) {
          const { state, activePairs } = spawnInfiniteF2LState(
            crossColor,
            ["FR", "BL"],
            true,
            { spawnMode: mode, aufEnabled: true },
          );
          // solve FR by swapping its pieces home, then respawn
          const frDef = CROSS_COLOR_CONFIGS[crossColor].slots.FR;
          const cpos = Array.from(state.cp).indexOf(frDef.cornerId);
          const occ = state.cp[frDef.cornerId];
          state.cp[frDef.cornerId] = frDef.cornerId;
          state.cp[cpos] = occ;
          state.co[frDef.cornerId] = 0;
          const epos = Array.from(state.ep).indexOf(frDef.edgeId);
          const eocc = state.ep[frDef.edgeId];
          state.ep[frDef.edgeId] = frDef.edgeId;
          state.ep[epos] = eocc;
          state.eo[frDef.edgeId] = 0;

          const { nextActivePairs, newPair } = respawnPair(
            state,
            crossColor,
            activePairs,
            "FR",
            ALL_SLOTS,
            { spawnMode: mode, aufEnabled: true },
          );
          expect(nextActivePairs.length, crossColor).toBe(2);
          expect(newPair, crossColor).toBeDefined();
          if (newPair) {
            expect(newPair.detectedCase, crossColor).toBeDefined();
            if (mode === "basic") {
              expect(newPair.detectedCase!.caseNumber).toMatch(BASIC_RE);
            } else {
              expect(newPair.detectedCase!.caseNumber).not.toMatch(BASIC_RE);
            }
          }
          assertCrossIntact(state, crossColor);
        }
      }
    },
  );

  it("AUF invariance: a folded config detects as its base case for all 6 crosses and all 3 turns", () => {
    for (const crossColor of CROSS_COLORS) {
      const config = CROSS_COLOR_CONFIGS[crossColor];
      const slotId: F2LSlotId = "FR";
      const def = config.slots[slotId];
      const table = getPairCaseTable(crossColor, slotId);
      // Sample a spread of detected base configs (all cases, first config each).
      const baseConfigs = [...table.byCase.values()].map((list) => list[0]).slice(0, 41);

      for (const cfg of baseConfigs) {
        const base = new CubeState();
        const curC = Array.from(base.cp).indexOf(def.cornerId);
        const occC = base.cp[cfg.cPos];
        base.cp[cfg.cPos] = def.cornerId;
        base.cp[curC] = occC;
        base.co[cfg.cPos] = cfg.co;
        const curE = Array.from(base.ep).indexOf(def.edgeId);
        const occE = base.ep[cfg.ePos];
        base.ep[cfg.ePos] = def.edgeId;
        base.ep[curE] = occE;
        base.eo[cfg.ePos] = cfg.eo;

        const baseDetected = detectPairCase(base, crossColor, slotId);
        expect(baseDetected, `${crossColor} C${cfg.cPos}co${cfg.co} E${cfg.ePos}eo${cfg.eo}`).toBeDefined();

        for (const auf of ["U", "U2", "U'"] as AufTurn[]) {
          const target = foldSpawnConfig(config.face, cfg, auf);
          const folded = base.clone();
          const occC2 = folded.cp[target.cPos];
          folded.cp[target.cPos] = def.cornerId;
          folded.cp[cfg.cPos] = occC2;
          folded.co[target.cPos] = target.co;
          const occE2 = folded.ep[target.ePos];
          folded.ep[target.ePos] = def.edgeId;
          folded.ep[cfg.ePos] = occE2;
          folded.eo[target.ePos] = target.eo;

          const foldedDetected = detectPairCase(folded, crossColor, slotId, auf);
          expect(foldedDetected?.caseNumber, `${crossColor}/${auf}`).toBe(baseDetected!.caseNumber);
        }
      }
    }
  });

  it("history parity with auf: re-detecting from startFacelets + stored auf reproduces the annotation", () => {
    for (const mode of ["basic", "advanced"] as SpawnMode[]) {
      for (let s = 0; s < 6; s++) {
        const crossColor = CROSS_COLORS[s % CROSS_COLORS.length];
        const { activePairs } = spawnInfiniteF2LState(
          crossColor,
          ALL_SLOTS.sort(() => Math.random() - 0.5).slice(0, 2),
          true,
          { spawnMode: mode, aufEnabled: true },
        );
        for (const p of activePairs) {
          const startState = FaceletStringConverter.fromFaceletString(p.startFacelets);
          expect(detectPairCase(startState, crossColor, p.slotId, p.auf)).toEqual(p.detectedCase);
        }
      }
    }
  });

  it("deferral: sampling returns null when every corner position is occupied (retry on next completion)", () => {
    const occupiedCorners = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    const occupiedEdges = new Set<number>();
    for (const crossColor of CROSS_COLORS) {
      for (const slotId of ALL_SLOTS) {
        const target = sampleSpawnConfig(
          crossColor,
          slotId,
          "basic",
          true,
          occupiedCorners,
          occupiedEdges,
        );
        expect(target, `${crossColor}/${slotId}`).toBeNull();
      }
    }
  });

  it("the config→case table covers both pools per (color, slot) and matches the detector", () => {
    // Structural guarantee: basic pool ∈ {41} and advanced pool ∈ {19} per
    // (color, slot), every config classified, and re-detection agrees.
    for (const crossColor of ["white", "green"] as CrossColor[]) {
      for (const slotId of ["FR", "BL"] as F2LSlotId[]) {
        const table = getPairCaseTable(crossColor, slotId);
        const basicKeys = [...table.byCase.keys()].filter((k) => BASIC_RE.test(k));
        const advKeys = [...table.byCase.keys()].filter((k) => !BASIC_RE.test(k));
        expect(basicKeys.length, `${crossColor}/${slotId} basic count`).toBe(41);
        expect(advKeys.length, `${crossColor}/${slotId} advanced count`).toBe(19);
        const total = [...table.byCase.values()].reduce((n, l) => n + l.length, 0);
        // 8 corners × 3 oris × 8 non-cross edges × 2 flips = 384, minus the
        // injector's solved-in-own-slot guard.
        expect(total, `${crossColor}/${slotId} total configs`).toBe(383);
      }
    }
  });
});