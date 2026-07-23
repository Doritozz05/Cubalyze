/**
 * Quick verification: apply setup scramble to solved cube and check U-face.
 * Also: manually verify a few OLL cases.
 */
import { CubeState, FaceletStringConverter } from './packages/math-core/src/index';
import { CaseStateGenerator } from './packages/algorithm-db/src/caseGenerator';
import { OLL_CASES } from './packages/algorithm-db/src/seed/cfop-oll';

// Helper: apply sequence to solved cube and get facelet string
function applyAndShow(label: string, seq: string) {
  const state = new CubeState();
  try {
    state.applySequence(seq);
    const facelets = FaceletStringConverter.toFaceletString(state);
    const uFace = facelets.substring(0, 9);
    console.log(`${label}: U-face="${uFace}"`);
    console.log(`  Full: ${facelets.substring(0,27)}...`);
    return uFace;
  } catch(e: any) {
    console.log(`${label}: ERROR - ${e.message}`);
    return '';
  }
}

console.log('═══════════════════════════════════════════════════');
console.log('  VERIFICACIÓN: Aplicar setup scramble directo');
console.log('═══════════════════════════════════════════════════\n');

// OLL 1: setup scramble applied directly (should show OLL 1 pattern)
console.log('--- OLL 1 via setup scramble ---');
applyAndShow('OLL 1 setup', "F R' F' R U2' F R' F' R2' U2' R'");

// OLL 1: inverse algorithm applied (should show same pattern)
console.log('\n--- OLL 1 via inverse algorithm ---');
const oll1 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 1')!;
const oll1alg = oll1.algorithms.find(a => a.isDefault) ?? oll1.algorithms[0];
const inv = CaseStateGenerator.generateCaseState(oll1alg.moves);
const invFacelets = FaceletStringConverter.toFaceletString(inv);
console.log(`OLL 1 inverse: U-face="${invFacelets.substring(0, 9)}"`);

// OLL 2: setup scramble applied directly
console.log('\n--- OLL 2 via setup scramble ---');
applyAndShow('OLL 2 setup', "f U R U' R' f' F U R U' R' F'");

// OLL 2: inverse algorithm applied
console.log('\n--- OLL 2 via inverse algorithm ---');
const oll2 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 2')!;
const oll2alg = oll2.algorithms.find(a => a.isDefault) ?? oll2.algorithms[0];
const inv2 = CaseStateGenerator.generateCaseState(oll2alg.moves);
const invFacelets2 = FaceletStringConverter.toFaceletString(inv2);
console.log(`OLL 2 inverse: U-face="${invFacelets2.substring(0, 9)}"`);

// OLL 5: verify with new parseMoves
console.log('\n--- OLL 5 via inverse algorithm (new parseMoves) ---');
const oll5 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 5')!;
const oll5alg = oll5.algorithms.find(a => a.isDefault) ?? oll5.algorithms[0];
console.log(`OLL 5 expanded moves: ${oll5alg.moves.join(' ')}`);
const inv5 = CaseStateGenerator.generateCaseState(oll5alg.moves);
const invFacelets5 = FaceletStringConverter.toFaceletString(inv5);
console.log(`OLL 5 inverse: U-face="${invFacelets5.substring(0, 9)}"`);

// OLL 53 vs 54: verify they are now DIFFERENT
console.log('\n--- OLL 53 vs 54 comparison ---');
const oll53 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 53')!;
const oll54 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 54')!;
const inv53 = CaseStateGenerator.generateCaseState(oll53.algorithms[0].moves);
const inv54 = CaseStateGenerator.generateCaseState(oll54.algorithms[0].moves);
console.log(`OLL 53 inverse: U-face="${FaceletStringConverter.toFaceletString(inv53).substring(0, 9)}"`);
console.log(`OLL 54 inverse: U-face="${FaceletStringConverter.toFaceletString(inv54).substring(0, 9)}"`);
console.log(`OLL 53 cp: [${Array.from(inv53.cp).join(',')}]`);
console.log(`OLL 54 cp: [${Array.from(inv54.cp).join(',')}]`);
console.log(`OLL 53 co: [${Array.from(inv53.co).join(',')}]`);
console.log(`OLL 54 co: [${Array.from(inv54.co).join(',')}]`);

// Check if OLL 53 still equals OLL 54
const sameCp = JSON.stringify(Array.from(inv53.cp)) === JSON.stringify(Array.from(inv54.cp));
const sameCo = JSON.stringify(Array.from(inv53.co)) === JSON.stringify(Array.from(inv54.co));
console.log(`Same cp: ${sameCp}, Same co: ${sameCo}`);

// OLL 7 scan: verify the yellow pattern is calculated correctly
console.log('\n--- OLL 7 (Lightning) ---');
const oll7 = OLL_CASES.find(c => c.caseDef.caseNumber === 'OLL 7')!;
const oll7alg = oll7.algorithms.find(a => a.isDefault) ?? oll7.algorithms[0];
console.log(`OLL 7 moves: ${oll7alg.moves.join(' ')}`);
const viz7 = CaseStateGenerator.generateCaseVisualization(oll7alg.moves, 'yellow-gray');
console.log(`OLL 7 U-face: "${viz7.faceletString.substring(0, 9)}"`);
console.log(`OLL 7 yellow: ${viz7.diagramColors.slice(0, 9).map(c => c === 'Y' ? 'Y' : '.').join('')}`);

// Direct facelet check without visualization pipeline
console.log('\n--- Direct facelet check for OLL 1 ---');
const raw1 = CaseStateGenerator.generateCaseState(oll1alg.moves);
console.log(`OLL 1 raw co: [${Array.from(raw1.co).join(',')}]`);
console.log(`OLL 1 raw cp: [${Array.from(raw1.cp).join(',')}]`);
console.log(`OLL 1 raw eo: [${Array.from(raw1.eo).join(',')}]`);
console.log(`OLL 1 raw ep: [${Array.from(raw1.ep).join(',')}]`);
const fc1 = FaceletStringConverter.toFaceletString(raw1);
console.log(`OLL 1 facelet U: "${fc1.substring(0, 9)}"`);
console.log(`OLL 1 facelet R: "${fc1.substring(9, 18)}"`);
console.log(`OLL 1 facelet F: "${fc1.substring(18, 27)}"`);

// Manual yellow-gray mapping
const yellowPattern = fc1.substring(0, 9).split('').map(c => c === 'U' ? 'Y' : '.').join('');
console.log(`OLL 1 manual yellow: "${yellowPattern}"`);
