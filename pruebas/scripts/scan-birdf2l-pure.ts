/**
 * Escaneo completo (Fase 2+3) — criterio definitivo.
 *
 * S = A^-1(solved) es un "caso de par FR valido" si las posiciones F2L NO-FR
 * solo contienen piezas F2L:
 *   - esquinas 5,6,7 (FL,BL,BR)  -> piezas {4..7}
 *   - aristas 9,10,11 (FL,BL,BR) -> piezas {8..11}
 *   - aristas 4..7 (cross)       -> piezas {4..7} (cross preservado)
 * La posicion FR (esquina 4, arista 8) queda LIBRE: si el par esta arriba,
 * ahi se sientan las piezas LL desplazadas.
 *
 * Vale para casos basicos (par arriba/slot propio) y avanzados (piezas en
 * otros slots). Validado contra Jb (U R U' R' -> valido) y contra los algs
 * impuros (R' F2 R F2 -> invalido).
 * Uso: pnpm dlx tsx scripts/scan-birdf2l-pure.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as Record<string, { algs: { moves: string }[] }>;

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
    Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" +
    Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("")
  );
}
function minOverAuf(fn: (st: CubeState) => string, s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = fn(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
function pairSig(s: CubeState): string {
  let cPos = -1, cO = -1, ePos = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { cPos = i; cO = s.co[i]; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { ePos = i; eO = s.eo[i]; }
  return `${cPos}${cO}|${ePos}${eO}`;
}

/** caso de par FR valido: posiciones F2L no-FR solo con piezas F2L */
function isFRCase(s: CubeState): boolean {
  for (const i of [5, 6, 7]) if (s.cp[i] < 4 || s.cp[i] > 7) return false;
  for (const i of [9, 10, 11]) if (s.ep[i] < 8 || s.ep[i] > 11) return false;
  for (const i of [4, 5, 6, 7]) if (s.ep[i] < 4 || s.ep[i] > 7) return false;
  return true;
}

const pages = Object.keys(data).sort();
let totalAlgs = 0, valid = 0, families = 0, parseErr = 0;
const perPage: { patid: string; total: number; valid: number; fam: number; pats: number }[] = [];

for (const patid of pages) {
  const algs = data[patid].algs;
  const fams = new Map<string, number>();
  const pats = new Map<string, number>();
  let v = 0;
  for (const a of algs) {
    totalAlgs++;
    let s: CubeState;
    try {
      s = new CubeState();
      s.applySequence(invertSequence(a.moves));
    } catch { parseErr++; continue; }
    if (isFRCase(s)) {
      v++;
      const fam = minOverAuf(stateHash, s);
      fams.set(fam, (fams.get(fam) ?? 0) + 1);
      const p = minOverAuf(pairSig, s);
      pats.set(p, (pats.get(p) ?? 0) + 1);
    }
  }
  valid += v;
  families += fams.size;
  perPage.push({ patid, total: algs.length, valid: v, fam: fams.size, pats: pats.size });
}

console.log(`=== ESCANEO DEFINITIVO (168 paginas) ===`);
console.log(`Algs totales:      ${totalAlgs}`);
console.log(`Casos FR validos:  ${valid} (${((100 * valid) / totalAlgs).toFixed(2)}%)`);
console.log(`Familias unicas:   ${families} (dedupe AUF)`);
console.log(`parse err: ${parseErr}`);

const top = [...perPage].sort((a, b) => b.valid - a.valid);
const bottom = [...perPage].sort((a, b) => a.valid - b.valid);
console.log(`\n=== TOP 12 por validos ===`);
for (const p of top.slice(0, 12)) {
  console.log(`  ${p.patid}: ${p.valid} validos (${p.total} tot, ${p.fam} familias, ${p.pats} patrones)`);
}
console.log(`\n=== 12 con MENOS validos ===`);
for (const p of bottom.slice(0, 12)) {
  console.log(`  ${p.patid}: ${p.valid} validos (${p.total} tot)`);
}
const zero = perPage.filter((p) => p.valid === 0);
console.log(`\nPaginas con 0 validos: ${zero.length} -> ${zero.map((p) => p.patid).join(" ")}`);
console.log(`Paginas homogeneas (1 patron): ${perPage.filter((p) => p.pats === 1).length}`);
const multi = perPage.filter((p) => p.pats > 1);
console.log(`Paginas con >1 patron: ${multi.length} -> ${multi.map((p) => `${p.patid}(${p.pats})`).join(" ")}`);
