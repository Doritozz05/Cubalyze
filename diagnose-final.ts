/**
 * Diagnóstico final: categoriza los 12 grupos duplicados OLL
 * y verifica OLL 53/54 que siguen siendo idénticos.
 */
import { CubeState, FaceletStringConverter } from './packages/math-core/src/index';
import { CaseStateGenerator } from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';

interface CaseInfo {
  n: number;
  uFace: string;
  yellow: string;
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
  expanded: string[];
  algStr: string;
}

function analyze(n: number): CaseInfo {
  const c = OLL_CASES.find(x => x.caseDef.caseNumber === `OLL ${n}`)!;
  const alg = c.algorithms.find(a => a.isDefault) ?? c.algorithms[0];
  const state = CaseStateGenerator.generateCaseState(alg.moves);
  const fc = FaceletStringConverter.toFaceletString(state);
  return {
    n,
    uFace: fc.substring(0, 9),
    yellow: fc.substring(0, 9).split('').map(c => c === 'U' ? 'Y' : '.').join(''),
    cp: Array.from(state.cp),
    co: Array.from(state.co),
    ep: Array.from(state.ep),
    eo: Array.from(state.eo),
    expanded: alg.moves,
    algStr: alg.moves.join(' '),
  };
}

function stateKey(cp: number[], co: number[], ep: number[], eo: number[]): string {
  return `cp:${cp.join(',')}|co:${co.join(',')}|ep:${ep.join(',')}|eo:${eo.join(',')}`;
}

function statesEqual(a: CaseInfo, b: CaseInfo): boolean {
  return stateKey(a.cp, a.co, a.ep, a.eo) === stateKey(b.cp, b.co, b.ep, b.eo);
}

// ═══ PART 1: OLL 53 vs 54 deep analysis ═════════════════════════════════════

console.log('═══════════════════════════════════════════════════');
console.log('  PARTE 1: OLL 53 vs OLL 54');
console.log('═══════════════════════════════════════════════════\n');

const oll53 = analyze(53);
const oll54 = analyze(54);

console.log(`OLL 53: yellow=${oll53.yellow}  uFace=${oll53.uFace}`);
console.log(`  expanded: ${oll53.expanded.join(' ')}`);
console.log(`  cp=[${oll53.cp}], co=[${oll53.co}]`);
console.log(`  ep=[${oll53.ep}], eo=[${oll53.eo}]`);

console.log(`\nOLL 54: yellow=${oll54.yellow}  uFace=${oll54.uFace}`);
console.log(`  expanded: ${oll54.expanded.join(' ')}`);
console.log(`  cp=[${oll54.cp}], co=[${oll54.co}]`);
console.log(`  ep=[${oll54.ep}], eo=[${oll54.eo}]`);

console.log(`\n¿Estado idéntico? ${statesEqual(oll53, oll54)}`);

// Apply OLL 53 algorithm to OLL 53 state → should solve
const solved53 = CaseStateGenerator.verifyAlgorithmSolvesCase(
  CaseStateGenerator.generateCaseState(oll53.expanded),
  oll53.expanded
);
// Apply OLL 54 algorithm to OLL 53 state → should NOT solve if different cases
const cross54on53 = CaseStateGenerator.verifyAlgorithmSolvesCase(
  CaseStateGenerator.generateCaseState(oll53.expanded),
  oll54.expanded
);
// Apply OLL 53 algorithm to OLL 54 state
const cross53on54 = CaseStateGenerator.verifyAlgorithmSolvesCase(
  CaseStateGenerator.generateCaseState(oll54.expanded),
  oll53.expanded
);

console.log(`Alg 53 resuelve caso 53: ${solved53}`);
console.log(`Alg 54 resuelve caso 53: ${cross54on53}`);
console.log(`Alg 53 resuelve caso 54: ${cross53on54}`);

// Verify with standard (non-expanded) algorithms
// Standard OLL 53: r' U' R U' R' U R U' R' U2 r
// Standard OLL 54: r U R' U R U' R' U R U2 r'
// Apply using CubeState with wide-move notation? Need parseMoves...
// Let's test by applying the algorithm directly as string notation
// (but CubeState doesn't support wide moves, only via parseMoves)

// ═══ PART 2: Categorize ALL 12 duplicate groups ═════════════════════════════

console.log('\n═══════════════════════════════════════════════════');
console.log('  PARTE 2: Categorización de los 12 grupos duplicados');
console.log('═══════════════════════════════════════════════════\n');

