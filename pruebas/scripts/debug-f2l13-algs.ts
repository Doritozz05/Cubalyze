import { CubeState } from '../../packages/math-core/src/index';
import { CaseStateGenerator } from '../../packages/algorithm-db/src/caseGenerator';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';

const c = BASIC_F2L_CASES.find((x) => x.caseDef.caseNumber === 'F2L 13')!;
const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

function slotState(s: CubeState): string {
  const parts = SLOTS.map((sl) => {
    const ok =
      s.cp[sl.cornerPos] === sl.cornerPos && s.co[sl.cornerPos] === 0 &&
      s.ep[sl.edgePos] === sl.edgePos && s.eo[sl.edgePos] === 0;
    return `${sl.name}${ok ? '✓' : '✗'}`;
  });
  return parts.join(' ');
}

const pre = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
console.log('setup:', c.caseDef.setupScramble);
console.log('pre  slots:', slotState(pre));

for (const [i, alg] of c.algorithms.entries()) {
  const moves = alg.moves.join(' ');
  const post = pre.clone();
  for (const t of tokenize(moves)) post.applySequence(t);
  console.log(`alg[${i}] (${alg.source}${alg.isDefault ? ', DEFAULT' : ''}): "${moves}"`);
  console.log(`   post slots: ${slotState(post)}  solved=${post.isSolved()}`);
}

// Variants of the default alg with different y prefixes / no prefix.
const base = c.algorithms.find((a) => a.isDefault)!.moves.filter((m) => !/^[xyz]/.test(m)).join(' ');
for (const prefix of ['', 'y', 'y2', "y'", "y' y'"]) {
  const post = pre.clone();
  for (const t of tokenize(prefix ? `${prefix} ${base}` : base)) post.applySequence(t);
  console.log(`variant "${prefix || '∅'} ${base}": ${slotState(post)}  solved=${post.isSolved()}`);
}
