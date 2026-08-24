/**
 * diag-2518-working.ts — the WORKING 2518 config (initialState = x2·solved,
 * scramble, phases) with full debug + per-slot transitions, to understand
 * why F2L 3/4 (internal y rotations) report no slot completion.
 */
import { CubeState } from '../../packages/math-core';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { ROTATION_GROUP, applyRotation } from '../../packages/algorithm-db/src/recognition/rotationGroup';

const SCRAMBLE = "R' D F L D R U D F2 R2 D R' B L' B U2 B' D'";
const PHASES = [
  { name: 'Cross (W)', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · OB)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · RB)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · GO)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · GR/OLL skip)', moves: "y' U' R U2 R'" },
  { name: 'PLL (AUF)', moves: 'U2' },
];

const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

function slotComplete(state: CubeState, frame: string, c: number, e: number): boolean {
  const v = applyRotation(state, frame);
  const h = applyRotation(new CubeState(), frame);
  return v.cp[c] === h.cp[c] && v.co[c] === 0 && v.ep[e] === h.ep[e] && v.eo[e] === 0;
}

function crossFrame(state: CubeState): string | null {
  const set = new Set([4, 5, 6, 7]);
  for (const r of ROTATION_GROUP) {
    const v = applyRotation(state, r);
    if ([4, 5, 6, 7].every((p) => set.has(v.ep[p]) && v.eo[p] === 0)) return r;
  }
  return null;
}

const initialState = new CubeState();
initialState.applySequence('x2');

const result = analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES, initialState });
console.log('ANALYZER: finalSolved=', result.finalSolved, 'inspection=', JSON.stringify(result.inspection), 'crossVerified=', result.crossVerified);
for (const p of result.pairs) {
  console.log(`  ${result.phases[p.phaseIndex].name}: case=${p.caseMatch.caseNumber ?? 'UNKNOWN'} slot=${p.slot} verified=${p.verified} frame=${p.frame || '(id)'}`);
}
console.log('\nDEBUG:'); for (const l of result.debug) console.log('  ' + l);

// Manual per-slot walk with per-state frames
console.log('\nMANUAL per-slot walk:');
const s = initialState.clone();
for (const t of tokenize(SCRAMBLE)) s.applySequence(t);
for (const t of tokenize(result.inspection)) s.applySequence(t);
for (const ph of PHASES) {
  const pre = s.clone();
  const moves = tokenize(ph.moves);
  const post = s.clone();
  for (const t of moves) post.applySequence(t);
  if (/f2l/i.test(ph.name)) {
    const fPre = crossFrame(pre);
    const fPost = crossFrame(post);
    console.log(`\n[${ph.name}] preFrame=${fPre ?? '∅'} postFrame=${fPost ?? '∅'}`);
    const frame = fPre ?? fPost;
    if (frame !== null) {
      for (const sl of SLOTS) {
        const b = slotComplete(pre, frame, sl.cornerPos, sl.edgePos);
        const a = slotComplete(post, frame, sl.cornerPos, sl.edgePos);
        if (!b && a) console.log(`  ${sl.name}: pre=${b} post=${a} ← TRANSITION`);
        else if (b || a) console.log(`  ${sl.name}: pre=${b} post=${a}`);
      }
    }
  }
  for (const t of moves) s.applySequence(t);
}
