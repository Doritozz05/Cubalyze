/**
 * Diagnóstico profundo de OLL 5, 6, 53, 54 - por qué producen el mismo patrón?
 * También analiza otros casos duplicados para distinguir bugs reales de casos legítimos.
 */
import { CubeState, FaceletStringConverter } from './packages/math-core/src/index';
import {
  CaseStateGenerator,
  invertMoveArray,
} from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';

// Find specific OLL cases
function findOll(n: number) {
  return OLL_CASES.find(c => c.caseDef.caseNumber === `OLL ${n}`)!;
}

function analyze(name: string, caseNum: number) {
  const { caseDef, algorithms } = findOll(caseNum);
  const alg = algorithms.find(a => a.isDefault) ?? algorithms[0];

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${name} — OLL ${caseNum} (${caseDef.category})`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Algorithm string: ${alg.moves.join(' ')}`);
  console.log(`  Move count: ${alg.moves.length} moves`);

  // Generate visualization
  const viz = CaseStateGenerator.generateCaseVisualization(alg.moves, 'yellow-gray');
  console.log(`  Facelet string (54): ${viz.faceletString}`);
  console.log(`  U-face (0-8):       ${viz.faceletString.substring(0, 9)}`);
  console.log(`  Yellow pattern:     ${viz.diagramColors.slice(0, 9).map(c => c === 'Y' ? 'Y' : '.').join('')}`);

  // Raw state
  const rawState = CaseStateGenerator.generateCaseState(alg.moves);
  console.log(`  co (raw):           [${Array.from(rawState.co).join(',')}]`);
  console.log(`  eo (raw):           [${Array.from(rawState.eo).join(',')}]`);
  console.log(`  cp (raw):           [${Array.from(rawState.cp).join(',')}]`);
  console.log(`  ep (raw):           [${Array.from(rawState.ep).join(',')}]`);

  // Clean state
  const cleanState = CaseStateGenerator.createCleanState(rawState);
  const cleanFacelet = FaceletStringConverter.toFaceletString(cleanState);
  console.log(`  Clean U-face:       ${cleanFacelet.substring(0, 9)}`);

  // Net rotation
  const netPerm = CaseStateGenerator.getNetRotationPermutation(alg.moves);
  console.log(`  Net rotation perm:  ${netPerm ? JSON.stringify(netPerm) : 'null (identity)'}`);

  // Verify
  const isSolved = CaseStateGenerator.verifyAlgorithmSolvesCase(rawState, alg.moves);
  console.log(`  Algorithm solves:   ${isSolved ? '✅' : '❌'}`);

  // Full facelet string with face labels
  console.log(`\n  Full facelet breakdown:`);
  console.log(`    U(0-8):   ${viz.faceletString.substring(0, 9)}`);
  console.log(`    R(9-17):  ${viz.faceletString.substring(9, 18)}`);
  console.log(`    F(18-26): ${viz.faceletString.substring(18, 27)}`);
  console.log(`    D(27-35): ${viz.faceletString.substring(27, 36)}`);
  console.log(`    L(36-44): ${viz.faceletString.substring(36, 45)}`);
  console.log(`    B(45-53): ${viz.faceletString.substring(45, 54)}`);

  return viz;
}

// ═══ Analyze the problematic group ═══════════════════════════════════════════

console.log('══════════════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO PROFUNDO: OLL 5, 6, 53, 54');
console.log('  (Deberían ser 4 casos visualmente DISTINTOS)');
console.log('══════════════════════════════════════════════════════════════════');

analyze('Square shape', 5);
analyze('Square shape (mirror)', 6);
analyze('L shape', 53);
analyze('L shape (mirror)', 54);

// ═══ Analyze other "duplicate" groups to distinguish real bugs from legitimate ═══

console.log('\n\n══════════════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO: OTROS GRUPOS "DUPLICADOS"');
console.log('══════════════════════════════════════════════════════════════════');

// OLL 21 vs 22 — both OCLL H case. Should they be the same?
console.log('\n--- OLL 21 vs 22 (OCLL - H case, expected to be SAME pattern) ---');
analyze('OCLL H (alg 1)', 21);
analyze('OCLL H (alg 2)', 22);

// OLL 33 vs 45 — both T shapes. Should they be the same?
console.log('\n--- OLL 33 vs 45 (T shapes, expected to be SAME pattern) ---');
analyze('T shape (alg 1)', 33);
analyze('T shape (alg 2)', 45);

// OLL 9 vs 10 — Fish shapes. Should they be different?
console.log('\n--- OLL 9 vs 10 (Fish shapes, should be DIFFERENT) ---');
analyze('Fish shape', 9);
analyze('Fish shape (mirror)', 10);

// OLL 24 vs 37 — OCLL and Fish. Should they be different?
console.log('\n--- OLL 24 vs 37 (OCLL vs Fish, should be DIFFERENT) ---');
analyze('OCLL', 24);
analyze('Fish', 37);

// OLL 27 vs 56 — Sune and Line. Should they be different?
console.log('\n--- OLL 27 vs 56 (Sune vs Line, should be DIFFERENT) ---');
analyze('Sune', 27);
analyze('Line', 56);

// OLL 29 vs 42 — Both Awkward. Should they be different?
console.log('\n--- OLL 29 vs 42 (Awkward shapes, should be DIFFERENT) ---');
analyze('Awkward', 29);
analyze('Awkward (mirror)', 42);

// OLL 30 vs 41 — Both Awkward. Should they be different?
console.log('\n--- OLL 30 vs 41 (Awkward shapes, should be DIFFERENT) ---');
analyze('Awkward', 30);
analyze('Awkward (mirror)', 41);

// OLL 2 vs 52 — Dot case vs Line. Should they be different?
console.log('\n--- OLL 2 vs 52 (Dot vs Line, should be DIFFERENT) ---');
analyze('Dot', 2);
analyze('Line', 52);

// OLL 14 vs 32 — Knight vs P shape. Should they be different?
console.log('\n--- OLL 14 vs 32 (Knight vs P, should be DIFFERENT) ---');
analyze('Knight', 14);
analyze('P shape', 32);
