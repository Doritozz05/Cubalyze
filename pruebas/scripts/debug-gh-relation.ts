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
function f2lEq(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

// 1) ¿Gr está derivado?
const gr = DERIVED.find((r: any) => r.patid === "Gr");
console.log("Gr en DERIVED:", gr ? gr.status : "NO", gr?.setup ? `| setup: ${gr.setup}` : "");

// 2) relación directa
const TGh = stateOf(normQuest(QA["gh"].setup));
const TGr = stateOf(normQuest(QA["gr"].setup));
console.log("T_Gh == T_Gr (F2L):", f2lEq(TGh, TGr));
console.log("eo T_Gh:", [8, 9, 10, 11].map((i) => `E${i}:${TGh.eo[i]}`).join(" "));
console.log("eo T_Gr:", [8, 9, 10, 11].map((i) => `E${i}:${TGr.eo[i]}`).join(" "));

// 3) G10
const F8 = "R F U F R F R U' F' U2 R2";
const G10 = `y2 ${F8} y2`;
const s = new CubeState();
s.applySequence(G10);
console.log("\nG10 aplicado a resuelto: eo F2L:", [8, 9, 10, 11].map((i) => `E${i}:${s.eo[i]}`).join(" "), "| piezas:", [8, 9, 10, 11].map((i) => s.ep[i]).join(","));
console.log("corners F2L:", [4, 5, 6, 7].map((i) => `${s.cp[i]}/${s.co[i]}`).join(" "));

// 4) G10 aplicado a T_Gr
const t = TGr.clone();
t.applySequence(G10);
console.log("\nG10 aplicado a T_Gr: F2L == T_Gh:", f2lEq(t, TGh));
console.log("piezas F2L tras G10:", [4, 5, 6, 7].map((i) => `C${i}:${t.cp[i]}`).join(" "), "|", [8, 9, 10, 11].map((i) => `E${i}:${t.ep[i]}`).join(" "));
console.log("eo tras G10:", [8, 9, 10, 11].map((i) => `E${i}:${t.eo[i]}`).join(" "));

// 5) setup completo: setup_Gr + G10
if (gr?.setup) {
  const full = `${gr.setup} ${G10}`;
  const S = stateOf(full);
  console.log("\nsetup(Gh) = setup(Gr) + G10 → F2L == T_Gh:", f2lEq(S, TGh));
  console.log("setup completo:", full);
}
