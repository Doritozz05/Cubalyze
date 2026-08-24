import { CubeState } from '../../packages/math-core/src/index';
import { CaseStateGenerator } from '../../packages/algorithm-db/src/caseGenerator';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';

function defaultAlg(c: { algorithms: { isDefault?: boolean; moves: string[] }[] }): string[] {
  return c.algorithms.find((a) => a.isDefault)!.moves;
}

for (const n of ['F2L 13', 'F2L 18', 'F2L 20', 'F2L 1']) {
  const c = BASIC_F2L_CASES.find((x) => x.caseDef.caseNumber === n)!;
  const setup = c.caseDef.setupScramble;
  const alg = defaultAlg(c).join(' ');

  // 1. Raw scramble application (what the analyzer currently does).
  const s1 = new CubeState();
  s1.applySequence(setup);
  s1.applySequence(alg);
  console.log(`${n}: raw-apply final solved = ${s1.isSolved()}`);

  // 2. CaseStateGenerator (what the index uses).
  const s2 = CaseStateGenerator.generateFromScramble(setup);
  s2.applySequence(alg);
  console.log(`${n}: generator-apply final solved = ${s2.isSolved()}`);

  // 3. Tokenized scramble application (proposed fix).
  const s3 = new CubeState();
  for (const t of tokenize(setup)) s3.applySequence(t);
  for (const t of tokenize(alg)) s3.applySequence(t);
  console.log(`${n}: tokenized-apply final solved = ${s3.isSolved()}`);
  console.log(`    setup="${setup}" alg="${alg}"`);
  console.log(`    setup tokens=[${tokenize(setup).join(' ')}]`);
}
