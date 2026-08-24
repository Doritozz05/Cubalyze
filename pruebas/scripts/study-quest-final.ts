/**
 * ESTUDIO FINAL — con el criterio real de quest.
 *
 * Quest NO exige que un alg preserve el F2L: usa "disturbs" para marcar
 * qué slot rompe. Un alg es válido si RESUELVE LA PAREJA en su slot hogar.
 *
 * Preguntas:
 *  1) ¿los algs de quest resuelven su setup con criterio pareja?
 *  2) ¿qué caso crea NUESTRO setup de la taxonomía? (pareja + piezas fuera)
 *  3) ¿el setup de quest = inverso de algún alg (alg o algid) mod rotación?
 *  4) ¿nuestros algs fused resuelven el setup de quest (criterio pareja)?
 */
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST_DIR = resolve(__dirname, "../raw/quest/study");
const TAX = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/f2l-taxonomy.json"), "utf-8")).cases;
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
/** Criterio quest: pareja C4+E8 resuelta en FR (DFR/FR), orientadas. */
function pairSolved(s: CubeState, hc: number, he: number): boolean {
  // home: corner hc está en posición hc con co=0, edge he en posición he con eo=0
  return s.cp[hc] === hc && s.co[hc] === 0 && s.ep[he] === he && s.eo[he] === 0;
}
/** F2L estrictamente resuelto. */
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 8; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function stateRot(s: CubeState, rot: string): CubeState {
  const t = s.clone();
  if (rot) t.applySequence(rot);
  return t;
}
/** Compara el estado F2L de dos estados mod rotación → rotación que los iguala o null */
function f2lSameUpToRot(a: CubeState, b: CubeState): string | null {
  for (const rot of ROTS) {
    const t = stateRot(a, rot);
    let same = true;
    for (let i = 4; i <= 7; i++) if (t.cp[i] !== b.cp[i] || t.co[i] !== b.co[i]) { same = false; break; }
    if (!same) continue;
    for (let i = 8; i <= 11; i++) if (t.ep[i] !== b.ep[i] || t.eo[i] !== b.eo[i]) { same = false; break; }
    if (same) return rot || "(sin rot)";
  }
  return null;
}

// ── 3) inverso del algid/alg vs setup ──────────────────────────────────────
console.log("═══ ¿setup = inverso de un alg? (mod rotación) ═══");
for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const sm = src.match(/selectedSetup:\s*"([^"]+)"/);
  if (!sm) continue;
  const S = stateOf(sm[1]);
  const row1 = src.match(/rows:\{a:\[\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)"/);
  let info = "sin rows";
  if (row1) {
    const alg = row1[1];
    const algid = row1[2].replace(/^(reco|scdb):/, "");
    const variants = [`${alg} ${row1[3]}`.trim(), algid, `${algid} ${row1[3]}`.trim()];
    for (const v of variants) {
      const invState = stateOf(invertSeq(v));
      const rot = f2lSameUpToRot(invState, S);
      if (rot) { info = `✅ inverso de "${v}" = setup (rot ${rot})`; break; }
    }
    if (info === "sin rows" || info.startsWith("sin")) {
      const invState = stateOf(invertSeq(alg));
      info = f2lSameUpToRot(invState, S) ? `✅ inverso de "${alg}" = setup` : "no";
    }
  }
  console.log(`  ${code.padEnd(4)}: ${info}`);
}

// ── 1) algs de quest resuelven su setup (criterio pareja) ─────────────────
console.log("\n═══ algs de quest vs su setup (criterio quest: pareja en FR) ═══");
for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const sm = src.match(/selectedSetup:\s*"([^"]+)"/);
  if (!sm) continue;
  const S = stateOf(sm[1]);
  const rows = [...src.matchAll(/\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)"/g)];
  let okPair = 0, okF2L = 0;
  for (const r of rows.slice(0, 20)) {
    const alg = normQuest(r[1]);
    const auf = normQuest(r[3]);
    for (const combo of [alg, `${alg} ${auf}`.trim(), `${auf} ${alg}`.trim()]) {
      const t = S.clone();
      try { t.applySequence(combo); } catch { continue; }
      if (pairSolved(t, 4, 8)) okPair++;
      if (f2lSolved(t)) okF2L++;
      if (okPair && okF2L) break;
    }
  }
  console.log(`  ${code.padEnd(4)}: pareja ${okPair}/${rows.length} | F2L completo ${okF2L}/${rows.length}`);
}

// ── 2) nuestro setup de taxonomía: ¿qué caso crea? ────────────────────────
console.log("\n═══ nuestro setup (taxonomía) vs quest ═══");
for (const f of readdirSync(QUEST_DIR).filter((x) => x.endsWith(".html")).sort()) {
  const code = f.replace(".html", "");
  const patid = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  const src = readFileSync(resolve(QUEST_DIR, f), "utf-8");
  const sm = src.match(/selectedSetup:\s*"([^"]+)"/);
  const ours = TAX[patid];
  if (!sm || !ours?.setup) continue;
  const S = stateOf(sm[1]);
  const O = stateOf(ours.setup);
  const rot = f2lSameUpToRot(O, S);
  console.log(`  ${patid.padEnd(4)}: ${rot ? `✅ mismo caso (rot ${rot})` : "❌ caso distinto"}`);
}

// ── 4) nuestros fused vs setup quest (criterio pareja) ────────────────────
console.log("\n═══ nuestros algs fused vs setup quest (pareja en FR) ═══");
for (const pid of ["Cf", "Ub", "Ui", "Vj", "Jb"]) {
  const src = readFileSync(resolve(QUEST_DIR, pid.toLowerCase() + ".html"), "utf-8");
  const sm = src.match(/selectedSetup:\s*"([^"]+)"/);
  if (!sm) continue;
  const S = stateOf(sm[1]);
  const fused = FUSED_B.find((c: any) => c.caseDef.caseNumber === pid) ?? FUSED_A.find((c: any) => c.caseDef.caseNumber === pid);
  if (!fused) { console.log(`  ${pid}: no está en fused`); continue; }
  let okPair = 0, okF2L = 0;
  for (const a of fused.algorithms as any[]) {
    const alg = (a.moves as string[]).join(" ");
    const t = S.clone();
    try { t.applySequence(alg); } catch { continue; }
    if (pairSolved(t, 4, 8)) okPair++;
    if (f2lSolved(t)) okF2L++;
  }
  console.log(`  ${pid}: fused ${okPair}/${fused.algorithms.length} resuelven pareja | ${okF2L} resuelven F2L completo`);
}
