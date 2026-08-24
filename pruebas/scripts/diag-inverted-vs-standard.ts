/**
 * diag-inverted-vs-standard.ts — compare the standard and inverted (U↔D
 * recolor) synthetic solves and dump the 2510 CUBEROOT cross-end frames.
 */
import { CubeState } from '../../packages/math-core';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import {
  applyColorRemap,
  U_D_SWAP_REMAP,
} from '../../packages/algorithm-db/src/recognition/conventions';
import {
  applyRotation,
  findCrossOnDFrames,
  ROTATION_GROUP,
  stateSignature,
} from '../../packages/algorithm-db/src/recognition/rotationGroup';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { BASIC_F2L_CASES } from '../../packages/algorithm-db/src/seed/cfop-f2l';
import { OLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-oll';
import { PLL_CASES } from '../../packages/algorithm-db/src/seed/cfop-pll';

function invertSequence(seq: string[]): string {
  return seq
    .slice()
    .reverse()
    .map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`))
    .join(' ');
}

const SLOT_HOMES = [
  { cornerPos: 4, edgePos: 8 },
  { cornerPos: 5, edgePos: 9 },
  { cornerPos: 6, edgePos: 10 },
  { cornerPos: 7, edgePos: 11 },
];

function completedSlotCount(state: CubeState): number {
  return SLOT_HOMES.filter(
    (sl) =>
      state.cp[sl.cornerPos] === sl.cornerPos &&
      state.co[sl.cornerPos] === 0 &&
      state.ep[sl.edgePos] === sl.edgePos &&
      state.eo[sl.edgePos] === 0,
  ).length;
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
const phases = [
  { name: 'Cross', moves: crossAlg },
  { name: 'F2L 1', moves: pairAlgs[0] },
  { name: 'F2L 2', moves: pairAlgs[1] },
  { name: 'F2L 3', moves: pairAlgs[2] },
  { name: 'F2L 4', moves: pairAlgs[3] },
  { name: 'OLL', moves: ollAlg },
  { name: 'PLL', moves: pllAlg },
];

const std = analyzeReconstruction({ scramble, phases });
const inv = analyzeReconstruction({
  scramble,
  phases,
  initialState: applyColorRemap(new CubeState(), U_D_SWAP_REMAP),
});

console.log('STANDARD:', std.finalSolved, 'remap=', JSON.stringify(std.colorRemap), 'OLL=', std.oll?.caseMatch.caseNumber, 'sig=', 'see debug');
console.log('INVERTED:', inv.finalSolved, 'remap=', JSON.stringify(inv.colorRemap), 'OLL=', inv.oll?.caseMatch.caseNumber);
console.log('\nSTANDARD debug:'); for (const l of std.debug) console.log('  ' + l);
console.log('\nINVERTED debug:'); for (const l of inv.debug) console.log('  ' + l);

// Compare OLL pre-state signatures raw
const ollIdx = phases.findIndex((p) => /oll/i.test(p.name));
console.log('\nOLL pre-state equality check:');
// replay standard
let s = new CubeState();
for (const t of tokenize(scramble)) s.applySequence(t);
let cursor = 0;
const states: CubeState[] = [];
for (const ph of phases) {
  const pre = s.clone();
  if (ph.name === 'OLL') {
    const stdPre = applyColorRemap(pre, U_D_SWAP_REMAP); // the inverted raw OLL pre
    const back = applyColorRemap(stdPre, U_D_SWAP_REMAP);
    console.log('  recolor round-trip OLL pre equal:', stateSignature(pre) === stateSignature(back));
    const framesRaw = findCrossOnDFrames(pre, [4, 5, 6, 7]);
    const framesInv = findCrossOnDFrames(stdPre, [4, 5, 6, 7]);
    console.log('  standard OLL pre cross-frames [4-7]:', framesRaw.slice(0, 4).join(',') || '∅');
    console.log('  inverted raw OLL pre cross-frames [4-7]:', framesInv.slice(0, 4).join(',') || '∅');
  }
  for (const t of tokenize(ph.moves)) {
    s.applySequence(t);
    states.push(s.clone());
  }
  cursor += tokenize(ph.moves).length;
}

// 2510 CUBEROOT raw cross-end frames
const SCRAMBLE_2510 = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const CUBEROOT_2510 = [
  { name: 'Inspection', moves: 'z y' },
  { name: 'Cross (W)', moves: "D2 L U R' U'" },
  { name: 'F2L 1 (BL · Pj)', moves: "x' D' L' U L U' L' U L D" },
  { name: 'F2L 2 (FR · Jm)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: 'F2L 3 (BR · Jb)', moves: "U2 U L U' L'" },
  { name: 'F2L 4 (BR · Ci)', moves: "y' R' U2 R U R' U' R" },
  { name: 'OLL', moves: "R' U' R' F R F' U R" },
  { name: 'PLL', moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];
let c = new CubeState();
for (const t of tokenize(SCRAMBLE_2510)) c.applySequence(t);
let cc = 0;
for (const ph of CUBEROOT_2510) {
  const pre = c.clone();
  if (ph.name === 'Cross (W)') {
    const after = c.clone();
    for (const t of tokenize(ph.moves)) after.applySequence(t);
    const frames45 = findCrossOnDFrames(after, [4, 5, 6, 7]);
    const frames01 = findCrossOnDFrames(after, [0, 1, 2, 3]);
    console.log('\n2510 CUBEROOT raw cross-end: [4-7] frames =', frames45.slice(0, 6).join(',') || '∅', '| [0-3] frames =', frames01.slice(0, 6).join(',') || '∅');
    const rawFinal = new CubeState();
    for (const t of tokenize(SCRAMBLE_2510)) rawFinal.applySequence(t);
    for (const phh of CUBEROOT_2510) for (const t of tokenize(phh.moves)) rawFinal.applySequence(t);
    console.log('  raw final isRotationOfSolved:', ROTATION_GROUP.find((r) => stateSignature(applyRotation(rawFinal, r)) === stateSignature(new CubeState())) ?? 'null');
  }
  for (const t of tokenize(ph.moves)) c.applySequence(t);
  cc++;
}
console.log('\n2510 analyzer run:');
const r2510 = analyzeReconstruction({ scramble: SCRAMBLE_2510, phases: CUBEROOT_2510 });
console.log('  finalSolved=', r2510.finalSolved, 'remap=', JSON.stringify(r2510.colorRemap), 'crossVerified=', r2510.crossVerified);
for (const l of r2510.debug) console.log('  ' + l);
