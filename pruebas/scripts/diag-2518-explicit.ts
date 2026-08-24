/**
 * diag-2518-explicit.ts — does recognition work on the exact CubeRoot 2518
 * paste (with the explicit `x2 // insp` phase)? Test 3 variants:
 *  A) inspection as an explicit phase (after the scramble — standard model)
 *  B) inspection applied BEFORE the scramble (alternative replay model)
 *  C) recovered automatically (no inspection phase)
 */
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { CubeState } from '../../packages/math-core';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { ROTATION_GROUP, applyRotation, isRotationOfReference } from '../../packages/algorithm-db/src/recognition/rotationGroup';
import { applyColorRemap, U_D_SWAP_REMAP } from '../../packages/algorithm-db/src/recognition/conventions';

const SCRAMBLE = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";

const PHASES_WITH_INSP = [
  { name: 'Inspection', moves: 'x2' },
  { name: 'Cross (W)', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · OB)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · RB)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · GO)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · GR/OLL skip)', moves: "y' U' R U2 R'" },
  { name: 'PLL (AUF)', moves: 'U2' },
];

const PHASES_NO_INSP = PHASES_WITH_INSP.slice(1);

function report(label: string, result: ReturnType<typeof analyzeReconstruction>): void {
  console.log(`\n=== ${label} ===`);
  console.log(`  finalSolved=${result.finalSolved} finalRotation=${result.finalRotation ?? 'null'} inspection=${JSON.stringify(result.inspection)}`);
  console.log(`  colorRemap=${JSON.stringify(result.colorRemap)} convention=${result.convention ? `[${result.convention.crossEdges}]` : 'null'} crossVerified=${result.crossVerified}`);
  for (const p of result.pairs) {
    console.log(`  ${result.phases[p.phaseIndex].name}: case=${p.caseMatch.caseNumber ?? 'UNKNOWN'} slot=${p.slot} slots=[${p.slotsCompleted.join(',')}] verified=${p.verified} frame=${p.frame || '(id)'}`);
  }
  console.log(`  OLL: ${result.oll ? result.oll.caseMatch.caseNumber ?? 'UNKNOWN' : '—(no oll phase)'} verified=${result.oll?.verified}`);
  console.log(`  PLL: ${result.pll ? result.pll.caseMatch.caseNumber ?? 'UNKNOWN' : '—(no pll phase)'} verified=${result.pll?.verified}`);
}

// A) Inspection as explicit phase (standard model: after scramble)
report('A) explicit Inspection x2 (standard model)', analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES_WITH_INSP }));

// B) Inspection applied BEFORE the scramble
{
  // Rebuild: replay solved → x2 → scramble → phases (inspection as initial state)
  const initialState = new CubeState();
  initialState.applySequence('x2');
  report('B) inspection BEFORE scramble', analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES_NO_INSP, initialState }));
}

// C) Recovered automatically
report('C) automatic recovery', analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES_NO_INSP }));

// D) Does ANY model make the cross WHITE on D after the cross phase?
{
  const s = new CubeState();
  for (const t of tokenize(SCRAMBLE)) s.applySequence(t);
  s.applySequence('x2');
  for (const t of tokenize(PHASES_WITH_INSP[1].moves)) s.applySequence(t);
  const frames4 = ROTATION_GROUP.filter((r) => {
    const v = applyRotation(s, r);
    const set = new Set([4, 5, 6, 7]);
    return [4, 5, 6, 7].every((p) => set.has(v.ep[p]) && v.eo[p] === 0);
  });
  const frames0 = ROTATION_GROUP.filter((r) => {
    const v = applyRotation(s, r);
    const set = new Set([0, 1, 2, 3]);
    return [4, 5, 6, 7].every((p) => set.has(v.ep[p]) && v.eo[p] === 0);
  });
  console.log(`\nD) cross-end (model A): white-on-D frames=[${frames4.slice(0, 3).join(',') || '∅'}] yellow-on-D frames=[${frames0.slice(0, 3).join(',') || '∅'}]`);
  // inverted scheme variant
  const invSolved = applyColorRemap(new CubeState(), U_D_SWAP_REMAP);
  console.log(`  final is rotation of solved (model A): ${isRotationOfReference(s, new CubeState())} (after cross only)`);
}
