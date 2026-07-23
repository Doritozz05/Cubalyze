/**
 * Diagnóstico completo de OLL (57) y PLL (21):
 * - Genera facelet strings para cada caso
 * - Detecta duplicados visuales
 * - Verifica que los algoritmos resuelven sus propios casos
 * - Comprueba unicidad de patrones U-face (OLL) y colores completos (PLL)
 */
import { CubeState, FaceletStringConverter, expandWideMoves } from './packages/math-core/src/index';
import { CaseStateGenerator } from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';
import { PLL_CASES } from './packages/algorithm-db/src/seed/cfop-pll';

interface CaseDiagnosis {
  caseNumber: string;
  caseId: string;
  algorithmMoves: string[];
  faceletString: string;
  uFacePattern: string;
  uFaceYellowPositions: string;
  diagramColors: string[];
  isSolvedByAlgorithm: boolean;
  expandedMoves?: string[];
}

function diagnoseCase(
  caseNumber: string,
  caseId: string,
  algorithmMoves: string[],
  style: 'yellow-gray' | 'full-color',
): CaseDiagnosis {
  let faceletString = '';
  let diagramColors: string[] = [];
  let isSolvedByAlgorithm = false;

  try {
    const viz = CaseStateGenerator.generateCaseVisualization(algorithmMoves, style);
    faceletString = viz.faceletString;
    diagramColors = viz.diagramColors;

    // Verify algorithm solves its own case
    const caseState = CaseStateGenerator.generateCaseState(algorithmMoves);
    isSolvedByAlgorithm = CaseStateGenerator.verifyAlgorithmSolvesCase(caseState, algorithmMoves);
  } catch (e: any) {
    faceletString = `ERROR: ${e.message}`;
  }

  // U-face pattern: first 9 chars of facelet string
  const uFacePattern = faceletString.substring(0, 9);

  // For OLL: which positions are yellow (correctly oriented)
  const uFaceYellow = style === 'yellow-gray'
    ? diagramColors.slice(0, 9).map(c => c === 'Y' ? 'Y' : '.').join('')
    : '';

  return {
    caseNumber,
    caseId,
    algorithmMoves,
    faceletString,
    uFacePattern,
    uFaceYellowPositions: uFaceYellow,
    diagramColors,
    isSolvedByAlgorithm,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO COMPLETO DE CASOS OLL + PLL');
console.log('═══════════════════════════════════════════════════════════\n');

// ═══ OLL ANALYSIS ═══════════════════════════════════════════════════════════

console.log('─── OLL (57 casos) ─────────────────────────────────────────\n');

const ollDiagnoses: CaseDiagnosis[] = [];

for (const { caseDef, algorithms } of OLL_CASES) {
  const defaultAlg = algorithms.find(a => a.isDefault) ?? algorithms[0];
  const d = diagnoseCase(caseDef.caseNumber, caseDef.id, defaultAlg.moves, 'yellow-gray');
  d.expandedMoves = defaultAlg.moves;
  ollDiagnoses.push(d);
}

// Check all algorithms solve their cases
const ollUnsolved = ollDiagnoses.filter(d => !d.isSolvedByAlgorithm);
if (ollUnsolved.length > 0) {
  console.log('❌ CASOS DONDE EL ALGORITMO NO RESUELVE SU PROPIO CASO:');
  for (const d of ollUnsolved) {
    console.log(`   ${d.caseNumber}: algoritmo NO resuelve el caso`);
  }
  console.log('');
} else {
  console.log('✅ Todos los 57 algoritmos OLL resuelven sus propios casos.\n');
}

// Check for duplicate U-face patterns
const patternMap = new Map<string, CaseDiagnosis[]>();
for (const d of ollDiagnoses) {
  const key = d.uFaceYellowPositions;
  if (!patternMap.has(key)) patternMap.set(key, []);
  patternMap.get(key)!.push(d);
}

const duplicates: [string, CaseDiagnosis[]][] = [];
for (const [key, diags] of patternMap) {
  if (diags.length > 1) duplicates.push([key, diags]);
}

if (duplicates.length > 0) {
  console.log('⚠️  CASOS OLL CON PATRONES U-FACE IDÉNTICOS (POSIBLES DUPLICADOS):');
  console.log('   (Estos casos se verán IGUALES en el diagrama yellow-gray)\n');
  for (const [pattern, diags] of duplicates) {
    const names = diags.map(d => d.caseNumber).join(', ');
    console.log(`   Patrón "${pattern}" → ${names}`);
    for (const d of diags) {
      console.log(`     ${d.caseNumber}: U-face="${d.uFacePattern}" | Moves: ${d.algorithmMoves.join(' ')}`);
    }
    console.log('');
  }
} else {
  console.log('✅ Todos los 57 OLL tienen patrones U-face ÚNICOS.\n');
}

// Show all OLL U-face patterns for reference
console.log('─── Patrones U-face de todos los OLL ───────────────────────\n');
// Group by category
for (const d of ollDiagnoses) {
  console.log(`  ${d.caseNumber.padEnd(7)} | U-face: ${d.uFacePattern} | Yellow: ${d.uFaceYellowPositions.padEnd(12)} | Solved: ${d.isSolvedByAlgorithm ? '✅' : '❌'}`);
}

// ═══ PLL ANALYSIS ═══════════════════════════════════════════════════════════

console.log('\n\n─── PLL (21 casos) ─────────────────────────────────────────\n');

const pllDiagnoses: CaseDiagnosis[] = [];

for (const { caseDef, algorithms } of PLL_CASES) {
  const defaultAlg = algorithms.find(a => a.isDefault) ?? algorithms[0];
  const d = diagnoseCase(caseDef.caseNumber, caseDef.id, defaultAlg.moves, 'full-color');
  pllDiagnoses.push(d);
}

// Check all algorithms solve their cases
const pllUnsolved = pllDiagnoses.filter(d => !d.isSolvedByAlgorithm);
if (pllUnsolved.length > 0) {
  console.log('❌ CASOS DONDE EL ALGORITMO NO RESUELVE SU PROPIO CASO:');
  for (const d of pllUnsolved) {
    console.log(`   ${d.caseNumber}: algoritmo NO resuelve el caso`);
  }
  console.log('');
} else {
  console.log('✅ Todos los 21 algoritmos PLL resuelven sus propios casos.\n');
}

// Check U-face: all should be 'U' for PLL (orientation preserved)
console.log('─── Verificación U-face PLL (todas deben ser "UUUUUUUUU") ──\n');
const pllBadUFace = pllDiagnoses.filter(d => !/^U{9}$/.test(d.uFacePattern));
if (pllBadUFace.length > 0) {
  console.log('❌ PLL con U-face INCORRECTA:');
  for (const d of pllBadUFace) {
    console.log(`   ${d.caseNumber}: U-face="${d.uFacePattern}"`);
  }
} else {
  console.log('✅ Todos los 21 PLL tienen U-face correcta (todo amarillo).\n');
}

// Check for duplicate U-layer side patterns (full PLL uniqueness)
const pllSidePatternMap = new Map<string, CaseDiagnosis[]>();
for (const d of pllDiagnoses) {
  // For PLL, uniqueness is determined by U-layer side strips: indices 9-11, 18-20, 36-38, 45-47
  const sidePattern = [
    d.faceletString.substring(9, 12),   // R top
    d.faceletString.substring(18, 21),  // F top
    d.faceletString.substring(36, 39),  // L top
    d.faceletString.substring(45, 48),  // B top
  ].join('|');
  if (!pllSidePatternMap.has(sidePattern)) pllSidePatternMap.set(sidePattern, []);
  pllSidePatternMap.get(sidePattern)!.push(d);
}

const pllDuplicates: [string, CaseDiagnosis[]][] = [];
for (const [key, diags] of pllSidePatternMap) {
  if (diags.length > 1) pllDuplicates.push([key, diags]);
}

if (pllDuplicates.length > 0) {
  console.log('⚠️  CASOS PLL CON PATRONES DE COLORES IDÉNTICOS (POSIBLES DUPLICADOS):');
  for (const [pattern, diags] of pllDuplicates) {
    const names = diags.map(d => d.caseNumber).join(', ');
    console.log(`   Patrón "${pattern}" → ${names}`);
  }
  console.log('');
} else {
  console.log('✅ Todos los 21 PLL tienen patrones de colores ÚNICOS.\n');
}

// Show all PLL side patterns
console.log('─── Patrones de todos los PLL ──────────────────────────────\n');
for (const d of pllDiagnoses) {
  const r = d.faceletString.substring(9, 12);
  const f = d.faceletString.substring(18, 21);
  const l = d.faceletString.substring(36, 39);
  const b = d.faceletString.substring(45, 48);
  console.log(`  ${d.caseNumber.padEnd(5)} | R:${r} F:${f} L:${l} B:${b} | U:${d.uFacePattern} | Solved: ${d.isSolvedByAlgorithm ? '✅' : '❌'}`);
}

// ═══ SUMMARY ═════════════════════════════════════════════════════════════════

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  RESUMEN FINAL');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  OLL: ${ollDiagnoses.length} casos, ${ollUnsolved.length} no resueltos, ${duplicates.length} grupos duplicados`);
console.log(`  PLL: ${pllDiagnoses.length} casos, ${pllUnsolved.length} no resueltos, ${pllDuplicates.length} grupos duplicados`);

if (ollUnsolved.length === 0 && duplicates.length === 0 &&
    pllUnsolved.length === 0 && pllDuplicates.length === 0) {
  console.log('\n  🎉 ¡TODO CORRECTO! No se encontraron problemas.');
} else {
  console.log('\n  ⚠️  Se encontraron problemas. Revisa los detalles arriba.');
}
