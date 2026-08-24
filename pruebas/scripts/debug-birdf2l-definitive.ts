/**
 * Test definitivo: clasificar TODOS los algs de Jb segun que hacen aplicados al
 * caso limpio C (setup "F R' F' R", otros 3 slots resueltos):
 *   A) resuelven FR y dejan los otros 3 intactos   -> alg F2L PURO
 *   B) resuelven FR pero desordenan otro slot      -> alg impuro
 *   C) no resuelven FR                             -> no es solver de este caso
 * Ademas: probar marcos rotados (C·y, C·y2, C·y', C·x...) para los que no
 * resuelven directo — si resuelven en un marco rotado, el alg esta escrito
 * en otro sistema de referencia.
 * Uso: pnpm dlx tsx scripts/debug-birdf2l-definitive.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
const allOk = (s: CubeState) =>
  slotOk(s, SLOTS.FR) && slotOk(s, SLOTS.FL) && slotOk(s, SLOTS.BR) && slotOk(s, SLOTS.BL);

const ROTATIONS = ["y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];

const algs = data["Jb"].algs as { moves: string }[];

const C = new CubeState();
C.applySequence("F R' F' R");

const counts = { pure: 0, impure: 0, notSolver: 0, rotated: 0, parseErr: 0 };
const impureSamples: string[] = [];
const rotatedSamples: string[] = [];

for (const a of algs) {
  // A) y B): aplicar al caso limpio
  let r: CubeState;
  try {
    r = C.clone();
    r.applySequence(a.moves);
  } catch { counts.parseErr++; continue; }
  const frSolved = slotOk(r, SLOTS.FR);
  const others = slotOk(r, SLOTS.FL) && slotOk(r, SLOTS.BR) && slotOk(r, SLOTS.BL);
  if (frSolved && others) { counts.pure++; continue; }
  if (frSolved) {
    counts.impure++;
    if (impureSamples.length < 6) impureSamples.push(a.moves);
    continue;
  }
  // C) probar marcos rotados
  let solvedInRotation = false;
  for (const rot of ROTATIONS) {
    const rc = C.clone();
    rc.applySequence(rot);
    rc.applySequence(a.moves);
    if (allOk(rc)) { solvedInRotation = true; break; }
  }
  if (solvedInRotation) {
    counts.rotated++;
    if (rotatedSamples.length < 6) rotatedSamples.push(a.moves);
  } else {
    counts.notSolver++;
  }
}

console.log(`=== CLASIFICACION DE LOS ${algs.length} ALGS DE Jb ===`);
console.log(`A) PUROS (resuelven FR, otros intactos):   ${counts.pure} (${((100 * counts.pure) / algs.length).toFixed(1)}%)`);
console.log(`B) IMPUROS (resuelven FR, desordenan otro): ${counts.impure} (${((100 * counts.impure) / algs.length).toFixed(1)}%)`);
console.log(`C) ROTADOS (resuelven en marco rotado):     ${counts.rotated} (${((100 * counts.rotated) / algs.length).toFixed(1)}%)`);
console.log(`D) NO SOLVER:                               ${counts.notSolver} (${((100 * counts.notSolver) / algs.length).toFixed(1)}%)`);
console.log(`E) parse err:                               ${counts.parseErr}`);
console.log(`\nejemplos IMPUROS: ${impureSamples.join(" | ")}`);
console.log(`ejemplos ROTADOS: ${rotatedSamples.join(" | ")}`);
