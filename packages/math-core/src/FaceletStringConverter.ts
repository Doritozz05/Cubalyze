import { CubeState } from './CubeState';

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
}
