/**
 * CONSOLIDACIÓN FINAL: une los 155 derivados + 12 construidos en
 * setups-independent-final.json (167 setups limpios) con métricas:
 *  - nOut (piezas F2L fuera del estado)
 *  - matchesQuest (coincide con el estado de quest mod AUF/rotación)
 *  - setupLen
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));
const FINAL12 = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-final12.json"), "utf-8"));

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function f2lEq(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
function rotEq(a: CubeState, b: CubeState): boolean {
  // probar las 24 rotaciones del cubo
  const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
  for (const r of ROTS) {
    const s = a.clone();
    if (r) s.applySequence(r);
    if (f2lEq(s, b)) return true;
  }
  return false;
}
function nOutOf(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (s.cp[i] === c) p = i; if (p !== c) n++; }
  for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (s.ep[i] === e) p = i; if (p !== e) n++; }
  return n;
}

// mapa patid → setup (derivados primero, luego los 12 construidos)
const byPatid: Record<string, string> = {};
for (const r of DERIVED) if (r.setup) byPatid[r.patid] = r.setup;
for (const r of FINAL12) if (r.setup) byPatid[r.patid] = r.setup;

const result: any[] = [];
let clean = 0, matches = 0, total = 0;
for (const [patid, setup] of Object.entries(byPatid)) {
  total++;
  const q = QA[patid.toLowerCase()];
  const S = stateOf(setup);
  const nOut = nOutOf(S);
  const isClean = nOut <= (q?.basic ? 2 : 4);
  if (isClean) clean++;
  const T = q ? stateOf(normQuest(q.setup)) : null;
  const mq = T ? rotEq(S, T) : null;
  if (mq) matches++;
  result.push({
    patid,
    setup,
    setupLen: setup.split(" ").length,
    nOut,
    clean: isClean,
    matchesQuest: mq,
  });
}

writeFileSync(resolve(__dirname, "../generated/setups-independent-final.json"), JSON.stringify(result, null, 1));
console.log(`Total: ${total} setups`);
console.log(`Limpios (out≤4 advanced / ≤2 basic): ${clean}/${total}`);
console.log(`Coinciden con quest (mod rotación): ${matches}/${total}`);
const dirty = result.filter((r) => !r.clean);
if (dirty.length) console.log(`Sucios: ${dirty.map((d) => d.patid).join(", ")}`);
const lens = result.map((r) => r.setupLen);
console.log(`Longitud setup: min ${Math.min(...lens)} / media ${(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1)} / max ${Math.max(...lens)}`);
