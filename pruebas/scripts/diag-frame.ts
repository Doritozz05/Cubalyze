/** Diagnóstico: identifyPair sobre setups de taxonomía vs setups finales, para entender el frame. */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const GEN = resolve(__dirname, "../generated");
const SETUPS = JSON.parse(readFileSync(resolve(GEN, "setups-independent-final.json"), "utf-8")) as { patid: string; setup: string }[];
const byPatid = new Map(SETUPS.filter((s) => !s.patid.startsWith("F2L")).map((s) => [s.patid, s.setup]));

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
function nOutOf(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (s.cp[i] === c) p = i; if (p !== c) n++; }
  for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (s.ep[i] === e) p = i; if (p !== e) n++; }
  return n;
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];

const A = JSON.parse(readFileSync(resolve(GEN, "scdb-af2l-fused.json"), "utf-8"));
const show = ["Cf", "Hn", "Cr", "Gb", "Gr", "Wl", "Ut", "Gh"];
for (const c of A.cases) {
  const cn = c.caseDef.caseNumber;
  if (!show.includes(cn)) continue;
  const tax = c.caseDef.setupScramble;
  const fin = byPatid.get(cn) ?? "?";
  const st = new CubeState(); apply(st, tax);
  const sf = new CubeState(); apply(sf, fin);
  const pTax = identifyPair(st);
  const pFin = identifyPair(sf);
  // ¿alguna rotación del setup final da el mismo identifyPair que la taxonomía?
  let matchRot = "NONE";
  for (const r of ROTS) {
    const s = new CubeState(); apply(s, [r, fin].filter(Boolean).join(" "));
    if (nOutOf(s) !== nOutOf(sf)) continue;
    const p = identifyPair(s);
    if (p.homeC === pTax.homeC && p.homeE === pTax.homeE) { matchRot = r || "∅"; break; }
  }
  console.log(`${cn}: tax(${pTax.kind} h${pTax.homeC},${pTax.homeE} nOut${nOutOf(st)}) | final(${pFin.kind} h${pFin.homeC},${pFin.homeE} nOut${nOutOf(sf)}) | rot que coincide: ${matchRot}`);
}
