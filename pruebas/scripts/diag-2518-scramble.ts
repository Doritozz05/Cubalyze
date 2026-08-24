/**
 * diag-2518-scramble.ts — which scramble makes the 2518 solve EXACTLY
 * coherent: the CubeRoot "h*" scramble or the official WCA scramble?
 */
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';

const SCRAMBLE_H = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";
const SCRAMBLE_WCA = "D2 R F U2 L2 B2 L' D2 R2 D2 F2 U' F2 L D' L B' R' B2";

const PHASES = [
  { name: 'Cross', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · Mi)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · Cc)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · Ja)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · Mi)', moves: "y' U' R U2 R'" },
  { name: 'OLL (skip)', moves: '' },
  { name: 'PLL', moves: 'U2' },
];

for (const [label, scramble] of [
  ['h* (Quest)', SCRAMBLE_H],
  ['WCA official', SCRAMBLE_WCA],
] as const) {
  const r = analyzeReconstruction({ scramble, phases: PHASES });
  console.log(`\n=== ${label} scramble ===`);
  console.log(`  finalSolved=${r.finalSolved} finalRotation=${r.finalRotation ?? 'null'} inspection=${JSON.stringify(r.inspection)}`);
  console.log(`  colorRemap=${JSON.stringify(r.colorRemap)} crossVerified=${r.crossVerified}`);
  for (const p of r.pairs) {
    console.log(`  ${r.phases[p.phaseIndex].name}: case=${p.caseMatch.caseNumber ?? 'UNKNOWN'} slot=${p.slot} verified=${p.verified} frame=${p.frame || '(id)'}`);
  }
  console.log(`  OLL: ${r.oll?.caseMatch.caseNumber ?? '—'} verified=${r.oll?.verified} | PLL: ${r.pll?.caseMatch.caseNumber ?? '—'} verified=${r.pll?.verified}`);
}
