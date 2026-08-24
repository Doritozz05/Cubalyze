/**
 * Auditoría: setups de los 126 casos Advanced.
 * Un setup limpio deja el F2L resuelto EXCEPTO la pareja (2 piezas fuera).
 * Contamos cuántas piezas F2L están fuera de su home tras el setup y si hay
 * algs puros en el dedupe-report para recalcular setups limpios.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const DEDUPE = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/dedupe-report.json"), "utf-8"));
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;

// posición actual de la pieza piece en arr (cp o ep)
const findPos = (arr: number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};

const advancedPats = Object.entries(TAX).filter(([, v]) => !v.f2lnum && v.position !== "solved");

let clean = 0, dirty = 0, noAlgs = 0;
const dirtyList: string[] = [];
const cleanWithPure: string[] = [];

for (const [patid, v] of advancedPats as any[]) {
  const setup = v.setup;
  let s: CubeState;
  try {
    s = new CubeState();
    s.applySequence(setup);
  } catch { continue; }

  // piezas F2L fuera de su home (corners 4-7, edges 4-11)
  const outOfPlace: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) outOfPlace.push(`C${c}`);
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) outOfPlace.push(`E${e}`);

  // El dedupe tiene top100 con pure flag — cuántos puros hay
  const d = (DEDUPE.cases as any[]).find((x) => x.patid === patid);
  const pureCount = d ? d.top100.filter((t: any) => t.pure).length : 0;

  if (outOfPlace.length <= 4) {
    clean++;
    if (pureCount > 0) cleanWithPure.push(patid);
  } else {
    dirty++;
    dirtyList.push(`${patid}: ${outOfPlace.length} piezas fuera (${outOfPlace.join(" ")}) puros=${pureCount} setup=${setup}`);
  }
  if (outOfPlace.length === 0) noAlgs++;
}

console.log(`=== Setups Advanced: ${advancedPats.length} casos ===`);
console.log(`Limpios (<=4 piezas fuera, solo la pareja): ${clean}`);
console.log(`Sucios (>4 piezas fuera): ${dirty}`);
console.log(`Con 0 piezas fuera (¿solved?): ${noAlgs}`);
console.log(`Limpios con algs puros disponibles: ${cleanWithPure.length}`);
console.log(`\n=== Sucios (primeros 20) ===`);
for (const d of dirtyList.slice(0, 20)) console.log(" ", d);

// ¿Y los 41 basic?
console.log(`\n=== Setups Basic (41) ===`);
let bClean = 0, bDirty = 0;
const basicPats = Object.entries(TAX).filter(([, v]) => v.f2lnum);
for (const [patid, v] of basicPats as any[]) {
  let s: CubeState;
  try { s = new CubeState(); s.applySequence(v.setup); } catch { continue; }
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  if (n <= 4) bClean++; else bDirty++;
}
console.log(`Limpios: ${bClean} | Sucios: ${bDirty}`);
