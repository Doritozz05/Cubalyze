/**
 * Verificación EXACTA de la página de quest "Jb / F2L 2" (pegada por el usuario,
 * setup "B' R B R'", 19 algs con votos) contra nuestros datos:
 *   - parsed.json        (BirdF2L: speeds/stm/htm por alg)
 *   - f2l-taxonomy.json  (casos: setup, f2lnum, mirror, aNum, posición)
 *   - seed SCDB          (cfop-f2l.ts: setups + votos)
 * Y validación del modelo de 4 slots (FR/FL/BL/BR) para TODOS los casos.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/verify-quest-jb-f2l2.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const QUEST = resolve(__dirname, "../raw/quest");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<
  string,
  { algs: { moves: string; speed: number; stm?: number; htm?: number }[] }
>;
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string,
  { setup: string; f2lnum: string | null; aNum: string | null; mirror: string | null; position: string }
>;

const patids = Object.keys(PARSED).sort();

// ---------- helpers ----------
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
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function frSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}
function tryApply(s: CubeState, seq: string): boolean {
  try { s.applySequence(seq); return true; } catch { return false; }
}
/** huella solo-F2L (piezas F2L: esquinas id>=4, aristas id>=4) normalizada por AUF */
function f2lFp(s: CubeState): string {
  const best: string[] = [];
  for (let k = 0; k < 4; k++) {
    const t = s.clone();
    if (k > 0) t.applySequence(k === 1 ? "U" : k === 2 ? "U2" : "U'");
    const pieces: string[] = [];
    for (let i = 0; i < 8; i++) if (t.cp[i] >= 4) pieces.push(`c${i}${t.co[i]}p${t.cp[i]}`);
    for (let i = 0; i < 12; i++) if (t.ep[i] >= 4) pieces.push(`e${i}${t.eo[i]}p${t.ep[i]}`);
    pieces.sort();
    best.push(pieces.join(","));
  }
  best.sort();
  return best[0];
}

// ---------- estados canónicos por patrón (inverso del alg top por speed) ----------
const canon = new Map<string, CubeState>();
for (const p of patids) {
  const algs = PARSED[p].algs;
  const top = [...algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const S = new CubeState();
  if (tryApply(S, invertSequence(top.moves))) canon.set(p, S);
}
const fpOf = new Map<string, string>();
for (const [p, S] of canon) fpOf.set(p, f2lFp(S));

/** clasifica un estado: (patrón, rotación y^k que lo lleva a FR canónico) */
function classify(s: CubeState): { patid: string; rot: string } | null {
  for (const r of ["", "y", "y2", "y'"]) {
    const t = s.clone();
    if (r && !tryApply(t, r)) continue;
    const fp = f2lFp(t);
    for (const [p, fp2] of fpOf) if (fp === fp2) return { patid: p, rot: r };
  }
  return null;
}

// ---------- 1) Los dos setups de quest ----------
console.log("=== 1) CLASIFICACIÓN DE LOS SETUPS DE QUEST ===");
for (const [name, setup] of [["Jb/F2L 1 (pag.1) 'F R' F' R'", "F R' F' R"], ["Jb/F2L 2 (pag.2) 'B' R B R'", "B' R B R'"], ["nuestro canon Jb 'R U R' U'", "R U R' U'"], ["nuestro canon Mi 'F' U' F U'", "F' U' F U"]]) {
  const s = new CubeState();
  if (!tryApply(s, setup)) { console.log(`  ${name}: setup NO parseable`); continue; }
  const cl = classify(s);
  const jb = new CubeState(); jb.applySequence("F R' F' R");
  console.log(`  ${name}: par en ${pairPos(s)} -> ${cl ? `patrón ${cl.patid} (rot ${cl.rot || "id"})` : "SIN MATCH"} | igual a Jb(F2L1): ${f2lFp(s) === f2lFp(jb) ? "SI" : "no"}`);
}
console.log(`  (Jb canónico = ${TAX.Jb.f2lnum} ${TAX.Jb.position} · mirror ${TAX.Jb.mirror} · Mi = ${TAX.Mi.f2lnum})`);

// ---------- 2) Comparación alg a alg de la página 2 ----------
console.log("\n=== 2) LOS 19 ALGS DE LA PAGINA 'Jb / F2L 2' vs NUESTROS DATOS ===");
const S2 = new CubeState(); S2.applySequence("B' R B R'");
const QUEST2: [string, number, number][] = [
  ["U' R' U R", 5954, 58],
  ["U2 R' U2 R", 1645, 6],
  ["U' R' U' R U R' U R", 15, 0],
  ["R B' R' B", 5, 0],
  ["U2 R' U R U' R' U2 R", 5, 0],
  ["R f' U' f", 4, 4],
  ["U2 R' U2 F R F'", 4, 0],
  ["U' l' B l", 2, 0],
  ["l U' l' B", 2, 0],
  ["U' R' F' U F R", 2, 0],
  ["U' R' U' R U2 R B' R' B", 1, 0],
  ["U' S' R' U R S", 1, 0],
  ["R y' r' U' r", 1, 0],
  ["U2 l' B2 l", 1, 0],
  ["U' R U' R' U' R U' R'", 1, 0],
  ["U2 R' U2 y F", 1, 0],
  ["U' R' U R r U' r' F", 1, 0],
  ["U' L' U L", 1, 0],
];
// fila plegada "U2 · Mi ×8 · 34" — la dejo fuera (no hay alg único en el paste)

const inParsed = new Map<string, { p: string; rank: number; n: number; speed: number }[]>();
for (const p of patids) {
  const sorted = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed);
  sorted.forEach((a, i) => {
    const arr = inParsed.get(a.moves) ?? [];
    arr.push({ p, rank: i + 1, n: sorted.length, speed: a.speed });
    inParsed.set(a.moves, arr);
  });
}

