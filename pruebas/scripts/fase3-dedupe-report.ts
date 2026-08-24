/**
 * Fase 3 — Dedupe profesional + reporte de fusión (SCDB + BirdF2L).
 *
 * Por cada uno de los 168 patrones:
 *   1) Estado canónico S_p = A⁻¹(solved) (voto mayoritario de la firma del par)
 *   2) Verificación exacta contra el caso real: A(S_p) deja el F2L COMPLETO
 *      resuelto (esquinas 4-7 + aristas 4-11 en casa) -> "puro"
 *   3) Si resuelve FR pero rompe otros slots -> clasificación "disturbs"
 *   4) Dedupe por familia: estado resultante AUF-canónico (caza "mismo efecto
 *      hasta rotación U", incl. moves extra al final)
 *   5) Cruce SCDB ↔ BirdF2L por estado resultante (regla de fusión: match = mismo
 *      efecto; SCDB gana y se enriquece)
 *   6) Top-100 por speed (cap decidido)
 *   7) Comparación con quest (Jb): filas, algs 1:1, pureza, disturbs, ranking
 *
 * Uso: pnpm dlx tsx pruebas/scripts/fase3-dedupe-report.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";

const RAW = resolve(__dirname, "../raw/birdf2l");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<
  string,
  { algs: { moves: string; speed: number; stm: number; htm: number; qtm: number; algid: string }[] }
>;
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string,
  { slotGroup: string }
>;
const QUEST = JSON.parse(readFileSync(resolve(__dirname, "../raw/quest/jb-data.json"), "utf-8")) as any;

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

const SLOTS = {
  FR: { c: 4, e: 8 }, FL: { c: 5, e: 9 }, BR: { c: 7, e: 11 }, BL: { c: 6, e: 10 },
};
function slotOk(s: CubeState, sl: { c: number; e: number }): boolean {
  return s.cp[sl.c] === sl.c && s.co[sl.c] === 0 && s.ep[sl.e] === sl.e && s.eo[sl.e] === 0;
}
function frSolved(s: CubeState): boolean { return slotOk(s, SLOTS.FR); }
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i <= 7; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i <= 11; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
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
/** huella de CASO: solo piezas F2L (las LL se anonimizan). Dos setups del mismo
 *  caso dan la misma huella aunque el LL difiera (varia entre setups). */
function caseFp(s: CubeState): string {
  const parts: string[] = [];
  // solo piezas F2L: esquinas 4-7, aristas 4-11 (las LL se anonimizan)
  for (let i = 0; i < 8; i++) if (s.cp[i] >= 4) parts.push(`c${s.cp[i]}@${i}${s.co[i]}`);
  for (let i = 0; i < 12; i++) if (s.ep[i] >= 4) parts.push(`e${s.ep[i]}@${i}${s.eo[i]}`);
  return parts.sort().join(",");
}
function minOverAufFp(s: CubeState): string {
  let best = "";
  const c = s.clone();
  for (let k = 0; k < 4; k++) {
    const h = caseFp(c);
    if (best === "" || h < best) best = h;
    if (k < 3) c.applySequence("U");
  }
  return best;
}
/** firma del par: posicion+orientacion de la esquina (pieza 4) y arista (pieza 8) */
function pairPos(s: CubeState): string {
  let c = -1, cO = -1, e = -1, eO = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; cO = s.co[i]; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; eO = s.eo[i]; break; }
  return `${c}${cO}|${e}${eO}`;
}
function classifyDisturbs(r: CubeState): { label: string; broken: string[] } {
  const broken: string[] = [];
  for (const [name, sl] of [["FL", SLOTS.FL], ["BR", SLOTS.BR], ["BL", SLOTS.BL]] as const) {
    const cBad = r.cp[sl.c] !== sl.c || r.co[sl.c] !== 0;
    const eBad = r.ep[sl.e] !== sl.e || r.eo[sl.e] !== 0;
    if (cBad && eBad) broken.push(`${name}-slot`);
    else if (cBad) broken.push(`${name}-corner`);
    else if (eBad) broken.push(`${name}-edge`);
  }
  return { label: broken.length === 0 ? "PURE" : broken.join("+"), broken };
}

