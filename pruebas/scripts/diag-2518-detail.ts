/**
 * diag-2518-detail.ts — per-phase slot transitions + cross-end analysis for
 * the 2518 solve (WCA scramble + recovered inspection x2).
 */
import { CubeState } from '../../packages/math-core';
import { tokenize } from '../../packages/algorithm-db/src/recognition/moveNotation';
import { ROTATION_GROUP, applyRotation } from '../../packages/algorithm-db/src/recognition/rotationGroup';

const SCRAMBLE = "D2 R F U2 L2 B2 L' D2 R2 D2 F2 U' F2 L D' L B' R' B2";
const INSPECTION = 'x2';
const PHASES = [
  { name: 'Cross', moves: "R D F D2 F' D'" },
  { name: 'F2L 1 (BL · Mi)', moves: "U F U' F'" },
  { name: 'F2L 2 (FL · Cc)', moves: "U' R U' R' U' R U' R' U R U' R'" },
  { name: 'F2L 3 (BR · Ja)', moves: "y U2 R U R' y U R U' R'" },
  { name: 'F2L 4 (FR · Mi)', moves: "y' U' R U2 R'" },
  { name: 'OLL (skip)', moves: '' },
  { name: 'PLL', moves: 'U2' },
];

const SLOTS = [
  { name: 'FR', cornerPos: 4, edgePos: 8 },
  { name: 'FL', cornerPos: 5, edgePos: 9 },
  { name: 'BL', cornerPos: 6, edgePos: 10 },
  { name: 'BR', cornerPos: 7, edgePos: 11 },
];

function crossFrames(state: CubeState, edges: number[]): string[] {
  const set = new Set(edges);
  const out: string[] = [];
  for (const r of ROTATION_GROUP) {
    const v = applyRotation(state, r);
    let ok = true;
    for (let p = 4; p < 8; p++) if (!set.has(v.ep[p]) || v.eo[p] !== 0) { ok = false; break; }
    if (ok) out.push(r);
  }
  return out.slice(0, 4);
}

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

// Replay
const s = new CubeState();
for (const t of tokenize(SCRAMBLE)) s.applySequence(t);
console.log('after scramble: white edges [4-7] on D frames:', crossFrames(s, [4, 5, 6, 7]).join(', ') || '∅');
s.applySequence(INSPECTION);
console.log('after x2:      white edges [4-7] on D frames:', crossFrames(s, [4, 5, 6, 7]).join(', ') || '∅');

const preStates: CubeState[] = [];
for (const ph of PHASES) {
  const pre = s.clone();
  preStates.push(pre);
  if (ph.name === 'Cross') {
    const after = s.clone();
    for (const t of tokenize(ph.moves)) after.applySequence(t);
    console.log('\nCROSS-END (after "R D F D2 F\' D\'"):');
    console.log('  white [4-7] on D frames:', crossFrames(after, [4, 5, 6, 7]).join(', ') || '∅');
    console.log('  yellow [0-3] on D frames:', crossFrames(after, [0, 1, 2, 3]).join(', ') || '∅');
    console.log('  ep of cross-end:', Array.from(after.ep).join(','));
    console.log('  eo of cross-end:', Array.from(after.eo).join(','));
  }
  if (/f2l/i.test(ph.name)) {
    const moves = tokenize(ph.moves);
    const post = s.clone();
    for (const t of moves) post.applySequence(t);
    const framesPre = crossFrames(pre, [4, 5, 6, 7]);
    const framesPost = crossFrames(post, [4, 5, 6, 7]);
    const frame = framesPre[0] ?? framesPost[0] ?? '';
    console.log(`\n${ph.name}: preFrames=[${framesPre.join(',') || '∅'}] postFrames=[${framesPost.join(',') || '∅'}] use frame="${frame}"`);
    if (frame !== undefined) {
      for (const slot of SLOTS) {
        const b = slotComplete(pre, frame, slot.cornerPos, slot.edgePos);
        const a = slotComplete(post, frame, slot.cornerPos, slot.edgePos);
        console.log(`  ${slot.name}: pre=${b} post=${a}${!b && a ? ' ← TRANSITION' : ''}`);
      }
    }
  }
  for (const t of tokenize(ph.moves)) s.applySequence(t);
}

const final = s.clone();
console.log('\nFINAL: isSolved=', final.isSolved());
console.log('  rotation-of-solved frames:', crossFrames(final, [4, 5, 6, 7]).length > 0);
