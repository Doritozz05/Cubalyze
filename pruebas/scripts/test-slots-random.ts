/**
 * Test de robustez del modelo de 4 slots con ALGS ALEATORIOS.
 *
 * Casos: Jb (jb-data.json), Mi, Vb, Ti (extraídos de quest).
 * Fuentes de algs: filas de quest (auf + alg) y nuestra data BirdF2L (parsed.json).
 *
 * 1) Setup de quest clasifica al patrón correcto (nuestro top alg lo resuelve).
 * 2) Cada alg (quest + random nuestro): clasificación FR sobre el caso canónico.
 * 3) TEST DE SLOTS (el corazón): para un alg A cualquiera,
 *      estado_tras(rInv A r sobre r·canon, des-rotado) DEBE ser IDÉNTICO a A·canon.
 *    Si falla para algún alg random => bug real en el modelo o en applySequence.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/test-slots-random.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const QUEST = resolve(__dirname, "../raw/quest");
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as Record<
  string,
  { algs: { moves: string; speed: number }[] }
>;
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string,
  { setup: string; f2lnum: string | null; aNum: string | null }
>;

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
/** normaliza X2' -> X2 (notación de quest en los setups avanzados) */
function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12");
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
function frSolved(s: CubeState): boolean {
  return s.cp[4] === 4 && s.co[4] === 0 && s.ep[8] === 8 && s.eo[8] === 0;
}
function pairPos(s: CubeState): string {
  let c = -1, e = -1;
  for (let i = 0; i < 8; i++) if (s.cp[i] === 4) { c = i; break; }
  for (let i = 0; i < 12; i++) if (s.ep[i] === 8) { e = i; break; }
  return `${c}|${e}`;
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}
function stateEq(a: CubeState, b: CubeState): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}
function classify(s: CubeState): string {
  if (f2lSolved(s)) return "pure";
  if (frSolved(s)) return "fr";
  return `other(pair ${pairPos(s)})`;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS = [
  { slot: "FR", r: "", rInv: "" },
  { slot: "FL", r: "y'", rInv: "y" },
  { slot: "BL", r: "y2", rInv: "y2" },
  { slot: "BR", r: "y", rInv: "y'" },
];
const RAND = 8; // algs aleatorios por fuente y caso
const CASES = [
  { patid: "Jb", q: "jb-data.json" },
  { patid: "Mi", q: "quest-mi-data.json" },
  { patid: "Vb", q: "quest-vb-data.json" },
  { patid: "Ti", q: "quest-ti-data.json" },
];

let totalSlotChecks = 0, slotFails = 0;
const slotFailList: string[] = [];
const agg: Record<string, any> = {};

for (const c of CASES) {
  const p = c.patid;
  const rnd = mulberry32(20260806 + p.length * 7);
  const qd = JSON.parse(readFileSync(resolve(QUEST, c.q), "utf-8"));
  const rows = (qd.rows?.a ?? []) as any[];

  // caso canónico = setup verificado de la taxonomía
  const canon = new CubeState();
  const canonOk = apply(canon, TAX[p]?.setup ?? "");
  const topOurs = [...PARSED[p].algs].sort((a, b) => a.speed - b.speed)[0];

  const a: any = { setupQuest: qd.selectedSetup, rows: rows.length, canon: canonOk, fr: {}, questSlot: { ok: 0, n: 0 }, oursSlot: { ok: 0, n: 0 } };

  // 1) setup de quest: nuestro top alg lo resuelve?
  if (canonOk && topOurs) {
    const t = canon.clone();
    apply(t, topOurs.moves);
    a.setupQuestSolves = classify(t);
  }

  // 2) TODAS las filas de quest clasificadas desde el marco FR
  const clsCount: Record<string, number> = {};
  for (const r of rows) {
    const full = r.auf ? `${r.auf} ${r.alg}` : r.alg;
    const t = canon.clone();
    const ok = apply(t, full);
    const cls = ok ? classify(t) : "parse-err";
    clsCount[cls] = (clsCount[cls] ?? 0) + 1;
    // además: el algid completo (puede diferir de auf+alg)
    const algidFull = typeof r.algid === "string" && r.algid.includes(":") ? r.algid.slice(r.algid.indexOf(":") + 1) : "";
    if (algidFull && algidFull !== full) {
      const t2 = canon.clone();
      const ok2 = apply(t2, algidFull);
      const cls2 = ok2 ? classify(t2) : "parse-err";
      clsCount[`algid:${cls2}`] = (clsCount[`algid:${cls2}`] ?? 0) + 1;
    }
  }
  a.fr = clsCount;

  // 2b) top-5 filas de quest: combinación autoritativa setup_quest + alg -> f2lSolved?
  const top5 = [...rows].sort((x, y) => (y.uses ?? 0) - (x.uses ?? 0)).slice(0, 5);
  a.top5 = top5.map((r) => {
    const full = r.auf ? `${r.auf} ${r.alg}` : r.alg;
    const qc = new CubeState();
    const setupOk = apply(qc, qd.selectedSetup ?? "");
    const solveOk = setupOk && apply(qc, full) && f2lSolved(qc);
    // clasificación FR sobre nuestro canon
    const tc = canon.clone();
    const cls = apply(tc, full) ? classify(tc) : "parse-err";
    return `${full} (uses ${r.uses}) setupQuest+alg→${solveOk ? "SOLVED✓" : "no"} | FR:${cls}`;
  });

  // 3) TEST DE SLOTS con algs random
  //    fuente quest: filas con alg (todas)
  const questAlgs: string[] = [];
  for (const r of rows) {
    const full = r.auf ? `${r.auf} ${r.alg}` : r.alg;
    if (full.trim()) questAlgs.push(full);
  }
  //    fuente nuestra: parsed.json del patrón
  const ourAlgs = PARSED[p].algs.map((x) => x.moves);

  const testAlgs = (label: string, list: string[]) => {
    const pool = list.filter((alg) => alg && alg.trim());
    if (!pool.length) return;
    const sample: string[] = [];
    for (let i = 0; i < Math.min(RAND, pool.length); i++) {
      sample.push(pool[Math.floor(rnd() * pool.length)]);
    }
    let ok = 0, n = 0, err = 0;
    const frCls: Record<string, number> = {};
    for (const A of sample) {
      n++;
      const t = canon.clone();
      if (!apply(t, A)) { err++; continue; }
      const frState = t.clone();
      const cls = classify(t);
      frCls[cls] = (frCls[cls] ?? 0) + 1;
      let allSlots = true;
      for (const s of SLOTS) {
        if (!s.r) continue;
        const u = canon.clone();
        if (!apply(u, s.r)) { allSlots = false; break; }
        if (!apply(u, `${s.rInv} ${A} ${s.r}`)) { allSlots = false; break; }
        if (!apply(u, s.rInv)) { allSlots = false; break; }
        if (!stateEq(u, frState)) { allSlots = false; slotFailList.push(`${p} ${label} "${A}" slot ${s.slot}`); }
        totalSlotChecks++;
      }
      if (allSlots) ok++; else slotFails++;
    }
    a[`${label}Slot`] = { ok, n, err, frCls };
  };
  testAlgs("quest", questAlgs);
  testAlgs("ours", ourAlgs);
  agg[p] = a;
}

// ---- reporte ----
console.log("=== TEST DE 4 SLOTS CON ALGS ALEATORIOS (seed fija) ===");
for (const p of Object.keys(agg)) {
  const a = agg[p];
  console.log(`\n── ${p} (${TAX[p].f2lnum ?? TAX[p].aNum ?? ""}) ──`);
  console.log(`  setup quest: "${a.setupQuest}" | nuestro top lo resuelve: ${a.setupQuestSolves ?? "?"}`);
  console.log(`  filas quest (${a.rows}) clasificación FR: ${JSON.stringify(a.fr)}`);
  console.log(`  top-5 quest (setup_quest + alg resuelve?):`);
  for (const t5 of a.top5) console.log(`    ${t5}`);
  console.log(`  slots quest random (${a.questSlot.n}): ${a.questSlot.ok}/${a.questSlot.n} exactos | FR: ${JSON.stringify(a.questSlot.frCls)}`);
  console.log(`  slots ours random  (${a.oursSlot.n}): ${a.oursSlot.ok}/${a.oursSlot.n} exactos | FR: ${JSON.stringify(a.oursSlot.frCls)}`);
}
console.log(`\nTOTAL checks de slots: ${totalSlotChecks} | fallos: ${slotFails}`);
if (slotFailList.length) console.log("fallos:", slotFailList.slice(0, 20).join(" | "));
