import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));

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
function f2lEq(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
function outCount(s: CubeState): number {
  const findPos = (arr: readonly number[], p: number) => { for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i; return -1; };
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}
const F8 = "R F U F R F R U' F' U2 R2";
function buildFlipSeq(q: number): string {
  const candidates: [string, string][] = [["", ""], ["y2", "y2"], ["z2", "z2"], ["y", "y'"], ["y'", "y"], ["z", "z'"], ["z'", "z"], ["x2", "x2"]];
  for (const [c, cinv] of candidates) {
    const seq = [c, F8, cinv].filter(Boolean).join(" ");
    const s = new CubeState();
    try { s.applySequence(seq); } catch { continue; }
    let ok = true;
    for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) ok = false;
    for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== (i === q ? 1 : 0)) ok = false;
    if (ok) return seq;
  }
  return "";
}
const G: Record<number, string> = {};
for (const q of [8, 9, 10, 11]) G[q] = buildFlipSeq(q);
console.log("G[10]:", G[10]);

// algs puros de Ur
const ur = PARSED["Ur"];
const fusedUr = FUSED_A.find((c: any) => c.caseDef.caseNumber === "Ur");
const algs: string[] = [];
if (ur?.algs) algs.push(...ur.algs.map((a: any) => a.moves));
if (fusedUr?.algorithms) algs.push(...fusedUr.algorithms.map((a: any) => (a.moves as string[]).join(" ")));
const pures: { inv: string; len: number }[] = [];
for (const a of algs) {
  try {
    const inv = invertSeq(a);
    if (outCount(stateOf(inv)) <= 4) pures.push({ inv, len: inv.split(" ").filter(Boolean).length });
  } catch { }
}
pures.sort((a, b) => a.len - b.len);
console.log("\nUr: algs", algs.length, "| puros:", pures.length);
console.log("top puros:", pures.slice(0, 8).map((p) => p.inv).join(" | "));

// el setup derivado de Ur en DERIVED
const dUr = DERIVED.find((r: any) => r.patid === "Ur");
console.log("\nsetup derivado de Ur:", dUr?.setup);

// ¿está el setup derivado en la lista de puros?
if (dUr?.setup) {
  const inList = pures.some((p) => p.inv === dUr.setup);
  console.log("¿setup derivado en pures?", inList);
}

// test: cada puro de Ur con G[10] → ¿T_Uh?
const TUh = stateOf(normQuest(QA["uh"].setup));
for (const p of pures.slice(0, 20)) {
  const D = stateOf(p.inv);
  const cand = D.clone();
  cand.applySequence(G[10]);
  if (f2lEq(cand, TUh)) console.log("✅ match (sin rot, flip10):", p.inv);
}
