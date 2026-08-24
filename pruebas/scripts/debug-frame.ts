import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const DERIVED = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent.json"), "utf-8"));
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function f2lEq(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
function findPos(arr: readonly number[], p: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === p) return i;
  return -1;
}
const CN = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DBR"];
const EN = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

const gr = DERIVED.find((r: any) => r.patid === "Gr");
const S = stateOf(gr.setup);
const TGr = stateOf(normQuest(QA["gr"].setup));
const TGh = stateOf(normQuest(QA["gh"].setup));

console.log("setup(Gr) derivado:", gr.setup);
console.log("\nestado del setup(Gr):");
console.log("  cp:", [...S.cp].join(","));
console.log("  ep:", [...S.ep].join(","));
console.log("  fuera:", [4, 5, 6, 7].map((c) => { const p = findPos(S.cp, c); return p === c ? "" : `C${c}@${CN[p]}`; }).filter(Boolean).join(" "), [8, 9, 10, 11].map((e) => { const p = findPos(S.ep, e); return p === e ? "" : `E${e}@${EN[p]}`; }).filter(Boolean).join(" "));

console.log("\nT_Gr (quest):");
console.log("  cp:", [...TGr.cp].join(","));
console.log("  ep:", [...TGr.ep].join(","));
console.log("  fuera:", [4, 5, 6, 7].map((c) => { const p = findPos(TGr.cp, c); return p === c ? "" : `C${c}@${CN[p]}`; }).filter(Boolean).join(" "), [8, 9, 10, 11].map((e) => { const p = findPos(TGr.ep, e); return p === e ? "" : `E${e}@${EN[p]}`; }).filter(Boolean).join(" "));

console.log("\nT_Gh (quest):");
console.log("  fuera:", [4, 5, 6, 7].map((c) => { const p = findPos(TGh.cp, c); return p === c ? "" : `C${c}@${CN[p]}`; }).filter(Boolean).join(" "), [8, 9, 10, 11].map((e) => { const p = findPos(TGh.ep, e); return p === e ? "" : `E${e}@${EN[p]}`; }).filter(Boolean).join(" "));

// ¿alguna rotación iguala S con T_Gr o T_Gh?
let m1 = null, m2 = null;
for (const r of ROTS) {
  const cand = S.clone(); if (r) cand.applySequence(r);
  if (f2lEq(cand, TGr) && !m1) m1 = r || "(sin rot)";
  if (f2lEq(cand, TGh) && !m2) m2 = r || "(sin rot)";
}
console.log("\nS == T_Gr mod rot:", m1 ?? "NO");
console.log("S == T_Gh mod rot:", m2 ?? "NO");
