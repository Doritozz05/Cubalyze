import { CubeState } from '../../packages/math-core/src/index';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { OLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-oll';
import { PLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-pll';

const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

function completed(state: CubeState): string {
  return SLOTS.filter(
    (sl) => state.cp[sl.cornerPos] === sl.cornerPos && state.co[sl.cornerPos] === 0 &&
      state.ep[sl.edgePos] === sl.edgePos && state.eo[sl.edgePos] === 0,
  ).map((s) => s.name).join(',');
}

function solvingAlg(cd: { caseDef: { setupScramble: string }; algorithms: { moves: string[] }[] }): string | null {
  for (const alg of cd.algorithms) {
    const st = new CubeState();
    for (const t of tokenize(cd.caseDef.setupScramble)) st.applySequence(t);
    for (const t of tokenize(alg.moves.join(' '))) st.applySequence(t);
    if (SLOTS.every((sl) => st.cp[sl.cornerPos] === sl.cornerPos && st.co[sl.cornerPos] === 0 &&
      st.ep[sl.edgePos] === sl.edgePos && st.eo[sl.edgePos] === 0)) return alg.moves.join(' ');
  }
  return null;
}

function defaultAlg(cd: { algorithms: { isDefault?: boolean; moves: string[] }[] }): string {
  return cd.algorithms.find((a) => a.isDefault)!.moves.join(' ');
}
function invertSequence(seq: string[]): string {
  return seq.slice().reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');
}

const crossAlg = 'D2 F2';
const algOf = (n: string) => solvingAlg(BASIC_F2L_CASES.find((c) => c.caseDef.caseNumber === n)!)!;
const pairAlgs = [algOf('F2L 39'), `y' ${algOf('F2L 11')}`, `y2 ${algOf('F2L 1')}`, `y ${algOf('F2L 18')}`];
const ollAlg = defaultAlg(OLL_CASES.find((c) => c.caseDef.caseNumber === 'OLL 46')!);
const pllAlg = defaultAlg(PLL_CASES.find((c) => c.caseDef.caseNumber === 'Gd')!);

const solveTokens = [crossAlg, ...pairAlgs, ollAlg, pllAlg];
const scramble = solveTokens.slice().reverse().map((a) => invertSequence(a.split(/\s+/))).join(' ');

console.log('pair algs:', pairAlgs);
console.log('scramble:', scramble);

// Verify each phase completes exactly one slot by direct replay.
const st = new CubeState();
for (const t of tokenize(scramble)) st.applySequence(t);
console.log('after scramble: completed =', completed(st));
for (const [i, alg] of solveTokens.entries()) {
  const before = completed(st);
  for (const t of tokenize(alg)) st.applySequence(t);
  console.log(`phase[${i}] "${alg}": completed ${before} → ${completed(st)}`);
}
console.log('final solved:', st.isSolved());

const result = analyzeReconstruction({ scramble, phases: [
  { name: 'Cross', moves: crossAlg },
  { name: 'F2L 1', moves: pairAlgs[0] },
  { name: 'F2L 2', moves: pairAlgs[1] },
  { name: 'F2L 3', moves: pairAlgs[2] },
  { name: 'F2L 4', moves: pairAlgs[3] },
  { name: 'OLL', moves: ollAlg },
  { name: 'PLL', moves: pllAlg },
] });
console.log('\nANALYZER:');
console.log('finalSolved:', result.finalSolved, 'crossVerified:', result.crossVerified);
result.pairs.forEach((p, i) => console.log(`pair${i + 1}: case=${p.caseMatch.caseNumber} slot=${p.slot} slots=[${p.slotsCompleted}] verified=${p.verified}`));
console.log('OLL:', result.oll?.caseMatch.caseNumber, result.oll?.verified);
console.log('PLL:', result.pll?.caseMatch.caseNumber, result.pll?.verified);
for (const line of result.debug) console.log('  ' + line);
