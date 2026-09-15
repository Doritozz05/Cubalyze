/**
 * @cubalyze/math-core — Cube2x2FaceletConverter
 *
 * Converts between {@link Cube2x2State} (cp + co) and a 24-character
 * facelet string for the 2×2×2 Pocket Cube.
 *
 * ## Facelet layout (24 chars, 4 per face × 6 faces)
 *
 *   U: 0..3   R: 4..7   F: 8..11   D: 12..15   L: 16..19   B: 20..23
 *
 * Each face is a 2×2 grid. The viewing convention matches the 3×3 layout
 * (scaled down from 3×3 to 2×2):
 *
 *   U face (viewed from top, B at top, L at left):
 *     0 = ULB    1 = UBR
 *     2 = UFL    3 = URF
 *
 *   R face (viewed from right, U at top, F at left):
 *     4 = URF    5 = UBR
 *     6 = DFR    7 = DRB
 *
 *   F face (viewed from front, U at top, L at left):
 *     8 = UFL    9 = URF
 *    10 = DLF   11 = DFR
 *
 *   D face (viewed from below, F at top, L at left):
 *    12 = DLF   13 = DFR
 *    14 = DBL   15 = DRB
 *
 *   L face (viewed from left, U at top, B at left):
 *    16 = ULB   17 = UFL
 *    18 = DBL   19 = DLF
 *
 *   B face (viewed from back, U at top, R at left):
 *    20 = UBR   21 = ULB
 *    22 = DRB   23 = DBL
 */

import { Cube2x2State } from './Cube2x2State';

/** Regex matching a solved 2×2 facelet string (4 of each of 6 colors). */
export const SOLVED_FACELETS_2X2 = /^(.)\1{3}(.)\2{3}(.)\3{3}(.)\4{3}(.)\5{3}(.)\6{3}$/;

// ── Corner → facelet position mapping ────────────────────────────────────
//
// For each corner position (0..7), the three facelet indices and the three
// face colors in the order [U/D face, R/L face, F/B face].

const CORNER_FACELET_2X2: number[][] = [
  [3, 4, 9],    // URF: U3, R0, F1
  [2, 8, 17],   // UFL: U2, F0, L1
  [0, 16, 21],  // ULB: U0, L0, B1
  [1, 20, 5],   // UBR: U1, B0, R1
  [13, 11, 6],  // DFR: D1, F3, R2
  [12, 19, 10], // DLF: D0, L3, F2
  [14, 23, 18], // DBL: D2, B3, L2
  [15, 7, 22],  // DRB: D3, R3, B2
];

// Colors of each corner piece in solved state (same as 3×3 cornerColor).
const CORNER_COLOR_2X2: string[][] = [
  ['U', 'R', 'F'], // URF
  ['U', 'F', 'L'], // UFL
  ['U', 'L', 'B'], // ULB
  ['U', 'B', 'R'], // UBR
  ['D', 'F', 'R'], // DFR
  ['D', 'L', 'F'], // DLF
  ['D', 'B', 'L'], // DBL
  ['D', 'R', 'B'], // DRB
];

export class Cube2x2FaceletConverter {
  /**
   * Convert a {@link Cube2x2State} to a 24-character facelet string.
   *
   * Centers are always set (positions U0..U3 share the same center concept,
   * but for 2×2 there are no fixed centers — we set the face color letters
   * based on the corner colors, which is consistent with the 3×3 approach).
   */
  public static toFaceletString(state: Cube2x2State): string {
    const f = new Array<string>(24).fill(' ');

    // Set "center" facelets — for 2×2 all 4 stickers on a face share the
    // same center color, but since there are no centers, we derive the face
    // color from the corner at the "center-adjacent" position. In practice,
    // we just set all facelets from the corner data below.

    // Set corner facelets
    for (let p = 0; p < 8; p++) {
      const c = state.cp[p]; // piece ID at position p
      const o = state.co[p]; // orientation at position p

      // Orientation rotates the destination facelet position:
      // o=0: f[facelet[0]] = color[0], f[facelet[1]] = color[1], f[facelet[2]] = color[2]
      // o=1: f[facelet[1]] = color[0], f[facelet[2]] = color[1], f[facelet[0]] = color[2]
      // o=2: f[facelet[2]] = color[0], f[facelet[0]] = color[1], f[facelet[1]] = color[2]
      f[CORNER_FACELET_2X2[p][(0 + o) % 3]] = CORNER_COLOR_2X2[c][0];
      f[CORNER_FACELET_2X2[p][(1 + o) % 3]] = CORNER_COLOR_2X2[c][1];
      f[CORNER_FACELET_2X2[p][(2 + o) % 3]] = CORNER_COLOR_2X2[c][2];
    }

    return f.join('');
  }

  /**
   * Directly convert a scramble string into a 24-character 2×2 facelet string.
   */
  public static toFaceletStringFromScramble(scramble: string): string {
    const state = new Cube2x2State();
    state.applySequence(scramble);
    return Cube2x2FaceletConverter.toFaceletString(state);
  }

  /**
   * Convert a 24-character facelet string back to a {@link Cube2x2State}.
   *
   * @param facelets  24-char string using U/R/F/D/L/B color letters.
   * @returns A Cube2x2State matching the given facelets.
   * @throws if the string is not 24 chars or describes an impossible state.
   */
  public static fromFaceletString(facelets: string): Cube2x2State {
    if (facelets.length !== 24) {
      throw new Error(`Invalid 2×2 facelet string length: ${facelets.length} (expected 24)`);
    }

    const cp = new Uint8Array(8);
    const co = new Uint8Array(8);
    const usedCorners = new Set<number>();

    for (let p = 0; p < 8; p++) {
      const [f0, f1, f2] = CORNER_FACELET_2X2[p];
      const col0 = facelets[f0];
      const col1 = facelets[f1];
      const col2 = facelets[f2];

      let foundC = -1;
      let foundO = -1;

      for (let c = 0; c < 8; c++) {
        if (usedCorners.has(c)) continue;
        // Match the color SET (order-independent for identification)
        if (
          CORNER_COLOR_2X2[c].includes(col0) &&
          CORNER_COLOR_2X2[c].includes(col1) &&
          CORNER_COLOR_2X2[c].includes(col2)
        ) {
          foundC = c;
          // col0 is read from cornerFacelet[p][0]
          // From toFaceletString: f[cornerFacelet[p][(k + o) % 3]] = cornerColor[c][k]
          // So for the 0th facelet position (k + o) % 3 = 0 => k = (3 - o) % 3
          // Therefore, cornerColor[c][(3 - o) % 3] === col0
          // If k = cornerColor[c].indexOf(col0), then (3 - o) % 3 = k => o = (3 - k) % 3
          const k = CORNER_COLOR_2X2[c].indexOf(col0);
          foundO = (3 - k) % 3;
          break;
        }
      }

      if (foundC === -1) {
        throw new Error(
          `Invalid corner at position ${p}: colors '${col0}${col1}${col2}' do not match any corner piece`,
        );
      }

      usedCorners.add(foundC);
      cp[p] = foundC;
      co[p] = foundO;
    }

    return new Cube2x2State(cp, co);
  }
}
