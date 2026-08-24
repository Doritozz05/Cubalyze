/**
 * Verify recon #2407 (Zane Myers, 2×2, CubeRoot):
 *   scramble:  U R' F' R U' R U' R2 U F' R
 *   inspection: y z' x' y
 *   solution:  U L' U' L R U R' U' R' F R F'
 *
 * Uses Cube2x2State (8 corners). A 2×2 has no edges/centers, so "solved" is
 * checked up to whole-cube rotations: apply each of the 24 rotation sequences
 * (via the 3×3-delegating path, which handles x/y/z) and test isSolved().
 */
import { Cube2x2State, CubeState } from '../../packages/math-core/src/index';

const SCRAMBLE = "U R' F' R U' R U' R2 U F' R";
const INSPECTION = "y z' x' y";
const SOLUTION = "U L' U' L R U R' U' R' F R F'";

const ROT = ['x', 'y', 'z'];
const AXIS: string[] = [];
for (const a of ROT) for (const b of ROT) for (const c of ROT) AXIS.push(`${a} ${b} ${c}`);

function applyRotationToState(s: Cube2x2State, rotation: string): Cube2x2State {
  const c3 = new CubeState(Array.from(s.cp), Array.from(s.co), null, null);
  c3.applySequence(rotation);
  return new Cube2x2State(Array.from(c3.cp), Array.from(c3.co));
}

function solvedUpToRotation(s: Cube2x2State): boolean {
  if (s.isSolved()) return true;
  for (const seq of AXIS) {
    if (applyRotationToState(s, seq).isSolved()) return true;
  }
  return false;
}

// ─── Models ─────────────────────────────────────────────────────────────
// A: no inspection            solved → scramble → solution
// B: insp after scramble      solved → scramble → insp → solution
// C: insp first (2518 model)  solved → insp → scramble → insp → solution
// D: insp first, no repeat    solved → insp → scramble → solution
const models: { name: string; seq: string }[] = [
  { name: 'A (sin inspección)', seq: `${SCRAMBLE} ${SOLUTION}` },
  { name: 'B (insp tras scramble)', seq: `${SCRAMBLE} ${INSPECTION} ${SOLUTION}` },
  { name: 'C (modelo 2518)', seq: `${INSPECTION} ${SCRAMBLE} ${INSPECTION} ${SOLUTION}` },
  { name: 'D (insp primero)', seq: `${INSPECTION} ${SCRAMBLE} ${SOLUTION}` },
];

console.log('Recon #2407 — Zane Myers 2×2 (CubeRoot)');
for (const m of models) {
  const s = new Cube2x2State();
  try {
    s.applySequence(m.seq);
    const solved = s.isSolved();
    const upToRot = solvedUpToRotation(s);
    console.log(
      `${solved ? 'SOLVED      ' : upToRot ? 'SOLVED-UP-TO-ROTATION' : 'NOT-SOLVED  '} [${m.name}]`,
    );
  } catch (e) {
    console.log(`ERROR [${m.name}]: ${(e as Error).message}`);
  }
}

// ─── Extra models ──────────────────────────────────────────────────────
// E: conjugation by the grip — the recorded moves are written in the
//    solver's frame (inspection R), so physically they act as R·m·R⁻¹.
//    physical = scramble → R → solution → R⁻¹.
function inverseNotation(seq: string): string {
  return seq
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((t) => (t.endsWith("'") ? t[0] : t.endsWith('2') ? t : t + "'"))
    .join(' ');
}
const physical = new Cube2x2State();
physical.applySequence(SCRAMBLE);
physical.applySequence(SOLUTION);
console.log(`\nphysical scramble→solution → ${physical.isSolved() ? 'SOLVED' : 'NOT-SOLVED'}`);

let conjSolved = false;
for (const R of AXIS) {
  const t = new Cube2x2State();
  t.applySequence(SCRAMBLE);
  const u = applyRotationToState(t, R);
  u.applySequence(SOLUTION);
  const v = applyRotationToState(u, inverseNotation(R));
  if (v.isSolved()) {
    conjSolved = true;
    console.log(`model E (conjugación grip R=${R}): SOLVED`);
    break;
  }
}
if (!conjSolved) console.log('model E (conjugación por cualquier grip R): NOT-SOLVED');

// Sanity: does Cube2x2State round-trip a scramble at all?
const sanity = new Cube2x2State();
sanity.applySequence(SCRAMBLE);
sanity.applySequence(inverseNotation(SCRAMBLE));
console.log(`\nsanity scramble→scramble⁻¹ → ${sanity.isSolved() ? 'SOLVED (estado 2x2 OK)' : 'NOT-SOLVED (¡bug del estado!)'}`);
