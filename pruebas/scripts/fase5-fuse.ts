/**
 * Fase 5 — Fusión SCDB+BirdF2L (regenera scdb-f2l.json y scdb-af2l.json).
 *
 * Resultado: 41 Basic (F2L n) + 126 Advanced (patrones BirdF2L con f2lnum nulo,
 * excluyendo Vj=solved), cada caso con algs de:
 *   1. SCDB (gana): algs del JSON SCDB, mapeados por f2l-pattern-map (basic) o
 *      af2l-pattern-map (advanced; varios AF2L pueden mapear al mismo patid).
 *   2. BirdF2L: top100 del dedupe-report (por speed) no duplicados en SCDB
 *      (colapsando movimientos consecutivos), cap configurable por caso.
 * Regla del usuario: nada de algs repetidos (misma secuencia colapsada) y todo
 * alg debe RESOLVER el caso — verificado contra el SETUP FINAL del caseDef con
 * el criterio exacto del test de verificación (identifyPair + pairHome, con
 * rotación de slot y rotaciones finales toleradas).
 *
 * Los caseDefs:
 *   - Basic: se conservan los del seed actual (seed-casedefs.json) → IDs
 *     estables (f2l-b01…) y progreso del usuario intactos.
 *   - Advanced: caseDefs NUEVOS desde la taxonomía (setup canónico verificado
 *     en Fase 4), ids uuid v5 determinísticos.
 *
 * Salida: escribe pruebas/generated/scdb-f2l-fused.json y scdb-af2l-fused.json
 * (NUNCA sobrescribe los originales scdb-*.json — idempotente). generate_seed_catalog.py
 * lee los archivos -fused (source/set/cases).
 *
 * Uso: pnpm dlx tsx pruebas/scripts/fase5-fuse.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import { CubeState } from "../../packages/math-core/src/index";

const RAW = resolve(__dirname, "../raw/birdf2l");
const GEN = resolve(__dirname, "../generated");

const F2L_SUBSET = "00000000-0000-4000-9000-000000000003";
const AF2L_SUBSET = "00000000-0000-4000-9000-000000000004";
const TOP_BIRD_PER_CASE = 25; // cap de algs BirdF2L nuevos por caso

// ─── Carga de datos ────────────────────────────────────────────────────────
const TAX = (JSON.parse(readFileSync(resolve(RAW, "f2l-taxonomy.json"), "utf-8")) as any).cases as Record<
  string, { setup: string; f2lnum: string | null; aNum: string | null; position: string; mirror: string; edgeFlipped: string | null }
>;
const AF2L_MAP = JSON.parse(readFileSync(resolve(GEN, "af2l-pattern-map.json"), "utf-8")) as Record<string, string | null>;
const F2L_MAP = JSON.parse(readFileSync(resolve(GEN, "f2l-pattern-map.json"), "utf-8")) as Record<string, string>;
const SCDB_F2L = JSON.parse(readFileSync(resolve(GEN, "scdb-f2l.json"), "utf-8"));
const SCDB_AF2L = JSON.parse(readFileSync(resolve(GEN, "scdb-af2l.json"), "utf-8"));
const DEDUPE = JSON.parse(readFileSync(resolve(RAW, "dedupe-report.json"), "utf-8"));
const SEED_CASEDEFS = JSON.parse(readFileSync(resolve(GEN, "seed-casedefs.json"), "utf-8")) as Record<string, any>;
const byPatid = new Map<string, any>((DEDUPE.cases as any[]).map((c: any) => [c.patid, c]));

// ─── Utilidades de cubo ────────────────────────────────────────────────────
function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12");
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { homeC: 4, homeE: 8 };
}
function pairHome(s: CubeState, homeC: number, homeE: number): boolean {
  return s.cp[homeC] === homeC && s.co[homeC] === 0 && s.ep[homeE] === homeE && s.eo[homeE] === 0;
}
const SINGLE = ["", "y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];
const COMPOUND = ["y' x", "x y'", "y x'", "x' y", "z y", "y z", "x z", "z x", "y2 x", "x y2", "y2 z", "z y2"];
const ALL_POSTS = [...SINGLE, ...COMPOUND];
function applyToks(s: CubeState, toks: string): void {
  for (const t of toks.split(/\s+/).filter(Boolean)) s.applySequence(t);
}
/** Criterio EXACTO del test de verificación: setup + slotRot + moves + post -> pairHome */
function solvesPair(setup: string, moves: string, homeC: number, homeE: number): boolean {
  for (const slotRot of ["", "y", "y2", "y'"]) {
    const s0 = new CubeState();
    if (!apply(s0, setup)) continue;
    if (slotRot) s0.applySequence(slotRot);
    for (const post of ALL_POSTS) {
      const t = s0.clone();
      if (!apply(t, moves)) continue;
      applyToks(t, post);
      if (pairHome(t, homeC, homeE)) return true;
    }
  }
  return false;
}

