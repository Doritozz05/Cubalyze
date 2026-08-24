/**
 * VERIFICACIÓN FINAL DE LA FUSIÓN: para cada caso (basic + advanced),
 * aplicar los algs fused contra el setup final e comprobar que la pareja
 * queda resuelta (en su slot hogar, con criterio quest: disturbs permitidos).
 * Es la prueba definitiva de que el seed funcionará.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const SETUPS = JSON.parse(readFileSync(resolve(__dirname, "../generated/setups-independent-final.json"), "utf-8"));
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8"));
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8"));

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function normAlg(m: string): string {
  return m.replace(/2'/g, "2").replace(/’/g, "'");
}
/** criterio quest: la PAREJA (esquina i + arista i) resuelta en su slot hogar (disturbs permitidos) */
function pairSolvedInAnySlot(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) {
    if (s.cp[i] === i && s.co[i] === 0 && s.ep[i] === i && s.eo[i] === 0) return true;
  }
  return false;
}

const byCase: Record<string, any[]> = {};
for (const c of FUSED_B.cases) byCase[c.caseDef.caseNumber] = c.algorithms;
for (const c of FUSED_A.cases) byCase[c.caseDef.caseNumber] = c.algorithms;

let total = 0, ok = 0, noAlgs = 0;
const fails: string[] = [];
for (const r of SETUPS) {
  const cn = r.patid;
  const algs = byCase[cn] ?? byCase[cn.toLowerCase()] ?? byCase[cn.toUpperCase()];
  const S = stateOf(normQuest(r.setup));
  total++;
  if (!algs || algs.length === 0) {
    noAlgs++;
    fails.push(`${cn} (sin algs)`);
    continue;
  }
  let caseOk = false;
  for (const a of algs) {
    const moves = a.moves ?? (a as any).movesStr;
    if (!moves) continue;
    const s = S.clone();
    try { s.applySequence(normAlg(moves.join ? moves.join(" ") : String(moves))); } catch { continue; }
    if (pairSolvedInAnySlot(s)) { caseOk = true; break; }
  }
  if (caseOk) ok++;
  else fails.push(cn);
}
console.log(`Casos con algs: ${total - noAlgs}/${total}`);
console.log(`Casos donde los algs fused resuelven el setup final: ${ok}/${total - noAlgs}`);
if (fails.length) console.log(`FALLOS (${fails.length}): ${fails.join(", ")}`);
