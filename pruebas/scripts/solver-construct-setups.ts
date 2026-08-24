/**
 * SOLVER v3 — IDA* con transposition table (estado completo).
 *
 * Busca X (corto) tal que X(D) tenga el mismo estado F2L que T.
 * setup derivado = D_pre + X (D_pre = inverso de un alg nuestro).
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
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
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
function outPieces(s: CubeState): string[] {
  const o: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) o.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) o.push(`E${e}`);
  return o;
}
function hF2L(s: CubeState, t: CubeState): number {
  let h = 0;
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== t.cp[i] || s.co[i] !== t.co[i]) h++;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== t.ep[i] || s.eo[i] !== t.eo[i]) h++;
  return h;
}
/** clave de estado COMPLETO */
function fullKey(s: CubeState): string {
  let k = "";
  for (let i = 0; i < 8; i++) k += `${s.cp[i]}:${s.co[i]},`;
  for (let i = 0; i < 12; i++) k += `${s.ep[i]}:${s.eo[i]},`;
  return k;
}

const FACES = ["U", "R", "F", "D", "L", "B"];
const MOVES: string[] = [];
for (const f of FACES) for (const t of ["", "'", "2"]) MOVES.push(f + t);
const baseOf = (m: string) => m[0];

let nodes = 0;
let deadline = 0;
let trans: Set<string>;

function dfs(s: CubeState, t: CubeState, g: number, threshold: number, prevFace: string, path: string[]): string[] | null {
  if (Date.now() > deadline) throw new Error("timeout");
  nodes++;
  const h = hF2L(s, t);
  if (h === 0) return path.slice();
  if (g + Math.ceil(h / 2) > threshold) return null;
  if (g >= threshold) return null;
  for (const mv of MOVES) {
    if (baseOf(mv) === prevFace) continue;
    const ns = s.clone();
    ns.applySequence(mv);
    const key = fullKey(ns);
    if (trans.has(key)) continue;
    trans.add(key);
    path.push(mv);
    const res = dfs(ns, t, g + 1, threshold, baseOf(mv), path);
    path.pop();
    if (res) return res;
  }
  return null;
}

function solve(D: CubeState, T: CubeState, maxDepth: number, msLimit: number): string[] | null {
  const h0 = hF2L(D, T);
  if (h0 === 0) return [];
  for (let th = Math.ceil(h0 / 2); th <= maxDepth; th += 2) {
    nodes = 0;
    trans = new Set([fullKey(D)]);
    const res = dfs(D, T, 0, th, "", []);
    if (res) return res;
  }
  return null;
}

const NEEDED = ["Gh", "Hn", "Ht", "Lh", "Oh", "Sf", "Sl", "Th", "Uh", "Ut", "Wh", "Wl"];
const out: any[] = [];
for (const patid of NEEDED) {
  const slug = patid.toLowerCase();
  const q = QA[slug];
  if (!q) { out.push({ patid, status: "sin-quest" }); continue; }
  const T = stateOf(normQuest(q.setup));
  const fused = FUSED_A.find((c: any) => c.caseDef.caseNumber === patid);
  let alg = "";
  if (fused?.algorithms?.length) alg = (fused.algorithms[0].moves as string[]).join(" ");
  else if (PARSED[patid]?.algs?.length) alg = PARSED[patid].algs[0].moves;
  const D = alg ? stateOf(invertSeq(alg)) : new CubeState();
  const pre = alg ? invertSeq(alg) : "";

  console.log(`\n${patid}: IDA* ...`);
  const t0 = Date.now();
  deadline = t0 + 45000;
  let X: string[] | null = null;
  try {
    X = solve(D, T, 16, 45000);
  } catch (e) { /* timeout */ }
  const ms = Date.now() - t0;
  if (!X) { console.log(`  ❌ sin solución (${ms}ms)`); out.push({ patid, status: "no-solve", ms }); continue; }
  const setup = [pre, X.join(" ")].filter(Boolean).join(" ");
  const S = stateOf(setup);
  const ok = hF2L(S, T) === 0;
  const o = outPieces(S);
  console.log(`  ✅ X=${X.join(" ")} (${X.length} mov, ${ms}ms)`);
  console.log(`     setup=${setup}`);
  console.log(`     F2L==T: ${ok} | fuera: ${o.join("") || "-"} (${o.length})`);
  out.push({ patid, status: "constructed", setup, xMoves: X.length, ms, ok, nOut: o.length, outPieces: o });
}
writeFileSync(resolve(__dirname, "../generated/setups-constructed.json"), JSON.stringify(out, null, 1));
console.log(`\nconstruidos: ${out.filter((r) => r.status === "constructed").length}/${NEEDED.length}`);
