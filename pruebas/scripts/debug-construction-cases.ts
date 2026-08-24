/**
 * Examina los 12 casos que necesitan construcción:
 * - D = inverso de un alg nuestro (estado sucio)
 * - T = estado objetivo (quest como oráculo)
 * - ¿cuántas piezas difieren entre D y T? ¿dónde?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;

const INV: Record<string, string> = {
  U: "U'", "U'": "U", U2: "U2", R: "R'", "R'": "R", R2: "R2",
  F: "F'", "F'": "F", F2: "F2", D: "D'", "D'": "D", D2: "D2",
  L: "L'", "L'": "L", L2: "L2", B: "B'", "B'": "B", B2: "B2",
  M: "M'", "M'": "M", M2: "M2", E: "E'", "E'": "E", E2: "E2",
  S: "S'", "S'": "S", S2: "S2", x: "x'", "x'": "x", x2: "x2",
  y: "y'", "y'": "y", y2: "y2", z: "z'", "z'": "z", z2: "z2",
  r: "r'", "r'": "r", r2: "r2", l: "l'", "l'": "l", l2: "l2",
  f: "f'", "f'": "f", f2: "f2", b: "b'", "b'": "b", b2: "b2",
  d: "d'", "d'": "d", d2: "d2", u: "u'", "u'": "u", u2: "u2",
};
function invertSeq(m: string): string {
  return m.split(" ").filter(Boolean).reverse().map((x) => INV[x] ?? x).join(" ");
}
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
function outPieces(s: CubeState): string[] {
  const o: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) o.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) o.push(`E${e}`);
  return o;
}
const CN = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DBR"];
const EN = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

const NEEDED = ["Gh", "Hn", "Ht", "Lh", "Oh", "Sf", "Sl", "Th", "Uh", "Ut", "Wh", "Wl"];

for (const patid of NEEDED) {
  const slug = patid.toLowerCase();
  const q = QA[slug];
  if (!q) { console.log(`${patid}: sin quest`); continue; }
  const T = stateOf(normQuest(q.setup));
  const tOut = outPieces(T);

  // alg de partida: fused o parsed
  const fused = FUSED_A.find((c: any) => c.caseDef.caseNumber === patid);
  let alg = "";
  if (fused?.algorithms?.length) alg = (fused.algorithms[0].moves as string[]).join(" ");
  else if (PARSED[patid]?.algs?.length) alg = PARSED[patid].algs[0].moves;
  const D = alg ? stateOf(invertSeq(alg)) : new CubeState();
  const dOut = outPieces(D);

  // diferencia entre D y T en posiciones F2L
  const diffPos: string[] = [];
  for (let i = 4; i <= 7; i++) {
    if (D.cp[i] !== T.cp[i] || D.co[i] !== T.co[i]) diffPos.push(`C${i}:${CN[D.cp[i]]}/${D.co[i]}→${CN[T.cp[i]]}/${T.co[i]}`);
  }
  for (let i = 8; i <= 11; i++) {
    if (D.ep[i] !== T.ep[i] || D.eo[i] !== T.eo[i]) diffPos.push(`E${i}:${EN[D.ep[i]]}/${D.eo[i]}→${EN[T.ep[i]]}/${T.eo[i]}`);
  }
  console.log(`\n═══ ${patid} | ${q.name} | algs: ${q.count} ═══`);
  console.log(`  T (quest): ${tOut.join("") || "-"} | setup ${normQuest(q.setup).split(" ").filter(Boolean).length} mov`);
  console.log(`  D (inverso de "${alg}"): ${dOut.join("") || "-"} (${dOut.length} fuera)`);
  console.log(`  diferencias D→T en posiciones F2L (${diffPos.length}):`);
  for (const d of diffPos.slice(0, 10)) console.log(`     ${d}`);
}
