import { CubeState } from './CubeState';

/** Matches the solved facelet string (9 of each of 6 colors, in order). */
export const SOLVED_FACELETS = /^(.)\1{8}(.)\2{8}(.)\3{8}(.)\4{8}(.)\5{8}(.)\6{8}$/;

// Facelet offsets: U: 0..8, R: 9..17, F: 18..26, D: 27..35, L: 36..44, B: 45..53
const cornerFacelet = [
  [8, 9, 20],   // URF
  [6, 18, 38],  // UFL
  [0, 36, 47],  // ULB
  [2, 45, 11],  // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51]  // DRB
];

const edgeFacelet = [
  [5, 10],  // UR
  [7, 19],  // UF
  [3, 37],  // UL
  [1, 46],  // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14]  // BR
];

const cornerColor = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B']
];

const edgeColor = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R']
];

export class FaceletStringConverter {
  /**
   * Converts a CubeState (cp, co, ep, eo) to a 54-character Kociemba facelet string.
   */
  public static toFaceletString(state: CubeState): string {
    const f = new Array<string>(54).fill(' ');

    // Set centers
    f[4] = 'U';
    f[13] = 'R';
    f[22] = 'F';
    f[31] = 'D';
    f[40] = 'L';
    f[49] = 'B';

    // Set corners
    for (let p = 0; p < 8; p++) {
      const c = state.cp[p];
      const o = state.co[p];
      f[cornerFacelet[p][(0 + o) % 3]] = cornerColor[c][0];
      f[cornerFacelet[p][(1 + o) % 3]] = cornerColor[c][1];
      f[cornerFacelet[p][(2 + o) % 3]] = cornerColor[c][2];
    }

    // Set edges
    for (let p = 0; p < 12; p++) {
      const c = state.ep[p];
      const o = state.eo[p];
      f[edgeFacelet[p][(0 + o) % 2]] = edgeColor[c][0];
      f[edgeFacelet[p][(1 + o) % 2]] = edgeColor[c][1];
    }

    return f.join('');
  }

  /**
   * Converts a 54-character Kociemba facelet string back to a CubeState.
   *
   * This is the inverse of {@link toFaceletString}. It is used to seed the
   * analysis timeline from the real cube state reported by a Smart Cube
   * (e.g. the GAN adapter's FACELETS event), making phase detection
   * deterministic even when scramble verification is disabled.
   *
   * @param facelets  A 54-character string using U/R/F/D/L/B color letters.
   * @returns A CubeState whose cp/co/ep/eo match the given facelets.
   * @throws if the string is not 54 characters or describes an impossible state.
   */
  public static fromFaceletString(facelets: string): CubeState {
    if (facelets.length !== 54) {
      throw new Error(`Invalid facelet string length: ${facelets.length} (expected 54)`);
    }

    const cp = new Int8Array(8);
    const co = new Int8Array(8);
    const ep = new Int8Array(12);
    const eo = new Int8Array(12);

    // ── Corners ──────────────────────────────────────────────────────────
    // For each corner position p, read the 3 facelet colors and identify
    // which cubie c occupies that position and its orientation o.
    //
    // From toFaceletString: f[cornerFacelet[p][(k + o) % 3]] = cornerColor[c][k]
    // So at position p: col_j = cornerColor[c][(j - o + 3) % 3]
    // We find c by matching the color SET, then o from where col_0 sits.
    const usedCorners = new Set<number>();
    for (let p = 0; p < 8; p++) {
      const col0 = facelets[cornerFacelet[p][0]];
      const col1 = facelets[cornerFacelet[p][1]];
      const col2 = facelets[cornerFacelet[p][2]];

      let foundC = -1;
      let foundO = -1;
      for (let c = 0; c < 8; c++) {
        if (usedCorners.has(c)) continue;
        // The three colors at this position must be exactly the three
        // colors of cubie c (order-independent for identification).
        if (
          cornerColor[c].includes(col0) &&
          cornerColor[c].includes(col1) &&
          cornerColor[c].includes(col2)
        ) {
          foundC = c;
          // col0 = cornerColor[c][(0 - o + 3) % 3] = cornerColor[c][(3 - o) % 3]
          // So (3 - o) % 3 = k where cornerColor[c][k] === col0
          // => o = (3 - k) % 3
          const k = cornerColor[c].indexOf(col0);
          foundO = (3 - k) % 3;
          break;
        }
      }

      if (foundC === -1) {
        throw new Error(
          `Invalid corner at position ${p}: colors '${col0}${col1}${col2}' do not match any cubie`,
        );
      }
      usedCorners.add(foundC);
      cp[p] = foundC;
      co[p] = foundO;
    }

    // ── Edges ────────────────────────────────────────────────────────────
    // Same approach: col_j = edgeColor[e][(j - o + 2) % 2]
    // o = (2 - k) % 2 where edgeColor[e][k] === col0
    const usedEdges = new Set<number>();
    for (let p = 0; p < 12; p++) {
      const col0 = facelets[edgeFacelet[p][0]];
      const col1 = facelets[edgeFacelet[p][1]];

      let foundE = -1;
      let foundO = -1;
      for (let e = 0; e < 12; e++) {
        if (usedEdges.has(e)) continue;
        if (
          edgeColor[e].includes(col0) &&
          edgeColor[e].includes(col1)
        ) {
          foundE = e;
          const k = edgeColor[e].indexOf(col0);
          foundO = (2 - k) % 2;
          break;
        }
      }

      if (foundE === -1) {
        throw new Error(
          `Invalid edge at position ${p}: colors '${col0}${col1}' do not match any cubie`,
        );
      }
      usedEdges.add(foundE);
      ep[p] = foundE;
      eo[p] = foundO;
    }

    return new CubeState(cp, co, ep, eo);
  }
}
