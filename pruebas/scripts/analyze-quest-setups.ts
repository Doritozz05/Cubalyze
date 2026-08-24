/**
 * ESTUDIO PROFUNDO de los 167 setups de quest.
 *
 * A) Limpieza: ¿cuántas piezas F2L deja fuera cada setup? (básico 2, advanced 3-4)
 * B) Estructura: para advanced, ¿el setup = [trigger] + [limpieza]?
 * C) ¿"Con un alg limpio se crearían iguales"? → inverso del setup de quest = alg
 *    puro. ¿Cuánto mide? ¿Coincide con el inverso de nuestros algs fused puros?
 * D) Comparación con nuestra taxonomía (mod rotación).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8")).cases;
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;

const INV: Record<string, string> = {
  U: "U'", "U'": "U", U2: "U2", R: "R'", "R'": "R", R2: "R2",
  F: "F'", "F'": "F", F2: "F2", D: "D'", "D'": "D", D2: "D2",
  L: "L'", "L'": "L", L2: "L2", B: "B'", "B'": "B", B2: "B2",
  M: "M'", "M'": "M", M2: "M2", E: "E'", "E'": "E", E2: "E2",
  S: "S'", "S'": "S", S2: "S2", x: "x'", "x'": "x", x2: "x2",
  y: "y'", "y'": "y", y2: "y2", z: "z'", "z'": "z", z2: "z2",
  r: "r'", "r'": "r", r2: "r2", l: "l'", "l'": "l", l2: "l2",
  f: "f'", "f'": "f", f2: "f2", b: "b'", "b'": "b", b2: "b2",
  d: "d'", "d'": "d", d2: "d2", u: "u'", "u'": "u", u2: "u2",
};
function invertSeq(m: string): string {
  return m.split(" ").filter(Boolean).reverse().map((x) => INV[x] ?? x).join(" ");
}
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
function outCount(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}
function outList(s: CubeState): string {
  const o: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) o.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) o.push(`E${e}`);
  return o.join("");
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function rot(s: CubeState, r: string): CubeState {
  const t = s.clone();
  if (r) t.applySequence(r);
  return t;
}
function f2lSameUpToRot(a: CubeState, b: CubeState): string | null {
  for (const r of ROTS) {
    const t = rot(a, r);
    let same = true;
    for (let i = 4; i <= 7; i++) if (t.cp[i] !== b.cp[i] || t.co[i] !== b.co[i]) { same = false; break; }
    if (!same) continue;
    for (let i = 8; i <= 11; i++) if (t.ep[i] !== b.ep[i] || t.eo[i] !== b.eo[i]) { same = false; break; }
    if (same) return r || "(sin rot)";
  }
  return null;
}
function pairSolved(s: CubeState, hc: number, he: number): boolean {
  return s.cp[hc] === hc && s.co[hc] === 0 && s.ep[he] === he && s.eo[he] === 0;
}

const slugs = Object.keys(QA).sort();
const basic = slugs.filter((s) => QA[s].basic);
const adv = slugs.filter((s) => !QA[s].basic);

// ── A) Limpieza de los setups ─────────────────────────────────────────────
const cleanBasic = [], cleanAdv = [], dirtyAdv: [string, number, string][] = [];
const lenBasic: number[] = [], lenAdv: number[] = [];
const pureInvLen: number[] = []; // longitud del inverso (alg puro)
for (const s of slugs) {
  const q = QA[s];
  const st = stateOf(q.setup);
  const n = outCount(st);
  const moves = normQuest(q.setup).split(" ").filter(Boolean);
  if (q.basic) { lenBasic.push(moves.length); if (n <= 2) cleanBasic.push(s); }
  else {
    lenAdv.push(moves.length);
    pureInvLen.push(moves.length); // inverso tiene la misma longitud
    if (n <= 4) cleanAdv.push(s); else dirtyAdv.push([s, n, outList(st)]);
  }
}
console.log("═══ A) LIMPIEZA DE LOS SETUPS DE QUEST ═══");
console.log(`básicos: ${basic.length} | setups limpios (≤2 fuera): ${cleanBasic.length}/${basic.length}`);
console.log(`advanced: ${adv.length} | setups limpios (≤4 fuera): ${cleanAdv.length}/${adv.length}`);
console.log(`advanced SUCIOS (>4 fuera): ${dirtyAdv.length}`);
for (const [s, n, o] of dirtyAdv) console.log(`   ${s}: ${n} fuera (${o})`);
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`longitud media setup: básico ${avg(lenBasic)} mov | advanced ${avg(lenAdv)} mov`);
console.log(`→ inverso de setup = alg puro de ${avg(pureInvLen)} mov (advanced)`);

// ── B) Estructura head/tail ───────────────────────────────────────────────
console.log("\n═══ B) ESTRUCTURA (advanced): ¿existe un prefijo que ya crea el caso limpio? ═══");
let prefixCreatesCase = 0;
for (const s of adv.slice(0, 126)) {
  const q = QA[s];
  const moves = normQuest(q.setup).split(" ").filter(Boolean);
  const full = stateOf(q.setup);
  const fullOut = outList(full);
  // buscar el prefijo más corto que deja EXACTAMENTE las mismas piezas fuera (mod rotación)
  let found = false;
  for (let k = Math.max(3, moves.length - 4); k < moves.length; k++) {
    const st = stateOf(moves.slice(0, k).join(" "));
    const o = outList(st);
    if (o === fullOut) { found = true; break; }
    // también probar con rotación
    if (f2lSameUpToRot(st, full)) { found = true; break; }
  }
  if (found) prefixCreatesCase++;
}
console.log(`prefijos que ya crean el caso limpio: ${prefixCreatesCase}/${adv.length}`);

// ── C) ¿Con un alg limpio se crearían iguales? ────────────────────────────
console.log("\n═══ C) NUESTRO SETUP vs SETUP QUEST (mod rotación) ═══");
let taxMatch = 0;
const taxMismatch: string[] = [];
for (const s of adv) {
  const patid = s.charAt(0).toUpperCase() + s.slice(1);
  const ours = TAX[patid];
  if (!ours?.setup) continue;
  const O = stateOf(ours.setup);
  const Q = stateOf(QA[s].setup);
  if (f2lSameUpToRot(O, Q)) taxMatch++; else taxMismatch.push(s);
}
console.log(`nuestra taxonomía coincide con quest (mod rot): ${taxMatch}/${adv.length}`);
console.log(`difieren: ${taxMismatch.slice(0, 20).join(", ")}${taxMismatch.length > 20 ? "…" : ""}`);

// ── D) ¿nuestros algs fused resuelven el setup canónico de quest? ────────
console.log("\n═══ D) NUESTROS ALGS FUSED vs SETUP QUEST (pareja en algún slot) ═══");
let okAll = 0;
const failCases: string[] = [];
for (const s of adv) {
  const patid = s.charAt(0).toUpperCase() + s.slice(1);
  const Q = stateOf(QA[s].setup);
  const fused = FUSED_A.find((c: any) => c.caseDef.caseNumber === patid);
  if (!fused) { continue; }
  let ok = 0;
  for (const a of fused.algorithms as any[]) {
    const t = Q.clone();
    try { t.applySequence((a.moves as string[]).join(" ")); } catch { continue; }
    for (const [hc, he] of [[4, 8], [5, 9], [6, 10], [7, 11]]) if (pairSolved(t, hc, he)) { ok++; break; }
  }
  if (ok > 0) okAll++; else failCases.push(s);
}
console.log(`casos donde ≥1 alg fused resuelve la pareja: ${okAll}/${adv.length}`);
console.log(`sin solve: ${failCases.join(", ") || "ninguno"}`);
