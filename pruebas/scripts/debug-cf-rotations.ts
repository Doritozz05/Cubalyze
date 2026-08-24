/**
 * Debug 2: nuestro Cf vs quest Cf bajo las 24 rotaciones del cubo.
 * 1. ¿El estado de quest es el nuestro rotado (alguna orientación)?
 * 2. ¿Nuestros algs de Cf resuelven el setup de quest (misma pareja tras rotar)?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { getSeedData } from "../../packages/algorithm-db/src/seed/index";

const QUEST_CF_SETUP = "U' F' R' F R U F L2 U2 F' U2 F U2 B' U2 B L2";
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];

function identifyPair(s: CubeState): { homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { homeC: 4, homeE: 8 };
}

// 24 orientaciones del cubo: composiciones de y (4) x (4) z... generamos con
// secuencias de rotaciones completas del cubo: aplicar giros a un cubo resuelto
// produce las 24 orientaciones posibles de los centros.
const ROTS = [
  "", "y", "y2", "y'",
  "x", "x2", "x'",
  "z", "z2", "z'",
  "y x", "x y'", "y' x", "x' y", "y x'", "x y", "y2 x", "x y2", "y2 z", "z y2",
  "y' x'", "x' y'", "y x2", "x2 y",
];

function rotateState(s: CubeState, toks: string): CubeState {
  const t = s.clone();
  for (const tok of toks.split(/\s+/).filter(Boolean)) t.applySequence(tok);
  return t;
}

// Huella del F2L: (corner en cada slot D, edge en cada slot E) con ids de pieza.
function f2lFingerprint(s: CubeState): string {
  const parts: string[] = [];
  for (let slot = 0; slot < 4; slot++) {
    const cornerPos = 4 + slot;
    const edgePos = 8 + slot;
    parts.push(`${cornerPos}:${s.cp[cornerPos]}|${edgePos}:${s.ep[edgePos]}`);
  }
  return parts.join(",");
}

const { cases, algorithms } = getSeedData();
const cfCase = cases.find((c) => c.caseNumber === "Cf");
if (!cfCase) { console.log("No Cf"); process.exit(0); }

const sA = new CubeState();
sA.applySequence(cfCase.setupScramble);
const sB = new CubeState();
sB.applySequence(QUEST_CF_SETUP);

console.log("setup nuestro:", cfCase.setupScramble);
console.log("pareja nuestra:", identifyPair(sA));
console.log("huella nuestra:", f2lFingerprint(sA));
console.log("pareja quest:  ", identifyPair(sB));
console.log("huella quest:  ", f2lFingerprint(sB));
console.log();

// 1) ¿algún estado B rotado coincide con A (F2L completo)?
console.log("=== ¿mismo caso bajo alguna de las 24 rotaciones? ===");
let found = false;
for (const r of ROTS) {
  const t = rotateState(sB, r);
  if (f2lFingerprint(t) === f2lFingerprint(sA)) {
    console.log("  SÍ con rotación:", r || "∅");
    found = true;
  }
}
if (!found) console.log("  NO — los F2L completos difieren bajo las 24 rotaciones");

// 2) ¿misma PAREJA bajo rotación (con el resto libre)?
console.log("\n=== ¿misma pareja (ids) bajo rotación? ===");
const pairA = identifyPair(sA);
found = false;
for (const r of ROTS) {
  const t = rotateState(sB, r);
  const p = identifyPair(t);
  if (p.homeC === pairA.homeC && p.homeE === pairA.homeE) {
    console.log("  SÍ con rotación:", r || "∅", "->", p);
    found = true;
  }
}
if (!found) console.log("  NO — parejas distintas bajo las 24 rotaciones");

// 3) ¿nuestros algs de Cf resuelven el setup de quest (pareja {5,9})?
console.log("\n=== algs de nuestro Cf contra el setup de QUEST (pareja {5,9}) ===");
const cfAlgs = algorithms.filter((a) => a.caseId === cfCase.id);
console.log("algs en seed:", cfAlgs.length);
let nSolve = 0;
const SINGLE = ["", "y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];
function pairHome(s: CubeState, homeC: number, homeE: number): boolean {
  return s.cp[homeC] === homeC && s.co[homeC] === 0 && s.ep[homeE] === homeE && s.eo[homeE] === 0;
}
for (const a of cfAlgs.slice(0, 8)) {
  const moves = a.moves.join(" ");
  let ok = false;
  for (const slotRot of ["", "y", "y2", "y'"]) {
    const s0 = new CubeState();
    s0.applySequence(QUEST_CF_SETUP);
    if (slotRot) s0.applySequence(slotRot);
    for (const post of SINGLE) {
      const t = s0.clone();
      t.applySequence(moves);
      if (post) t.applySequence(post);
      if (pairHome(t, 5, 9)) { ok = true; break; }
    }
    if (ok) break;
  }
  if (ok) nSolve++;
  console.log(`  ${ok ? "RESUELVE" : "no"}  ${moves}`);
}
console.log("resuelven {5,9} (pareja quest):", nSolve, "/", Math.min(cfAlgs.length, 8));
