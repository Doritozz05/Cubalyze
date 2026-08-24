/**
 * ¿Podemos derivar localmente un setup LIMPIO para los casos sucios?
 * Setup limpio = inverso de un alg del top100 tal que el estado resultante
 * tiene <=4 piezas F2L fuera (solo la pareja).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const DEDUPE = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/dedupe-report.json"), "utf-8"));
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;

const inverse = (seq: string) =>
  seq.split(/\s+/).filter(Boolean).reverse().map((m) => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith("2")) return m;
    return m + "'";
  }).join(" ");

const findPos = (arr: number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};
function outOfPlace(s: CubeState): number[] {
  const out: number[] = [];
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) out.push(c);
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) out.push(e);
  return out;
}

// Cf y un par de casos sucios más
const targets = ["Cf", "Cn", "Gb", "Gr", "Hb"];
for (const patid of targets) {
  const d = (DEDUPE.cases as any[]).find((x) => x.patid === patid);
  if (!d) { console.log(patid, "sin dedupe"); continue; }
  let best: { setup: string; out: number[]; alg: string } | null = null;
  for (const t of d.top100) {
    let s: CubeState;
    try {
      s = new CubeState();
      s.applySequence(inverse(t.moves));
    } catch { continue; }
    const out = outOfPlace(s);
    if (out.length <= 4) {
      if (!best || out.length < best.out.length) {
        best = { setup: inverse(t.moves), out, alg: t.moves };
      }
    }
  }
  console.log(`\n${patid}: setup actual="${TAX[patid].setup}"`);
  if (best) {
    console.log(`  MEJOR setup limpio="${best.setup}" (inv de "${best.alg}") -> ${best.out.length} fuera: [${best.out}]`);
  } else {
    console.log(`  NO hay setup limpio local (todos los inversos dejan >4 fuera)`);
    // mostrar el mínimo
    let min = 99; let minInfo: any = null;
    for (const t of d.top100) {
      try {
        const s = new CubeState();
        s.applySequence(inverse(t.moves));
        const n = outOfPlace(s).length;
        if (n < min) { min = n; minInfo = t; }
      } catch {}
    }
    console.log(`  mínimo encontrado: ${min} fuera con alg "${minInfo?.moves}" -> setup "${minInfo ? inverse(minInfo.moves) : ''}"`);
  }
}
