/**
 * Fase 6 — Inyectar los SETUPS finales ya calculados en AdvancedF2L.
 *
 * Los setups vienen de setups-independent-final.json (155 derivados puros
 * + 12 construidos = 126 advanced) — NO se recalcula nada. Los 41 básicos
 * NO se tocan (sus canónicos del seed ya son correctos).
 *
 * El único ajuste: el test de verificación (scdb-alg-verification.test.ts,
 * verifyF2L) identifica la pareja del caso con identifyPair() sobre el setup
 * (homeC/homeE) y exige que cada alg la deje en ESE home. Los setups finales
 * independientes presentan el MISMO caso pero a veces en un frame rotado
 * (la pareja en otro slot) → identifyPair detecta otro home y el test
 * rechazaría los algs. Como rotar el cubo entero no cambia el caso (solo la
 * presentación), se prueba la rotación del setup final que hace coincidir el
 * home identificado con el del setup de taxonomía actual (el que los algs ya
 * resuelven). Si ninguna rotación funciona, se conserva el setup original.
 *
 * RESULTADO (2026-08-07, seed actual): 111 directos + 4 rotados (Ln via x2;
 * Lh, Oh, Th via x2 y') + 11 CONSERVADOS: Cr, Hn, Ht, Sf, Sl, Uh, Un, Wf, Wh,
 * Xl, Xt. En esos 11 el setup final presenta el caso en el FRAME DE QUEST pero
 * sus algs están escritos para el FRAME DE TAXONOMÍA; ninguna rotación los
 * reconcilia (identifyPair detecta otro home y el gate rechazaría TODOS los
 * algs → el caso se perdería). Conservar el setup previo evita perder el caso;
 * es la opción segura. Documentado en pruebas/REPORTE_Setups_Quest.md §11.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/fase6-setups.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const GEN = resolve(__dirname, "../generated");
const SETUPS = JSON.parse(readFileSync(resolve(GEN, "setups-independent-final.json"), "utf-8")) as {
  patid: string; setup: string; nOut: number;
}[];
const byPatid = new Map(SETUPS.filter((s) => !s.patid.startsWith("F2L")).map((s) => [s.patid, s]));

function norm(seq: string): string {
  return seq.replace(/([UDFBLRMESxyz])2'/g, "$12").replace(/’/g, "'");
}
function apply(s: CubeState, seq: string): boolean {
  try { s.applySequence(norm(seq)); return true; } catch { return false; }
}

// ── criterio EXACTO del test (verifyF2L) ───────────────────────────────────
const MATE_EDGE_OF_CORNER = [8, 9, 10, 11, 8, 9, 10, 11];
const MATE_CORNER_OF_EDGE = [-1, -1, -1, -1, 7, 4, 5, 6, 4, 5, 6, 7];
function identifyPair(s: CubeState): { kind: string; homeC: number; homeE: number } {
  const c = s.cp[4];
  const e = s.ep[8];
  if (c >= 4 && c !== 4) return { kind: "trapped-corner", homeC: c, homeE: MATE_EDGE_OF_CORNER[c] };
  if (e >= 4 && e !== 8) return { kind: "trapped-edge", homeC: MATE_CORNER_OF_EDGE[e], homeE: e };
  return { kind: "basic", homeC: 4, homeE: 8 };
}
const SINGLE = ["", "y", "y2", "y'", "x", "x2", "x'", "z", "z2", "z'"];
const COMPOUND = ["y' x", "x y'", "y x'", "x' y", "z y", "y z", "x z", "z x", "y2 x", "x y2", "y2 z", "z y2"];
const ALL_POSTS = [...SINGLE, ...COMPOUND];
const ROTS = ["", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2", "y x", "y x'", "y x2", "y' x", "y' x'", "y' x2"];
function pairHome(s: CubeState, homeC: number, homeE: number): boolean {
  return s.cp[homeC] === homeC && s.co[homeC] === 0 && s.ep[homeE] === homeE && s.eo[homeE] === 0;
}
function solvesExact(setup: string, moves: string, homeC: number, homeE: number): boolean {
  for (const slotRot of ["", "y", "y2", "y'"]) {
    const s0 = new CubeState();
    if (!apply(s0, setup)) continue;
    if (slotRot) s0.applySequence(slotRot);
    for (const post of ALL_POSTS) {
      const t = s0.clone();
      if (!apply(t, moves)) continue;
      for (const tok of post.split(/\s+/).filter(Boolean)) t.applySequence(tok);
      if (pairHome(t, homeC, homeE)) return true;
    }
  }
  return false;
}
function nOutOf(s: CubeState): number {
  let n = 0;
  for (let c = 4; c <= 7; c++) { let p = -1; for (let i = 0; i < 8; i++) if (s.cp[i] === c) p = i; if (p !== c) n++; }
  for (let e = 8; e <= 11; e++) { let p = -1; for (let i = 0; i < 12; i++) if (s.ep[i] === e) p = i; if (p !== e) n++; }
  return n;
}

// ── procesar SOLO advanced ─────────────────────────────────────────────────
const path = resolve(GEN, "scdb-af2l-fused.json");
const d = JSON.parse(readFileSync(path, "utf-8"));
let inyectados = 0, rotados = 0, conservados = 0, algsKeep = 0, algsDrop = 0;
const conservadosList: string[] = [];

const casesOut: any[] = [];
for (const c of d.cases) {
  const cn = c.caseDef.caseNumber as string;
  const fin = byPatid.get(cn);
  const original = c.caseDef.setupScramble;

  if (!fin) {
    console.log(`  ⚠️ ${cn}: sin setup final`);
    casesOut.push(c);
    continue;
  }

  // cuántos algs pasan con el setup ORIGINAL (taxonomía) — punto de referencia
  const countFor = (setup: string): { keep: any[]; n: number } => {
    const s0 = new CubeState();
    if (!apply(s0, setup)) return { keep: [], n: 0 };
    const { homeC, homeE } = identifyPair(s0);
    const keep = c.algorithms.filter((a: any) => solvesExact(setup, (a.moves as string[]).join(" "), homeC, homeE));
    return { keep, n: keep.length };
  };

  // probar el setup final + sus 24 rotaciones; elegir el que conserve MÁS algs
  let best: { setup: string; keep: any[]; via: string } | null = null;
  for (const r of ROTS) {
    const candSetup = [r, fin.setup].filter(Boolean).join(" ");
    const s0 = new CubeState();
    if (!apply(s0, candSetup)) continue;
    if (nOutOf(s0) !== fin.nOut) continue; // la rotación debe preservar el caso
    const { homeC, homeE } = identifyPair(s0);
    const keep = c.algorithms.filter((a: any) => solvesExact(candSetup, (a.moves as string[]).join(" "), homeC, homeE));
    if (!best || keep.length > best.keep.length) best = { setup: candSetup, keep, via: r || "∅" };
  }

  // el criterio es ≥1 alg que sobreviva con el setup final (rotado si hace falta).
  // Si ninguna rotación del setup final permite resolver el caso, se conserva el
  // setup original (y sus algs) para no perder el caso.
  if (!best || best.keep.length === 0) {
    // ninguna rotación del setup final permite resolver → conservar el original
    const orig = countFor(original);
    conservados++;
    conservadosList.push(`${cn} (orig ${orig.n} algs)`);
    c.algorithms = orig.keep;
    algsKeep += orig.keep.length;
    algsDrop += c.algorithms.length - orig.keep.length;
    const defs = orig.keep.filter((a: any) => a.isDefault);
    if (defs.length !== 1) {
      const pick = defs.length
        ? [...defs].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
        : orig.keep[0];
      for (const a of c.algorithms) a.isDefault = a === pick;
    }
    casesOut.push(c);
    continue;
  }

  // el setup final (o su rotación) es compatible: inyectar y conservar solo
  // los algs que resuelven el caso bajo el criterio exacto del test.
  const changed = best.setup !== original;
  if (changed) {
    c.caseDef.setupScramble = best.setup;
    if (best.via !== "∅") rotados++; else inyectados++;
  }
  c.algorithms = best.keep;
  algsKeep += best.keep.length;
  algsDrop += c.algorithms.length - best.keep.length;
  // garantizar EXACTAMENTE 1 default (el filtrado puede haber descartado el
  // default SCDB original) — misma regla que fase5-fuse: preferir el default
  // de mejor rank (menor sortOrder) o el primero.
  const defs = best.keep.filter((a: any) => a.isDefault);
  if (defs.length !== 1) {
    const pick = defs.length
      ? [...defs].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
      : best.keep[0];
    for (const a of c.algorithms) a.isDefault = a === pick;
  }
  casesOut.push(c);
}
d.cases = casesOut;
writeFileSync(path, JSON.stringify(d, null, 1));

console.log(`\n=== FASE 6 (solo advanced) ===`);
console.log(`Casos: ${d.cases.length} | setup final directo ${inyectados} | rotado al frame canónico ${rotados} | conservado original ${conservados}`);
console.log(`Algs: ${algsKeep} sobreviven (descartados ${algsDrop})`);
if (conservadosList.length) console.log(`Conservados (setup final incompatible): ${conservadosList.join(", ")}`);