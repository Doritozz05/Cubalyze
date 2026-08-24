/**
 * Debug: por que solo ~5% de los algs de Jb pasan la verificacion?
 * Prueba ambas direcciones (A^-1(solved) y A(solved)) y cuenta slots resueltos.
 * Uso: pnpm dlx tsx scripts/debug-birdf2l-check.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

function invertSequence(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.endsWith("'")) out.push(t.slice(0, -1));
    else if (t.endsWith("2")) out.push(t);
    else out.push(t + "'");
  }
  return out.join(" ");
}

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };

function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}

function show(name: string, s: CubeState) {
  console.log(
    `   ${name}: FR=${slotOk(s, SLOTS.FR)} FL=${slotOk(s, SLOTS.FL)} BR=${slotOk(s, SLOTS.BR)} BL=${slotOk(s, SLOTS.BL)}`,
  );
}

const algs = data["Jb"].algs as { moves: string }[];

// 1) Muestra: primeros 12 algs, ambas direcciones
console.log("=== PRIMEROS 12 ALGS (S = A^-1(solved) | T = A(solved)) ===");
for (const a of algs.slice(0, 12)) {
  let S: CubeState | null = null, T: CubeState | null = null;
  try {
    S = new CubeState(); S.applySequence(invertSequence(a.moves));
  } catch { /* noop */ }
  try {
    T = new CubeState(); T.applySequence(a.moves);
  } catch { /* noop */ }
  console.log(a.moves.padEnd(34));
  if (S) show("S", S);
  if (T) show("T", T);
}

// 2) Distribucion global: cuantos slots de FL/BR/BL quedan resueltos en S
console.log("\n=== DISTRIBUCION S = A^-1(solved): slots FL/BR/BL resueltos ===");
const dist = new Map<number, number>();
for (const a of algs) {
  let s: CubeState;
  try { s = new CubeState(); s.applySequence(invertSequence(a.moves)); } catch { continue; }
  const n = [SLOTS.FL, SLOTS.BR, SLOTS.BL].filter((sl) => slotOk(s, sl)).length;
  dist.set(n, (dist.get(n) ?? 0) + 1);
}
for (const [k, v] of [...dist.entries()].sort((x, y) => y[0] - x[0])) {
  console.log(`  ${k} de 3 slots resueltos: ${v} algs (${((100 * v) / algs.length).toFixed(1)}%)`);
}

// 3) En los que fallan, que slot falla mas?
const failBySlot = { FL: 0, BR: 0, BL: 0 };
let checked = 0;
for (const a of algs) {
  let s: CubeState;
  try { s = new CubeState(); s.applySequence(invertSequence(a.moves)); } catch { continue; }
  checked++;
  for (const k of ["FL", "BR", "BL"] as const) {
    if (!slotOk(s, SLOTS[k])) failBySlot[k]++;
  }
}
console.log(`\n=== de ${checked} algs, slot NO resuelto en S ===`);
for (const k of ["FL", "BR", "BL"] as const) {
  console.log(`  ${k}: ${failBySlot[k]} (${((100 * failBySlot[k]) / checked).toFixed(1)}%)`);
}
