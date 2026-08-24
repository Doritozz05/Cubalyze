/**
 * Auditoría completa: para los 126 advanced, ¿existe un setup limpio local
 * (inverso de un alg del top100 con <=4 piezas F2L fuera)? ¿Coincide la pareja
 * con la del setup actual (indica si el setup actual era el mismo caso rotado)?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const DEDUPE = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/dedupe-report.json"), "utf-8"));
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];

const inverse = (seq: string) =>
  seq.split(/\s+/).filter(Boolean).reverse().map((m) => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith("2")) return m;
    return m + "'";
  }).join(" ");

const findPos = (arr: number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};
function identifyPair(s: CubeState): { homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { homeC: 4, homeE: 8 };
}
function outCount(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}

const advancedPats = Object.entries(TAX).filter(([, v]) => !v.f2lnum && v.position !== "solved");
const byPatid = new Map((DEDUPE.cases as any[]).map((c: any) => [c.patid, c]));

let fixed = 0, noLocal = 0, samePair = 0, diffPair = 0;
const noLocalList: string[] = [];
const diffPairList: string[] = [];

for (const [patid, v] of advancedPats as any[]) {
  const d = byPatid.get(patid);
  if (!d) { noLocal++; noLocalList.push(`${patid} (sin dedupe)`); continue; }

  // mejor setup local: mínimo de piezas fuera
  let best: { setup: string; out: number; pair: { homeC: number; homeE: number } } | null = null;
  for (const t of d.top100) {
    try {
      const s = new CubeState();
      s.applySequence(inverse(t.moves));
      const out = outCount(s);
      if (out <= 4) {
        const pair = identifyPair(s);
        if (!best || out < best.out) best = { setup: inverse(t.moves), out, pair };
      }
    } catch { /* skip */ }
  }

  // pareja del setup actual
  let curPair: { homeC: number; homeE: number } | null = null;
  try {
    const sc = new CubeState();
    sc.applySequence(v.setup);
    curPair = identifyPair(sc);
  } catch { /* skip */ }

  if (!best) {
    noLocal++;
    noLocalList.push(`${patid} (setup actual="${v.setup}" fuera=${curPair ? "?" : "?"})`);
    continue;
  }
  fixed++;
  if (curPair && curPair.homeC === best.pair.homeC && curPair.homeE === best.pair.homeE) {
    samePair++;
  } else {
    diffPair++;
    diffPairList.push(`${patid}: actual{p${curPair?.homeC},${curPair?.homeE}} limpio{p${best.pair.homeC},${best.pair.homeE}} out=${best.out}`);
  }
}

console.log(`=== Auditoría setups Advanced (${advancedPats.length}) ===`);
console.log(`Con setup limpio local (<=4 fuera): ${fixed}`);
console.log(`Sin fix local: ${noLocal}`);
console.log(`  Pareja coincide con setup actual: ${samePair}`);
console.log(`  Pareja CAMBIA (el setup actual era otro caso): ${diffPair}`);
if (noLocalList.length) console.log(`\nSin fix local: ${noLocalList.join("; ")}`);
console.log(`\n=== Casos donde la pareja cambia (primeros 15) ===`);
for (const x of diffPairList.slice(0, 15)) console.log(" ", x);
