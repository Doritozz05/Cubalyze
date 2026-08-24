/**
 * CLEANUP SOLVER: transformar estado S (puro derivado) → T (canónico quest).
 * Ambos limpios (≤4 fuera); difieren en 3-ciclos cortos.
 * IDA* con transposición y poda por heurística.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
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
function hF2L(s: CubeState, t: CubeState): number {
  let h = 0;
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== t.cp[i] || s.co[i] !== t.co[i]) h++;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== t.ep[i] || s.eo[i] !== t.eo[i]) h++;
  return h;
}
function fullKey(s: CubeState): string {
  let k = "";
  for (let i = 0; i < 8; i++) k += `${s.cp[i]}:${s.co[i]},`;
  for (let i = 0; i < 12; i++) k += `${s.ep[i]}:${s.eo[i]},`;
  return k;
}
function outCount(s: CubeState): number {
  const findPos = (arr: readonly number[], p: number) => { for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i; return -1; };
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}
const FACES = ["U", "R", "F", "D", "L", "B"];
const MOVES: string[] = [];
for (const f of FACES) for (const t of ["", "'", "2"]) MOVES.push(f + t);
const baseOf = (m: string) => m[0];

let nodes = 0;
let deadline = 0;
function dfs(s: CubeState, t: CubeState, g: number, threshold: number, prevFace: string, path: string[], trans: Set<string>): string[] | null {
  if (Date.now() > deadline) throw new Error("timeout");
  nodes++;
  const h = hF2L(s, t);
  if (h === 0) return path.slice();
  if (g + Math.ceil(h / 2) > threshold) return null;
  for (const mv of MOVES) {
    if (baseOf(mv) === prevFace) continue;
    const ns = s.clone();
    ns.applySequence(mv);
    const key = fullKey(ns);
    if (trans.has(key)) continue;
    trans.add(key);
    path.push(mv);
    const res = dfs(ns, t, g + 1, threshold, baseOf(mv), path, trans);
    path.pop();
    if (res) return res;
  }
  return null;
}
function solve(S: CubeState, T: CubeState, maxDepth: number, msLimit: number): string[] | null {
  const h0 = hF2L(S, T);
  if (h0 === 0) return [];
  for (let th = Math.ceil(h0 / 2); th <= maxDepth; th += 2) {
    nodes = 0;
    const trans = new Set<string>([fullKey(S)]);
    const res = dfs(S, T, 0, th, "", [], trans);
    if (res) return res;
  }
  return null;
}

// GH: S_Gr → T_Gr  (prueba)
const grSetup = "L' U' F2 L F2 U L"; // setup derivado de Gr
const S = stateOf(grSetup);
const T = stateOf(normQuest(QA["gr"].setup));
console.log("Gh test: S (Gr derivado) → T (Gr quest)");
console.log("h0:", hF2L(S, T), "| S fuera:", outCount(S), "| T fuera:", outCount(T));
deadline = Date.now() + 60000;
try {
  const X = solve(S, T, 16, 60000);
  if (X) {
    console.log("✅ cleanup:", X.join(" "), `(${X.length} mov)`);
    const full = [grSetup, X.join(" ")].filter(Boolean).join(" ");
    const final = stateOf(full);
    console.log("setup completo:", full);
    console.log("F2L == T_Gr:", hF2L(final, T) === 0, "| fuera:", outCount(final));
  } else console.log("❌ sin solución");
} catch (e) { console.log("⏱ timeout"); }
