/**
 * diag-2518-inspection.ts — for each R in the rotation group, replay
 * scramble → R → phases and check whether the final is a rotation of the
 * catalog solved or of the U↔D-inverted solved (Quest strips inspection).
 */
import { CubeState } from '../../packages/math-core';
import { ROTATION_GROUP, applyRotation, isRotationOfReference } from '../../packages/algorithm-db/src/recognition/rotationGroup';
import { applyColorRemap, U_D_SWAP_REMAP } from '../../packages/algorithm-db/src/recognition/conventions';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';

const SCRAMBLE = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";
const PHASES = [
  { name: 'Cross', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · Mi)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · Cc)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · Ja)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · Mi)', moves: "y' U' R U2 R'" },
  { name: 'OLL (skip)', moves: '' },
  { name: 'PLL', moves: 'U2' },
];

const invertedSolved = applyColorRemap(new CubeState(), U_D_SWAP_REMAP);

function finalOf(R: string): CubeState {
  const s = new CubeState();
  for (const t of tokenize(SCRAMBLE)) s.applySequence(t);
  if (R) s.applySequence(R);
  for (const ph of PHASES) for (const t of tokenize(ph.moves)) s.applySequence(t);
  return s;
}

// Baseline without inspection
const base = finalOf('');
console.log('no inspection: isSolved=', base.isSolved(), 'rotationOfSolved=', isRotationOfReference(base, new CubeState()), 'rotationOfInverted=', isRotationOfReference(base, invertedSolved));

const hits: { r: string; kind: string }[] = [];
for (const R of ROTATION_GROUP) {
  const f = finalOf(R);
  const cat = isRotationOfReference(f, new CubeState());
  const inv = isRotationOfReference(f, invertedSolved);
  if (cat || inv) hits.push({ r: R || '(identity)', kind: cat ? 'catalog' : 'inverted' });
}
console.log('\ninspection rotations that make the final coherent:');
for (const h of hits) console.log('  R =', JSON.stringify(h.r), '→', h.kind);
if (hits.length === 0) console.log('  NONE — the paste is missing more than the inspection (mid-solve rotations/moves)');
