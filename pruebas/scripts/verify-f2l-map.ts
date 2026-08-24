/**
 * Verificar el mapeo F2L n <-> patid usando el seed SCDB:
 * para cada caso F2L n, aplicar el inverso de su alg FR top al cubo resuelto,
 * obtener la firma del par (posicion+orientacion, AUF-normalizada), y buscar
 * esa firma en los 168 patrones de BirdF2L.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;

function invertSequence(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.endsWith("'")) out.push(t.slice(0, -1));
    else if (t.endsWith("2")) out.push(t);
    else out.push(t + "'");
  }
  return out.join(" ");
}

function pairFp(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    let cP = -1, cO = -1, eP = -1, eO = -1;
    for (let i = 0; i < 8; i++) if (c.cp[i] === 4) { cP = i; cO = c.co[i]; break; }
    for (let i = 0; i < 12; i++) if (c.ep[i] === 8) { eP = i; eO = c.eo[i]; break; }
    const h = `c${cP}${cO}|e${eP}${eO}`;
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}

// firmas de los 168 patrones (alg top por speed)
const patFps = new Map<string, string>(); // pairFp (AUF) -> patid
for (const patid of Object.keys(PARSED)) {
  const top = [...PARSED[patid].algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const s = new CubeState();
  try { s.applySequence(invertSequence(top.moves)); } catch { continue; }
  const fp = pairFp(s);
  const prev = patFps.get(fp);
  if (prev && prev !== patid) {
    console.log(`COLLISION firma ${fp}: ${prev} y ${patid}`);
  }
  patFps.set(fp, patid);
}
console.log(`patrones indexados: ${patFps.size}`);

console.log("\n=== Mapeo seed -> patid (alg FR top por caso, votos) ===");
const seedMap = new Map<string, string>(); // F2L n -> patid
for (const fc of ALL_F2L_CASES) {
  const cn = fc.caseDef.caseNumber as string;
  // algs FR del seed, con votos
  const frAlgs = fc.algorithms
    .filter((a) => (a.notes ?? "").includes("Slot: FR"))
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const fr = frAlgs[0];
  if (!fr) { console.log(`${cn}: sin alg FR en seed`); continue; }
  const s = new CubeState();
  try { s.applySequence(invertSequence((fr.moves as string[]).join(" "))); } catch (e) { console.log(`${cn}: error ${e}`); continue; }
  const fp = pairFp(s);
  const patid = patFps.get(fp) ?? "???";
  seedMap.set(cn, patid);
  console.log(`  ${cn.padEnd(6)} -> ${patid.padEnd(4)} (alg: ${(fr.moves as string[]).join(" ")}, votos ${fr.votes ?? 0})`);
}
