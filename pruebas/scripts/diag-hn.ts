/** Diagnóstico definitivo: para Hn (conservado), ¿los algs resuelven el setup final en algún slot? */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const GEN = resolve(__dirname, "../generated");
const SETUPS = JSON.parse(readFileSync(resolve(GEN, "setups-independent-final.json"), "utf-8")) as { patid: string; setup: string }[];
const fin = new Map(SETUPS.filter((s) => !s.patid.startsWith("F2L")).map((s) => [s.patid, s.setup]));

function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12").replace(/’/g, "'");
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { kind: string; homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { kind: "trapped-corner", homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { kind: "trapped-edge", homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { kind: "basic", homeC: 4, homeE: 8 };
}
// criterio laxo: pareja en CUALQUIER slot
function anySlotSolved(s: CubeState): number[] {
  const slots: number[] = [];
  for (let i = 4; i <= 7; i++) if (s.cp[i] === i && s.co[i] === 0 && s.ep[i] === i && s.eo[i] === 0) slots.push(i);
  return slots;
}

const A = JSON.parse(readFileSync(resolve(GEN, "scdb-af2l-fused.json"), "utf-8"));
for (const cn of ["Hn", "Cr", "Xt", "Uh"]) {
  const c = A.cases.find((x: any) => x.caseDef.caseNumber === cn);
  if (!c) continue;
  const setupFinal = fin.get(cn)!;
  const sf = new CubeState(); apply(sf, setupFinal);
  const p = identifyPair(sf);
  console.log(`\n=== ${cn} ===`);
  console.log(`setup final: ${setupFinal}`);
  console.log(`identifyPair(final): ${p.kind} h${p.homeC},${p.homeE}`);
  // qué piezas hay en FR/DFR
  console.log(`cp[4]=${sf.cp[4]} ep[8]=${sf.ep[8]}`);
  let nAny = 0, nExact = 0;
  for (const a of c.algorithms.slice(0, 30)) {
    const moves = (a.moves as string[]).join(" ");
    const t = sf.clone();
    if (!apply(t, moves)) continue;
    const any = anySlotSolved(t);
    // criterio exacto: slotRot + post → home identificado
    let exact = false;
    const SINGLE = ["", "y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];
    const COMPOUND = ["y' x", "x y'", "y x'", "x' y", "z y", "y z", "x z", "z x", "y2 x", "x y2", "y2 z", "z y2"];
    for (const sr of ["", "y", "y2", "y'"]) {
      const s0 = sf.clone();
      if (sr) s0.applySequence(sr);
      for (const post of [...SINGLE, ...COMPOUND]) {
        const t2 = s0.clone();
        if (!apply(t2, moves)) continue;
        for (const tok of post.split(/\s+/).filter(Boolean)) t2.applySequence(tok);
        if (t2.cp[p.homeC] === p.homeC && t2.co[p.homeC] === 0 && t2.ep[p.homeE] === p.homeE && t2.eo[p.homeE] === 0) { exact = true; break; }
      }
      if (exact) break;
    }
    if (any.length) nAny++;
    if (exact) nExact++;
    if (any.length && !exact) console.log(`  alg resuelve en slot ${any} PERO no en home (${p.homeC},${p.homeE}): ${moves}`);
  }
  console.log(`→ algs que resuelven en algún slot: ${nAny}/${Math.min(30, c.algorithms.length)} | en el home de identifyPair: ${nExact}`);
}