// ============ SCDB: algs FR agrupados por huella de caso ============
// El match DEBE ser dentro del mismo caso: la huella del caso = disposición F2L
// del setup (las piezas LL se anonimizan). El match se hace aplicando el alg
// SCDB al estado canónico del patrón y comparando la clase LL resultante.
interface ScdbEntry { algid: string; caseNumber: string; votes: number; moves: string; isDefault: boolean; llClass: string | null }
const scdbByCaseFp = new Map<string, ScdbEntry[]>();
const fpToCase = new Map<string, string[]>();
for (const fc of ALL_F2L_CASES) {
  const setup = fc.caseDef.setupScramble as string;
  const s0 = new CubeState();
  try { s0.applySequence(setup); } catch { continue; }
  const setupKey = minOverAufFp(s0);
  const arr = fpToCase.get(setupKey) ?? [];
  if (!arr.includes(fc.caseDef.caseNumber)) arr.push(fc.caseDef.caseNumber);
  fpToCase.set(setupKey, arr);
  const list = scdbByCaseFp.get(setupKey) ?? [];
  for (const a of fc.algorithms) {
    const slot = (a.notes ?? "").match(/Slot: (\w+)/)?.[1] ?? "?";
    if (slot !== "FR") continue;
    list.push({ algid: a.id, caseNumber: fc.caseDef.caseNumber, votes: a.votes ?? 0, moves: (a.moves as string[]).join(" "), isDefault: !!a.isDefault, llClass: null });
  }
  scdbByCaseFp.set(setupKey, list);
}

// ============ Bucle por patrón ============
interface Fam {
  key: string; moves: string; speed: number; stm: number; size: number;
  pure: boolean; disturbs: string; scdb: { algid: string; caseNumber: string; votes: number; moves: string; isDefault: boolean }[] | null;
}

const report: any[] = [];
let sum = { total: 0, pure: 0, impure: 0, noSolver: 0, families: 0, pureFams: 0 };

