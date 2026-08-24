/**
 * diag-2518-search.ts — for every R in the rotation group (applied after the
 * scramble), report: does the Cross phase leave WHITE (4-7) on D? does the
 * final return to a rotation of solved / inverted solved?
 */
import { CubeState } from '../../packages/math-core';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { ROTATION_GROUP, applyRotation, isRotationOfReference } from '../../packages/algorithm-db/src/recognition/rotationGroup';
import { applyColorRemap, U_D_SWAP_REMAP } from '../../packages/algorithm-db/src/recognition/conventions';

const SCRAMBLE = "D2 R F U2 L2 B2 L' D2 R2 D2 F2 U' F2 L D' L B' R' B2";
const CROSS = "R D F D2 F' D'";
const PHASES = [
  'R D F D2 F\' D\'',
  "U F U' F'",
  "U' R U' R' U' R U' R' U R U' R'",
  "y U2 R U R' y U R U' R'",
  "y' U' R U2 R'",
  '',
  'U2',
];

const invertedSolved = applyColorRemap(new CubeState(), U_D_SWAP_REMAP);

function crossOnD(state: CubeState, edges: number[]): boolean {
  const set = new Set(edges);
  for (const r of ROTATION_GROUP) {
    const v = applyRotation(state, r);
    let ok = true;
    for (let p = 4; p < 8; p++) if (!set.has(v.ep[p]) || v.eo[p] !== 0) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

function replay(scrambled: CubeState, R: string): { crossEnd: CubeState; final: CubeState } {
  const s = applyRotation(scrambled, R);
  const crossEnd = s.clone();
  for (const t of tokenize(CROSS)) crossEnd.applySequence(t);
  const final = crossEnd.clone();
  for (let i = 1; i < PHASES.length; i++) for (const t of tokenize(PHASES[i])) final.applySequence(t);
  return { crossEnd, final };
}

const scrambled = new CubeState();
for (const t of tokenize(SCRAMBLE)) scrambled.applySequence(t);

console.log('R              whiteCrossOnD   finalCatalog   finalInverted');
for (const R of ROTATION_GROUP) {
  const { crossEnd, final } = replay(scrambled, R);
  const w = crossOnD(crossEnd, [4, 5, 6, 7]);
  const y = crossOnD(crossEnd, [0, 1, 2, 3]);
  const fc = isRotationOfReference(final, new CubeState());
  const fi = isRotationOfReference(final, invertedSolved);
  if (w || y || fc || fi) {
    console.log(
      `${(R || '(id)').padEnd(14)} white=${w ? '✓' : '✗'} yellow=${y ? '✓' : '✗'}   finalCatalog=${fc ? '✓' : '✗'}   finalInverted=${fi ? '✓' : '✗'}`,
    );
  }
}
