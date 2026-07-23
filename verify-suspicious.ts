/**
 * Verify a few suspicious OLL cases directly
 */
import { CubeState, FaceletStringConverter } from './packages/math-core/src/index';
import { CaseStateGenerator } from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';

function checkCase(n: number) {
  const c = OLL_CASES.find(x => x.caseDef.caseNumber === `OLL ${n}`)!;
  const alg = c.algorithms.find(a => a.isDefault)!;
  const cat = c.caseDef.category;
  
  // Raw state from inverse
  const raw = CaseStateGenerator.generateCaseState(alg.moves);
  const rawFC = FaceletStringConverter.toFaceletString(raw);
  
  // Clean state
  const clean = CaseStateGenerator.createCleanState(raw);
  const cleanFC = FaceletStringConverter.toFaceletString(clean);
  
  // Visualization
  const viz = CaseStateGenerator.generateCaseVisualization(alg.moves, 'yellow-gray');
  
  console.log(`\nOLL ${n} (${cat})`);
  console.log(`  alg: ${c.algorithms[0].moves.join(' ').substring(0, 80)}`);
  console.log(`  raw U-face:  "${rawFC.substring(0, 9)}"`);
  console.log(`  raw yellow:  ${rawFC.substring(0,9).split('').map(ch=>ch==='U'?'Y':'.').join('')}`);
  console.log(`  clean U-face:"${cleanFC.substring(0, 9)}"`);
  console.log(`  clean yellow:${cleanFC.substring(0,9).split('').map(ch=>ch==='U'?'Y':'.').join('')}`);
  console.log(`  viz yellow:  ${viz.diagramColors.slice(0,9).map(c=>c==='Y'?'Y':'.').join('')}`);
  console.log(`  co(U): [${Array.from(raw.co).slice(0,4)}]`);
  console.log(`  eo(U): [${Array.from(raw.eo).slice(0,4)}]`);
  console.log(`  cp(U): [${Array.from(raw.cp).slice(0,4)}]`);
  console.log(`  solves: ${CaseStateGenerator.verifyAlgorithmSolvesCase(raw, alg.moves)}`);
}

console.log('═══ SUSPICIOUS OLL CASES ═══');

// OLL 20 - Dot Case showing all yellow?!
console.log('\n--- GROUP: OLL 20, 28, 57 (all yellow pattern) ---');
checkCase(20);
checkCase(28);
checkCase(57);

// OLL 5, 8, 15 - different categories, same yellow
console.log('\n--- GROUP: OLL 5 (Square), 8 (Lightning), 15 (Knight) ---');
checkCase(5);
checkCase(8);
checkCase(15);

// OLL 6, 16 - Square vs Knight
console.log('\n--- GROUP: OLL 6 (Square), 16 (Knight) ---');
checkCase(6);
checkCase(16);

// OLL 7, 11, 27 - Lightning vs Sune
console.log('\n--- GROUP: OLL 7 (Lightning), 11 (Lightning), 27 (Sune) ---');
checkCase(7);
checkCase(11);
checkCase(27);

// Verify OLL 1 and 2 are different
console.log('\n--- OLL 1 vs 2 (Dot Cases - should be DIFFERENT) ---');
checkCase(1);
checkCase(2);

// Cross-test: does OLL 1's algorithm solve OLL 2's case?
console.log('\n--- Cross-test OLL 1 ↔ OLL 2 ---');
const oll1alg = OLL_CASES.find(x => x.caseDef.caseNumber === 'OLL 1')!.algorithms[0];
const oll2alg = OLL_CASES.find(x => x.caseDef.caseNumber === 'OLL 2')!.algorithms[0];
const raw1 = CaseStateGenerator.generateCaseState(oll1alg.moves);
const raw2 = CaseStateGenerator.generateCaseState(oll2alg.moves);
console.log(`Alg1 solves case1: ${CaseStateGenerator.verifyAlgorithmSolvesCase(raw1, oll1alg.moves)}`);
console.log(`Alg2 solves case2: ${CaseStateGenerator.verifyAlgorithmSolvesCase(raw2, oll2alg.moves)}`);
console.log(`Alg1 solves case2: ${CaseStateGenerator.verifyAlgorithmSolvesCase(raw2, oll1alg.moves)}`);
console.log(`Alg2 solves case1: ${CaseStateGenerator.verifyAlgorithmSolvesCase(raw1, oll2alg.moves)}`);
