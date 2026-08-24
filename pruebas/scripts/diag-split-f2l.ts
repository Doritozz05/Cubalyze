/**
 * diag-split-f2l.ts — why does the single-F2L-phase walk not yield exactly 4
 * pairs for the synthetic solve?
 */
import { CubeState } from '../../packages/math-core';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { OLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-oll';
import { PLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-pll';

function invertSequence(seq: string[]): string {
  return seq.slice().reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`)).join(' ');
}
const SLOT_HOMES = [
  { cornerPos: 4, edgePos: 8 },
  { cornerPos: 5, edgePos: 9 },
  { cornerPos: 6, edgePos: 10 },
  { cornerPos: 7, edgePos: 11 },
];
function completedSlotCount(state: CubeState): number {
  return SLOT_HOMES.filter((sl) => state.cp[sl.cornerPos] === sl.cornerPos && state.co[sl.cornerPos] === 0 && state.ep[sl.edgePos] === sl.edgePos && state.eo[sl.edgePos] === 0).length;
}
function solvingAlg(caseData: { caseDef: { setupScramble: string }; algorithms: { moves: string[] }[] }): string | null {
  for (const alg of caseData.algorithms) {
    const state = new CubeState();
    for (const t of tokenize(caseData.caseDef.setupScramble)) state.applySequence(t);
    for (const t of tokenize(alg.moves.join(' '))) state.applySequence(t);
    if (completedSlotCount(state) === 4) return alg.moves.join(' ');
  }
  return null;
}

const crossAlg = 'D2 F2';
const algOf = (n: string): string => solvingAlg(BASIC_F2L_CASES.find((c) => c.caseDef.caseNumber === n)!)!;
const pairAlgs = [
  algOf('F2L 39'),
  `y' ${algOf('F2L 11')}`,
  `y2 ${algOf('F2L 1')}`,
  `y ${algOf('F2L 18')}`,
];
const ollAlg = OLL_CASES.find((c) => c.caseDef.caseNumber === 'OLL 46')!.algorithms.find((a) => a.isDefault)!.moves.join(' ');
const pllAlg = PLL_CASES.find((c) => c.caseDef.caseNumber === 'Gd')!.algorithms.find((a) => a.isDefault)!.moves.join(' ');
const solveTokens = [crossAlg, ...pairAlgs, ollAlg, pllAlg];
const scramble = solveTokens.slice().reverse().map((a) => invertSequence(a.split(/\s+/))).join(' ');

const result = analyzeReconstruction({
  scramble,
  phases: [
    { name: 'Cross', moves: crossAlg },
    { name: 'F2L', moves: pairAlgs.join(' ') },
    { name: 'OLL', moves: ollAlg },
    { name: 'PLL', moves: pllAlg },
  ],
});
console.log('finalSolved=', result.finalSolved, 'crossVerified=', result.crossVerified);
console.log('pairs:', result.pairs.map((p) => `${p.caseMatch.caseNumber ?? 'UNKNOWN'}@${p.slot}`).join(', ') || '(none)');
console.log('OLL=', result.oll?.caseMatch.caseNumber, 'PLL=', result.pll?.caseMatch.caseNumber);
console.log('\nDEBUG:');
for (const l of result.debug) console.log('  ' + l);
