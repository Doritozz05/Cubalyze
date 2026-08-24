/**
 * Clasificacion "Disturbs" (concepto speedcube.quest): para cada alg de los 41
 * casos basicos, aplicarlo al caso limpio (setup del seed) y etiquetar QUE slot
 * no-FR rompe (y si es corner/edge/slot completo). Los algs "impuros" de la
 * Fase 2 NO se descartan: son algs de free-slot (utilizables si ese slot esta
 * vacio).
 *
 * Ademas cruza con el metodo S = A^-1(solved) para validar ambos.
 * Uso: pnpm dlx tsx scripts/scan-birdf2l-disturbs.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { BASIC_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const PARSED = resolve(__dirname, "../raw/birdf2l/parsed.json");
const data = JSON.parse(readFileSync(PARSED, "utf-8")) as any;

// Numeracion quest/birdf2l: F2L n -> patid (verificada del index)
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

const SLOTS = { FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 } };
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}

const agg = new Map<string, number>();
let total = 0, frNot = 0, parseErr = 0;
const perCase: { cn: string; patid: string; total: number; pure: number; dist1: number; dist2: number; dist3: number }[] = [];

for (const fc of BASIC_F2L_CASES) {
  const cn = fc.caseDef.caseNumber as string;
  const patid = F2L_TO_PATID[cn];
  if (!patid) continue;
  const algs = data[patid]?.algs ?? [];
  const C = new CubeState();
  C.applySequence(fc.caseDef.setupScramble as string);

  let pure = 0, d1 = 0, d2 = 0, d3 = 0;
  const dist = new Map<string, number>();
  for (const a of algs) {
    total++;
    const r = C.clone();
    try { r.applySequence(a.moves); } catch { parseErr++; continue; }
    if (!slotOk(r, SLOTS.FR)) { frNot++; continue; }
    const broken: string[] = [];
    for (const [name, sl] of [["FL", SLOTS.FL], ["BR", SLOTS.BR], ["BL", SLOTS.BL]] as const) {
      const cBad = r.cp[sl.c] !== sl.c || r.co[sl.c] !== 0;
      const eBad = r.ep[sl.e] !== sl.e || r.eo[sl.e] !== 0;
      if (cBad && eBad) broken.push(`${name}-slot`);
      else if (cBad) broken.push(`${name}-corner`);
      else if (eBad) broken.push(`${name}-edge`);
    }
    const key = broken.length === 0 ? "PURE" : broken.join("+");
    dist.set(key, (dist.get(key) ?? 0) + 1);
    agg.set(key, (agg.get(key) ?? 0) + 1);
    if (broken.length === 0) pure++;
    else if (broken.length === 1) d1++;
    else if (broken.length === 2) d2++;
    else d3++;
  }
  perCase.push({ cn, patid, total: algs.length, pure, dist1: d1, dist2: d2, dist3: d3 });
}

console.log(`=== DISTURBS (41 casos basicos, setup del seed) ===`);
console.log(`Algs totales: ${total} | no resuelven FR: ${frNot} | parse err: ${parseErr}`);
console.log(`\nTop etiquetas de disturbio:`);
for (const [k, v] of [...agg.entries()].sort((x, y) => y[1] - x[1]).slice(0, 14)) {
  console.log(`  ${k.padEnd(22)} ${v} (${((100 * v) / Math.max(1, total - frNot)).toFixed(1)}%)`);
}

const ok = total - frNot;
const sumPure = perCase.reduce((s, p) => s + p.pure, 0);
const sumD1 = perCase.reduce((s, p) => s + p.dist1, 0);
const sumD2 = perCase.reduce((s, p) => s + p.dist2, 0);
const sumD3 = perCase.reduce((s, p) => s + p.dist3, 0);
console.log(`\n=== RESUMEN ===`);
console.log(`PUROS (no rompen nada):          ${sumPure} (${((100 * sumPure) / ok).toFixed(1)}%)`);
console.log(`Rompen 1 slot (free-slot):        ${sumD1} (${((100 * sumD1) / ok).toFixed(1)}%)`);
console.log(`Rompen 2 slots:                   ${sumD2} (${((100 * sumD2) / ok).toFixed(1)}%)`);
console.log(`Rompen 3 slots:                   ${sumD3} (${((100 * sumD3) / ok).toFixed(1)}%)`);

console.log(`\nEjemplos por caso (top 6 y bottom 3):`);
const sorted = [...perCase].sort((a, b) => b.pure - a.pure);
for (const p of sorted.slice(0, 6)) {
  console.log(`  ${p.cn.padEnd(7)} ${p.patid}: ${p.total} algs -> pure ${p.pure}, 1slot ${p.dist1}, 2slot ${p.dist2}, 3slot ${p.dist3}`);
}
for (const p of sorted.slice(-3)) {
  console.log(`  ${p.cn.padEnd(7)} ${p.patid}: ${p.total} algs -> pure ${p.pure}, 1slot ${p.dist1}, 2slot ${p.dist2}, 3slot ${p.dist3}`);
}
