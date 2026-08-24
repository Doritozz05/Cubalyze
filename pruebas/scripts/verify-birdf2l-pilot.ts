/**
 * Piloto de verificacion BirdF2L (Fase 2).
 *
 * Para cada alg de una pagina: A^-1 aplicado a cubo resuelto debe dejar los
 * otros 3 slots (FL/BR/BL) intactos -> es un alg F2L valido para el par FR.
 * Ademas:
 *   - firmas de par (AUF-normalizadas): homogeneidad del caso en la pagina
 *   - familias de duplicados: estado completo AUF-canónico -> detecta "el mismo
 *     alg con un U extra al final" (ej. "U R U' R'" vs "U R U' R' U")
 *
 * Uso: pnpm dlx tsx scripts/verify-birdf2l-pilot.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as Record<
  string,
  { patid: string; algs: { moves: string }[] }
>;

// Indices Kociemba: esquinas 0=URF 1=UFL 2=ULB 3=UBR 4=DFR 5=DLF 6=DBL 7=DRB
// aristas 0=UR 1=UF 2=UL 3=UB 4=DR 5=DF 6=DL 7=DB 8=FR 9=FL 10=BL 11=BR
const OTHER_SLOTS = [
  { c: 5, e: 9 }, // FL
  { c: 7, e: 11 }, // BR
  { c: 6, e: 10 }, // BL
];

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

function stateHash(s: CubeState): string {
  return (
    Array.from(s.cp).join("") + ";" +
    Array.from(s.co).join("") + ";" +
    Array.from(s.ep).join("") + ";" +
    Array.from(s.eo).join("")
  );
}

/** Firma del par FR: posicion+orientacion de la esquina (pieza 4) y arista (pieza 8) */
function pairSignature(s: CubeState): string {
  let cPos = -1, cO = -1, ePos = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { cPos = i; cO = s.co[i]; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { ePos = i; eO = s.eo[i]; }
  return `${cPos}${cO}|${ePos}${eO}`;
}

/** Normaliza sobre las 4 AUF de U: minimo de fn(s), fn(s·U), fn(s·U2), fn(s·U') */
function minOverAuf(fn: (s: CubeState) => string, s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = fn(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}

function analyzePage(patid: string, refPair?: string) {
  const algs = data[patid]?.algs ?? [];
  console.log(`\n===== ${patid} — ${algs.length} algs =====`);

  let valid = 0, invalid = 0, parseErr = 0;
  const pairCanon = new Map<string, number>();
  const refMatches = refPair ? 0 : -1;
  let refCount = 0;
  const families = new Map<string, number>();
  const famSamples = new Map<string, string[]>();
  let totalTokens = 0;

  for (const a of algs) {
    const toks = a.moves.trim().split(/\s+/).filter(Boolean);
    if (toks.length === 0) { parseErr++; continue; }
    totalTokens += toks.length;
    let s: CubeState;
    try {
      s = new CubeState();
      s.applySequence(invertSequence(a.moves));
    } catch {
      parseErr++;
      continue;
    }
    const otherOk = OTHER_SLOTS.every(
      ({ c, e }) => s.cp[c] === c && s.co[c] === 0 && s.ep[e] === e && s.eo[e] === 0,
    );
    if (!otherOk) { invalid++; continue; }
    valid++;

    const pc = minOverAuf(pairSignature, s);
    pairCanon.set(pc, (pairCanon.get(pc) ?? 0) + 1);
    if (refPair && pc === refPair) refCount++;

    const fam = minOverAuf(stateHash, s);
    families.set(fam, (families.get(fam) ?? 0) + 1);
    const samples = famSamples.get(fam) ?? [];
    if (samples.length < 3) famSamples.set(fam, [...samples, a.moves]);
  }

  console.log(
    `validos: ${valid} (${((100 * valid) / Math.max(1, valid + invalid + parseErr)).toFixed(1)}%) | ` +
    `invalidos: ${invalid} | parse err: ${parseErr}`,
  );
  console.log(`moves medio: ${(totalTokens / Math.max(1, valid + invalid + parseErr)).toFixed(1)}`);

  console.log(`\nfirmas de par distintas (AUF-norm): ${pairCanon.size}`);
  for (const [sig, n] of [...pairCanon.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)) {
    console.log(`   par ${sig}: ${n} algs`);
  }
  if (refPair) console.log(`coinciden con el par de referencia (${refPair}): ${refCount}`);

  console.log(`\nfamilias de duplicados (estado AUF-norm): ${families.size} de ${valid} validos`);
  const biggest = [...families.entries()].sort((x, y) => y[1] - x[1])[0];
  if (biggest) {
    console.log(`familia mas grande: ${biggest[1]} algs — ${famSamples.get(biggest[0])?.join("   vs   ")}`);
  }
  const sizes = [...families.values()].sort((x, y) => y - x);
  console.log(`top 5 tamanos: ${sizes.slice(0, 5).join(", ")}`);
  console.log(`algs que serian unicos tras dedupe: ${families.size} (${((100 * families.size) / Math.max(1, valid)).toFixed(0)}% de los validos)`);
}

// Referencia Jb: setup del seed "F2L 1" = F R' F' R
const ref = new CubeState();
ref.applySequence("F R' F' R");
const refPair = minOverAuf(pairSignature, ref);
console.log(`Par de referencia Jb (setup "F R' F' R"): ${refPair}`);

analyzePage("Jb", refPair);
analyzePage("Mi");
