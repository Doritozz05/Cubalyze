/**
 * OPCIÓN B — DERIVACIÓN INDEPENDIENTE DE SETUPS (sin copiar quest).
 *
 * Para cada caso (167: 41 basic + 126 advanced):
 *   1. Corpus = algs de nuestro propio birdf2l parsed.json + algs fused (SCDB).
 *   2. Alg "puro" = su inverso aplicado al cubo resuelto deja ≤4 piezas F2L fuera
 *      (es decir: el inverso es un SETUP LIMPIO del caso).
 *   3. Elegimos el mejor (menor longitud, desempate por speed).
 *   4. Verificamos contra quest SOLO como oráculo: ¿el setup derivado crea el
 *      mismo estado F2L (mod rotación) que el setup canónico de quest?
 *
 * Salida: pruebas/generated/setups-independent.json
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8"));
const QA = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/quest-all.json"), "utf-8"));
const FUSED_B = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-f2l-fused.json"), "utf-8")).cases;
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
/** MATE: corner hogar del edge y viceversa (para identifyPair simple) */
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number; kind: string } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c], kind: "trapped-corner" };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e, kind: "trapped-edge" };
  return { homeC: 4, homeE: 8, kind: "basic" };
}

// ── construir la lista de casos (patid + slug quest + básico?) ────────────
interface CaseEntry {
  patid: string;
  slug?: string;
  basic: boolean;
  fused?: any;
}
const entries: CaseEntry[] = [];
// advanced: slug = patid lowercase
for (const slug of Object.keys(QA).sort()) {
  const q = QA[slug];
  if (q.basic) continue;
  const patid = slug.charAt(0).toUpperCase() + slug.slice(1);
  entries.push({ patid, slug, basic: false, fused: FUSED_A.find((c: any) => c.caseDef.caseNumber === patid) });
}
// basic: mapear por coincidencia de setup (mod rot) contra quest basic
for (const c of FUSED_B) {
  const O = stateOf(c.caseDef.setupScramble);
  let slug: string | undefined;
  for (const [s, q] of Object.entries(QA) as any) {
    if (!q.basic) continue;
    if (f2lSameUpToRot(O, stateOf(normQuest(q.setup)))) { slug = s; break; }
  }
  entries.push({ patid: c.caseDef.caseNumber, slug, basic: true, fused: c });
}

// ── derivación ─────────────────────────────────────────────────────────────
const results: any[] = [];
let derived = 0, clean = 0, matchesQuest = 0;
for (const e of entries) {
  const patidKey = e.basic ? undefined : e.patid; // parsed.json usa patid real para advanced
  const corpus: any[] = [];
  if (!e.basic && PARSED[e.patid]?.algs) corpus.push(...PARSED[e.patid].algs.map((a: any) => ({ moves: a.moves, speed: a.speed ?? 99 })));
  if (e.fused?.algorithms) corpus.push(...e.fused.algorithms.map((a: any) => ({ moves: (a.moves as string[]).join(" "), speed: 50 })));

  let best: { inv: string; len: number; speed: number; src: string } | null = null;
  for (const a of corpus) {
    let inv: string;
    try { inv = invertSeq(a.moves); } catch { continue; }
    let s: CubeState;
    try { s = stateOf(inv); } catch { continue; }
    const out = outPieces(s);
    if (out.length <= 4) {
      const len = inv.split(" ").filter(Boolean).length;
      if (!best || len < best.len || (len === best.len && a.speed < best.speed)) {
        best = { inv, len, speed: a.speed, src: "parsed" };
      }
    }
  }

  const rec: any = {
    patid: e.patid, slug: e.slug ?? null, basic: e.basic,
    corpusAlgs: corpus.length,
  };
  if (best) {
    derived++;
    const S = stateOf(best.inv);
    const out = outPieces(S);
    const pair = identifyPair(S);
    let questMatch: string | null = null;
    let questState: CubeState | null = null;
    if (e.slug && QA[e.slug]) {
      questState = stateOf(normQuest(QA[e.slug].setup));
      questMatch = f2lSameUpToRot(S, questState);
    }
    if (questMatch) matchesQuest++;
    if (out.length <= 4) clean++;
    Object.assign(rec, {
      status: "derived",
      setup: best.inv,
      len: best.len,
      speed: best.speed,
      outPieces: out,
      nOut: out.length,
      pair: `${pair.homeC},${pair.homeE} (${pair.kind})`,
      questMatch,
      questSetupLen: e.slug && QA[e.slug] ? normQuest(QA[e.slug].setup).split(" ").filter(Boolean).length : null,
    });
  } else {
    rec.status = "needs-construction";
  }
  results.push(rec);
}

writeFileSync(resolve(__dirname, "../generated/setups-independent.json"), JSON.stringify(results, null, 1));
console.log(`═══ DERIVACIÓN INDEPENDIENTE ═══`);
console.log(`casos: ${results.length} (41 basic + 126 advanced)`);
console.log(`derivados de nuestro corpus: ${derived}`);
console.log(`setups limpios (≤4 fuera): ${clean}`);
console.log(`coinciden con quest (mod rot): ${matchesQuest}`);
const nc = results.filter((r) => r.status === "needs-construction").map((r) => r.patid);
console.log(`necesitan construcción (${nc.length}): ${nc.join(", ")}`);
// resumen de limpieza
const dirty = results.filter((r) => r.status === "derived" && r.nOut > 4);
console.log(`derivados pero SUCIOS (>4 fuera): ${dirty.length}`);
for (const d of dirty) console.log(`   ${d.patid}: ${d.nOut} fuera (${d.outPieces.join("")})`);
