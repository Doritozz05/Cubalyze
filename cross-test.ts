/**
 * Cross-test: for each duplicate group, verify that algorithms
 * solve their OWN case but NOT the other cases in the group.
 */
import { CaseStateGenerator } from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';

function getAlg(n: number) {
  const c = OLL_CASES.find(x => x.caseDef.caseNumber === `OLL ${n}`)!;
  return c.algorithms.find(a => a.isDefault)!;
}

// Test groups where algorithms might be producing identical states
const groups = [
  { name: 'OLL 5=15?', a: 5, b: 15 },
  { name: 'OLL 6=16?', a: 6, b: 16 },
  { name: 'OLL 7=11=27?', pairs: [[7,11],[7,27],[11,27]] },
  { name: 'OLL 1 vs 2', a: 1, b: 2 },
  { name: 'OLL 53 vs 54', a: 53, b: 54 },
  { name: 'OLL 20 vs 28', a: 20, b: 28 },
  { name: 'OLL 28 vs 57', a: 28, b: 57 },
];

console.log('═══ CROSS-TEST: Algoritmos que resuelven casos cruzados ═══\n');

for (const group of groups) {
  if ('pairs' in group && group.pairs) {
    for (const [a, b] of group.pairs!) {
      const algA = getAlg(a);
      const algB = getAlg(b);
      const stateB = CaseStateGenerator.generateCaseState(algB.moves);
      const stateA = CaseStateGenerator.generateCaseState(algA.moves);
      
      const aSolvesB = CaseStateGenerator.verifyAlgorithmSolvesCase(stateB, algA.moves);
      const bSolvesA = CaseStateGenerator.verifyAlgorithmSolvesCase(stateA, algB.moves);
      
      console.log(`${group.name}: Alg${a} solves case${b}? ${aSolvesB} | Alg${b} solves case${a}? ${bSolvesA}`);
      if (aSolvesB || bSolvesA) {
        console.log(`  ⚠️  PROBLEMA: Los algoritmos se cruzan → mismo caso!`);
      }
    }
  } else {
    const algA = getAlg(group.a!);
    const algB = getAlg(group.b!);
    const stateA = CaseStateGenerator.generateCaseState(algA.moves);
    const stateB = CaseStateGenerator.generateCaseState(algB.moves);
    
    const aSolvesA = CaseStateGenerator.verifyAlgorithmSolvesCase(stateA, algA.moves);
    const bSolvesB = CaseStateGenerator.verifyAlgorithmSolvesCase(stateB, algB.moves);
    const aSolvesB = CaseStateGenerator.verifyAlgorithmSolvesCase(stateB, algA.moves);
    const bSolvesA = CaseStateGenerator.verifyAlgorithmSolvesCase(stateA, algB.moves);
    
    console.log(`${group.name}:`);
    console.log(`  Alg${group.a} solves case${group.a}: ${aSolvesA}`);
    console.log(`  Alg${group.b} solves case${group.b}: ${bSolvesB}`);
    console.log(`  Alg${group.a} solves case${group.b}: ${aSolvesB} ${aSolvesB ? '⚠️ MISMO CASO!' : '✅'}`);
    console.log(`  Alg${group.b} solves case${group.a}: ${bSolvesA} ${bSolvesA ? '⚠️ MISMO CASO!' : '✅'}`);
  }
}

// Also test: OLL 5 alg vs OLL 8 case
console.log('\n--- Extra: OLL 5 vs 8, 5 vs 15 ---');
const alg5 = getAlg(5);
const alg8 = getAlg(8);
const alg15 = getAlg(15);
const state5 = CaseStateGenerator.generateCaseState(alg5.moves);
const state8 = CaseStateGenerator.generateCaseState(alg8.moves);
const state15 = CaseStateGenerator.generateCaseState(alg15.moves);

console.log(`Alg5 solves case8: ${CaseStateGenerator.verifyAlgorithmSolvesCase(state8, alg5.moves)}`);
console.log(`Alg8 solves case5: ${CaseStateGenerator.verifyAlgorithmSolvesCase(state5, alg8.moves)}`);
console.log(`Alg5 solves case15: ${CaseStateGenerator.verifyAlgorithmSolvesCase(state15, alg5.moves)}`);
console.log(`Alg15 solves case5: ${CaseStateGenerator.verifyAlgorithmSolvesCase(state5, alg15.moves)}`);

// Check: do OLL 5 and 15 produce truly identical states?
console.log('\n--- State comparison OLL 5 vs 15 ---');
import { FaceletStringConverter } from './packages/math-core/src/index';
const fc5 = FaceletStringConverter.toFaceletString(state5);
const fc15 = FaceletStringConverter.toFaceletString(state15);
console.log(`OLL 5 full facelet:  ${fc5}`);
console.log(`OLL 15 full facelet: ${fc15}`);
console.log(`Identical facelets: ${fc5 === fc15}`);
console.log(`cp5=[${Array.from(state5.cp)}]`);
console.log(`cp15=[${Array.from(state15.cp)}]`);
console.log(`co5=[${Array.from(state5.co)}]`);
console.log(`co15=[${Array.from(state15.co)}]`);
console.log(`ep5=[${Array.from(state5.ep)}]`);
console.log(`ep15=[${Array.from(state15.ep)}]`);
console.log(`eo5=[${Array.from(state5.eo)}]`);
console.log(`eo15=[${Array.from(state15.eo)}]`);
