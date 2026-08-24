/**
 * Hipótesis: el caso F2L debe identificarse por el PAR (esquina + arista),
 * no por el estado F2L completo (los otros pares aún están sin resolver en
 * un solve real). Depura la firma del par para el 2510.
 * Uso: pnpm dlx tsx pruebas/scripts/debug-recognition-pair.ts
 */
import { CubeState } from "../../packages/math-core/src/index";
import { findCrossOnDFrames, applyRotation } from "../../packages/algorithm-db/src/recognition/rotationGroup";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
import { f2lSignature } from "../../packages/algorithm-db/src/recognition/signatures";

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

// ── Replay with per-token states ──────────────────────────────────────────
const state = new CubeState();
state.applySequence(SCRAMBLE);
const states: CubeState[] = [];
const borders: { name: string; start: number }[] = [];
let idx = 0;
for (const p of CUBEROOT) {
  borders.push({ name: p.name, start: idx });
  for (const t of tokenize(p.moves)) {
    state.applySequence(t);
    states.push(state.clone());
  }
  idx += tokenize(p.moves).length;
}
const final = states[states.length - 1];
console.log(`final isSolved=${final.isSolved()} rot=${(require("../../packages/algorithm-db/src/recognition/rotationGroup") as any).findRotationOfSolved(final)}`);

const CROSS = [0, 1, 2, 3]; // convención del solver (detectada por color)

// ── Firma del PAR: rol@pos#orient para la esquina y la arista del par ─────
function pairSignature(stateIn: CubeState, frame: string, cornerPiece: number, edgePiece: number): string | null {
  const home = applyRotation(new CubeState(), frame);
  const cornerHome = new Map<number, number>();
  const edgeHome = new Map<number, number>();
  for (let p = 0; p < 8; p++) cornerHome.set(home.cp[p], p);
  for (let p = 0; p < 12; p++) edgeHome.set(home.ep[p], p);
  const base = applyRotation(stateIn, frame);
  let best: string | null = null;
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 4; j++) {
      const t = base.clone();
      for (let i = 0; i < k; i++) t.applySequence("y");
      if (j === 1) t.applySequence("U");
      else if (j === 2) t.applySequence("U2");
      else if (j === 3) t.applySequence("U'");
      const cpos = Array.from(t.cp).indexOf(cornerPiece);
      const epos = Array.from(t.ep).indexOf(edgePiece);
      const key = `${cornerHome.get(cornerPiece)}@${cpos}#${t.co[cpos]}|E${edgeHome.get(edgePiece)}@${epos}#${t.eo[epos]}`;
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

// ── Slot detectado en el grip acumulado ───────────────────────────────────
const SLOT_DEF = [
  { name: "FR", c: 4, e: 8 },
  { name: "FL", c: 5, e: 9 },
  { name: "BL", c: 6, e: 10 },
  { name: "BR", c: 7, e: 11 },
];
function slotOk(s: CubeState, home: CubeState, sl: { c: number; e: number }) {
  return s.cp[sl.c] === home.cp[sl.c] && s.co[sl.c] === 0 && s.ep[sl.e] === home.ep[sl.e] && s.eo[sl.e] === 0;
}

// ── Índice del catálogo por PAR (FR: esquina 4, arista 8) ─────────────────
const index = new Map<string, string>();
for (const c of ALL_F2L_CASES) {
  const cs = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  const sig = pairSignature(cs, "", 4, 8);
  if (sig === null) continue;
  if (!index.has(sig)) index.set(sig, c.caseDef.caseNumber);
  else if (/^F2L \d+$/.test(index.get(sig)!) && !/^F2L \d+$/.test(c.caseDef.caseNumber)) {
    // keep basic
  } else if (!/^F2L \d+$/.test(index.get(sig)!)) {
    index.set(sig, c.caseDef.caseNumber);
  }
}
console.log(`índice por PAR: ${index.size} firmas de ${ALL_F2L_CASES.length} casos`);
console.log(`\ncolisiones por par (ejemplos):`);
const seenPairs = new Map<string, string[]>();
for (const c of ALL_F2L_CASES) {
  const cs = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
  const sig = pairSignature(cs, "", 4, 8);
  if (sig === null) continue;
  const arr = seenPairs.get(sig) ?? [];
  arr.push(c.caseDef.caseNumber);
  seenPairs.set(sig, arr);
}
let coll = 0;
for (const [sig, cases] of seenPairs) {
  if (cases.length > 1) {
    coll++;
    if (coll <= 5) console.log(`  ${cases.join(", ")} → ${sig}`);
  }
}
console.log(`  total grupos con >1 caso: ${coll}`);

// ── Por fase F2L: par = slot que pasa de incompleto a completo ────────────
console.log("\n── Fases F2L (grip acumulado del stream) ──");
const f2lIdxs = borders.map((b, i) => ({ b, i })).filter((x) => /f2l/i.test(x.b.name));
let grip: string[] = [];
const preOf = (start: number) => (start === 0 ? (() => { const s = new CubeState(); s.applySequence(SCRAMBLE); return s; })() : states[start - 1]);

for (const { b, i } of f2lIdxs) {
  // grip acumulado hasta el inicio de esta fase (rotaciones del stream)
  const pre = preOf(b.start);
  const post = states[tokenize(CUBEROOT[i].moves).length + b.start - 1];
  // frames con cross en D:
  const frames = findCrossOnDFrames(pre, CROSS);
  console.log(`\n${b.name}: frames=${frames.length} (${frames.join(", ") || "—"})`);
  for (const f of frames.slice(0, 4)) {
    const home = applyRotation(new CubeState(), f);
    const preSlots = SLOT_DEF.filter((s) => slotOk(pre, home, s)).map((s) => s.name);
    const postSlots = SLOT_DEF.filter((s) => slotOk(post, home, s)).map((s) => s.name);
    const newSlots = SLOT_DEF.map((s) => s.name).filter((n) => !preSlots.includes(n) && postSlots.includes(n));
    console.log(`  frame=${f.padEnd(8)} pre=[${preSlots.join(",")}] post=[${postSlots.join(",")}] → NUEVOS: ${newSlots.join(",") || "—"}`);
    if (newSlots.length === 1) {
      const sl = SLOT_DEF.find((s) => s.name === newSlots[0])!;
      const corner = post.cp[sl.c];
      const edge = post.ep[sl.e];
      const sig = pairSignature(pre, f, corner, edge);
      console.log(`    par: esquina ${corner} arista ${edge} → sig=${sig} → ${index.get(sig!) ?? "??"} (anotado ${CUBEROOT[i].name.match(/\(.*\)/)?.[0] ?? "?"})`);
    }
  }
}
