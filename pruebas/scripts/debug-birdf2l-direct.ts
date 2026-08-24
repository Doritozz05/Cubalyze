/**
 * Test directo: construir el caso Jb (setup del seed "F R' F' R"), aplicar cada
 * alg, y ver si resuelve el par FR dejando los otros slots intactos.
 * Tambien: dump completo del estado de A^-1(solved) para un par de algs.
 * Uso: pnpm dlx tsx scripts/debug-birdf2l-direct.ts
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
function dump(s: CubeState, label: string) {
  console.log(
    `${label}: cp=[${Array.from(s.cp)}] co=[${Array.from(s.co)}] ep=[${Array.from(s.ep)}] eo=[${Array.from(s.eo)}]`,
  );
}

const algs = data["Jb"].algs as { moves: string }[];

// 1) El caso Jb segun el seed
const C = new CubeState();
C.applySequence("F R' F' R");
console.log("=== CASO Jb (setup 'F R' F' R') ===");
dump(C, "C");
console.log(
  `slots en C: FR=${slotOk(C, SLOTS.FR)} FL=${slotOk(C, SLOTS.FL)} BR=${slotOk(C, SLOTS.BR)} BL=${slotOk(C, SLOTS.BL)}`,
);

// 2) Aplicar cada alg AL CASO C (direccion directa)
console.log("\n=== APLICAR ALG AL CASO C (primeros 15) ===");
let directSolve = 0;
const distDirect = new Map<string, number>();
for (const a of algs) {
  const r = C.clone();
  try { r.applySequence(a.moves); } catch { continue; }
  const key = `${slotOk(r, SLOTS.FR)}${slotOk(r, SLOTS.FL)}${slotOk(r, SLOTS.BR)}${slotOk(r, SLOTS.BL)}`;
  distDirect.set(key, (distDirect.get(key) ?? 0) + 1);
  if (slotOk(r, SLOTS.FR) && slotOk(r, SLOTS.FL) && slotOk(r, SLOTS.BR) && slotOk(r, SLOTS.BL)) directSolve++;
}
for (const [k, v] of [...distDirect.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
  console.log(`  tras alg: FR=${k[0]} FL=${k[1]} BR=${k[2]} BL=${k[3]} -> ${v} algs`);
}
console.log(`resuelven C por completo: ${directSolve}`);

// 3) Estado real de A^-1(solved) para un alg "invalido"
console.log("\n=== DUMP A^-1(solved) para algs invalidos ===");
for (const a of ["R' U F R F'", "R' F2 R F2"]) {
  const s = new CubeState();
  s.applySequence(invertSequence(a));
  dump(s, `A=${a}  A^-1=${invertSequence(a)}`);
  console.log(
    `  slots: FR=${slotOk(s, SLOTS.FR)} FL=${slotOk(s, SLOTS.FL)} BR=${slotOk(s, SLOTS.BR)} BL=${slotOk(s, SLOTS.BL)}`,
  );
  // donde estan las piezas del par FR?
  let cPos = -1, ePos = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) cPos = i;
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) ePos = i;
  console.log(`  par FR: esquina(pieza4) en pos ${cPos}, arista(pieza8) en pos ${ePos}`);
}
