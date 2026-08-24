/**
 * verify-2518-analyzer.ts — run the full recognition pipeline on recon #2518
 * (Zeyu Li, 2026WCA漳州魔方公开赛) and print the outcome.
 * Quest version: no inspection listed, OLL skip, PLL = U2 (AUF only).
 */
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { getRecognitionIndex } from '../../packages/algorithm-db/src/recognition/caseIndex';

const SCRAMBLE = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";

const PHASES = [
  { name: 'Cross', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · Mi)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · Cc)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · Ja)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · Mi)', moves: "y' U' R U2 R'" },
  { name: 'OLL (skip)', moves: '' },
  { name: 'PLL', moves: 'U2' },
];

const idx = getRecognitionIndex();
console.log('INDEX:');
console.log(`  f2l cases=${idx.f2lCases} indexed=${idx.f2l.size} unindexed=${idx.f2lUnindexed.length} collisions=${idx.f2lCollisions}`);
console.log(`  oll cases=${idx.ollCases} indexed=${idx.oll.size} unindexed=${idx.ollUnindexed.length} collisions=${idx.ollCollisions}`);
console.log(`  pll cases=${idx.pllCases} indexed=${idx.pll.size} unindexed=${idx.pllUnindexed.length} collisions=${idx.pllCollisions}`);
console.log();

const result = analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES });

console.log('ANALYSIS:');
console.log(`  finalSolved=${result.finalSolved} finalRotation=${result.finalRotation ?? 'null'} inspection=${JSON.stringify(result.inspection)}`);
console.log(`  convention=${result.convention ? `crossEdges=[${result.convention.crossEdges}]` : 'null'} colorRemap=${JSON.stringify(result.colorRemap)}`);
console.log(`  crossVerified=${result.crossVerified}`);
console.log('  F2L pairs:');
for (const p of result.pairs) {
  console.log(`    "${result.phases[p.phaseIndex].name}": case=${p.caseMatch.caseNumber ?? 'UNKNOWN'}` +
    ` ambiguous=${p.caseMatch.ambiguous} slot=${p.slot} slotsCompleted=[${p.slotsCompleted.join(',')}]` +
    ` auf=[${p.aufMove.join(' ')}] verified=${p.verified} grip=${p.grip || '(id)'} frame=${p.frame || '(id)'}`);
}
if (result.oll) {
  console.log(`  OLL: case=${result.oll.caseMatch.caseNumber ?? 'UNKNOWN'} auf=${result.oll.auf} verified=${result.oll.verified}`);
} else {
  console.log('  OLL: not analyzed (skip expected)');
}
if (result.pll) {
  console.log(`  PLL: case=${result.pll.caseMatch.caseNumber ?? 'UNKNOWN'} auf=${result.pll.auf} verified=${result.pll.verified}`);
} else {
  console.log('  PLL: not analyzed');
}
console.log('\nDEBUG:');
for (const line of result.debug) console.log('  ' + line);
