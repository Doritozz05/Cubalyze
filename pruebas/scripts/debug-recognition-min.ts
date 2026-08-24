/**
 * Réplica exacta del replay del analyzer (con su tokenize) para comparar frames.
 * Uso: pnpm dlx tsx pruebas/scripts/debug-recognition-min.ts
 */
import { CubeState } from "../../packages/math-core/src/index";
import { tokenize } from "../../packages/algorithm-db/src/recognition/moveNotation";
import { findCrossOnDFrames } from "../../packages/algorithm-db/src/recognition/rotationGroup";

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const PHASES = [
  { name: "Inspection", moves: "z y" },
  { name: "Cross (W)", moves: "D2 L U R' U'" },
  { name: "F2L 1 (BL · Pj)", moves: "x' D' L' U L U' L' U L D" },
  { name: "F2L 2 (FR · Jm)", moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: "F2L 3 (BR · Jb)", moves: "U2 U L U' L'" },
  { name: "F2L 4 (BR · Ci)", moves: "y' R' U2 R U R' U' R" },
  { name: "OLL", moves: "R' U' R' F R F' U R" },
  { name: "PLL", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

const state = new CubeState();
state.applySequence(SCRAMBLE);
const states: CubeState[] = [];
const borders: { name: string; start: number }[] = [];
let cursor = 0;
for (const p of PHASES) {
  const moves = tokenize(p.moves);
  borders.push({ name: p.name, start: cursor });
  console.log(`tokenize("${p.moves}") -> [${moves.join(", ")}] (${moves.length})`);
  cursor += moves.length;
  for (const t of moves) {
    state.applySequence(t);
    states.push(state.clone());
  }
}

for (const b of borders) {
  if (!/f2l/i.test(b.name) && !/oll/i.test(b.name) && !/pll/i.test(b.name)) continue;
  const pre = b.start === 0 ? (() => { const s = new CubeState(); s.applySequence(SCRAMBLE); return s; })() : states[b.start - 1];
  console.log(`${b.name.padEnd(22)} pre=states[${b.start - 1}] frames(0-3)=${findCrossOnDFrames(pre, [0, 1, 2, 3]).length}`);
}
console.log(`total tokens: ${states.length}`);
