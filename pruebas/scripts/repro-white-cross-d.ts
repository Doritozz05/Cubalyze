/**
 * REPRODUCCIÓN VERIFICABLE — solve CFOP sintético con cross BLANCA en D
 * ─────────────────────────────────────────────────────────────────────────
 * Este es el caso que estaba ROTO: las máscaras antiguas ancladas a piezas
 * solo detectan la cross amarilla en D. Un solver que construye la cross
 * BLANCA en D (el estilo estándar) era invisible para las 24 máscaras.
 *
 * Construcción (algoritmos reales, frame con cross blanca en D):
 *   - x2 inicial: coloca el frame con la cross blanca en D (como hace un
 *     solver con cross blanca abajo al empezar a resolver).
 *   - Cross en D (blanca): "F' U R'"
 *   - F2L (restaura el ecuador): "E2"
 *   - OLL 46 real: "R' U' R' F R F' U R"
 *   - PLL T-perm real: "R U R' U' R' F R2 U' R' U' R U R' F'"
 *   - x2 final: devuelve el cubo a la orientación canónica (resuelto exacto),
 *     igual que la app espera el estado final del smart cube.
 *
 * El scramble se genera como la inversa de la solución (por construcción el
 * solve devuelve el cubo a resuelto EXACTAMENTE). Verifica:
 *   1. scramble + solve → resuelto exacto
 *   2. geometría de cada fase (cross BLANCA en D, F2L, OLL, PLL)
 *   3. el pipeline de la app (TimelineBuilder + PhaseSplitter colorNeutral)
 *      detecta las 4 fases en los límites exactos
 *   4. las máscaras canónicas antiguas FALLAN en la cross (contraste)
 *
 * REPRODUCE CON TU CUBO: aplica el scramble, luego el solve, y el cubo
 * quedará resuelto (con la cross blanca abajo durante el solve, tu estilo).
 *   pnpm dlx tsx pruebas/scripts/repro-white-cross-d.ts
 */
import {
  CubeState,
  CFOPDefinition,
  expandWideMoves,
  FaceletStringConverter,
} from '../../packages/math-core/src/index';
import { PhaseSplitter } from '../../packages/analysis-engine/src/phases/PhaseSplitter';
import { TimelineBuilder } from '../../packages/analysis-engine/src/timeline/TimelineBuilder';
import type { SolveTimeline } from '../../packages/types/src/analysis';

/* eslint-disable no-console */

const OLL = "R' U' R' F R F' U R"; // OLL 46 (Seein' Headlights)
const PLL = "R U R' U' R' F R2 U' R' U' R U R' F'"; // T-perm
const CROSS = "F' U R'"; // cross blanca en D
const F2L = 'E2'; // restaura el ecuador

function invertSeq(seq: string): string {
  const toks = expandWideMoves(seq).filter(Boolean);
  return toks
    .map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : `${t}'`))
    .reverse()
    .join(' ');
}

// Scramble = [x2, P⁻¹, O⁻¹, E2, C⁻¹] aplicado a resuelto; solve = [C, E2, O, P, x2].
// x2 (rotación 180° en X) pone la cross blanca en D; el x2 final devuelve el
// cubo a la orientación canónica. (y2 rotaría F↔B/R↔L y NO mueve la cross.)
const SCRAMBLE = ['x2', invertSeq(PLL), invertSeq(OLL), F2L, invertSeq(CROSS)].join(' ');
const SOLUTION = [CROSS, F2L, OLL, PLL, 'x2'].join(' ');

// ── 1) scramble + solve = resuelto exacto ─────────────────────────────────
console.log('════════ 1) COHERENCIA ════════');
console.log(`Scramble (${SCRAMBLE.split(/\s+/).filter(Boolean).length} movs): ${SCRAMBLE}`);
console.log(`Solve    (${SOLUTION.split(/\s+/).filter(Boolean).length} movs): ${SOLUTION}`);
const v = new CubeState();
v.applySequence(SCRAMBLE);
v.applySequence(SOLUTION);
console.log('scramble + solve → solved exacto:', v.isSolved());
if (!v.isSolved()) throw new Error('El solve no devuelve el cubo a resuelto');

// ── 2) geometría de cada fase (verificable con el cubo físico) ────────────
console.log('\n════════ 2) GEOMETRÍA DE FASES ════════');
const SOLVED_FL = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
function faceletsAfter(pre: string, seq: string): string {
  const s = new CubeState();
  s.applySequence(pre);
  s.applySequence(seq);
  return FaceletStringConverter.toFaceletString(s);
}
const dEdges = [28, 32, 30, 34]; // facelets de aristas de la cara D
const crossFl = faceletsAfter(SCRAMBLE, CROSS);
const dAllWhite = dEdges.every((i) => crossFl[i] === 'U');
console.log(`Tras CROSS  (${CROSS})      → 4 aristas de D todas BLANCAS? ${dAllWhite}  [${dEdges.map((i) => crossFl[i]).join('')}]`);

