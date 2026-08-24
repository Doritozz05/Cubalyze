/**
 * Verificación del modelo de slots (la pregunta del usuario):
 * "¿cada rotación es un caso en BirdF2L o es el mismo caso rotado?"
 *
 * Metodo:
 *  1. De los datos: para cada patron, su estado canonico = A^-1(solved) con A =
 *     su alg principal -> anota en que posiciones quedan las piezas del par FR
 *     (esquina pieza 4, arista pieza 8). Eso da el mapa posiciones -> patid.
 *  2. Estado Jb = setup "F R' F' R" (el mismo setup que usa quest).
 *  3. Rotar Jb por y / y2 / y' -> ver en que patron aterriza el par (mapa).
 *  4. Cruzar con los algs por slot del seed SCDB (U R U' R' / U L U' L' / ...).
 *
 * Uso: pnpm dlx tsx scripts/verify-rotation-model.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as Record<string, { algs: { moves: string }[] }>;

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

/** posiciones+orientaciones (indice Kociemba) donde estan las piezas del par FR (esquina 4, arista 8) */
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}

function frSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}

const patids = Object.keys(data).sort();

// 1) Mapa posiciones(+orientacion) -> patid. Estado por pagina = voto mayoritario
//    de las posiciones del par en A^-1(solved) sobre TODOS los algs de la pagina
//    (mas robusto que usar solo el primer alg, que puede llevar AUF de offset).
const posToPatid = new Map<string, string>();
const tallyByPage = new Map<string, Map<string, number>>();
for (const patid of patids) {
  const tally = new Map<string, number>();
  for (const a of data[patid].algs) {
    let s: CubeState;
    try { s = new CubeState(); s.applySequence(invertSequence(a.moves)); } catch { continue; }
    const key = pairPos(s);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  tallyByPage.set(patid, tally);
  let best = "", bestN = 0;
  for (const [k, v] of tally) if (v > bestN) { best = k; bestN = v; }
  if (best) posToPatid.set(best, patid);
}
console.log(`Mapa posiciones+orientacion -> patid: ${posToPatid.size} de ${patids.length} patrones`);
const allTuples = new Set<string>();
for (const p of patids) for (const k of tallyByPage.get(p)!.keys()) allTuples.add(k);
console.log(`Tuplas distintas en total (con AUF-offset): ${allTuples.size}`);
console.log(`(esquinas 0=URF 1=UFL 2=ULB 3=UBR 4=DFR 5=DLF 6=DBL 7=DRB | aristas 0=UR 1=UF 2=UL 3=UB 4=DR 5=DF 6=DL 7=DB 8=FR 9=FL 10=BL 11=BR)\n`);

// 2) Jb
const jb = new CubeState();
jb.applySequence("F R' F' R");
console.log(`Jb = "F R' F' R" (setup de quest): par en ${pairPos(jb)} -> patid ${posToPatid.get(pairPos(jb))}`);// 3) Rotaciones de Jb
console.log(`\n=== ROTACIONES de Jb (misma situacion, otro slot) ===`);
const missing: string[] = [];
for (const r of ["y", "y2", "y'"]) {
  const s = jb.clone();
  try { s.applySequence(r); } catch (e) { console.log(`${r}: no soportado (${e})`); continue; }
  const key = pairPos(s);
  const patid = posToPatid.get(key) ?? "??";
  let solves = "n/a";
  if (posToPatid.has(key)) {
    const main = data[patid].algs[0].moves;
    const t = s.clone();
    t.applySequence(main);
    solves = frSolved(t) ? `SI (${main})` : `NO`;
  } else {
    missing.push(`${r}:${key}`);
  }
  console.log(`  ${r}(Jb): par en ${key} -> patron ${patid} | alg principal del patron resuelve el estado rotado: ${solves}`);
}
if (missing.length) console.log(`\n  !!! rotaciones SIN patron en BirdF2L: ${missing.join("  ")}`);

// 3c) Los patrones cuyo par esta en esquinas de arriba (los 'both on top')
console.log(`\n=== Patrones con par en esquinas de arriba ===`);
const topRows: [string, string][] = [];
for (const p of patids) {
  const tally = tallyByPage.get(p)!;
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const c = Number(best.split("|")[0].charAt(0));
  if (!Number.isNaN(c) && c <= 3) topRows.push([p, best]);
}
console.log(`patrones con par en esquina de arriba: ${topRows.length}`);
for (const [p, t] of topRows) console.log(`  ${p}: par en ${t}`);


// y la comprobacion directa: el alg rotado esta en el HTML de quest
console.log(`\n=== Cruce con algs por slot del seed SCDB (F2L 1) ===`);
const targets: [string, string][] = [
  ["FR", "U R U' R'"],
  ["FL", "U F U' F'"],
  ["BL", "U L U' L'"],
  ["BR", "U B U' B'"],
];
for (const [slot, alg] of targets) {
  const hits = patids.filter((p) => data[p].algs.some((a) => a.moves === alg));
  console.log(`  F2L 1 ${slot} "${alg}": en ${hits.length} paginas BirdF2L -> ${hits.join(", ") || "(ninguna)"}`);
}

// 4) Los patrones vecinos: su alg mas usado (primero = mas uso)
console.log(`\n=== Jb vs Mi (espejo): primer alg (mas usado) ===`);
for (const p of ["Jb", "Mi"]) {
  const top = data[p].algs.slice(0, 3);
  console.log(`  ${p}: ${top.map((a) => `${a.moves} (speed ${a.speed})`).join(" | ")}`);
}