for (const patid of Object.keys(PARSED).sort()) {
  const algs = PARSED[patid].algs;
  // estado canónico por voto mayoritario de la firma del par
  const tally = new Map<string, { n: number; state: CubeState }>();
  for (const a of algs) {
    const s = new CubeState();
    try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
    const k = pairPos(s);
    const e = tally.get(k);
    if (e) e.n++;
    else tally.set(k, { n: 1, state: s });
  }
  let bestK = "", bestN = 0;
  let S: CubeState | null = null;
  let setupMoves = "";
  for (const [k, e] of tally) if (e.n > bestN) { bestK = k; bestN = e.n; S = e.state; setupMoves = PARSED[patid].algs.find((a) => {
    const t = new CubeState();
    try { t.applySequence(invertSequence(a.moves)); } catch { return false; }
    return pairPos(t) === k;
  })?.moves ?? ""; }
  if (!S) continue;

  // clasificación de posición desde el estado canónico
  const m = bestK.match(/^(\d)(\d)\|(\d+)(\d)$/);
  const cPos = m ? Number(m[1]) : -1;
  const ePos = m ? Number(m[3]) : -1;
  let position = "advanced";
  if (cPos === 0) position = ePos <= 3 ? "both-top" : "advanced";
  else if (cPos === 4) position = (ePos === 8 && bestK === "40|80") ? "solved" : "own-slot";

  // verificación + clasificación + familias
  const fams = new Map<string, Fam>();
  const distAgg = new Map<string, number>();
  let pure = 0, impure = 0, noSolver = 0, parseErr = 0;
  for (const a of algs) {
    const r = S.clone();
    try { r.applySequence(a.moves); } catch { parseErr++; continue; }
    if (f2lSolved(r)) {
      pure++;
      const key = minOverAufHash(r);
      let f = fams.get(key);
      if (!f) { f = { key, moves: a.moves, speed: a.speed ?? 99, stm: a.stm ?? 99, size: 0, pure: true, disturbs: "PURE", scdb: null }; fams.set(key, f); }
      f.size++;
      if (a.speed < f.speed || (a.speed === f.speed && (a.stm ?? 99) < f.stm)) { f.moves = a.moves; f.speed = a.speed; f.stm = a.stm; }
    } else if (frSolved(r)) {
      impure++;
      const { label } = classifyDisturbs(r);
      distAgg.set(label, (distAgg.get(label) ?? 0) + 1);
      const key = minOverAufHash(r);
      let f = fams.get(key);
      if (!f) { f = { key, moves: a.moves, speed: a.speed ?? 99, stm: a.stm ?? 99, size: 0, pure: false, disturbs: label, scdb: null }; fams.set(key, f); }
      f.size++;
      if (a.speed < f.speed || (a.speed === f.speed && (a.stm ?? 99) < f.stm)) { f.moves = a.moves; f.speed = a.speed; f.stm = a.stm; }
    } else noSolver++;
  }

  // cruce SCDB por estado (mismo caso): aplicar cada alg SCDB al estado canónico
  // del patrón y comparar la clase LL resultante con las familias
  const patternKey = minOverAufFp(S);
  const caseEntries = scdbByCaseFp.get(patternKey) ?? [];
  for (const e of caseEntries) {
    const st = S.clone();
    try { st.applySequence(e.moves); } catch { continue; }
    if (!f2lSolved(st)) continue; // el alg debe resolver el F2L del caso
    e.llClass = minOverAufHash(st);
  }
  let scdbMatched = 0;
  const scdbAlgIds: string[] = [];
  for (const f of fams.values()) {
    const matches = caseEntries.filter((e) => e.llClass !== null && e.llClass === f.key);
    if (matches.length) {
      f.scdb = matches;
      scdbMatched += matches.length;
      for (const mm of matches) scdbAlgIds.push(mm.algid);
    }
  }

  const sorted = [...fams.values()].sort((a, b) => a.speed - b.speed || a.stm - b.stm || a.moves.length - b.moves.length);
  const pureFams = sorted.filter((f) => f.pure);
  sum.total += algs.length; sum.pure += pure; sum.impure += impure; sum.noSolver += noSolver;
  sum.families += sorted.length; sum.pureFams += pureFams.length;

  report.push({
    patid,
    slotGroup: TAX[patid]?.slotGroup ?? "?",
    position,
    f2lnum: PATID_TO_F2L[patid] ?? null,
    setup: invertSequence(setupMoves),
    totalAlgs: algs.length,
    pure, impure, noSolver, parseErr,
    families: sorted.length,
    pureFamilies: pureFams.length,
    disturbs: [...distAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    scdbMatch: { matchedAlgs: scdbMatched, algids: scdbAlgIds },
    top100: sorted.slice(0, 100).map((f) => ({
      key: f.key, moves: f.moves, speed: Number(f.speed.toFixed(2)), stm: f.stm,
      size: f.size, pure: f.pure, disturbs: f.disturbs,
      scdb: f.scdb ? { algid: f.scdb[0].algid, votes: f.scdb[0].votes, caseNumber: f.scdb[0].caseNumber } : null,
    })),
  });
}

// ============ comparación quest (Jb) ============
const jbReport = report.find((r) => r.patid === "Jb");
const jbS = (() => {
  const algs = PARSED["Jb"].algs;
  const tally = new Map<string, { n: number; state: CubeState }>();
  for (const a of algs) {
    const s = new CubeState();
    try { s.applySequence(invertSequence(a.moves)); } catch { continue; }
    const k = pairPos(s);
    const e = tally.get(k);
    if (e) e.n++; else tally.set(k, { n: 1, state: s });
  }
  let bestN = 0; let st: CubeState | null = null;
  for (const e of tally.values()) if (e.n > bestN) { bestN = e.n; st = e.state; }
  return st;
})();

const questRows: any[] = (QUEST?.rows?.a ?? []) as any[];
const parsedJbSet = new Set(PARSED["Jb"].algs.map((a) => a.moves));
const ROT_INV: Record<string, string> = { y: "y'", "y2": "y2", "y'": "y" };
const qComp = {
  rows: questRows.length,
  hitsInParsed: 0,
  hitByFamily: 0,
  frames: {} as Record<string, number>,
  pureByUs: 0,
  disturbsAgree: 0,
  disturbsDisagree: [] as string[],
  top20overlap: 0,
  ranks: [] as { full: string; frame: string; questUses: number; questScore: number; ourSpeedRank: number | null; ourDisturbs: string }[],
};
// top-20 de quest por uso: cuántos caen en nuestras top-20 familias FR
const theirTop20 = [...questRows].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)).slice(0, 20);
const ourTop20keys = new Set((jbReport?.top100 ?? []).slice(0, 20).map((t: any) => t.key));

