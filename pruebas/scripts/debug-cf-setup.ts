/**
 * Debug: nuestro setup de Cf (seed) vs el setup de quest para Cf.
 * ¿Son el mismo caso? ¿La pareja objetivo se identifica igual?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { getSeedData } from "../../packages/algorithm-db/src/seed/index";

const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number; kind: string } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c], kind: "trapped-corner" };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e, kind: "trapped-edge" };
  return { homeC: 4, homeE: 8, kind: "basic" };
}

// ─── Cargar seed ──────────────────────────────────────────────────────────
const { cases } = getSeedData();
const cf = cases.find((c) => c.caseNumber === "Cf");
console.log("=== Cf en el seed ===");
if (!cf) {
  console.log("NO existe Cf en el seed");
} else {
  console.log("id:", cf.id);
  console.log("subsetId:", cf.subsetId);
  console.log("name:", cf.name);
  console.log("setupScramble:", cf.setupScramble);
  console.log("tags:", cf.tags);
  const s = new CubeState();
  s.applySequence(cf.setupScramble);
  const pair = identifyPair(s);
  console.log("identifyPair:", pair);
  console.log("cp[4] (corner en DFR):", s.cp[4], "| ep[8] (edge en FR):", s.ep[8]);
  // dónde está la pareja: posiciones actuales de las piezas homeC y homeE
  const cIdx = pair.homeC, eIdx = pair.homeE;
  const findPos = (arr: number[], piece: number) => {
    for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
    return -1;
  };
  const cPos = findPos(s.cp, cIdx);
  const ePos = findPos(s.ep, eIdx);
  console.log(`pareja corner ${cIdx} está en posición cp[${cPos}] = ${cPos}`, cPos === 4 ? "(DFR)" : cPos < 4 ? `(U corner ${cPos})` : `(D corner ${cPos})`);
  console.log(`pareja edge ${eIdx} está en posición ep[${ePos}] = ${ePos}`, ePos === 8 ? "(FR)" : ePos < 4 ? `(U edge ${ePos})` : `(D/E edge ${ePos})`);
  // cuántos algs tiene
  const { algorithms } = require("../../packages/algorithm-db/src/seed/index") as any;
  void algorithms;
}

// ─── Setup de quest para Cf (del paste del usuario) ───────────────────────
const QUEST_CF_SETUP = "U' F' R' F R U F L2 U2 F' U2 F U2 B' U2 B L2";
console.log("\n=== Setup de quest Cf ===");
const s2 = new CubeState();
try {
  s2.applySequence(QUEST_CF_SETUP);
  const pair2 = identifyPair(s2);
  console.log("identifyPair:", pair2);
  console.log("cp[4]:", s2.cp[4], "| ep[8]:", s2.ep[8]);
  const c2 = pair2.homeC, e2 = pair2.homeE;
  const findPos2 = (arr: number[], piece: number) => {
    for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
    return -1;
  };
  const cPos2 = findPos2(s2.cp, c2);
  const ePos2 = findPos2(s2.ep, e2);
  console.log(`pareja corner ${c2} en posición ${cPos2}`, cPos2 === 4 ? "(DFR)" : cPos2 < 4 ? `(U corner ${cPos2})` : `(D corner ${cPos2})`);
  console.log(`pareja edge ${e2} en posición ${ePos2}`, ePos2 === 8 ? "(FR)" : ePos2 < 4 ? `(U edge ${ePos2})` : `(D/E edge ${ePos2})`);
  // ¿F2L resuelto excepto pareja? comprobar todos los slots
  const F2L_OK = [4, 5, 6, 7].every((p) => s2.cp[p] === p) && [4, 5, 6, 7, 8, 9, 10, 11].every((p) => s2.ep[p] === p);
  console.log("¿F2L completo resuelto (cp[4-7]=home y ep[4-11]=home)?:", F2L_OK);
} catch (e) {
  console.log("ERROR aplicando setup quest:", e);
}

// ─── Comparar estados: ¿mismo caso hasta rotación U? ─────────────────────
console.log("\n=== Comparación de casos ===");
if (cf) {
  const sA = new CubeState();
  sA.applySequence(cf.setupScramble);
  const sB = new CubeState();
  sB.applySequence(QUEST_CF_SETUP);
  // huella de parejas del F2L (corner+edge por slot) para comparar
  const slots = ["DFR/FR", "DLF/FL", "DBL/BL", "DRB/BR"].map((_, i) => i + 4);
  const fingerprint = (s: CubeState) => {
    const f = [];
    for (const corner of [4, 5, 6, 7]) {
      const c = s.cp[corner];
      const e = s.ep[8 + (corner - 4)];
      f.push(`${corner}:${c}/${8 + (corner - 4)}:${e}`);
    }
    return f;
  };
  console.log("huella A (nuestro setup):", fingerprint(sA));
  console.log("huella B (quest setup):  ", fingerprint(sB));
  // AUF: rotar sB con U/U2/U' y comparar con sA (completo)
  for (const rot of ["", "U", "U2", "U'"]) {
    const t = sB.clone();
    if (rot) t.applySequence(rot);
    const same = JSON.stringify(fingerprint(sA)) === JSON.stringify(fingerprint(t));
    console.log(`¿mismo caso con ${rot || "∅"}?:`, same);
  }
}
