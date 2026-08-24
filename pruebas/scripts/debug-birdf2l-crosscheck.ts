/**
 * Cross-check: aplicar el mismo test de pureza a nuestros algs de F2L 1 del seed
 * SCDB (curados, con votos). Si TODOS los de slot FR salen "puros" y los de
 * otros slots salen "no-solver", el metodo queda validado y el 5.2% de BirdF2L
 * es real (no un bug del test).
 * Uso: pnpm dlx tsx scripts/debug-birdf2l-crosscheck.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const SEED = resolve(__dirname, "../../packages/algorithm-db/src/seed/cfop-f2l.ts");
const src = readFileSync(SEED, "utf-8");

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
const othersOk = (s: CubeState) =>
  slotOk(s, SLOTS.FL) && slotOk(s, SLOTS.BR) && slotOk(s, SLOTS.BL);

// Extraer el primer caseDef (F2L 1) del seed: caseId f2l-b01 + sus moves
// (parsing simple del archivo generado)
const firstCase = src.indexOf('caseId: "f2l-b01"');
const chunk = src.slice(firstCase, src.indexOf("caseDef: {", firstCase + 10));

// Agarrar TODOS los bloques moves de f2l-b01: "moves: ["..."]" + notes Slot
const algBlocks = [...chunk.matchAll(/moves: \[([^\]]*)\][\s\S]*?notes: "([^"]*)"/g)];
const algs = algBlocks.map((m) => ({
  moves: (m[1].match(/"([^"]+)"/g) ?? []).map((x) => x.slice(1, -1)).join(" "),
  slot: (m[2].match(/Slot: (\w+)/) ?? [])[1] ?? "?",
}));
console.log(`F2L 1 del seed: ${algs.length} algs (${[...new Set(algs.map((a) => a.slot))].join(",")})`);

const C = new CubeState();
C.applySequence("F R' F' R"); // setup del seed para F2L 1

for (const a of algs) {
  let r: CubeState;
  try { r = C.clone(); r.applySequence(a.moves); } catch { console.log(`${a.moves.padEnd(30)} parse-err`); continue; }
  const fr = slotOk(r, SLOTS.FR);
  const pure = fr && othersOk(r);
  const label = pure ? "PURO" : fr ? "impuro" : "no-solver";
  console.log(`${a.moves.padEnd(30)} slot=${a.slot.padEnd(3)} -> ${label}`);
}

// Y comprobar la misma clasificacion con el metodo A^-1
console.log("\n=== con metodo A^-1 (slots de S) ===");
for (const a of algs) {
  const s = new CubeState();
  try { s.applySequence([...a.moves.split(" ")].reverse().map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith("2") ? t : t + "'")).join(" ")); } catch { continue; }
  const fr = slotOk(s, SLOTS.FR);
  const pure = !fr && othersOk(s);
  console.log(`${a.moves.padEnd(30)} slot=${a.slot.padEnd(3)} -> ${pure ? "PURO" : fr ? "par-resuelto-en-S" : "?"}`);
}