const duplicateGroups = [
  ['OLL 1', 'OLL 2'],
  ['OLL 5', 'OLL 8', 'OLL 15'],
  ['OLL 6', 'OLL 16'],
  ['OLL 7', 'OLL 11', 'OLL 27'],
  ['OLL 9', 'OLL 10'],
  ['OLL 18', 'OLL 19'],
  ['OLL 20', 'OLL 28', 'OLL 57'],
  ['OLL 21', 'OLL 22', 'OLL 49', 'OLL 50', 'OLL 53', 'OLL 54', 'OLL 56'],
  ['OLL 29', 'OLL 42'],
  ['OLL 30', 'OLL 41'],
  ['OLL 32', 'OLL 44'],
  ['OLL 33', 'OLL 45'],
];

for (const group of duplicateGroups) {
  const nums = group.map(s => parseInt(s.replace('OLL ', '')));
  const infos = nums.map(n => analyze(n));
  const yellow = infos[0].yellow;
  const allSameYellow = infos.every(i => i.yellow === yellow);

  // Check if all states are identical
  const firstKey = stateKey(infos[0].cp, infos[0].co, infos[0].ep, infos[0].eo);
  const allSameState = infos.every(i => stateKey(i.cp, i.co, i.ep, i.eo) === firstKey);

  // Check categories from seed data
  const cats = nums.map(n => {
    const c = OLL_CASES.find(x => x.caseDef.caseNumber === `OLL ${n}`)!;
    return c.caseDef.category;
  });

  const allSameCat = cats.every(c => c === cats[0]);

  console.log(`\nGrupo: ${group.join(', ')} | Yellow="${yellow}" | Misma categoría: ${allSameCat}`);
  console.log(`  Estados idénticos: ${allSameState} | Cats: ${cats.join(', ')}`);

  if (!allSameState) {
    console.log(`  Estados DIFERENTES (mismo patrón visual pero distintas permutaciones):`);
    for (const info of infos) {
      console.log(`    OLL ${info.n}: cp=[${info.cp.slice(0,4)}] co=[${info.co.slice(0,4)}] uFace="${info.uFace}"`);
    }
  } else {
    console.log(`  ⚠️  TODOS LOS ESTADOS SON IDÉNTICOS → ¡POSIBLE BUG!`);
    for (const info of infos) {
      console.log(`    OLL ${info.n}: "${info.algStr.substring(0, 60)}..."`);
    }
  }

  // Verdict
  if (allSameCat && allSameState) {
    console.log(`  → VEREDICTO: BUG - misma categoría y mismo estado (algoritmos equivalentes o incorrectos)`);
  } else if (allSameCat && !allSameState) {
    console.log(`  → VEREDICTO: LEGÍTIMO - misma categoría, mismo patrón visual, diferentes algoritmos`);
  } else if (!allSameCat && allSameState) {
    console.log(`  → VEREDICTO: BUG - diferentes categorías pero mismo estado`);
  } else {
    console.log(`  → VEREDICTO: LEGÍTIMO (?) - diferentes categorías, diferentes estados, mismo patrón visual`);
  }
}

// ═══ PART 3: Check specific suspicious cases ════════════════════════════════

console.log('\n\n═══════════════════════════════════════════════════');
console.log('  PARTE 3: Casos sospechosos específicos');
console.log('═══════════════════════════════════════════════════\n');

// OLL 20 (Dot Case) - all yellow?!
console.log('--- OLL 20 (Dot Case) ---');
const oll20 = analyze(20);
console.log(`  yellow="${oll20.yellow}" uFace="${oll20.uFace}"`);
console.log(`  expanded: ${oll20.expanded.join(' ')}`);

// OLL 28 (All Corners Oriented) - all yellow should be correct
console.log('\n--- OLL 28 (All Corners Oriented) ---');
const oll28 = analyze(28);
console.log(`  yellow="${oll28.yellow}" uFace="${oll28.uFace}"`);
console.log(`  expanded: ${oll28.expanded.join(' ')}`);

// OLL 57 (All Corners Oriented) - all yellow should be correct
console.log('\n--- OLL 57 (All Corners Oriented) ---');
const oll57 = analyze(57);
console.log(`  yellow="${oll57.yellow}" uFace="${oll57.uFace}"`);
console.log(`  expanded: ${oll57.expanded.join(' ')}`);

// OLL 1 vs 2 - both dot cases, same yellow?
console.log('\n--- OLL 1 vs OLL 2 (Dot Cases) ---');
const oll1 = analyze(1);
const oll2 = analyze(2);
console.log(`OLL 1: yellow="${oll1.yellow}" cp=[${oll1.cp.slice(0,8)}] co=[${oll1.co.slice(0,8)}]`);
console.log(`OLL 2: yellow="${oll2.yellow}" cp=[${oll2.cp.slice(0,8)}] co=[${oll2.co.slice(0,8)}]`);
console.log(`Same state: ${statesEqual(oll1, oll2)}`);
