/**
 * Test decisivo: el espejo de Jb ¿es Mi?
 * Si mirror(S_Jb) = S_Mi (mod rotaciones), entonces el alg principal de Mi
 * debe resolver el estado reflejado de Jb (deja el F2L completo resuelto).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;

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

// estado canónico por voto mayoritario de la firma del par
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

// espejo x=y (plano diagonal que fija el slot FR: R<->F, L<->B)
// Regla de EO: una arista que CRUZA el plano del espejo (emap[j] !== j) invierte
// su orientacion; una que queda en el plano (emap[j] === j) la conserva.
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

function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function frPairSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}

function topAlg(patid: string, n = 5): { moves: string; speed: number }[] {
  return [...PARSED[patid].algs].sort((a, b) => a.speed - b.speed).slice(0, n);
}

console.log("=== algs top de Jb y Mi ===");
for (const a of topAlg("Jb")) console.log(`  Jb ${a.speed.toFixed(2)} ${a.moves}`);
console.log("");
for (const a of topAlg("Mi")) console.log(`  Mi ${a.speed.toFixed(2)} ${a.moves}`);

// Test 1: alg de Mi resuelve el espejo de Jb?
console.log("\n=== Test 1: algs de Mi sobre mirror(Jb) ===");
const mJb = reflect(canon.get("Jb")!);
for (const a of topAlg("Mi")) {
  const t = mJb.clone();
  t.applySequence(a.moves);
  console.log(`  ${a.moves}: f2l=${f2lSolved(t)} frPair=${frPairSolved(t)}`);
}

// Test 2: alg de Jb resuelve el espejo de Mi?
console.log("\n=== Test 2: algs de Jb sobre mirror(Mi) ===");
const mMi = reflect(canon.get("Mi")!);
for (const a of topAlg("Jb")) {
  const t = mMi.clone();
  t.applySequence(a.moves);
  console.log(`  ${a.moves}: f2l=${f2lSolved(t)} frPair=${frPairSolved(t)}`);
}

// Test 3: ¿el espejo del estado es un estado valido del cubo?
console.log("\n=== Test 3: validez (las piezas se mapean 1:1) ===");
for (const p of ["Jb", "Mi"]) {
  const m = reflect(canon.get(p)!);
  const cps = new Set<number>(); for (let i = 0; i < 8; i++) cps.add(m.cp[i]);
  const eps = new Set<number>(); for (let i = 0; i < 12; i++) eps.add(m.ep[i]);
  console.log(`  mirror(${p}): corners=${cps.size}/8 edges=${eps.size}/12`);
}
