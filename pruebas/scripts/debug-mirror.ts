/**
 * Debug: por qué el espejo mapea Jb -> Vj en vez de Jb -> Mi.
 * Compara reflect(Jb) contra los estados canónicos de Mi y Vj.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string }[] }>;

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

const canon = new Map<string, CubeState>();
for (const patid of Object.keys(PARSED)) {
  const tally = new Map<string, number>();
  const byKey = new Map<string, string>();
  for (const a of PARSED[patid].algs) {
    const s = new CubeState();
    try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
    // fingerprint solo de las piezas del par
    let c = -1, co = -1, e = -1, eo = -1;
    for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; co = s.co[i]; break; }
    for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eo = s.eo[i]; break; }
    const k = `${c}${co}|${e}${eo}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
    byKey.set(k, a.moves);
  }
  let bestK = ""; let bestN = 0;
  for (const [k, n] of tally) if (n > bestN) { bestN = n; bestK = k; }
  if (bestK) {
    const s = new CubeState();
    s.applySequence(invertSequence(byKey.get(bestK)!));
    canon.set(patid, s);
  }
}

function caseFp(s: CubeState): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) if (s.cp[i] >= 4) parts.push(`c${s.cp[i]}@${i}${s.co[i]}`);
  for (let i = 0; i < 12; i++) if (s.ep[i] >= 4) parts.push(`e${s.ep[i]}@${i}${s.eo[i]}`);
  return parts.sort().join(",");
}
function minOverAufFp(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = caseFp(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
function pairInfo(s: CubeState): string {
  let c = -1, co = -1, e = -1, eo = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; co = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eo = s.eo[i]; break; }
  return `corner#${c}(co${co}) edge#${e}(eo${eo})`;
}

const REFLECTIONS: Record<string, { cmap: number[]; emap: number[] }> = {
  "x=y": { cmap: [0, 3, 2, 1, 4, 7, 5, 6], emap: [1, 0, 3, 2, 5, 4, 7, 6, 8, 11, 10, 9] },
  "y=-x": { cmap: [2, 1, 0, 3, 6, 5, 4, 7], emap: [2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9] },
  "R-L": { cmap: [1, 0, 3, 2, 5, 4, 7, 6], emap: [2, 3, 0, 1, 6, 7, 4, 5, 9, 8, 11, 10] },
  "F-B": { cmap: [3, 2, 1, 0, 7, 6, 5, 4], emap: [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8] },
};
function reflect(s: CubeState, cmap: number[], emap: number[], flipEo: boolean): CubeState {
  // Espejo real: transforma posicion Y pieza: cp[cmap[i]] = cmap[s.cp[i]].
  const cp = new Uint8Array(8), co = new Uint8Array(8);
  const ep = new Uint8Array(12), eo = new Uint8Array(12);
  for (let i = 0; i < 8; i++) {
    cp[cmap[i]] = cmap[s.cp[i]];
    const c = s.co[i];
    co[cmap[i]] = c === 1 ? 2 : c === 2 ? 1 : 0;
  }
  for (let i = 0; i < 12; i++) {
    ep[emap[i]] = emap[s.ep[i]];
    eo[emap[i]] = flipEo ? ((1 - s.eo[i]) as 0 | 1) : s.eo[i];
  }
  return new CubeState(cp, co, ep, eo);
}

for (const p of ["Jb", "Mi", "Vj", "Je", "Ma"]) {
  const S = canon.get(p);
  if (!S) { console.log(`${p}: NO canon`); continue; }
  console.log(`${p}: par en ${pairInfo(S)} | fp = ${minOverAufFp(S)}`);
}
console.log("");
const jb = canon.get("Jb")!;
const mi = canon.get("Mi")!;
const vj = canon.get("Vj")!;
const miFp = minOverAufFp(mi);
const vjFp = minOverAufFp(vj);
console.log(`Mi fp = ${miFp}`);
console.log(`Vj fp = ${vjFp}`);
console.log(`\n=== reflect(Jb) por config ===`);
for (const [name, { cmap, emap }] of Object.entries(REFLECTIONS)) {
  for (const flip of [false, true]) {
    const M = reflect(jb, cmap, emap, flip);
    const fp = minOverAufFp(M);
    const match = fp === miFp ? "== Mi" : fp === vjFp ? "== Vj" : "??";
    console.log(`${name} flip=${flip}: fp=${fp.slice(0, 60)}... ${match} | par en ${pairInfo(M)}`);
  }
}
