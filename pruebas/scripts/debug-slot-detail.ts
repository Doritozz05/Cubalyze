import { CubeState } from '../../packages/math-core/src/index';
import { CaseStateGenerator } from '../../packages/algorithm-db/src/caseGenerator';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { applyRotation, findCrossOnDFrames } from '../../packages/algorithm-db/src/recognition/rotationGroup';

function defaultAlg(c: { algorithms: { isDefault?: boolean; moves: string[] }[] }): string[] {
  return c.algorithms.find((a) => a.isDefault)!.moves;
}

const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

const n = 'F2L 13';
const c = BASIC_F2L_CASES.find((x) => x.caseDef.caseNumber === n)!;
const pre = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
const post = pre.clone();
for (const t of tokenize(defaultAlg(c).join(' '))) post.applySequence(t);

console.log(`=== ${n} ===`);
console.log('pre cross frames (4-7 on D):', findCrossOnDFrames(pre, [4, 5, 6, 7]).join(' | ') || 'NONE');
console.log('post cross frames (4-7 on D):', findCrossOnDFrames(post, [4, 5, 6, 7]).join(' | ') || 'NONE');
console.log('pre  cp:', Array.from(pre.cp).join(','));
console.log('post cp:', Array.from(post.cp).join(','));
console.log('pre  ep:', Array.from(pre.ep).join(','));
console.log('post ep:', Array.from(post.ep).join(','));

for (const frame of ['', 'y', 'y y', "y'"]) {
  const home = applyRotation(new CubeState(), frame);
  const rows: string[] = [];
  for (const slot of SLOTS) {
    const pv = applyRotation(pre, frame);
    const qv = applyRotation(post, frame);
    const before =
      pv.cp[slot.cornerPos] === home.cp[slot.cornerPos] && pv.co[slot.cornerPos] === 0 &&
      pv.ep[slot.edgePos] === home.ep[slot.edgePos] && pv.eo[slot.edgePos] === 0;
    const after =
      qv.cp[slot.cornerPos] === home.cp[slot.cornerPos] && qv.co[slot.cornerPos] === 0 &&
      qv.ep[slot.edgePos] === home.ep[slot.edgePos] && qv.eo[slot.edgePos] === 0;
    rows.push(`${slot.name}:${before ? 'B' : '·'}→${after ? 'A' : '·'}`);
  }
  console.log(`frame "${frame || '∅'}": ${rows.join('  ')}`);
}

// What does the pair signature say at pre?
import { f2lPairSignature } from '../../packages/algorithm-db/src/recognition/signatures';
for (const slot of SLOTS) {
  const sig = f2lPairSignature(pre, [4, 5, 6, 7], slot.cornerPos, slot.edgePos);
  console.log(`pair sig slot ${slot.name}: ${sig ? sig.slice(0, 40) : 'null'}`);
}
