/**
 * Diagnóstico completo de frames para el 2510: rotación final, grip acumulado,
 * frames cross-on-D por fase, transiciones de slot con homes del estado final,
 * y la firma del par contra el índice del catálogo.
 * Uso: pnpm dlx tsx pruebas/scripts/debug-recognition-frames.ts
 */
import { CubeState } from "../../packages/math-core/src/index";
import {
  findCrossOnDFrames,
  findRotationOfSolved,
  applyRotation,
  invertSequence,
} from "../../packages/algorithm-db/src/recognition/rotationGroup";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(m: string): string[] {
  let s = m.replace(PRIME, "'").replace(/[↑·()]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

const CUBEROOT = [
  { name: "Inspection", moves: "z y" },
  { name: "Cross (W)", moves: "D2 L U R' U'" },
  { name: "F2L 1 (BL · Pj)", moves: "x' D' L' U L U' L' U L D" },
  { name: "F2L 2 (FR · Jm)", moves: "U2 y' L' U L U' L' U L U2 L' U L" },
  { name: "F2L 3 (BR · Jb)", moves: "U2 U L U' L'" },
  { name: "F2L 4 (BR · Ci)", moves: "y' R' U2 R U R' U' R" },
  { name: "OLL", moves: "R' U' R' F R F' U R" },
  { name: "PLL", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

// ── Replay con estados por token + acumulador de rotaciones ───────────────
const state = new CubeState();
state.applySequence(SCRAMBLE);
const states: CubeState[] = [];
const gripAtPhaseStart: string[] = [];
const borders: { name: string; start: number; end: number }[] = [];
const grip: string[] = [];
let idx = 0;
for (const p of CUBEROOT) {
  gripAtPhaseStart.push(grip.join(" "));
  const toks = tokenize(p.moves);
  borders.push({ name: p.name, start: idx, end: idx + toks.length - 1 });
  idx += toks.length;
  for (const t of toks) {
    state.applySequence(t);
    states.push(state.clone());
    if (/^[xyz]/.test(t)) grip.push(t);
  }
}
const final = states[states.length - 1];
const R = findRotationOfSolved(final);
console.log(`final isSolved=${final.isSolved()} rot=${R ?? "NONE"}`);
console.log(`rotaciones acumuladas: [${grip.join(" ")}]`);
const A = grip.join(" ");
// ¿A·final == solved?
if (R) {
  const t = final.clone();
  t.applySequence(A);
  console.log(`A·final == solved? ${t.isSolved()}`);
  console.log(`¿A == R⁻¹? secuencia R⁻¹ = ${invertSequence(R)}`);
  const t2 = final.clone();
  t2.applySequence(invertSequence(R));
  console.log(`R⁻¹·final == solved? ${t2.isSolved()}`);
}

const preOf = (b: { start: number }) =>
  b.start === 0 ? (() => { const s = new CubeState(); s.applySequence(SCRAMBLE); return s; })() : states[b.start - 1];

// ── Firma del par (canónica: min sobre slotRot × AUF de posiciones) ──────
function pairSig(pre: CubeState, frame: string, corner: number, edge: number): string | null {
  const base = applyRotation(pre, frame);
  let best: string | null = null;
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 4; j++) {
      const t = base.clone();
      for (let i = 0; i < k; i++) t.applySequence("y");
      if (j === 1) t.applySequence("U");
      else if (j === 2) t.applySequence("U2");
      else if (j === 3) t.applySequence("U'");
      const cpos = Array.from(t.cp).indexOf(corner);
      const epos = Array.from(t.ep).indexOf(edge);
      const key = `C${cpos}#${t.co[cpos]}|E${epos}#${t.eo[epos]}`;
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

// Índice del catálogo por par (FR: esquina 4, arista 8, frame identidad)
const index = new Map<string, string>();
for (const c of ALL_F2L_CASES) {
  const cs = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  const sig = pairSig(cs, "", 4, 8);
  if (sig === null) continue;
  const prev = index.get(sig);
  if (prev === undefined) index.set(sig, c.caseDef.caseNumber);
  else if (!/^F2L \d+$/.test(prev) && /^F2L \d+$/.test(c.caseDef.caseNumber)) index.set(sig, c.caseDef.caseNumber);
}
console.log(`\níndice por par: ${index.size} firmas`);

// ── Por fase F2L ──────────────────────────────────────────────────────────
const SLOTS = [
  { name: "FR", c: 4, e: 8 },
  { name: "FL", c: 5, e: 9 },
  { name: "BL", c: 6, e: 10 },
  { name: "BR", c: 7, e: 11 },
];
function slotOk(s: CubeState, home: CubeState, sl: { c: number; e: number }) {
  return s.cp[sl.c] === home.cp[sl.c] && s.co[sl.c] === 0 && s.ep[sl.e] === home.ep[sl.e] && s.eo[sl.e] === 0;
}

console.log("\n── Fases F2L ──");
for (let i = 0; i < borders.length; i++) {
  const b = borders[i];
  if (!/f2l/i.test(b.name)) continue;
  const pre = preOf(b);
  const post = states[b.end];
  const crossFrames = findCrossOnDFrames(pre, [0, 1, 2, 3]);
  const frames4 = findCrossOnDFrames(pre, [4, 5, 6, 7]);
  console.log(`\n${b.name}  grip@inicio="${gripAtPhaseStart[i]}"`);
  console.log(`  frames cross-on-D conv solver(0-3): ${crossFrames.length} | conv catálogo(4-7): ${frames4.length}`);
  for (const f of crossFrames.slice(0, 4)) {
    const home = applyRotation(new CubeState(), f);
    const preSlots = SLOTS.filter((s) => slotOk(pre, home, s)).map((s) => s.name);
    const postSlots = SLOTS.filter((s) => slotOk(post, home, s)).map((s) => s.name);
    const newSlots = SLOTS.map((s) => s.name).filter((n) => !preSlots.includes(n) && postSlots.includes(n));
    console.log(`  frame=${f.padEnd(8)} nuevos slots: ${newSlots.join(",") || "—"}`);
    if (newSlots.length === 1) {
      const sl = SLOTS.find((s) => s.name === newSlots[0])!;
      const corner = post.cp[sl.c];
      const edge = post.ep[sl.e];
      const sig = pairSig(pre, f, corner, edge);
      console.log(`    par=(${corner},${edge}) sig=${sig} → ${index.get(sig!) ?? "??"} (anotado ${b.name.match(/\(.*\)/)?.[0] ?? "?"})`);
    }
  }
}

// ── OLL / PLL pre-states: frames ──────────────────────────────────────────
for (const name of ["OLL", "PLL"]) {
  const i = borders.findIndex((b) => new RegExp(name, "i").test(b.name));
  if (i < 0) continue;
  const pre = preOf(borders[i]);
  const f03 = findCrossOnDFrames(pre, [0, 1, 2, 3]);
  const f47 = findCrossOnDFrames(pre, [4, 5, 6, 7]);
  console.log(`\n${name} pre-state: frames conv solver(0-3)=${f03.length} | catálogo(4-7)=${f47.length}`);
  const co = Array.from(pre.co).slice(0, 4);
  const eo = Array.from(pre.eo).slice(0, 4);
  console.log(`  LL orient (co/eo @ pos 0-3): co=${co} eo=${eo} → OLL done? ${co.every((x) => x === 0) && eo.every((x) => x === 0)}`);
}
