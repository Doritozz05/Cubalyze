/**
 * Detection completeness regression — Advanced F2L loader.
 *
 * Enumerate EVERY possible single-pair configuration the random injector can
 * produce (corner: 8 positions × 3 orientations; edge: 8 non-cross positions
 * × 2 orientations) and verify each one is detected by the combined
 * Basic + Advanced catalog. 0 undefined proves the 60-signature catalog
 * (41 Basic + 19 distinct Advanced) is a COMPLETE cover of the pair-config
 * space — measured BEFORE the loader: ~20% of spawns were undefined.
 */
import { describe, it, expect } from "vitest";
import { CubeState } from "@cubalyze/math-core";
import {
  detectPairCase,
  CROSS_COLOR_CONFIGS,
  type CrossColor,
  type F2LSlotId,
} from "../infiniteF2lEngine";

function findPieceIndex(arr: { [index: number]: number; length: number }, id: number): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === id) return i;
  }
  return -1;
}

describe("f2l detection coverage", () => {
  it(
    "detects every possible pair configuration for all 6 cross colors (0 undefined)",
    // Exhaustive over 6×383 configurations; generous timeout because the
    // full parallel suite can slow the worker far past the 5s default.
    { timeout: 60_000 },
    () => {
    const CROSS_COLORS: CrossColor[] = ["white", "yellow", "green", "blue", "red", "orange"];
    let total = 0;
    let undefinedTotal = 0;
    const undefSamples: string[] = [];

    for (const crossColor of CROSS_COLORS) {
      const config = CROSS_COLOR_CONFIGS[crossColor];
      const slotId: F2LSlotId = "FR";
      const def = config.slots[slotId];

      // Edge positions NOT occupied by the cross: all 12 minus cross edges.
      const eligibleEdges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(
        (e) => !config.crossEdges.includes(e as never),
      );

      let count = 0;
      let undef = 0;
      for (let cPos = 0; cPos < 8; cPos++) {
        for (let co = 0; co < 3; co++) {
          for (const ePos of eligibleEdges) {
            for (let eo = 0; eo < 2; eo++) {
              // Skip the solved-in-own-slot guard the injector applies.
              if (cPos === def.cornerId && co === 0 && ePos === def.edgeId && eo === 0) {
                continue;
              }
              const state = new CubeState();
              // Place corner piece into cPos with orientation co.
              const curC = findPieceIndex(state.cp, def.cornerId);
              if (curC !== -1 && curC !== cPos) {
                const occ = state.cp[cPos];
                state.cp[cPos] = def.cornerId;
                state.cp[curC] = occ;
              }
              state.co[cPos] = co;
              const curE = findPieceIndex(state.ep, def.edgeId);
              if (curE !== -1 && curE !== ePos) {
                const occ = state.ep[ePos];
                state.ep[ePos] = def.edgeId;
                state.ep[curE] = occ;
              }
              state.eo[ePos] = eo;

              count++;
              const detected = detectPairCase(state, crossColor, slotId);
              if (!detected) {
                undef++;
                if (undefSamples.length < 12) {
                  undefSamples.push(
                    `${crossColor} C${cPos} co${co} E${ePos} eo${eo}`,
                  );
                }
              }
            }
          }
        }
      }
      total += count;
      undefinedTotal += undef;
      console.log(
        `[exhaustive] ${crossColor}  configs=${count}  detected=${count - undef}  undefined=${undef}`,
      );
    }
    console.log(
      `[exhaustive] TOTAL configs=${total}  undefined=${undefinedTotal}  ${(
        (100 * (total - undefinedTotal)) /
        total
      ).toFixed(1)}%`,
    );
    if (undefSamples.length) {
      console.log(`[exhaustive] undefined samples: ${undefSamples.join(" | ")}`);
    }
    // The complete-cover theorem: 0 undefined across all 6 frames.
    expect(undefinedTotal).toBe(0);
  });
});
