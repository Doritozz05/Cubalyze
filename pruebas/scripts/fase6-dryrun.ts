/**
 * Fase 6 dry-run — aplica el criterio EXACTO del test de verificación
 * (scdb-alg-verification.test.ts verifyF2L: identifyPair → homeC/homeE, luego
 * slotRot + alg + post → pairHome en el home identificado) a los advanced con
 * los NUEVOS setups independientes. Solo reporta: cuántos algs/casos sobreviven.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const GEN = resolve(__dirname, "../generated");
const SETUPS = JSON.parse(readFileSync(resolve(GEN, "setups-independent-final.json"), "utf-8")) as {
  patid: string; setup: string;
}[];
const byPatid = new Map(SETUPS.filter((s) => !s.patid.startsWith("F2L")).map((s) => [s.patid, s.setup]));

function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12").replace(/’/g, "'");
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}
// ── criterio exacto del test ───────────────────────────────────────────────
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { kind: string; homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { kind: "trapped-corner", homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { kind: "trapped-edge", homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { kind: "basic", homeC: 4, homeE: 8 };
}
const SINGLE = ["", "y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];
const COMPOUND = ["y' x", "x y'", "y x'", "x' y", "z y", "y z", "x z", "z x", "y2 x", "x y2", "y2 z", "z y2"];
const ALL_POSTS = [...SINGLE, ...COMPOUND];
function pairHome(s: CubeState, homeC: number, homeE: number): boolean {
  return s.cp[homeC] === homeC && s.co[homeC] === 0 && s.ep[homeE] === homeE && s.eo[homeE] === 0;
}
function solvesExact(setup: string, moves: string, homeC: number, homeE: number): boolean {
  for (const slotRot of ["", "y", "y2", "y'"]) {
    const s0 = new CubeState();
    if (!apply(s0, setup)) continue;
    if (slotRot) s0.applySequence(slotRot);
    for (const post of ALL_POSTS) {
      const t = s0.clone();
      if (!apply(t, moves)) continue;
      for (const tok of post.split(/\s+/).filter(Boolean)) t.applySequence(tok);
      if (pairHome(t, homeC, homeE)) return true;
    }
  }
  return false;
}

// ── análisis ───────────────────────────────────────────────────────────────
const path = resolve(GEN, "scdb-af2l-fused.json");
const d = JSON.parse(readFileSync(path, "utf-8"));
let okCases = 0, emptyCases = 0, algsKeep = 0, algsDrop = 0, algsTotal = 0;
const empty: string[] = [];
const droppedSamples: [string, string, string][] = [];
for (const c of d.cases) {
  const cn = c.caseDef.caseNumber as string;
  const setup = byPatid.get(cn);
  const useSetup = setup ?? c.caseDef.setupScramble;
  const s0 = new CubeState();
  if (!apply(s0, useSetup)) { emptyCases++; empty.push(`${cn} (setup no parsea)`); continue; }
  const { homeC, homeE } = identifyPair(s0);
  const keep: any[] = [];
  for (const a of c.algorithms) {
    algsTotal++;
    if (solvesExact(useSetup, (a.moves as string[]).join(" "), homeC, homeE)) keep.push(a);
    else { algsDrop++; if (droppedSamples.length < 8) droppedSamples.push([cn, a.source ?? "?", (a.moves as string[]).join(" ")]); }
  }
  algsKeep += keep.length;
  if (!keep.length) { emptyCases++; empty.push(cn); }
  else okCases++;
}
console.log(`Advanced: ${d.cases.length} casos`);
console.log(`Casos con algs tras filtro exacto: ${okCases} | sin algs: ${emptyCases}`);
if (empty.length) console.log(`  sin algs: ${empty.join(", ")}`);
console.log(`Algs: ${algsKeep}/${algsTotal} sobreviven (descartados ${algsDrop})`);
if (droppedSamples.length) {
  console.log(`Muestras de descartados (${droppedSamples.length}):`);
  for (const [cn, src, mv] of droppedSamples) console.log(`  ${cn} [${src}] ${mv}`);
}