for (const r of questRows) {
  const full = (r.auf ? r.auf + " " : "") + r.alg;
  if (parsedJbSet.has(full)) qComp.hitsInParsed++;
  if (!jbS) continue;
  let cls = "no-solver";
  let frame = "";
  let famKey: string | null = null;
  // probar marcos: FR puro y rotados (quest muestra el caso en varios slots)
  for (const rot of ["", "y", "y2", "y'"]) {
    const st = jbS.clone();
    try {
      if (rot) st.applySequence(rot);
      st.applySequence(full);
    } catch { continue; }
    if (f2lSolved(st)) {
      cls = "PURE"; frame = rot || "FR";
      if (rot) st.applySequence(ROT_INV[rot]);
      famKey = minOverAufHash(st);
      break;
    }
    if (frSolved(st) && !frame) {
      cls = classifyDisturbs(st).label; frame = rot || "FR";
      if (rot) st.applySequence(ROT_INV[rot]);
      famKey = minOverAufHash(st);
    }
  }
  if (!frame && !cls.startsWith("no-solver")) frame = "FR";
  qComp.frames[frame || "no-solver"] = (qComp.frames[frame || "no-solver"] ?? 0) + 1;
  if (famKey && (jbReport?.top100 ?? []).some((t: any) => t.key === famKey)) qComp.hitByFamily++;
  const qPure = !r.disturbs;
  if ((cls === "PURE") === qPure) qComp.disturbsAgree++;
  else qComp.disturbsDisagree.push(`${full}: quest=${r.disturbs || '""'} nos=${cls}`);
  if (cls === "PURE") qComp.pureByUs++;
  const famIdx = (jbReport?.top100 ?? []).findIndex((t: any) => t.key === famKey);
  qComp.ranks.push({ full, frame: frame || "no-solver", questUses: r.uses ?? 0, questScore: r.score ?? 0, ourSpeedRank: famIdx >= 0 ? famIdx + 1 : null, ourDisturbs: cls });
}
// overlap: de los top-20 de quest (por uso), cuántos mapan a familias FR en nuestras top-20
for (const r of theirTop20) {
  const full = (r.auf ? r.auf + " " : "") + r.alg;
  const st = jbS!.clone();
  try { st.applySequence(full); } catch { continue; }
  if (!f2lSolved(st)) continue; // filas rotadas no cuentan (son de otro slot)
  if (ourTop20keys.has(minOverAufHash(st))) qComp.top20overlap++;
}

const reportOut = {
  meta: {
    generated: new Date().toISOString(),
    source: "parsed.json + seed cfop-f2l + f2l-taxonomy + jb-data.json",
    method: "S=A^-1(solved) canonico; A(S)=F2L completo resuelto; familia=estado AUF-canonico; cap=100",
  },
  totals: { ...sum, avgPurePct: ((100 * sum.pure) / Math.max(1, sum.total)).toFixed(2) + "%" },
  scdb: { frAlgsIndexed: [...scdbByCaseFp.values()].reduce((s, a) => s + a.length, 0), distinctCaseFps: fpToCase.size },
  cases: report,
  questJb: qComp,
};

