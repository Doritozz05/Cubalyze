import { CubeState } from '../../packages/math-core/src/index';
import { CaseStateGenerator } from '../../packages/algorithm-db/src/caseGenerator';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';

const SLOTS = [
  { cornerPos: 4, edgePos: 8 },
  { cornerPos: 5, edgePos: 9 },
  { cornerPos: 6, edgePos: 10 },
  { cornerPos: 7, edgePos: 11 },
];

function completedSlots(s: CubeState): number {
  return SLOTS.filter(
    (sl) => s.cp[sl.cornerPos] === sl.cornerPos && s.co[sl.cornerPos] === 0 &&
      s.ep[sl.edgePos] === sl.edgePos && s.eo[sl.edgePos] === 0,
  ).length;
}

for (const n of ['F2L 13', 'F2L 18', 'F2L 20']) {
  const c = BASIC_F2L_CASES.find((x) => x.caseDef.caseNumber === n)!;
  const pre = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  console.log(`=== ${n} (pre completed slots: ${completedSlots(pre)}) setup="${c.caseDef.setupScramble}"`);
  for (const [i, alg] of c.algorithms.entries()) {
    const post = pre.clone();
    for (const t of tokenize(alg.moves.join(' '))) post.applySequence(t);
    const done = completedSlots(post);
    if (done === 4) {
      console.log(`  alg[${i}]${alg.isDefault ? ' DEFAULT' : ''} "${alg.moves.join(' ')}" → 4/4 slots ✓ SOLVES`);
    } else {
      console.log(`  alg[${i}]${alg.isDefault ? ' DEFAULT' : ''} "${alg.moves.join(' ')}" → ${done}/4`);
    }
    if (i >= 9) break;
  }
}
