/**
 * 1) ¿T_Gh (quest) = T_Gr (quest) con aristas F2L volteadas (mod rotación)?
 * 2) Buscar secuencia corta F que voltee una arista F2L y deje el resto del
 *    F2L en su sitio (para añadirla al setup del caso derivado).
 */
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
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function rot(s: CubeState, r: string): CubeState {
  const t = s.clone();
  if (r) t.applySequence(r);
  return t;
}
function sameF2Lpos(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i]) return false;
  return true;
}
/** ¿b == a con las orientaciones de aristas F2L cambiadas (todas o una)? */
function flippedEdgeMatch(a: CubeState, b: CubeState, flipAll: boolean): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) {
    if (a.ep[i] !== b.ep[i]) return false;
    const wantFlip = flipAll ? true : a.eo[i] !== b.eo[i];
    if (flipAll && a.eo[i] === b.eo[i]) return false; // todas deben cambiar
  }
  return true;
}

const PAIRS: [string, string][] = [
  ["Gh", "Gr"], ["Lh", "Lr"], ["Oh", "Or"], ["Uh", "Ur"], ["Ut", "Un"], ["Wh", "Wr"], ["Wl", "Wf"], ["Hn", "Ht"], ["Sf", "Sl"], ["Th", "Tr"],
];
for (const [a, b] of PAIRS) {
  const qa = QA[a.toLowerCase()];
  const qb = QA[b.toLowerCase()];
  if (!qa || !qb) { console.log(`${a}↔${b}: sin quest`); continue; }
  const A = stateOf(normQuest(qa.setup));
  const B = stateOf(normQuest(qb.setup));
  let result = "sin relación";
  for (const r of ROTS) {
    const Br = rot(B, r);
    if (sameF2Lpos(A, Br)) {
      // misma posición de piezas; ¿orientaciones?
      const eoDiff = [];
      for (let i = 8; i <= 11; i++) if (A.eo[i] !== Br.eo[i]) eoDiff.push(`E${i}`);
      const coDiff = [];
      for (let i = 4; i <= 7; i++) if (A.co[i] !== Br.co[i]) coDiff.push(`C${i}`);
      if (eoDiff.length === 0 && coDiff.length === 0) result = `✅ MISMO CASO (rot ${r || "-"})`;
      else if (eoDiff.length >= 1 && coDiff.length === 0) result = `🔄 edgeFlipped: aristas ${eoDiff.join(",")} (rot ${r || "-"})`;
      else result = `difiere: corners ${coDiff.join(",")} edges ${eoDiff.join(",")} (rot ${r || "-"})`;
      break;
    }
  }
  console.log(`${a} ↔ ${b}: ${result}`);
}