writeFileSync(resolve(RAW, "dedupe-report.json"), JSON.stringify(reportOut, null, 1));
console.log(`=== DEDUPE REPORT ===`);
console.log(`casos: ${report.length} | algs: ${sum.total} | puros: ${sum.pure} (${((100 * sum.pure) / Math.max(1, sum.total)).toFixed(2)}%) | impuros: ${sum.impure} | no-solvers: ${sum.noSolver}`);
console.log(`familias: ${sum.families} (puras: ${sum.pureFams}) | SCDB algs FR indexados: ${reportOut.scdb.frAlgsIndexed}`);
const withSc = report.filter((r) => r.scdbMatch.matchedAlgs > 0).length;
const scTotal = report.reduce((s, r) => s + r.scdbMatch.matchedAlgs, 0);
console.log(`patrones con match SCDB: ${withSc}/${report.length} | algs SCDB emparejados: ${scTotal}`);
console.log(`\n=== Distribucion de casos ===`);
const byGroup = new Map<string, number>();
const byPos = new Map<string, number>();
for (const r of report) {
  byGroup.set(r.slotGroup, (byGroup.get(r.slotGroup) ?? 0) + 1);
  byPos.set(r.position, (byPos.get(r.position) ?? 0) + 1);
}
console.log(`slotGroup: ${JSON.stringify(Object.fromEntries(byGroup))}`);
console.log(`position: ${JSON.stringify(Object.fromEntries(byPos))}`);

console.log(`\n=== Jb (F2L 1) ===`);
console.log(JSON.stringify({ patid: jbReport.patid, slotGroup: jbReport.slotGroup, position: jbReport.position, f2lnum: jbReport.f2lnum, setup: jbReport.setup, totalAlgs: jbReport.totalAlgs, pure: jbReport.pure, impure: jbReport.impure, families: jbReport.families, pureFamilies: jbReport.pureFamilies, disturbsTop: jbReport.disturbs.slice(0, 5), scdbMatched: jbReport.scdbMatch.matchedAlgs, scdbAlgids: jbReport.scdbMatch.algids.length, top5: jbReport.top100.slice(0, 5).map((t: any) => ({ moves: t.moves, speed: t.speed, size: t.size, scdb: t.scdb })) }, null, 1));

console.log(`\n=== Casos con 0 algs validos (sin puros) ===`);
for (const r of report.filter((x) => x.pure === 0)) console.log(`  ${r.patid}: ${r.totalAlgs} algs, ${r.families} familias (todas con disturbs)`);
console.log(`\n=== QUEST (Jb) ===`);
console.log(`filas quest: ${qComp.rows} | texto exacto en parsed: ${qComp.hitsInParsed} | matchean familia nuestra (por estado): ${qComp.hitByFamily}`);
console.log(`marcos resueltos: ${JSON.stringify(qComp.frames)}`);
console.log(`puros segun nuestro metodo: ${qComp.pureByUs} | acuerdo disturbs (vacio==PURE): ${qComp.disturbsAgree}/${qComp.rows}`);
if (qComp.disturbsDisagree.length) console.log(`desacuerdos: ${qComp.disturbsDisagree.slice(0, 4).join(" | ")}`);
console.log(`overlap top-20 (sus usos FR vs nuestro speed FR): ${qComp.top20overlap}/20`);
console.log(`\nranking: (sus uses, nuestro rank por speed)`);
for (const rk of qComp.ranks.slice(0, 14)) {
  console.log(`  ${rk.full.padEnd(28)} slot=${rk.frame.padEnd(4)} uses=${String(rk.questUses).padEnd(6)} score=${String(rk.questScore).padEnd(4)} ourSpeedRank=${rk.ourSpeedRank ?? "-"}`);
}
console.log(`\n-> ${resolve(RAW, "dedupe-report.json")}`);
