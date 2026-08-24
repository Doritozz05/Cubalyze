/**
 * Consistencia interna:
 * - nuestros algs fused de Cf ¿resuelven nuestro setup (pareja 4,8)? ¿resuelven el de quest?
 * - dump de los algs fused de Cf
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8")).cases;

function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(moves);
  return s;
}
function pairSolved(s: CubeState, hc: number, he: number): boolean {
  return s.cp[hc] === hc && s.co[hc] === 0 && s.ep[he] === he && s.eo[he] === 0;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
const findPos = (arr: readonly number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};
function analyze(label: string, s: CubeState) {
  const out: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) out.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) out.push(`E${e}`);
  console.log(`  ${label}: fuera=${out.join("") || "-"} | DFR/FR piezas: cp[4]=${s.cp[4]} ep[8]=${s.ep[8]} | C4@${["URF","UFL","ULB","UBR","DFR","DLF","DBL","DBR"][findPos(s.cp,4)]} E8@${["UR","UF","UL","UB","DR","DF","DL","DB","FR","FL","BL","BR"][findPos(s.ep,8)]}`);
}

for (const [pid, fusedArr, tax] of [["Cf", FUSED_A, TAX.Cf], ["Jb", FUSED_B, TAX.Jb]] as const) {
  console.log(`\n═══ ${pid} ═══`);
  console.log(`  nuestro setup: ${tax?.setup}`);
  const O = stateOf(tax?.setup ?? "");
  analyze("nuestro setup", O);

  const fused = (fusedArr as any[]).find((c: any) => c.caseDef.caseNumber === pid);
  console.log(`  algs fused (${fused?.algorithms.length}):`);
  for (const a of (fused?.algorithms as any[]).slice(0, 12)) {
    const alg = (a.moves as string[]).join(" ");
    const tO = O.clone(); tO.applySequence(alg);
    const onOurs = pairSolved(tO, 4, 8) ? "pareja✅" : "pareja❌";
    const onOursF2L = f2lSolved(tO) ? "F2L✅" : "";
    console.log(`    ${alg.padEnd(28)} → nuestro setup: ${onOurs} ${onOursF2L}`);
  }
}
