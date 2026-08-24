/**
 * Verificacion del modelo de slots:
 * 1) "1 caso, 4 rotaciones": el alg U R U' R' (FR) rotado y/y2/y' resuelve el
 *    MISMO caso en FL/BL/BR?
 * 2) Cobertura por ESTADO: de los algs de slot FR de los 41 casos basicos del
 *    seed, cuantos tienen equivalente real (mismo efecto) en la pagina de
 *    BirdF2L de su caso?
 * Uso: pnpm dlx tsx scripts/verify-slot-model.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { BASIC_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
function stateHash(s: CubeState): string {
  return (
    Array.from(s.cp).join("") + ";" + Array.from(s.co).join("") + ";" +
    Array.from(s.ep).join("") + ";" + Array.from(s.eo).join("")
  );
}
function minOverAuf(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = stateHash(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}

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

// ── 1) Test de rotaciones de slot ──
console.log("=== 1) UN CASO, 4 ROTACIONES ===");
const C = new CubeState();
C.applySequence("F R' F' R"); // caso Jb, par en FR
const variants = [
  { label: "FR  U R U' R'", moves: "U R U' R'" },
  { label: "FL  U F U' F'  (y)", moves: "U F U' F'" },
  { label: "BL  U L U' L'  (y2)", moves: "U L U' L'" },
  { label: "BR  U B U' B'  (y')", moves: "U B U' B'" },
];
for (const v of variants) {
  const r = C.clone();
  r.applySequence(v.moves);
  const solved = ["FR", "FL", "BR", "BL"].filter((n) => slotOk(r, SLOTS[n as keyof typeof SLOTS]));
  console.log(`  ${v.label.padEnd(26)} -> resuelve: ${solved.join(", ") || "nada"}`);
}

// ── 2) Cobertura por estado de nuestros algs FR ──
console.log("\n=== 2) COBERTURA POR ESTADO (algs FR del seed vs pagina BirdF2L) ===");
let total = 0, covered = 0;
const perCase: { cn: string; patid: string; t: number; c: number }[] = [];
for (const fc of BASIC_F2L_CASES) {
  const cn = fc.caseDef.caseNumber as string;
  const patid = F2L_TO_PATID[cn];
  if (!patid) continue;
  const C2 = new CubeState();
  C2.applySequence(fc.caseDef.setupScramble as string);
  // familias de la pagina (algs puros)
  const famSet = new Set<string>();
  for (const a of (data[patid]?.algs ?? []) as { moves: string }[]) {
    const r = C2.clone();
    try { r.applySequence(a.moves); } catch { continue; }
    if (slotOk(r, SLOTS.FR) && slotOk(r, SLOTS.FL) && slotOk(r, SLOTS.BR) && slotOk(r, SLOTS.BL)) {
      famSet.add(minOverAuf(r));
    }
  }
  // algs FR del seed
  let t = 0, c = 0;
  for (const a of fc.algorithms) {
    const slot = (a.notes ?? "").match(/Slot: (\w+)/)?.[1];
    if (slot !== "FR") continue;
    t++;
    const r = C2.clone();
    try { r.applySequence((a.moves as string[]).join(" ")); } catch { continue; }
    if (famSet.has(minOverAuf(r))) c++;
  }
  total += t;
  covered += c;
  if (t > 0) perCase.push({ cn, patid, t, c });
}
console.log(`Algs FR del seed (41 basicos): ${total}`);
console.log(`Con equivalente real en BirdF2L: ${covered} (${((100 * covered) / Math.max(1, total)).toFixed(1)}%)`);
console.log(`\nPor caso (todos los que tienen FR):`);
for (const p of perCase) {
  console.log(`  ${p.cn.padEnd(7)} ${p.patid}: ${p.c}/${p.t}`);
}
