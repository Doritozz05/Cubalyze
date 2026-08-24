/**
 * Fase 5 — Mapeos de la fusión SCDB+BirdF2L (genera 3 JSON en pruebas/generated):
 *
 *  1. af2l-pattern-map.json : { "AF2L 1": "Hb", ... } — los 54 casos advanced de
 *     SCDB absorbidos en los patrones BirdF2L. Método (validado 54/54, 0 fallos):
 *       a. identifyPair() sobre el setup SCDB → (homeC, homeE) — la regla exacta
 *          del test de verificación (trapped-corner / trapped-edge / basic).
 *       b. Solo se prueban los patrones de la taxonomía con la MISMA pareja.
 *       c. El alg (probando TODOS los del caso, con rotación de slot y AUF)
 *          debe dejar la pareja en casa (pairHome).
 *     NOTA: el par es identificado en el setup SCDB pero verificado contra el
 *     setup canónico del patrón — por eso no sirve la comparación de estados
 *     (los setups SCDB advanced dejan más piezas desplazadas).
 *  2. f2l-pattern-map.json  : { "F2L 1": "Jb", ... } — de la taxonomía (f2lnum).
 *  3. quest-scdb-valid.json : { patid: [{moves, algid, uses, score, ...}] } —
 *     SOLO filas de quest con algid `scdb:` que RESUELVEN el caso (setup
 *     canónico de la taxonomía → F2L completo resuelto), tolerando AUF y
 *     rotación de slot (la vista back de quest es el mismo caso rotado).
 *
 * Uso: pnpm dlx tsx pruebas/scripts/fase5-mapping.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const GEN = resolve(__dirname, "../generated");
const QUEST = resolve(__dirname, "../raw/quest");

const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string,
  { setup: string; f2lnum: string | null; aNum: string | null }
>;
const AF2L = JSON.parse(readFileSync(resolve(GEN, "scdb-af2l.json"), "utf-8"));

function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12");
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}
function f2lSolved(s: CubeState): boolean {
  for (let i = 4; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 4; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

// ── identifyPair (regla exacta del test de verificación) ──────────────────
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number; kind: string } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c], kind: "trapped-corner" };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e, kind: "trapped-edge" };
  return { homeC: 4, homeE: 8, kind: "basic" };
}
function pairHome(s: CubeState, homeC: number, homeE: number): boolean {
  return s.cp[homeC] === homeC && s.co[homeC] === 0 && s.ep[homeE] === homeE && s.eo[homeE] === 0;
}

// ── 1) índice de patrones por pareja identifyPair ──────────────────────────
const pats = Object.entries(TAX).map(([patid, v]) => {
  const s = new CubeState();
  apply(s, v.setup);
  const p = identifyPair(s);
  return { patid, setup: v.setup, ...p };
});
const byPair = new Map<string, typeof pats>();
for (const p of pats) {
  const k = `${p.homeC},${p.homeE}`;
  const arr = byPair.get(k) ?? [];
  arr.push(p);
  byPair.set(k, arr);
}

// ── 2) mapa AF2L n -> patid ────────────────────────────────────────────────
const af2lMap: Record<string, string | null> = {};
let mapped = 0;
const fails: string[] = [];
for (const c of AF2L.cases) {
  const cn = c.caseDef.caseNumber as string;
  const s = new CubeState();
  if (!apply(s, c.caseDef.setupScramble)) { af2lMap[cn] = null; fails.push(`${cn}: setup no parseable`); continue; }
  const { homeC, homeE } = identifyPair(s);
  const cands = byPair.get(`${homeC},${homeE}`) ?? [];
  if (cands.length === 0) { af2lMap[cn] = null; fails.push(`${cn}: pareja (${homeC},${homeE}) sin candidatos`); continue; }
  const algs = c.algorithms.map((a: any) => a.moves.join(" "));
  let hit: string | null = null;
  outer:
  for (const p of cands) {
    for (const moves of algs) {
      for (const rot of ["", "y", "y2", "y'"]) {
        for (let k = 0; k < 4; k++) {
          const t = new CubeState();
          if (!apply(t, p.setup)) continue;
          if (rot) t.applySequence(rot);
          if (k === 1) t.applySequence("U");
          else if (k === 2) t.applySequence("U2");
          else if (k === 3) t.applySequence("U'");
          if (!apply(t, moves)) continue;
          if (pairHome(t, p.homeC, p.homeE)) { hit = p.patid; break outer; }
        }
      }
    }
  }
  af2lMap[cn] = hit;
  if (hit) mapped++;
  else fails.push(`${cn}: sin hit (pareja ${homeC},${homeE})`);
}
writeFileSync(resolve(GEN, "af2l-pattern-map.json"), JSON.stringify(af2lMap, null, 1));
console.log(`AF2L -> patid: ${mapped}/${AF2L.cases.length}`);
if (fails.length) console.log(`  fallos: ${fails.join(" | ")}`);

// ── 3) mapa F2L n -> patid (taxonomía) ─────────────────────────────────────
const f2lMap: Record<string, string> = {};
for (const [patid, v] of Object.entries(TAX)) if (v.f2lnum) f2lMap[v.f2lnum] = patid;
writeFileSync(resolve(GEN, "f2l-pattern-map.json"), JSON.stringify(f2lMap, null, 1));
console.log(`F2L n -> patid: ${Object.keys(f2lMap).length}/41`);

// ── 4) quest: solo filas scdb: que resuelven el caso ───────────────────────
const QUEST_FILES: [string, string][] = [
  ["Jb", "jb-data.json"],
  ["Mi", "quest-mi-data.json"],
  ["Vb", "quest-vb-data.json"],
  ["Ti", "quest-ti-data.json"],
];
const qOut: Record<string, any[]> = {};
for (const [patid, file] of QUEST_FILES) {
  const qd = JSON.parse(readFileSync(resolve(QUEST, file), "utf-8"));
  const rows = (qd.rows?.a ?? []) as any[];
  const canon = new CubeState();
  if (!apply(canon, TAX[patid]?.setup ?? "")) { qOut[patid] = []; continue; }
  const { homeC, homeE } = identifyPair(canon);
  const list: any[] = [];
  let scdbRows = 0, solving = 0, anySlot = 0;
  for (const r of rows) {
    const algid = typeof r.algid === "string" ? r.algid : "";
    if (!algid.startsWith("scdb:")) continue;
    scdbRows++;
    const full = algid.slice("scdb:".length);
    let ok = false, slot = "FR";
    outer:
    for (const rot of ["", "y", "y2", "y'"]) {
      for (let k = 0; k < 4; k++) {
        const t = canon.clone();
        if (rot) t.applySequence(rot);
        if (k === 1) t.applySequence("U");
        else if (k === 2) t.applySequence("U2");
        else if (k === 3) t.applySequence("U'");
        if (!apply(t, full)) continue;
        if (pairHome(t, homeC, homeE)) { ok = true; if (rot) { anySlot++; slot = rot === "y" ? "FL" : rot === "y2" ? "BL" : "BR"; } break outer; }
      }
    }
    if (!ok) continue;
    solving++;
    list.push({
      moves: full,
      algid,
      uses: r.uses ?? null,
      score: r.score ?? null,
      frontUses: r.frontUses ?? null,
      backUses: r.backUses ?? null,
      usesBy: r.usesBy ?? null,
      htm: r.htm ?? null,
      slot,
    });
  }
  qOut[patid] = list;
  console.log(`quest ${patid}: ${scdbRows} filas scdb: -> ${solving} resuelven el caso (${list.length} usables, ${anySlot} con rotación)`);
}
writeFileSync(resolve(GEN, "quest-scdb-valid.json"), JSON.stringify(qOut, null, 1));

// ── 5) sanity: estructura de parsed.json (metadata de enriquecimiento) ─────
const PARSED = JSON.parse(readFileSync(resolve(RAW, "parsed.json"), "utf-8")) as any;
const jb0 = PARSED.Jb.algs[0];
console.log("\nparsed Jb algs[0] keys:", Object.keys(jb0).join(", "));
console.log("parsed Jb algs[0]:", JSON.stringify(jb0).slice(0, 260));
