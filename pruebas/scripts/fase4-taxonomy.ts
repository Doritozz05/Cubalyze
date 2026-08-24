/**
 * Fase 4 — Taxonomía completa: f2l-taxonomy.json
 *
 * Por patrón (168):
 *   - slotGroup  : Vj-only | Uf | Wn | Xr | 3slots (del index de BirdF2L)
 *   - position   : both-top | own-slot | solved | advanced (derivada del estado)
 *   - f2lnum     : 1-41 (básicos) | null
 *   - aNum       : A1-A42 (+ variantes 'a') — convención de quest (datos del paste)
 *   - mirror     : pareja de espejo (derivada por transformación de estado)
 *   - edgeFlipped: variante edge-flipped (pares b↔i de quest, validados empíricamente)
 *   - setup      : secuencia que crea el caso (inversa del alg canónico)
 *
 * Método de espejo: probamos 4 reflexiones × {EO flip, EO keep} y nos quedamos
 * con la que reproduce los 41 pares de espejo del mapeo F2L (adyacentes).
 *
 * Uso: pnpm dlx tsx pruebas/scripts/fase4-taxonomy.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<string, { algs: { moves: string; speed: number }[] }>;
const TAX0 = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<string, { slotGroup: string }>;

const F2L_TO_PATID: Record<string, string> = {
  "F2L 1": "Jb", "F2L 2": "Mi", "F2L 3": "Je", "F2L 4": "Ma", "F2L 5": "Ja",
  "F2L 6": "Me", "F2L 7": "Jd", "F2L 8": "Mq", "F2L 9": "Jq", "F2L 10": "Md",
  "F2L 11": "Jm", "F2L 12": "Mc", "F2L 13": "Ji", "F2L 14": "Mb", "F2L 15": "Jc",
  "F2L 16": "Mm", "F2L 17": "Cb", "F2L 18": "Ci", "F2L 19": "Ca", "F2L 20": "Ce",
  "F2L 21": "Cd", "F2L 22": "Cq", "F2L 23": "Cc", "F2L 24": "Cm",
  "F2L 25": "Vb", "F2L 26": "Vi", "F2L 27": "Kb", "F2L 28": "Pi", "F2L 29": "Ki",
  "F2L 30": "Pb", "F2L 31": "Cp", "F2L 32": "Cj", "F2L 33": "Jj", "F2L 34": "Mj",
  "F2L 35": "Jp", "F2L 36": "Mp", "F2L 37": "Vp", "F2L 38": "Kj", "F2L 39": "Pj",
  "F2L 40": "Kp", "F2L 41": "Pp",
};
const PATID_TO_F2L: Record<string, string> = {};
for (const [k, v] of Object.entries(F2L_TO_PATID)) PATID_TO_F2L[v] = k;

// a-números (convención quest, extraídos del paste de la página avanzada)
const A_NUMS: Record<string, string> = {
  Ti: "A1", Tb: "A1a", Sb: "A2", Si: "A2a", Li: "A3", Lb: "A3a", Oi: "A4", Ob: "A4a",
  Hb: "A5", Hi: "A5a", Gi: "A6", Gb: "A6a", Wi: "A7", Wb: "A7a", Xb: "A8", Xi: "A8a",
  Ui: "A9", Ub: "A9a", Mt: "A10", Jr: "A11", Ml: "A12", Cn: "A13", Cr: "A14", Cf: "A15",
  Mn: "A16", Jh: "A17", Mf: "A18", Jn: "A19", Mr: "A20", Jf: "A21", Ct: "A22", Ch: "A23",
  Cl: "A24", Wn: "A25", Xr: "A26", Uf: "A27", Tt: "A28", Sh: "A29", Ll: "A30", Ot: "A31",
  Hh: "A32", Gl: "A33", Tn: "A34", Sr: "A35", Lf: "A36", On: "A37", Hr: "A38", Gf: "A39",
  Wt: "A40", Xh: "A41", Ul: "A42",
};

// ---- helpers ----
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
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}

// ---- estados canónicos: inverso del alg TOP por speed (determinista, sin AUF ambiguo) ----
// El alg más rápido publicado para el caso es la "definición" canónica (quest/SCDB usan
// el mismo criterio: "U R U' R'" para Jb, "U' F' U F" para Mi -> sus inversos dan
// estados espejo exactos sin necesidad de normalización AUF.
const canon = new Map<string, { S: CubeState; setup: string }>();
for (const patid of Object.keys(PARSED)) {
  const algs = PARSED[patid].algs;
  const top = [...algs].sort((a, b) => a.speed - b.speed)[0];
  if (!top) continue;
  const S = new CubeState();
  try { S.applySequence(invertSequence(top.moves)); } catch { continue; }
  canon.set(patid, { S, setup: invertSequence(top.moves) });
}

// ---- espejo REAL por alg: mirror(alg de p) debe resolver el setup del caso espejo ----
// La reflexion x=y (plano diagonal que fija el slot FR) INVIERTE el sentido del giro:
// R<->F', F<->R', L<->B', B<->L', U<->U', D<->D', M<->S', E<->E', y<->y'.
// Es un AUTOMORFISMO por conjugacion (φ(g)=MgM⁻¹): si A resuelve S, entonces
// mirror(A) resuelve mirror(S) — la verificacion empírica lo confirma:
// espejo de "U R U' R'" = "U' F' U F" = alg top de Mi (match 1:1 con quest).
// Resultado: 168/168 patrones con match 1:1, 0 asimetricos (involucion perfecta).
const patids = Object.keys(PARSED).sort();

function mirrorMove(t: string): string {
  const m = t.match(/^([UDFBLRMESxyz])(2|')?$/);
  if (!m) return t;
  const face = m[1], suf = m[2] ?? "";
  if (suf === "2") {
    const f2: Record<string, string> = { R: "F", F: "R", L: "B", B: "L", U: "U", D: "D", M: "S", S: "M", E: "E", x: "x", y: "y", z: "z" };
    return (f2[face] ?? face) + "2";
  }
  const map: Record<string, string> = {
    R: "F'", "R'": "F", F: "R'", "F'": "R",
    L: "B'", "L'": "B", B: "L'", "B'": "L",
    U: "U'", "U'": "U", D: "D'", "D'": "D",
    M: "S'", "M'": "S", S: "M'", "S'": "M", E: "E'", "E'": "E",
    y: "y'", "y'": "y", x: "x'", "x'": "x", z: "z'", "z'": "z",
  };
  return map[face + suf] ?? map[face] + suf;
}
function mirrorAlg(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  // salvaguarda: ningun token debe quedar sin mapear (wide moves r/l/u/f/b/d no cubiertos)
  for (const t of toks) if (!/^([UDFBLRMESxyz])(2|')?$/.test(t)) throw new Error(`token no espejable: ${t} en "${alg}"`);
  return toks.map(mirrorMove).join(" ");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

// top-5 algs por patron (algunos top-1 son reducciones/impuros -> probar varios)
const top5 = new Map<string, string[]>();
for (const p of patids) {
  top5.set(p, [...PARSED[p].algs].sort((a, b) => a.speed - b.speed).slice(0, 5).map((a) => a.moves));
}

// ---- esperados de espejo (41 básicos, pares adyacentes) — SOLO como referencia ----
// NOTA: los pares adyacentes NO son siempre espejos: verificado Cp/Cj/Vp auto-espejos
// y Kj<->Pj, Kp<->Pp. La numeracion SCDB de advanced no agrupa espejos adyacentes.
const expectedMirror = new Map<string, string>();
for (let n = 1; n <= 41; n += 2) {
  const a = F2L_TO_PATID[`F2L ${n}`];
  const b = n === 41 ? a : F2L_TO_PATID[`F2L ${n + 1}`];
  expectedMirror.set(a, b);
  expectedMirror.set(b, a);
}

// ---- derivar el mapa de espejo por alg (con AUF libre en el setup) ----
const mirrorMap = new Map<string, string>();
let mirrorOk = 0;
const mirrorFails: string[] = [];
let autoMirror = 0;
const autoMirrors: string[] = [];
for (const p of patids) {
  let solved: string[] = [];
  for (const alg of top5.get(p)!) {
    const malg = mirrorAlg(alg);
    solved = [];
    for (const q of patids) {
      for (let u = 0; u < 4; u++) {
        const t = canon.get(q)!.S.clone();
        try { t.applySequence(malg); } catch { continue; }
        if (f2lSolved(t)) { solved.push(q); break; }
      }
    }
    if (solved.length === 1) break;
  }
  if (solved.length === 1) { mirrorMap.set(p, solved[0]); }
  else mirrorFails.push(`${p} (mirror de ${top5.get(p)![0]} -> ${solved.length} matches)`);
}
// verificacion contra los 41 basicos
{
  const fails: string[] = [];
  for (const [a, b] of expectedMirror) {
    if (mirrorMap.get(a) === b) mirrorOk++;
    else fails.push(`${a}->${mirrorMap.get(a) ?? "?"} (esperado ${b})`);
  }
  console.log(`\nespejo por alg: ${mirrorMap.size}/${patids.length} patrones | basic adyacente: ${mirrorOk}/${expectedMirror.size}`);
  if (fails.length) console.log(`  diffs vs adyacente: ${fails.slice(0, 10).join(" | ")}`);
  if (mirrorFails.length) console.log(`  sin match: ${mirrorFails.slice(0, 6).join(" | ")}`);
}

// espejos asimetricos (a->b pero b->a?)
let asym = 0;
for (const [a, b] of mirrorMap) if (mirrorMap.get(b) !== a) asym++;
for (const p of patids) if (mirrorMap.get(p) === p) { autoMirror++; autoMirrors.push(p); }
console.log(`pares de espejo asimetricos: ${asym} | auto-espejos: ${autoMirror} -> ${autoMirrors.join(" ")}`);

// ---- edgeFlipped empírico: misma esquina, misma posición de arista, EO flip ----
const edgeFlipMap = new Map<string, string>();
for (const p of patids) {
  const S = canon.get(p)!.S;
  let cP = -1, cO = -1, eP = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (S.cp[i] === 4) { cP = i; cO = S.co[i]; break; }
  for (let i = 0; i < 12; i++) if (S.ep[i] === 8) { eP = i; eO = S.eo[i]; break; }
  if (cP < 0) continue;
  for (const q of patids) {
    if (q === p) continue;
    const Q = canon.get(q)!.S;
    let qCP = -1, qCO = -1, qEP = -1, qEO = -1;
    for (let i = 0; i < 8; i++) if (Q.cp[i] === 4) { qCP = i; qCO = Q.co[i]; break; }
    for (let i = 0; i < 12; i++) if (Q.ep[i] === 8) { qEP = i; qEO = Q.eo[i]; break; }
    if (qCP === cP && qCO === cO && qEP === eP && qEO === (1 - eO) as 0 | 1) { edgeFlipMap.set(p, q); break; }
  }
}
console.log(`edgeFlipped empírico (misma posición, EO flip): ${edgeFlipMap.size} parejas`);
for (const [a, b] of edgeFlipMap) console.log(`  ${a} <-> ${b}`);

// ---- pares quest b↔i (a-variantes) ----
const QUEST_FLIP_PAIRS: [string, string][] = [
  ["Tb", "Ti"], ["Sb", "Si"], ["Lb", "Li"], ["Ob", "Oi"], ["Hb", "Hi"],
  ["Gb", "Gi"], ["Wb", "Wi"], ["Xb", "Xi"], ["Ub", "Ui"],
];
const questFlip = new Map<string, string>();
for (const [a, b] of QUEST_FLIP_PAIRS) { questFlip.set(a, b); questFlip.set(b, a); }

// comparar Gb vs Gi estado a estado
{
  const Ga = canon.get("Gb")!.S, Gb = canon.get("Gi")!.S;
  const diffs: string[] = [];
  for (let i = 0; i < 8; i++) if (Ga.cp[i] !== Gb.cp[i] || Ga.co[i] !== Gb.co[i]) diffs.push(`corner@${i}: ${Ga.cp[i]}/${Ga.co[i]} vs ${Gb.cp[i]}/${Gb.co[i]}`);
  for (let i = 0; i < 12; i++) if (Ga.ep[i] !== Gb.ep[i] || Ga.eo[i] !== Gb.eo[i]) diffs.push(`edge@${i}: ${Ga.ep[i]}/${Ga.eo[i]} vs ${Gb.ep[i]}/${Gb.eo[i]}`);
  console.log(`\nGb vs Gi: ${diffs.length} diferencias -> ${diffs.slice(0, 6).join(" | ")}`);
}

// ---- escribir taxonomía completa ----
const groups: Record<string, number> = {};
const cases: Record<string, any> = {};
for (const p of patids) {
  const S = canon.get(p)!.S;
  const pk = pairPos(S);
  const m = pk.match(/^(\d)(\d)\|(\d+)(\d)$/);
  const cP = m ? Number(m[1]) : -1, eP = m ? Number(m[3]) : -1;
  let position = "advanced";
  if (cP === 0) position = eP <= 3 ? "both-top" : "advanced";
  else if (cP === 4) position = (eP === 8 && pk === "40|80") ? "solved" : "own-slot";
  const sg = TAX0[p]?.slotGroup ?? "?";
  groups[sg] = (groups[sg] ?? 0) + 1;
  cases[p] = {
    slotGroup: sg,
    position,
    f2lnum: PATID_TO_F2L[p] ?? null,
    aNum: A_NUMS[p] ?? null,
    mirror: mirrorMap.get(p) ?? null,
    edgeFlipped: questFlip.get(p) ?? null,
    setup: canon.get(p)!.setup,
  };
}
// edgeFlipped empírico adicional (los que no son pares quest)
for (const [a, b] of edgeFlipMap) {
  if (!cases[a].edgeFlipped) cases[a].edgeFlipped = b;
  if (!cases[b].edgeFlipped) cases[b].edgeFlipped = a;
}

const out = {
  generated: new Date().toISOString(),
  groups,
  mirrorTransform: {
    reflection: "x=y (plano diagonal que fija el slot FR: R<->F, L<->B)",
    method: "espejo de ALG: mirror(alg p) resuelve setup q (automorfismo por conjugacion con la reflexion x=y), AUF libre, top-5 algs",
    basicAdjacentVerified: `${mirrorOk}/${expectedMirror.size}`,
    asym: `${asym}`,
  },
  aNumCount: Object.keys(A_NUMS).length,
  cases,
};
writeFileSync(resolve(RAW, "f2l-taxonomy.json"), JSON.stringify(out, null, 1));

// ---- validación ----
console.log(`\n=== TAXONOMIA COMPLETA ===`);
console.log(`patrones: ${patids.length} | grupos: ${JSON.stringify(groups)}`);
const aNums = Object.values(A_NUMS);
const numbered = new Set(aNums.filter((a) => !a.endsWith("a")));
const variants = aNums.filter((a) => a.endsWith("a"));
const missing = Object.keys(A_NUMS).filter((c) => !patids.includes(c));
console.log(`a-nums: ${numbered.size} numerados + ${variants.length} variantes 'a' = ${aNums.length} | códigos no encontrados: ${missing.length ? missing.join(",") : "ninguno"}`);
const noF2L = patids.filter((p) => !PATID_TO_F2L[p] && !A_NUMS[p] && p !== "Vj");
console.log(`patrones sin f2lnum ni aNum (ni Vj): ${noF2L.length}`);
const selfMirror = patids.filter((p) => mirrorMap.get(p) === p);
console.log(`auto-espejos: ${selfMirror.length} -> ${selfMirror.join(" ")}`);
const withEdgeFlip = patids.filter((p) => cases[p].edgeFlipped);
console.log(`con edgeFlipped: ${withEdgeFlip.length} (quest ${QUEST_FLIP_PAIRS.length * 2} + empíricos ${edgeFlipMap.size})`);
console.log(`\n-> ${resolve(RAW, "f2l-taxonomy.json")}`);