console.log("  alg | usa(quest) | resuelve S2? | resultado | en parsed.json | speed/rank");
for (const [alg, uses, other] of QUEST2) {
  const t = S2.clone();
  const ok = tryApply(t, alg);
  let cls = "ERR";
  if (ok) cls = f2lSolved(t) ? "F2L COMPLETO (puro)" : frSolved(t) ? "FR ok" : `deja patrón ${classify(t)?.patid ?? "??"}`;
  const hits = inParsed.get(alg);
  const hStr = hits ? hits.map((h) => `${h.p}#${h.rank}/${h.n} speed ${h.speed}`).join(" | ") : "(no está en BirdF2L)";
  console.log(`  ${alg.padEnd(28)} ${String(uses).padStart(5)} | ${cls.padEnd(28)} | ${hStr}`);
}
// las filas plegadas de la pagina 1 (referencia): estan en nuestra data?
console.log("\n  (fila plegada pag.2: 'U2' → Mi ×8, 34 usos — 8 algs que reducen Jb→Mi, no hay alg único)");

// ---------- 3) Cruzar con la pagina 1 (jb-data.json) ----------
console.log("\n=== 3) jb-data.json (pagina 1) — estructura de slots ===");
try {
  const jb = JSON.parse(readFileSync(resolve(QUEST, "jb-data.json"), "utf-8"));
  console.log("  claves:", Object.keys(jb).join(", "));
  const rows = jb.rows ?? jb;
  console.log("  rows:", JSON.stringify(rows).slice(0, 400));
  const usesBy = jb.usesBy;
  if (Array.isArray(usesBy)) console.log("  usesBy[4] (FR,FL,BL,BR?):", JSON.stringify(usesBy));
} catch (e) {
  console.log("  (sin jb-data.json:", (e as Error).message, ")");
}

// ---------- 4) Modelo de slots: top-3 algs de la pagina 2 en los 4 slots ----------
console.log("\n=== 4) MODELO DE 4 SLOTS (FR/FL/BL/BR) para el top-3 de la pagina 2 ===");
// caso en slot S (r: FR->S): r=id, y' (FL), y2 (BL), y (BR); resolver = r^-1 A r
const SLOTS: [string, string, string][] = [
  ["FR", "", ""],
  ["FL", "y'", "y"],
  ["BL", "y2", "y2"],
  ["BR", "y", "y'"],
];
for (const alg of ["U' R' U R", "U2 R' U2 R", "R B' R' B"]) {
  const parts: string[] = [];
  for (const [slot, r, rInv] of SLOTS) {
    const t = S2.clone();
    if (r && !tryApply(t, r)) { parts.push(`${slot}:ERR(rot)`); continue; }
    const seq = rInv ? `${rInv} ${alg} ${r}` : alg;
    const ok = tryApply(t, seq);
    parts.push(`${slot}:${ok && f2lSolved(t) ? "OK" : "FALLA"}`);
  }
  console.log(`  "${alg}" -> ${parts.join("  ")}`);
}

// ---------- 5) Validación 4 slots para TODOS los casos (top alg por speed) ----------
console.log("\n=== 5) 4 SLOTS PARA LOS 168 CASOS (top alg por speed, conjugado por rotación) ===");
let fail = 0, checked = 0;
const failList: string[] = [];
for (const p of patids) {
  const S = canon.get(p);
  if (!S) continue;
  const top = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const a = top.moves;
  for (const [slot, r, rInv] of SLOTS) {
    checked++;
    const t = S.clone();
    if (r && !tryApply(t, r)) { fail++; failList.push(`${p} ${slot}: rot no soportada`); continue; }
    const seq = rInv ? `${rInv} ${a} ${r}` : a;
    if (!tryApply(t, seq) || !f2lSolved(t)) { fail++; failList.push(`${p} ${slot}: ${a}`); }
  }
}
console.log(`  ${checked} comprobaciones (168 casos × 4 slots) | fallos: ${fail}`);
if (failList.length) console.log("  fallos:", failList.slice(0, 20).join(" | "));

// ---------- 6) Los top-3 por speed de Jb y Mi + presencia de los algs de quest ----------
console.log("\n=== 6) TOP-5 POR SPEED de Jb y Mi (nuestra data) ===");
for (const p of ["Jb", "Mi"]) {
  const tops = [...PARSED[p].algs].sort((x, y) => x.speed - y.speed).slice(0, 5);
  console.log(`  ${p} (${TAX[p].f2lnum}, mirror ${TAX[p].mirror}):`);
  for (const a of tops) console.log(`    speed ${a.speed} · ${a.moves}`);
}
console.log("\n== FIN ==");
