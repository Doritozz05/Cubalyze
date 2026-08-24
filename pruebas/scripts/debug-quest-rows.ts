/**
 * Debug de la comparación quest (Jb):
 *  1) las 5 filas "no-solver" — ¿resuelven Jb realmente?
 *  2) por qué solo 25/59 filas están literalmente en parsed (slices/wide/reco?)
 * Uso: pnpm dlx tsx pruebas/scripts/debug-quest-rows.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8")) as Record<string, { algs: { moves: string }[] }>;
const QUEST = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/jb-data.json"), "utf-8")) as any;

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
const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
function frSolved(s: CubeState): boolean { return slotOk(s, SLOTS.FR); }
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

// estado canónico Jb
const algs = PARSED["Jb"].algs;
const tally = new Map<string, { n: number; state: CubeState }>();
for (const a of algs) {
  const s = new CubeState();
  try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
  let c = -1, e = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; break; }
  const k = `${c}|${e}`;
  const t = tally.get(k);
  if (t) t.n++; else tally.set(k, { n: 1, state: s });
}
let bestN = 0; let JbS: CubeState | null = null;
for (const t of tally.values()) if (t.n > bestN) { bestN = t.n; JbS = t.state; }
console.log(`Jb canonical: ${bestN}/${algs.length} algs soportan la firma`);

// 1) no-solvers
const rows = QUEST.rows.a as any[];
const noSolvers = [
  "R' F R y' R'", "U R U' y F'", "U y R2 R2 F U' F'", "U y' R' F' U' F R", "R' y r U r'",
];
for (const full of noSolvers) {
  const st = JbS!.clone();
  try { st.applySequence(full); } catch (e) { console.log(`${full}: parse error ${e}`); continue; }
  const fr = frSolved(st);
  const f2l = f2lSolved(st);
  const cp = Array.from(st.cp).slice(0, 8).join(",");
  const co = Array.from(st.co).join(",");
  const ep = Array.from(st.ep).join(",");
  const eo = Array.from(st.eo).join(",");
  console.log(`\n${full}: frSolved=${fr} f2lSolved=${f2l}`);
  console.log(`  cp=[${cp}] co=[${co}]`);
  console.log(`  ep=[${ep}] eo=[${eo}]`);
}

// 2) hits por texto: clasificar por algid scdb/reco y por normalizacion de slices
console.log(`\n=== hits en parsed por tipo de algid ===`);
const parsedJb = new Set(algs.map((a) => a.moves));
let scdbN = 0, scdbHit = 0, recoN = 0, recoHit = 0;
for (const r of rows) {
  const full = (r.auf ? r.auf + " " : "") + r.alg;
  const isReco = (r.algid ?? "").startsWith("reco:");
  if (isReco) recoN++; else scdbN++;
  if (parsedJb.has(full)) { if (isReco) recoHit++; else scdbHit++; }
}
console.log(`scdb: ${scdbHit}/${scdbN} | reco: ${recoHit}/${recoN}`);

// ejemplos de miss con su algid
let shown = 0;
for (const r of rows) {
  const full = (r.auf ? r.auf + " " : "") + r.alg;
  if (!parsedJb.has(full) && shown < 10) {
    console.log(`  MISS ${full.padEnd(26)} algid=${r.algid}`);
    shown++;
  }
}
