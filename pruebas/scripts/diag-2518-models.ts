/**
 * diag-2518-models.ts — the definitive replay-model test for the 2518.
 * Variants:
 *   1. solved → S → phases
 *   2. solved → S → x2 → phases
 *   3. solved → x2 → S → phases
 *   4. solved → x2 → S → x2 → phases
 * for S = h* scramble and S = WCA scramble. Report cross-on-D (white 4-7) at
 * the cross-end and whether the final is a rotation of solved / exactly solved.
 */
import { CubeState } from '../../packages/math-core';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { ROTATION_GROUP, applyRotation, isRotationOfReference } from '../../packages/algorithm-db/src/recognition/rotationGroup';

const SCRAMBLE_H = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";
const SCRAMBLE_WCA = "D2 R F U2 L2 B2 L' D2 R2 D2 F2 U' F2 L D' L B' R' B2";
const PHASES = [
  "R D F D2 F' D'",
  "U F U' F'",
  "U' R U' R' U' R U' R' U R U' R'",
  "y U2 R U R' y U R U' R'",
  "y' U' R U2 R'",
  'U2',
];

function crossOnD(state: CubeState, edges: number[]): string | null {
  const set = new Set(edges);
  for (const r of ROTATION_GROUP) {
    const v = applyRotation(state, r);
    if ([4, 5, 6, 7].every((p) => set.has(v.ep[p]) && v.eo[p] === 0)) return r;
  }
  return null;
}

function run(label: string, setup: CubeState, scramble: string): void {
  const s = setup.clone();
  for (const t of tokenize(scramble)) s.applySequence(t);
  const crossEnd = s.clone();
  for (const t of tokenize(PHASES[0])) crossEnd.applySequence(t);
  for (let i = 1; i < PHASES.length; i++) for (const t of tokenize(PHASES[i])) s.applySequence(t);
  const final = s;
  const white = crossOnD(crossEnd, [4, 5, 6, 7]);
  const yellow = crossOnD(crossEnd, [0, 1, 2, 3]);
  console.log(
    `${label.padEnd(34)} whiteCross=${white !== null ? '✓' : '✗'} yellowCross=${yellow !== null ? '✓' : '✗'} finalExact=${final.isSolved()} finalRotationOfSolved=${isRotationOfReference(final, new CubeState())}`,
  );
}

const solved = new CubeState();
const x2solved = new CubeState();
x2solved.applySequence('x2');

for (const [name, S] of [
  ['h*', SCRAMBLE_H],
  ['WCA', SCRAMBLE_WCA],
] as const) {
  console.log(`\n=== scramble ${name} ===`);
  run('1) S → phases', solved, S);
  run('2) S → x2 → phases', solved, S);
  // 3) x2·solved → S → phases (model B)
  {
    const s = x2solved.clone();
    for (const t of tokenize(S)) s.applySequence(t);
    const crossEnd = s.clone();
    for (const t of tokenize(PHASES[0])) crossEnd.applySequence(t);
    for (let i = 1; i < PHASES.length; i++) for (const t of tokenize(PHASES[i])) s.applySequence(t);
    const white = crossOnD(crossEnd, [4, 5, 6, 7]);
    const yellow = crossOnD(crossEnd, [0, 1, 2, 3]);
    console.log(
      `3) x2·solved → S → phases        whiteCross=${white !== null ? '✓' : '✗'} yellowCross=${yellow !== null ? '✓' : '✗'} finalExact=${s.isSolved()} finalRotationOfSolved=${isRotationOfReference(s, new CubeState())}`,
    );
  }
  // 4) x2·solved → S → x2 → phases
  {
    const s = x2solved.clone();
    for (const t of tokenize(S)) s.applySequence(t);
    s.applySequence('x2');
    const crossEnd = s.clone();
    for (const t of tokenize(PHASES[0])) crossEnd.applySequence(t);
    for (let i = 1; i < PHASES.length; i++) for (const t of tokenize(PHASES[i])) s.applySequence(t);
    const white = crossOnD(crossEnd, [4, 5, 6, 7]);
    const yellow = crossOnD(crossEnd, [0, 1, 2, 3]);
    console.log(
      `4) x2·solved → S → x2 → phases    whiteCross=${white !== null ? '✓' : '✗'} yellowCross=${yellow !== null ? '✓' : '✗'} finalExact=${s.isSolved()} finalRotationOfSolved=${isRotationOfReference(s, new CubeState())}`,
    );
  }
}
