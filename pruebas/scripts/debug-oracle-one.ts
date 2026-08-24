import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';

import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';

function defaultAlg(caseData: { algorithms: { isDefault?: boolean; moves: string[] }[] }): string {
  const alg = caseData.algorithms.find((a) => a.isDefault);
  if (!alg) throw new Error('no default');
  return alg.moves.join(' ');
}

const cases: { n: string; setup: string; alg: string }[] = ['F2L 13', 'F2L 18', 'F2L 20'].map((n) => {
  const c = BASIC_F2L_CASES.find((x) => x.caseDef.caseNumber === n)!;
  return { n, setup: c.caseDef.setupScramble, alg: defaultAlg(c) };
});

for (const c of cases) {
  console.log(`\n########## ${c.n} ##########`);
  const result = analyzeReconstruction({
    scramble: c.setup,
    phases: [{ name: 'Cross', moves: 'U2' }, { name: `F2L ${c.n}`, moves: c.alg }],
  });
  console.log('finalSolved:', result.finalSolved);
  console.log('convention:', result.convention ? `crossEdges=[${result.convention.crossEdges}]` : 'null');
  console.log('crossVerified:', result.crossVerified);
  console.log('pairs:', result.pairs.map((p) => ({
    case: p.caseMatch.caseNumber,
    ambiguous: p.caseMatch.ambiguous,
    slots: p.slotsCompleted,
    slot: p.slot,
    verified: p.verified,
    frame: p.frame,
  })));
  console.log('--- debug ---');
  for (const line of result.debug) console.log('  ' + line);
}
