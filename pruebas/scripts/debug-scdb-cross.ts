/**
 * Debug del cruce SCDB↔BirdF2L: por cada caso basico, algs FR del seed,
 * si su texto esta en la pagina BirdF2L del patron, y si el match por clase
 * LL se produce.
 * Uso: pnpm dlx tsx pruebas/scripts/debug-scdb-cross.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const PARSED = JSON.parse(readFileSync(resolve(__dirname, "../raw/birdf2l/parsed.json"), "utf-8")) as Record<string, { algs: { moves: string }[] }>;

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
  return Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" + Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("");
}
function minOverAufHash(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = stateHash(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

let basicTotal = 0, basicMatched = 0, basicNoFp = 0;
let advancedTotal = 0, advancedMatched = 0;

for (const fc of ALL_F2L_CASES) {
  const cn = fc.caseDef.caseNumber as string;
  const patid = F2L_TO_PATID[cn];
  const isBasic = !!patid;
  const frAlgs = fc.algorithms.filter((a) => (a.notes ?? "").includes("Slot: FR"));
  if (isBasic) basicTotal += frAlgs.length;
  else advancedTotal += frAlgs.length;

  // estado canonico del patron (o de su setup para advanced)
  let S: CubeState;
  if (patid) {
    const algs = PARSED[patid]?.algs ?? [];
    const tally = new Map<string, CubeState>();
    for (const a of algs) {
      const s = new CubeState();
      try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
      const k = pairPos(s);
      if (!tally.has(k)) tally.set(k, s);
    }
    let bestN = 0; let st: CubeState | null = null;
    const cnt = new Map<string, number>();
    for (const a of algs) {
      const s = new CubeState();
      try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
      const k = pairPos(s);
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    for (const [k, n] of cnt) if (n > bestN) { bestN = n; st = tally.get(k) ?? null; }
    if (!st) { console.log(`${cn}: SIN estado canonico`); continue; }
    S = st;
  } else {
    S = new CubeState();
    try { S.applySequence(fc.caseDef.setupScramble as string); } catch { continue; }
  }

  // match por clase LL
  let matched = 0;
  const hits: string[] = [];
  for (const a of frAlgs) {
    const moves = (a.moves as string[]).join(" ");
    const st = S.clone();
    let ok = true;
    try { st.applySequence(moves); } catch { ok = false; }
    if (!ok || !f2lSolved(st)) continue;
    const ll = minOverAufHash(st);
    // buscar familia BirdF2L con esa clase (solo si el texto esta en la pagina)
    const pageSet = patid ? new Set((PARSED[patid]?.algs ?? []).map((x) => x.moves)) : null;
    const textHit = pageSet ? pageSet.has(moves) : false;
    matched++;
    hits.push(`${moves}${textHit ? "[textoOK]" : "[textoNO]"}`);
  }
  if (isBasic) basicMatched += matched;
  else advancedMatched += matched;
  console.log(`${cn.padEnd(7)} ${patid ?? "(adv)"} FR algs: ${frAlgs.length} -> matchean ${matched} | ${hits.join(" | ")}`);
}

console.log(`\nBASIC: ${basicMatched}/${basicTotal} | ADVANCED: ${advancedMatched}/${advancedTotal}`);
