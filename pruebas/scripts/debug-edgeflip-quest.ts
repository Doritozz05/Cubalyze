/** Verificar: ¿T_Hn = T_Ht + flip de una arista? (quest frames) ¿T_Sf = T_Sl + flip? */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));

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
// donde difieren las aristas (posiciones y piezas)
function edgeDiff(a: CubeState, b: CubeState): string[] {
  const d: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) d.push(`pos${i}: ${a.ep[i]}o${a.eo[i]} vs ${b.ep[i]}o${b.eo[i]}`);
  }
  return d;
}

for (const [a, b] of [["Ht", "Hn"], ["Sl", "Sf"]] as const) {
  const Ta = stateOf(normQuest(QA[a.toLowerCase()].setup));
  const Tb = stateOf(normQuest(QA[b.toLowerCase()].setup));
  console.log(`\n=== T_${a} vs T_${b} ===`);
  console.log(`F2L iguales: ${f2lEq(Ta, Tb)}`);
  const cd = [];
  for (let i = 4; i <= 7; i++) if (Ta.cp[i] !== Tb.cp[i] || Ta.co[i] !== Tb.co[i]) cd.push(`pos${i}: c${Ta.cp[i]}o${Ta.co[i]} vs c${Tb.cp[i]}o${Tb.co[i]}`);
  const ed = edgeDiff(Ta, Tb);
  console.log("corners difieren:", cd.length ? cd.join("; ") : "ninguno");
  console.log("edges difieren:", ed.length ? ed.join("; ") : "ninguno");
}