// Referencia: el estado "resuelto en el frame de la cross" = x2·solved
// (blanco en D, amarillo en U). Las comprobaciones se hacen en ese frame.
const refState = new CubeState();
refState.applySequence('x2');
const REF_FL = FaceletStringConverter.toFaceletString(refState);

const f2lFl = faceletsAfter(SCRAMBLE, [CROSS, F2L].join(' '));
const uPositions = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47, 13, 22, 31, 40, 49]);
const f2lOk = [...f2lFl].every((c, i) => uPositions.has(i) || c === REF_FL[i]);
console.log(`Tras F2L   (${F2L})         → todo salvo capa U en su sitio? ${f2lOk}`);

const ollFl = faceletsAfter(SCRAMBLE, [CROSS, F2L, OLL].join(' '));
const uAllYellow = [0, 1, 2, 3, 5, 6, 7, 8].every((i) => ollFl[i] === 'D');
console.log(`Tras OLL   (${OLL}) → cara U toda AMARILLA (orientada)? ${uAllYellow}  [${[0, 1, 2, 3, 5, 6, 7, 8].map((i) => ollFl[i]).join('')}]`);

const pllFl = faceletsAfter(SCRAMBLE, [CROSS, F2L, OLL, PLL].join(' '));
const rotatedSolved = [...pllFl].every((c, i) => uPositions.has(i) || c === REF_FL[i]);
console.log(`Tras PLL   (${PLL}) → resuelto en el frame x2 (salvo AUF final)? ${rotatedSolved}  [D: ${dEdges.map((i) => pllFl[i]).join('')}]`);
const finalState = faceletsAfter(SCRAMBLE, SOLUTION);
const finalCheck = new CubeState();
finalCheck.applySequence(SCRAMBLE);
finalCheck.applySequence(SOLUTION);
console.log(`Tras x2 final          → solved exacto? ${finalCheck.isSolved()}  (cara D: ${dEdges.map((i) => finalState[i]).join('')})`);

// ── 3) pipeline real de la app ────────────────────────────────────────────
console.log('\n════════ 3) PIPELINE (PhaseSplitter colorNeutral = NUEVO detector por color) ════════');
const tokens = expandWideMoves(SOLUTION).filter(Boolean);
const state = new CubeState();
state.applySequence(SCRAMBLE);
const entries: SolveTimeline['entries'] = [];
let ts = 0;
for (const t of tokens) {
  state.applySequence(t);
  const face = t[0] as 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
  const direction = t.endsWith("'") ? -1 : t.endsWith('2') ? 2 : 1;
  const move = { face, direction, cubeTimestamp: ts, hostTimestamp: ts };
  entries.push({
    index: entries.length,
    move,
    displayMove: move,
    state: TimelineBuilder.toSnapshot(state),
    hostTimestamp: ts,
  });
  ts += 100;
}
const timeline: SolveTimeline = {
  solveId: 'repro',
  method: 'CFOP',
  entries,
  phases: [],
  initialStateSource: 'scramble',
  startTimestamp: 0,
  endTimestamp: ts,
};

PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });
for (const p of timeline.phases) {
  console.log(`  ${p.phaseName.padEnd(5)} → movs ${String(p.startIndex + 1).padStart(2)}-${String(p.endIndex + 1).padStart(2)} (${p.moveCount} movs)  ${p.skipped ? '[skipped]' : ''}`);
}
const names = timeline.phases.map((p) => p.phaseName);
const all4 = names.includes('Cross') && names.includes('F2L') && names.includes('OLL') && names.includes('PLL');
console.log(`¿4 fases detectadas? ${all4}  (crossFace detectada: ${timeline.detectionReport?.crossFace ?? 'n/a'} — debe ser 'D' con cross blanca)`);

// ── 4) máscaras canónicas antiguas (contraste) ─────────────────────────────
console.log('\n════════ 4) MÁSCARAS CANÓNICAS ANTIGUAS (antes del fix) ════════');
const oldPhases = PhaseSplitter.split(timeline, CFOPDefinition);
console.log(`Fases detectadas por las máscaras D-ancladas (cross amarilla): ${oldPhases.length}`);
for (const p of oldPhases) {
  console.log(`  ${p.phaseName}: movs ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount} movs)`);
}

console.log('\n═══ REPRODUCCIÓN PARA TU CUBO ═══');
console.log(`1. Aplica el scramble:   ${SCRAMBLE}`);
console.log(`2. Aplica el solve:      ${SOLUTION}`);
console.log('3. Durante el solve la cross es BLANCA en D (tu estilo). El cubo');
console.log('   queda resuelto al final. Las fases deben dividirse en:');
console.log('   Cross (blanca en D) · F2L · OLL 46 · PLL T-perm.');
