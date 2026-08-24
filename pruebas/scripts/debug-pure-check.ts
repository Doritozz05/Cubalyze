/**
 * Debug Fase 3:
 *  1) `R' F2 R F2` aparece como PURE en Jb — ¿de verdad resuelve el par?
 *  2) ¿el chequeo full-F2L es correcto, o hay algs que necesitan AUF distinto?
 *  3) colisión SCDB cross-case (13.922 matches para 372 algs)
 * Uso: pnpm dlx tsx pruebas/scripts/debug-pure-check.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;

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
function stateHash(s: CubeState): string {
  return Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" + Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("");
}
function minOverAufHash(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = stateHash(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

// S_Jb canonico
const algs = PARSED["Jb"].algs;
const tally = new Map<string, { n: number; state: CubeState }>();
for (const a of algs) {
  const s = new CubeState();
  try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
  const k = pairPos(s);
  const t = tally.get(k);
  if (t) t.n++; else tally.set(k, { n: 1, state: s });
}
let bestN = 0; let JbS: CubeState | null = null;
for (const t of tally.values()) if (t.n > bestN) { bestN = t.n; JbS = t.state; }
console.log(`S_Jb canonico: ${bestN}/${algs.length} | par ${[...tally.entries()].sort((a, b) => b[1].n - a[1].n)[0][0]}`);

// 1) R' F2 R F2
for (const full of ["R' F2 R F2", "U R U' R2 U R", "U R U' R'", "R U R' U' R U R'"]) {
  const st = JbS!.clone();
  try { st.applySequence(full); } catch (e) { console.log(`${full}: ERR ${e}`); continue; }
  const f2l = f2lSolved(st);
  console.log(`\n${full}: f2lSolved=${f2l}`);
  if (!f2l) {
    console.log(`  cp=[${Array.from(st.cp).join(",")}] co=[${Array.from(st.co).join(",")}]`);
    console.log(`  ep=[${Array.from(st.ep).join(",")}] eo=[${Array.from(st.eo).join(",")}]`);
    // que piezas estan en F2L? LL en F2L?
    const llInF2L: string[] = [];
    for (let i = 4; i <= 7; i++) if (st.cp[i] > 7) llInF2L.push(`c${i}=${st.cp[i]}`);
    for (let i = 4; i <= 11; i++) if (st.ep[i] > 11) llInF2L.push(`e${i}=${st.ep[i]}`);
    console.log(`  piezas LL en posiciones F2L: ${llInF2L.join(" ") || "ninguna"}`);
  }
}

// 2) hipótesis AUF-reference: algs con inverso isFRCase-limpio pero que fallan en S_Jb
//    -> ¿funcionan con prefijo U?
console.log(`\n=== hipotesis AUF-reference ===`);
let cleanInverse = 0, cleanFails = 0, fixedWithAuf = 0;
for (const a of algs) {
  const s = new CubeState();
  try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
  // isFRCase: posiciones no-FR solo piezas F2L
  let ok = true;
  for (const i of [5, 6, 7]) if (s.cp[i] < 4 || s.cp[i] > 7) { ok = false; break; }
  if (ok) for (const i of [9, 10, 11]) if (s.ep[i] < 8 || s.ep[i] > 11) { ok = false; break; }
  if (ok) for (const i of [4, 5, 6, 7]) if (s.ep[i] < 4 || s.ep[i] > 7) { ok = false; break; }
  if (!ok) continue;
  cleanInverse++;
  const r = JbS!.clone();
  r.applySequence(a.moves);
  if (!f2lSolved(r)) {
    cleanFails++;
    // probar con AUF: (U^k A)
    let fixed = false;
    for (const pre of ["U", "U2", "U'"]) {
      const r2 = JbS!.clone();
      r2.applySequence(pre + " " + a.moves);
      if (f2lSolved(r2)) { fixed = true; break; }
    }
    if (fixed) fixedWithAuf++;
  }
}
console.log(`inversos isFRCase-limpios: ${cleanInverse} | fallan en S_Jb: ${cleanFails} | se arreglan con AUF prefijo: ${fixedWithAuf}`);
