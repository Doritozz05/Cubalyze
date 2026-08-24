/**
 * PRUEBA DECISIVA v2 — ¿de dónde salen los setups de quest?
 *
 * Correcciones vs v1:
 *  - Comparar estado F2L (corners 4-7 + edges 8-11), no el cubo completo:
 *    un alg de F2L deja la capa U scramblada → isSolved() era el criterio mal.
 *  - Resolver el ternario invertido del v1.
 *
 * Preguntas:
 *   A) ¿inverso del alg top de quest == setup de quest? (estado F2L, mod rotación)
 *   B) ¿el alg top de quest resuelve su setup? (F2L resuelto)
 *   C) ¿nuestro setup (taxonomía) crea el MISMO caso F2L que quest?
 *   D) ¿nuestros algs fused resuelven el setup de quest? (F2L resuelto)
 */
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;
const FUSED = JSON.parse(readFileSync(resolve(__dirname, "../generated/scdb-af2l-fused.json"), "utf-8")).cases;

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
function invertSeq(moves: string): string {
  return moves.split(" ").filter(Boolean).reverse().map((m) => INV[m] ?? m).join(" ");
}
function normQuest(s: string): string {
  return s.replace(/([RLUDFBMES]w?|[rludbfxyz])2'/g, "$12").replace(/’/g, "'");
}
function stateOf(moves: string): CubeState {
  const s = new CubeState();
  s.applySequence(normQuest(moves));
  return s;
}
/** Compara SOLO el estado F2L (corners 4-7, edges 8-11, con orientaciones). */
function sameF2L(a: CubeState, b: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 8; i <= 11; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
/** ¿F2L resuelto? (la capa U puede estar scramblada) */
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
/** Prueba las 24 orientaciones del cubo: ¿b = rotación(a)? */
function sameUpToRotation(a: CubeState, b: CubeState): string | null {
  const rots = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
  const combos: string[] = [];
  for (const r1 of rots) for (const r2 of ["", "y", "y2", "y'", "z", "z2", "x", "x2", "x'"]) {
    combos.push(`${r1} ${r2}`.trim());
  }
  for (const rot of combos) {
    const t = a.clone();
    try { t.applySequence(rot); } catch { continue; }
    if (sameF2L(t, b)) return rot || "(sin rotación)";
  }
  return null;
}

for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  const patid = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const m = src.match(/selectedSetup:\s*"([^"]+)"/);
  const basicM = src.match(/basic:\s*(true|false)/);
  if (!m) { console.log(`${patid}: sin setup`); continue; }
  const S = stateOf(m[1]);

  // A) inverso del alg top == setup? (estado F2L, mod rotación)
  const top = src.match(/rows:\{a:\[\{alg:"([^"]+)"/);
  let aInfo = "n/a";
  if (top) {
    const invTop = stateOf(invertSeq(top[1]));
    const rot = sameUpToRotation(invTop, S);
    aInfo = rot ? `ROT:${rot}` : "no(rot)";
    // B) ¿el alg top (sin auf) resuelve el setup?
    const t = S.clone(); t.applySequence(normQuest(top[1]));
    aInfo += ` | solve:${f2lSolved(t) ? "SÍ" : "no"}`;
  }

  // C) nuestro setup ¿mismo caso F2L que quest? (mod rotación)
  const ours = TAX[patid];
  let cInfo = "sin taxonomía";
  if (ours?.setup) {
    const O = stateOf(ours.setup);
    const rot = sameUpToRotation(O, S);
    cInfo = rot ? `ROT:${rot}` : "no(rot)";
  }

  console.log(`${patid} (${basicM?.[1] === "true" ? "BASIC" : "ADV"}): A)[${aInfo}] C)[${cInfo}]`);
}

// D) algs fused vs setup quest, para Cf y Vj
for (const pid of ["Cf", "Vj", "Ub"]) {
  const caseF = pid.toLowerCase();
  const file = resolve(QUEST_DIR, caseF + ".html");
  if (!readFileSync(file, "utf-8")) continue;
  const src = readFileSync(file, "utf-8");
  const m = src.match(/selectedSetup:\s*"([^"]+)"/);
  if (!m) continue;
  const S = stateOf(m[1]);
  // algs de quest (con auf)
  const qRows = [...src.matchAll(/\{alg:"([^"]+)",algid:"[^"]*",auf:"([^"]*)"/g)];
  let qOk = 0, qErr = 0;
  for (const r of qRows) {
    const t = S.clone();
    try { t.applySequence(normQuest(r[1] + " " + r[2])); } catch { qErr++; continue; }
    if (f2lSolved(t)) qOk++;
  }
  // algs fused nuestros
  const fused = FUSED.find((c: any) => c.caseDef.caseNumber === pid);
  let fOk = 0;
  if (fused) for (const a of fused.algorithms as any[]) {
    const t = S.clone();
    try { t.applySequence((a.moves as string[]).join(" ")); } catch { continue; }
    if (f2lSolved(t)) fOk++;
  }
  console.log(`\nD) ${pid}: quest algs ${qOk}/${qRows.length} resuelven su setup (${qErr} err) | fused ${fOk}/${fused?.algorithms.length ?? "?"} resuelven el setup quest`);
}
