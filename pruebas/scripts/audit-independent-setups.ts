/**
 * AUDITORÍA INDEPENDIENTE: ¿podemos derivar nuestros propios setups limpios
 * sin copiar nada de quest?
 *
 * Método 100% con datos propios (birdf2l parsed.json — nuestro corpus):
 *   para cada alg A del caso: estado = A⁻¹(cubo resuelto)
 *   - si A⁻¹ deja ≤4 piezas F2L fuera → A es "puro" y su inverso es un SETUP LIMPIO
 *   - cogemos el mejor (menor longitud / mejor speed)
 *
 * Luego verificamos contra quest SOLO como oráculo (comparación de estado,
 * no copia de cadenas): ¿el setup derivado crea el mismo caso F2L?
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));

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
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(moves);
  return s;
}
function findPos(arr: readonly number[], piece: number): number {
  for (let i = 0; i < arr.length; i++) if (arr[i] === piece) return i;
  return -1;
}
function outCount(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) if (findPos(s.cp, c) !== c) n++;
  for (let e = 8; e <= 11; e++) if (findPos(s.ep, e) !== e) n++;
  return n;
}
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function rot(s: CubeState, r: string): CubeState {
  const t = s.clone();
  if (r) t.applySequence(r);
  return t;
}
function f2lSameUpToRot(a: CubeState, b: CubeState): string | null {
  for (const r of ROTS) {
    const t = rot(a, r);
    let same = true;
    for (let i = 4; i <= 7; i++) if (t.cp[i] !== b.cp[i] || t.co[i] !== b.co[i]) { same = false; break; }
    if (!same) continue;
    for (let i = 8; i <= 11; i++) if (t.ep[i] !== b.ep[i] || t.eo[i] !== b.eo[i]) { same = false; break; }
    if (same) return r || "(sin rot)";
  }
  return null;
}

// ── por cada caso advanced: buscar algs puros en NUESTRO corpus ───────────
let casesWithPure = 0;
let casesMatchingQuest = 0;
const results: [string, number, number, number, string | null][] = []; // [slug, pureAlgs, totalAlgs, bestLen, matchQuestRot]

for (const slug of Object.keys(QA).sort()) {
  const q = QA[slug];
  if (q.basic) continue;
  const patid = slug.charAt(0).toUpperCase() + slug.slice(1);
  const entry = PARSED[patid];
  if (!entry?.algs) { results.push([slug, -1, 0, 0, null]); continue; }

  let bestLen = Infinity;
  let bestMoves = "";
  let pureCount = 0;
  for (const a of entry.algs as any[]) {
    const inv = invertSeq(a.moves);
    let s: CubeState;
    try { s = stateOf(inv); } catch { continue; }
    const n = outCount(s);
    if (n <= 4) {
      pureCount++;
      const len = inv.split(" ").filter(Boolean).length;
      if (len < bestLen) { bestLen = len; bestMoves = inv; }
    }
  }
  if (pureCount > 0) casesWithPure++;

  // verificación contra quest (oráculo): ¿el mejor setup derivado crea el caso de quest?
  let match: string | null = null;
  if (bestMoves) {
    const O = stateOf(bestMoves);
    const Q = stateOf(normQuest(q.setup));
    match = f2lSameUpToRot(O, Q);
    if (match) casesMatchingQuest++;
  }
  results.push([slug, pureCount, entry.algs.length, bestLen === Infinity ? 0 : bestLen, match]);
}

console.log("═══ AUDITORÍA INDEPENDIENTE (nuestra data birdf2l, sin quest) ═══");
console.log(`casos advanced con ≥1 alg puro en nuestro corpus: ${casesWithPure}/126`);
console.log(`de esos, los que además coinciden con el caso de quest (mod rot): ${casesMatchingQuest}/126`);
console.log("\ndetalle (slug | puros/total | mejor long setup | coincide quest):");
for (const [slug, pure, total, len, match] of results) {
  console.log(`  ${slug.padEnd(4)} | ${pure}/${total} puros | setup ${len} mov | quest: ${match ?? "—"}`);
}
