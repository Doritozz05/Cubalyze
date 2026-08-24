import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { detectCrossColor } from '../../packages/algorithm-db/src/recognition/conventions';
import { findCrossOnDFrames } from '../../packages/algorithm-db/src/recognition/rotationGroup';

const EDGE_FACELETS: [number, number][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];

function face(i: number): string {
  if (i < 9) return 'U'; if (i < 18) return 'R'; if (i < 27) return 'F';
  if (i < 36) return 'D'; if (i < 45) return 'L'; return 'B';
}

function dump(label: string, state: CubeState): void {
  const f = FaceletStringConverter.toFaceletString(state);
  console.log(`--- ${label} ---`);
  console.log(`  crossColor: ${detectCrossColor(state)}`);
  console.log(`  white pieces (4-7) at: cp[${[4,5,6,7].map((p) => state.cp[p]).join(',')}] ep[${[4,5,6,7].map((p) => state.ep[p]).join(',')}]`);
  console.log(`  positions 0-3 hold cp: ${[0,1,2,3].map((p) => state.cp[p]).join(',')} ep: ${[0,1,2,3].map((p) => state.ep[p]).join(',')}`);
  for (const faceName of ['U', 'D', 'F']) {
    const stickers = EDGE_FACELETS.map(([a, b], e) => (face(a) === faceName ? f[a] : face(b) === faceName ? f[b] : null))
      .filter((s): s is string => s !== null);
    console.log(`  face ${faceName} edge stickers: ${stickers.join('')}`);
  }
  console.log(`  frames(white on D): ${findCrossOnDFrames(state, [4, 5, 6, 7]).join(' | ') || 'NONE'}`);
  console.log(`  frames(yellow on D): ${findCrossOnDFrames(state, [0, 1, 2, 3]).join(' | ') || 'NONE'}`);
}

const f2l39 = new CubeState();
f2l39.applySequence("R U' R' U' R U R' U2' R U' R'");
dump('F2L 39 setup', f2l39);

const s = new CubeState();
s.applySequence("R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2");
s.applySequence('z y');
s.applySequence("D2 L U R' U'");
dump('2510 CubeRoot cross-end', s);
