/**
 * verify-2510-analyzer.ts — run the full recognition pipeline on recon #2510
 * (CubeRoot version with inspection) and print the outcome.
 */
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { getRecognitionIndex } from '../../packages/algorithm-db/src/recognition/caseIndex';

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

const CUBEROOT_PHASES = [
  { name: 'Inspection', moves: 'z y' },
  { name: 'Cross (W)', moves: "D2 L U R' U'" },
  { name: 'F2L 1 (BL · Pj)', moves: "x' D' L' U L U' L' U L D" },
  { name: 'F2L 2 (FR · Jm)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: 'F2L 3 (BR · Jb)', moves: "U2 U L U' L'" },
  { name: 'F2L 4 (BR · Ci)', moves: "y' R' U2 R U R' U' R" },
  { name: 'OLL', moves: "R' U' R' F R F' U R" },
  { name: 'PLL', moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

const idx = getRecognitionIndex();
console.log('INDEX:');
console.log(`  f2l cases=${idx.f2lCases} indexed=${idx.f2l.size} unindexed=${idx.f2lUnindexed.length} collisions=${idx.f2lCollisions}`);
console.log(`  oll cases=${idx.ollCases} indexed=${idx.oll.size} unindexed=${idx.ollUnindexed.length} collisions=${idx.ollCollisions}`);
console.log(`  pll cases=${idx.pllCases} indexed=${idx.pll.size} unindexed=${idx.pllUnindexed.length} collisions=${idx.pllCollisions}`);
console.log('  f2l unindexed:', idx.f2lUnindexed.slice(0, 20).join(', '));
console.log('  oll unindexed:', idx.ollUnindexed.slice(0, 20).join(', '));
console.log('  pll unindexed:', idx.pllUnindexed.slice(0, 20).join(', '));
console.log();

const result = analyzeReconstruction({ scramble: SCRAMBLE, phases: CUBEROOT_PHASES });

console.log('ANALYSIS:');
console.log(`  finalSolved=${result.finalSolved} finalRotation=${result.finalRotation ?? 'null'}`);
console.log(`  convention=${result.convention ? `crossEdges=[${result.convention.crossEdges}]` : 'null'} colorRemap=${JSON.stringify(result.colorRemap)}`);
console.log(`  crossVerified=${result.crossVerified}`);
console.log('  F2L pairs:');
for (const p of result.pairs) {
  console.log(`    "${result.phases[p.phaseIndex].name}": case=${p.caseMatch.caseNumber ?? 'UNKNOWN'}` +
    ` ambiguous=${p.caseMatch.ambiguous} slot=${p.slot} slotsCompleted=[${p.slotsCompleted.join(',')}]` +
    ` auf=[${p.aufMove.join(' ')}] verified=${p.verified} grip=${p.grip || '(id)'}`);
}
if (result.oll) {
  console.log(`  OLL: case=${result.oll.caseMatch.caseNumber ?? 'UNKNOWN'} auf=${result.oll.auf} verified=${result.oll.verified}`);
} else {
  console.log('  OLL: not analyzed');
}
if (result.pll) {
  console.log(`  PLL: case=${result.pll.caseMatch.caseNumber ?? 'UNKNOWN'} auf=${result.pll.auf} verified=${result.pll.verified}`);
} else {
  console.log('  PLL: not analyzed');
}
console.log('\nDEBUG:');
for (const line of result.debug) console.log('  ' + line);
