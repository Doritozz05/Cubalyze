/**
 * Demo de la estrategia de seleccion: los MEJORES algs de F2L 1 (Jb).
 * Pipeline completo mini:
 *   1) filtrar puros (aplicar al caso limpio, otros slots intactos)
 *   2) dedupe por familia (estado AUF-canónico del resultado)
 *   3) ranking: speed (Petrus) -> stm -> longitud
 *   4) cruzar con los algs que ya tenemos en el seed SCDB (por texto sin
 *      rotaciones, + marca de coincidencia)
 * Uso: pnpm dlx tsx scripts/demo-select-best.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { BASIC_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
function stateHash(s: CubeState): string {
  return (
    Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" +
    Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("")
  );
}
function minOverAuf(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = stateHash(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
const ROTS = new Set(["y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2"]);
function stripped(t: string[]): string {
  const x = [...t];
  while (x.length && ROTS.has(x[0])) x.shift();
  while (x.length && ROTS.has(x[x.length - 1])) x.pop();
  return x.join(" ");
}

// Setup de F2L 1 del seed
const f1 = BASIC_F2L_CASES.find((c) => c.caseDef.caseNumber === "F2L 1")!;
const C = new CubeState();
C.applySequence(f1.caseDef.setupScramble as string);

// Algs SCDB de F2L 1 (texto sin rotaciones)
const scdbAlgs = new Set(f1.algorithms.map((a) => stripped(a.moves as string[])));

const algs = data["Jb"].algs as { moves: string; speed: number; stm: number }[];
const families = new Map<string, { moves: string; speed: number; stm: number; len: number }>();

let pure = 0, impure = 0;
for (const a of algs) {
  const r = C.clone();
  try { r.applySequence(a.moves); } catch { continue; }
  if (!slotOk(r, SLOTS.FR) || !slotOk(r, SLOTS.FL) || !slotOk(r, SLOTS.BR) || !slotOk(r, SLOTS.BL)) {
    impure++;
    continue;
  }
  pure++;
  const key = minOverAuf(r);
  const cur = families.get(key);
  const cand = { moves: a.moves, speed: a.speed ?? 99, stm: a.stm ?? 99, len: a.moves.length };
  if (!cur || cand.speed < cur.speed || (cand.speed === cur.speed && cand.stm < cur.stm)) {
    families.set(key, cand);
  }
}

const ranked = [...families.values()].sort((x, y) => x.speed - y.speed || x.stm - y.stm);
console.log(`=== SELECTION F2L 1 (Jb): ${algs.length} algs -> ${pure} puros -> ${families.size} familias ===`);
console.log(`\nTOP 12 por speed (Petrus) — [SCDB] = ya lo tenemos en el seed:`);
for (const a of ranked.slice(0, 12)) {
  const inSc = scdbAlgs.has(stripped(a.moves.split(" ")));
  console.log(`  ${a.speed.toFixed(2).padStart(5)}  stm ${a.stm}  ${a.moves.padEnd(32)} ${inSc ? "[SCDB]" : ""}`);
}
console.log(`\nRango de speed: ${ranked[0]?.speed.toFixed(2)} - ${ranked[ranked.length - 1]?.speed.toFixed(2)}`);
console.log(`Algs SCDB de F2L 1 presentes entre los puros (texto sin rot.): ${algs.filter((a) => scdbAlgs.has(stripped(a.moves.split(" ")))).length}/${f1.algorithms.length}`);
