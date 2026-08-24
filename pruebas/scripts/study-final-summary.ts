/**
 * RESUMEN FINAL v2: probar los 4 pares hogar (FR/FL/BL/BR) para cada caso.
 * El par que resuelvan nuestros algs = el par real del caso.
 */
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8")).cases;
const FUSED_A = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;

const HOMES = [
  { c: 4, e: 8, name: "FR" },
  { c: 5, e: 9, name: "FL" },
  { c: 6, e: 10, name: "BL" },
  { c: 7, e: 11, name: "BR" },
];
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function pairSolved(s: CubeState, hc: number, he: number): boolean {
  return s.cp[hc] === hc && s.co[hc] === 0 && s.ep[he] === he && s.eo[he] === 0;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
function outPieces(s: CubeState): string[] {
  const out: string[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) out.push(`C${c}`);
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) out.push(`E${e}`);
  return out;
}

console.log("caso | fuera        | algs fused: pareja por slot (FR/FL/BL/BR) | F2L completo");
console.log("─────┼──────────────┼──────────────────────────────────────────┼──────────────");
for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  const patid = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const sm = src.match(/selectedSetup:\s*"([^"]+)"/);
  if (!sm) continue;
  const S = new CubeState();
  S.applySequence(normQuest(sm[1]));
  const out = outPieces(S);

  const fused = FUSED_B.find((c: any) => c.caseDef.caseNumber === patid) ?? FUSED_A.find((c: any) => c.caseDef.caseNumber === patid);
  if (!fused) { console.log(`${patid.padEnd(4)} | ${out.join("").padEnd(12)} | (sin fused — caso basic?)`); continue; }
  let tested = 0, okF2L = 0;
  const perHome = HOMES.map((h) => ({ name: h.name, ok: 0 }));
  for (const a of fused.algorithms as any[]) {
    const alg = (a.moves as string[]).join(" ");
    const t = S.clone();
    try { t.applySequence(alg); } catch { continue; }
    tested++;
    HOMES.forEach((h, i) => { if (pairSolved(t, h.c, h.e)) perHome[i].ok++; });
    if (f2lSolved(t)) okF2L++;
  }
  const per = perHome.map((p) => `${p.name}:${p.ok}`).join(" ");
  console.log(`${patid.padEnd(4)} | ${out.join("").padEnd(12)} | ${per.padEnd(46)} | ${okF2L}/${tested}`);
}
