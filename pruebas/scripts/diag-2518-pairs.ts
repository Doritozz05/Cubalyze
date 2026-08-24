/**
 * diag-2518-pairs.ts — why do F2L 3/4 (internal y rotations) report no slot
 * transition in the model-B 2518 replay? Also check 2510 CUBEROOT under B.
 */
import { CubeState } from '../../packages/math-core';
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

function crossFrame(state: CubeState): string | null {
  const set = new Set([4, 5, 6, 7]);
  for (const r of ROTATION_GROUP) {
    const v = applyRotation(state, r);
    if ([4, 5, 6, 7].every((p) => set.has(v.ep[p]) && v.eo[p] === 0)) return r;
  }
  return null;
}

// Model B replay: x2·solved → scramble → phases
const s = new CubeState();
s.applySequence('x2');
for (const t of tokenize(SCRAMBLE)) s.applySequence(t);

for (const ph of PHASES) {
  const pre = s.clone();
  const moves = tokenize(ph.moves);
  const post = s.clone();
  for (const t of moves) post.applySequence(t);

  const fPre = crossFrame(pre);
  const fPost = crossFrame(post);
  console.log(`\n[${ph.name}] preFrame=${fPre ?? '∅'} postFrame=${fPost ?? '∅'} moves=${moves.join(' ')}`);

  // Transition detection in the pre-frame (current analyzer behavior)
  const frame = fPre ?? fPost;
  if (frame !== null) {
    for (const slot of SLOTS) {
      const b = slotComplete(pre, frame, slot.cornerPos, slot.edgePos);
      const a = slotComplete(post, frame, slot.cornerPos, slot.edgePos);
      if (!b && a) console.log(`  [pre-frame] ${slot.name} ← TRANSITION`);
    }
  }
  // Transition detection with per-state frames (pre-frame for pre, post-frame for post)
  if (fPre !== null && fPost !== null) {
    for (const slot of SLOTS) {
      const b = slotComplete(pre, fPre, slot.cornerPos, slot.edgePos);
      const a = slotComplete(post, fPost, slot.cornerPos, slot.edgePos);
      if (!b && a) console.log(`  [per-state] ${slot.name} ← TRANSITION`);
    }
  }
  // Print which slots are complete in pre and post (pre-frame)
  if (frame !== null) {
    const preSlots = SLOTS.filter((sl) => slotComplete(pre, frame, sl.cornerPos, sl.edgePos)).map((x) => x.name);
    const postSlots = SLOTS.filter((sl) => slotComplete(post, frame, sl.cornerPos, sl.edgePos)).map((x) => x.name);
    console.log(`  pre completed=[${preSlots.join(',') || '∅'}] post completed=[${postSlots.join(',') || '∅'}]`);
  }
  for (const t of moves) s.applySequence(t);
}

const final = s.clone();
console.log('\nFINAL: isSolved=', final.isSolved());