// ─── Normalización / dedup (replica generate_seed_catalog.py) ─────────────
const MOVE_RE = /^([RLUDFB]w?|[rludfbMES]|[xyz])(2|'|\u2032)?$/;
function validMoves(moves: string[]): boolean {
  return moves.every((m) => MOVE_RE.test(m));
}
function collapseConsecutive(moves: string[]): string[] {
  const out: string[] = [];
  for (const m of moves) {
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const b1 = prev.replace(/2[']/, "");
      const b2 = m.replace(/2[']/, "");
      const d1 = prev.includes("2");
      const d2 = m.includes("2");
      if (b1 === b2 && !d1 && !d2 && prev.endsWith("'") === m.endsWith("'")) {
        out.pop();
        out.push(`${b1}2`);
        continue;
      }
    }
    out.push(m);
  }
  return out;
}
const movesKey = (moves: string[]) => JSON.stringify(collapseConsecutive(moves));

// ─── ids determinísticos ───────────────────────────────────────────────────
function uuid5(name: string): string {
  const h = createHash("sha1").update(`cubeforge:f2l:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ─── Helpers de métricas ───────────────────────────────────────────────────
function countHtm(moves: string[]): number {
  return moves.filter((m) => !/[xyz]/.test(m)).length;
}
function countQtm(moves: string[]): number {
  return moves.filter((m) => !/[xyz]/.test(m) && !m.endsWith("2")).length;
}
function countStm(moves: string[]): number {
  // STM: movimientos de cara, slice y wide = 1; rotaciones = 0.
  return moves.filter((m) => !/[xyz]/.test(m)).length;
}

// ─── Construcción de casos ─────────────────────────────────────────────────
const casesOut: { basic: any[]; advanced: any[] } = { basic: [], advanced: [] };
let stat = { cases: 0, scdbAlgs: 0, birdAlgs: 0, dropped: 0, droppedNoSetup: 0, noAlgs: 0 };

function buildCase(patid: string, v: { setup: string; f2lnum: string | null }, isBasic: boolean): any[] | null {
  // ── caseDef ──────────────────────────────────────────────────────────
  let caseDef: any;
  if (isBasic) {
    const seedKey = `${F2L_SUBSET}|${v.f2lnum}`;
    caseDef = SEED_CASEDEFS[seedKey] ?? null;
    if (!caseDef) {
      // fallback: generar desde el JSON SCDB
      const sc = SCDB_F2L.cases.find((c: any) => c.caseDef.caseNumber === v.f2lnum);
      caseDef = sc ? { ...sc.caseDef } : null;
    }
  }
  if (!caseDef) {
    caseDef = {
      id: uuid5(`case:${patid}`),
      subsetId: isBasic ? F2L_SUBSET : AF2L_SUBSET,
      caseNumber: isBasic ? v.f2lnum : patid,
      name: isBasic ? v.f2lnum : patid,
      recognitionPatterns: [],
      setupScramble: v.setup,
      diagramType: "3d-isometric",
      difficulty: "advanced",
      category: isBasic ? "Free Pairs" : undefined,
      tags: isBasic ? ["f2l", "basic"] : ["f2l", "af2l", "advanced"],
      puzzleType: "3x3x3",
    };
    if (!isBasic && v.aNum) caseDef.name = `${patid} (${v.aNum})`;
    if (!isBasic) delete caseDef.category;
  }
  const setup = caseDef.setupScramble;
  const s = new CubeState();
  if (!apply(s, setup)) { stat.droppedNoSetup++; return null; }
  const { homeC, homeE } = identifyPair(s);

  const out: any[] = [];
  const seen = new Set<string>();
  const add = (alg: any) => {
    if (!alg.moves?.length || !validMoves(alg.moves)) return;
    const k = movesKey(alg.moves);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(alg);
  };
  const findKey = (k: string) => out.find((o) => movesKey(o.moves) === k);

  // ── 1) SCDB (gana) ───────────────────────────────────────────────────
  const scdbCases: any[] = isBasic
    ? [SCDB_F2L.cases.find((c: any) => c.caseDef.caseNumber === v.f2lnum)].filter(Boolean)
    : SCDB_AF2L.cases.filter((c: any) => AF2L_MAP[c.caseDef.caseNumber] === patid);
  for (const sc of scdbCases) {
    for (const a of sc.algorithms) {
      const moves = a.moves as string[];
      if (!validMoves(moves)) continue;
      if (!solvesPair(setup, moves.join(" "), homeC, homeE)) { stat.dropped++; continue; }
      add({
        ...a,
        caseId: caseDef.id,
        notes: a.notes ?? "Slot: FR",
        source: "SpeedCubeDB",
        isDefault: a.isDefault ?? false,
        isCustom: false,
        sortOrder: a.sortOrder ?? 0,
        moveCount: a.moveCount ?? { htm: countHtm(moves), qtm: countQtm(moves), stm: countStm(moves) },
      });
      stat.scdbAlgs++;
    }
  }

  // ── 2) BirdF2L top (no duplicados en SCDB) ───────────────────────────
  const d = byPatid.get(patid);
  if (d && Array.isArray(d.top100)) {
    let added = 0;
    for (const t of d.top100) {
      if (added >= TOP_BIRD_PER_CASE) break;
      const moves = (t.moves as string).split(/\s+/);
      if (!validMoves(moves)) continue;
      if (seen.has(movesKey(moves))) continue; // ya en SCDB
      if (!solvesPair(setup, t.moves, homeC, homeE)) { stat.dropped++; continue; }
      add({
        id: uuid5(`alg:${patid}:${t.moves}`),
        caseId: caseDef.id,
        moves,
        moveCount: { htm: countHtm(moves), qtm: countQtm(moves), stm: t.stm ?? countStm(moves) },
        isDefault: false,
        source: "BirdF2L",
        difficulty: "intermediate",
        triggers: [],
        // Canónico: escrito para el slot FR, pero el caso se resuelve en los 4
        // slots rotando el cubo (slots-model.ts 672/672). La UI rota el modelo
        // y ejecuta el alg igual → el alg es universal ("Slot: ALL").
        notes: t.pure ? "Slot: ALL" : `Slot: ALL; impuro (${t.disturbs})`,
        isMirror: false,
        isInverse: false,
        isCustom: false,
        sortOrder: 100 + added,
        votes: Math.max(1, Math.round(1000 / t.speed)),
        attributionUrl: `https://github.com/andydude/birdf2l/blob/gh-pages/app/${patid.toLowerCase()}.html`,
      });
      added++;
      stat.birdAlgs++;
    }
  }


  // ── garantizar EXACTAMENTE 1 default ─────────────────────────────────
  // (varios AF2L pueden mapear al mismo patid y cada uno trae su default)
  if (out.length) {
    const defs = out.filter((a) => a.isDefault);
    if (defs.length !== 1) {
      // elegir el default SCDB de mejor rank (menor sortOrder) o el primero
      const pick = defs.length
        ? [...defs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
        : out[0];
      for (const a of out) a.isDefault = a === pick;
    }
  }
  if (!out.length) { stat.noAlgs++; return null; }

  stat.cases++;
  return [{ caseDef, algorithms: out }];
}

// ─── Orden de casos: basic F2L 1-41, luego advanced por taxonomía ────────
const basicPats = Object.entries(TAX)
  .filter(([, v]) => v.f2lnum)
  .sort((a, b) => parseInt((a[1].f2lnum as string).split(" ")[1]) - parseInt((b[1].f2lnum as string).split(" ")[1]));
const advancedPats = Object.entries(TAX)
  .filter(([, v]) => !v.f2lnum && v.position !== "solved");

for (const [patid, v] of basicPats) {
  const r = buildCase(patid, v, true);
  if (r) casesOut.basic.push(...r);
}
for (const [patid, v] of advancedPats) {
  const r = buildCase(patid, v, false);
  if (r) casesOut.advanced.push(...r);
}

// ─── Escritura (mismo formato que lee generate_seed_catalog.py) ──────────
const f2lOut = { source: "SpeedCubeDB+BirdF2L", set: "F2L", cases: casesOut.basic };
const af2lOut = { source: "SpeedCubeDB+BirdF2L", set: "AdvancedF2L", cases: casesOut.advanced };
writeFileSync(resolve(GEN, "scdb-f2l-fused.json"), JSON.stringify(f2lOut, null, 1));
writeFileSync(resolve(GEN, "scdb-af2l-fused.json"), JSON.stringify(af2lOut, null, 1));

console.log(`=== FUSIÓN FASE 5 ===`);
console.log(`Basic: ${casesOut.basic.length} casos, ${casesOut.basic.reduce((n, c) => n + c.algorithms.length, 0)} algs`);
console.log(`Advanced: ${casesOut.advanced.length} casos, ${casesOut.advanced.reduce((n, c) => n + c.algorithms.length, 0)} algs`);
console.log(`Algs: SCDB ${stat.scdbAlgs} | BirdF2L ${stat.birdAlgs} | descartados ${stat.dropped} (no resuelven) | sin setup ${stat.droppedNoSetup} | casos sin algs ${stat.noAlgs}`);
