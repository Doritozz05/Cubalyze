/**
 * Buscar la rotacion de cubo R (de las 24) tal que R(mirror_x=y(setup Jb)) == setup Mi
 * (estado COMPLETO, todas las piezas y orientaciones). Si existe, la transformacion
 * de espejo en BirdF2L es: espejo x=y + rotacion de cubo.
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

const CMAP = [0, 3, 2, 1, 4, 7, 5, 6];
const EMAP = [1, 0, 3, 2, 5, 4, 7, 6, 8, 11, 10, 9];
function reflect(s: CubeState): CubeState {
  const cp = new Uint8Array(8), co = new Uint8Array(8);
  const ep = new Uint8Array(12), eo = new Uint8Array(12);
  for (let i = 0; i < 8; i++) {
    cp[CMAP[i]] = CMAP[s.cp[i]];
    const c = s.co[i];
    co[CMAP[i]] = c === 1 ? 2 : c === 2 ? 1 : 0;
  }
  for (let i = 0; i < 12; i++) {
    ep[EMAP[i]] = EMAP[s.ep[i]];
    eo[EMAP[i]] = EMAP[i] !== i ? (1 - s.eo[i]) as 0 | 1 : s.eo[i];
  }
  return new CubeState(cp, co, ep, eo);
}

function stateHash(s: CubeState): string {
  return Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" +
    Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("");
}
function sameState(a: CubeState, b: CubeState): boolean {
  return stateHash(a) === stateHash(b);
}

// las 24 rotaciones de cubo: secuencias de x/y/z
const ROT_SEQS: string[] = [];
{
  const xs = ["", "x", "x2", "x'"];
  const ys = ["", "y", "y2", "y'"];
  const zs = ["", "z", "z2", "z'"];
  // generamos todas las combinaciones x^a y^b z^c (24 unicas)
  for (const a of xs) for (const b of ys) for (const c of zs) {
    const seq = [a, b, c].filter(Boolean).join(" ");
    if (!seq) continue;
    ROT_SEQS.push(seq);
  }
  // dedupe por hash del estado tras aplicar la rotacion al solved
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const seq of ROT_SEQS) {
    const s = new CubeState();
    s.applySequence(seq);
    const h = stateHash(s);
    if (!seen.has(h)) { seen.add(h); uniq.push(seq); }
  }
  ROT_SEQS.length = 0;
  ROT_SEQS.push(...uniq);
}
console.log(`rotaciones unicas de cubo: ${ROT_SEQS.length}`);

const jb = canon.get("Jb")!;
const mi = canon.get("Mi")!;
const mJb = reflect(jb);

console.log("\nsetup Jb : " + stateHash(jb).slice(0, 60));
console.log("setup Mi : " + stateHash(mi).slice(0, 60));
console.log("mirror(Jb): " + stateHash(mJb).slice(0, 60));

console.log("\n=== buscar R tal que R(mirror(Jb)) == Mi ===");
let found = 0;
for (const seq of ROT_SEQS) {
  const t = mJb.clone();
  t.applySequence(seq);
  if (sameState(t, mi)) {
    console.log(`  COINCIDENCIA EXACTA: R = ${seq}`);
    found++;
  }
}
if (!found) {
  // nivel 2: permitir que difieran en AUF (rotacion U de la capa superior)
  console.log("\n(sin coincidencia exacta — probando con AUF libre en el target)");
  for (const seq of ROT_SEQS) {
    const t = mJb.clone();
    t.applySequence(seq);
    for (let u = 0; u < 4; u++) {
      if (sameState(t, mi)) { console.log(`  COINCIDE con AUF: R=${seq} U^${u}`); found++; break; }
      t.applySequence("U");
    }
  }
}
if (!found) {
  console.log("Ninguna rotacion mapea mirror(Jb) -> Mi exactamente.");
  console.log("Probamos al reves: rotaciones de Mi y comparar con mirror(Jb)...");
  for (const seq of ROT_SEQS) {
    const t = mi.clone();
    t.applySequence(seq);
    for (let u = 0; u < 4; u++) {
      if (sameState(t, mJb)) { console.log(`  REVERSO: R=${seq} U^${u}`); found++; break; }
      t.applySequence("U");
    }
  }
}
