/**
 * Verificación: el setup limpio de Cf = inverso de un alg PURO.
 * Quest Cf: pareja {5,9}. Si el inverso del alg puro de Cf da pareja {5,9},
 * el fix es: recalcular setups sucios con inverso de alg puro.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const DEDUPE = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/dedupe-report.json"), "utf-8"));
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { homeC: 4, homeE: 8 };
}

// Invertir una secuencia de movimientos
function inverse(seq: string): string {
  return seq.split(/\s+/).filter(Boolean).reverse().map((m) => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith("2")) return m;
    return m + "'";
  }).join(" ");
}

// Piezas F2L fuera de su home
const findPos = (arr: number[], piece: number) => {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
};
function countOutOfPlace(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 4; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}

const d = (DEDUPE.cases as any[]).find((x) => x.patid === "Cf")!;
const pureAlgs = d.top100.filter((t: any) => t.pure);
console.log("Cf: algs puros:", pureAlgs.length);
for (const t of pureAlgs.slice(0, 5)) {
  const setup = inverse(t.moves);
  const s = new CubeState();
  try {
    s.applySequence(setup);
    const pair = identifyPair(s);
    const oop = countOutOfPlace(s);
    console.log(`  alg="${t.moves}"`);
    console.log(`    setup="${setup}" -> pareja {${pair.homeC},${pair.homeE}} | piezas fuera: ${oop}`);
  } catch (e) {
    console.log("  alg inválido:", t.moves);
  }
}

// Y el setup de quest directamente (si es un alg del top, su inverso es el setup)
console.log("\nQuest setup de Cf (paste): U' F' R' F R U F L2 U2 F' U2 F U2 B' U2 B L2");
const sq = new CubeState();
sq.applySequence("U' F' R' F R U F L2 U2 F' U2 F U2 B' U2 B L2");
console.log("  pareja quest:", identifyPair(sq), "| piezas fuera:", countOutOfPlace(sq));
