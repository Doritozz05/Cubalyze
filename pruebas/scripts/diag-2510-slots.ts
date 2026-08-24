/**
 * diag-2510-slots.ts — decisive diagnosis for the 2510 F2L slot detection.
 *
 * Questions:
 *  1. Is recolor(solved) == x2·solved? (i.e. can the final-state rotation check
 *     discriminate schemes at all)
 *  2. Per F2L phase: per-slot completeness of pre/post in the pre-frame AND in
 *     the post-frame (the analyzer uses ONE frame for both — if the cross moves
 *     from B to D during the phase, that might break the transition detection).
 *  3. OLL pre-state orientation signature in the frame the analyzer picks.
 */
import { CubeState } from '../../packages/math-core';
import { analyzeReconstruction } from '../../packages/algorithm-db/src/recognition/reconstructionAnalyzer';
import {
  applyRotation,
  findRotationOfSolved,
  ROTATION_GROUP,
} from '../../packages/algorithm-db/src/recognition/rotationGroup';
import {
  applyColorRemap,
  U_D_SWAP_REMAP,
  CATALOG_CONVENTION,
} from '../../packages/algorithm-db/src/recognition/conventions';
import { tokenize, isRotation } from '../../packages/algorithm-db/src/recognition/moveNotation';

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

const PHASES = [
  { name: 'Inspection', moves: 'z y' },
  { name: 'Cross (W)', moves: "D2 L U R' U'" },
  { name: 'F2L 1 (BL · Pj)', moves: "x' D' L' U L U' L' U L D" },
  { name: 'F2L 2 (FR · Jm)', moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: 'F2L 3 (BR · Jb)', moves: "U2 U L U' L'" },
  { name: 'F2L 4 (BR · Ci)', moves: "y' R' U2 R U R' U' R" },
  { name: 'OLL', moves: "R' U' R' F R F' U R" },
  { name: 'PLL', moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

function slotComplete(state: CubeState, frame: string, cornerPos: number, edgePos: number): boolean {
  const view = applyRotation(state, frame);
  const home = applyRotation(new CubeState(), frame);
  return (
    view.cp[cornerPos] === home.cp[cornerPos] &&
    view.co[cornerPos] === 0 &&
    view.ep[edgePos] === home.ep[edgePos] &&
    view.eo[edgePos] === 0
  );
}

function findFrames(state: CubeState, crossEdges: readonly number[]): string[] {
  const frames: string[] = [];
  const crossSet = new Set(crossEdges);
  for (const r of ROTATION_GROUP) {
    const rotated = applyRotation(state, r);
    let ok = true;
    for (let pos = 4; pos < 8; pos++) {
      if (!crossSet.has(rotated.ep[pos]) || rotated.eo[pos] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) frames.push(r);
  }
  return frames.slice(0, 8);
}

// ── 1. recolor(solved) rotation ────────────────────────────────────────────
const recoloredSolved = applyColorRemap(new CubeState(), U_D_SWAP_REMAP);
console.log(
  'Q1 recolor(solved) isRotationOfSolved =',
  findRotationOfSolved(recoloredSolved),
  '(if non-null ⇒ final-state rotation check CANNOT discriminate schemes)',
);

// ── 2. replay in raw scheme, then recolor like the analyzer ────────────────
const analyzer = analyzeReconstruction({ scramble: SCRAMBLE, phases: PHASES });

const crossEdges = CATALOG_CONVENTION.crossEdges;
let state = new CubeState();
for (const t of tokenize(SCRAMBLE)) state.applySequence(t);
const rawStates: CubeState[] = [];
const rawPre: CubeState[] = [];
for (const phase of PHASES) {
  const pre = state.clone();
  rawPre.push(pre);
  for (const t of tokenize(phase.moves)) {
    state.applySequence(t);
    rawStates.push(state.clone());
  }
}
const remapped = (s: CubeState) => applyColorRemap(s, U_D_SWAP_REMAP);

const replayed = remapped(state);
console.log('Q1b recolored final isSolved =', replayed.isSolved());
console.log('Q1c recolored final rotation-of-solved =', findRotationOfSolved(replayed));

// Phase boundaries
let cursor = 0;
for (let p = 0; p < PHASES.length; p++) {
  const phase = PHASES[p];
  const moves = tokenize(phase.moves);
  const pre = remapped(rawPre[p]);
  const post = cursor + moves.length - 1 >= 0 ? remapped(rawStates[cursor + moves.length - 1]) : pre;
  const framesPre = findFrames(pre, crossEdges);
  const framesPost = findFrames(post, crossEdges);
  if (!/f2l|pair/i.test(phase.name)) {
    console.log(`\n[${phase.name}] pre frames(cross on D): ${framesPre.slice(0, 4).join(', ') || 'none'} | post frames: ${framesPost.slice(0, 4).join(', ') || 'none'}`);
    if (/oll/i.test(phase.name)) {
      const f = framesPre[0] ?? framesPost[0] ?? '';
      const view = f ? applyRotation(pre, f) : pre;
      console.log(
        `  OLL pre co[0..3]=[${Array.from(view.co).slice(0, 4).join(',')}] eo[0..3]=[${Array.from(view.eo).slice(0, 4).join(',')}] frame="${f}"`,
      );
    }
    cursor += moves.length;
    continue;
  }
  const framePre = framesPre[0] ?? null;
  const framePost = framesPost[0] ?? null;
  const frame = framePre ?? framePost;
  console.log(`\n[${phase.name}] preFrames=${framesPre.slice(0, 4).join(',') || '∅'} postFrames=${framesPost.slice(0, 4).join(',') || '∅'} analyzer frame="${frame ?? '∅'}"`);
  if (frame !== null) {
    for (const slot of SLOTS) {
      const b = slotComplete(pre, frame, slot.cornerPos, slot.edgePos);
      const a = slotComplete(post, frame, slot.cornerPos, slot.edgePos);
      const aPostFrame = framePost !== null
        ? slotComplete(post, framePost, slot.cornerPos, slot.edgePos)
        : null;
      console.log(
        `  ${slot.name}: pre=${b} post(preFrame)=${a} post(postFrame)=${aPostFrame} ${!b && a ? '← TRANSITION' : ''}`,
      );
    }
  }
  cursor += moves.length;
}

console.log('\nANALYZER summary:');
console.log(`  finalSolved=${analyzer.finalSolved} finalRotation=${analyzer.finalRotation ?? 'null'} crossVerified=${analyzer.crossVerified}`);
for (const pr of analyzer.pairs) {
  console.log(`  ${analyzer.phases[pr.phaseIndex].name}: case=${pr.caseMatch.caseNumber ?? 'UNKNOWN'} slot=${pr.slot} slots=[${pr.slotsCompleted.join(',')}] verified=${pr.verified}`);
}
console.log(`  OLL: ${analyzer.oll?.caseMatch.caseNumber ?? '—'} verified=${analyzer.oll?.verified}`);
console.log(`  PLL: ${analyzer.pll?.caseMatch.caseNumber ?? '—'} verified=${analyzer.pll?.verified}`);
