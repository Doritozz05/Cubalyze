/**
 * Verificación end-to-end de UNA reconstrucción de CubeRoot (id 2510, Liam Walton 9.64)
 *
 * Pregunta que responde: ¿nuestro sistema reproduce EXACTAMENTE las fases y los
 * casos anotados por el reconstructor? (El usuario pidió usar la reconstrucción
 * de speedcube.quest/reconstructions/cuberoot2510.)
 *
 * HALLAZGO CLAVE (Fase 0.5 / matcher):
 *   Los masks del PhaseSplitter (CrossMask/F2LMask/OLLMask/PLLMask) están anclados
 *   a la capa D del frame Kociemba (U=blanco, D=amarillo) → detectan la cross
 *   AMARILLA en D (piezas 4-7). Pero los reconstructores reales (CubeRoot, reco.nz)
 *   escriben el solve en el frame del solver: cross BLANCA en D (piezas 0-3).
 *   Como los IDs de pieza son físicos, NINGUNA rotación convierte una cross blanca
 *   en una amarilla → el PhaseSplitter NO detecta fases en solves estándar.
 *   Este script usa DETECCIÓN POR COLOR (la cross del solver) para las fases e
 *   IDENTIFICACIÓN POR ROLES (convención-independiente) para los casos.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/verify-cuberoot-2510.ts
 */
import {
  CubeState,
  CFOPDefinition,
  StateMatcher,
  expandWideMoves,
  CrossMask,
  FaceletStringConverter,
} from "../../packages/math-core/src/index";
import { PhaseSplitter } from "../../packages/analysis-engine/src/phases/PhaseSplitter";
import { TimelineBuilder } from "../../packages/analysis-engine/src/timeline/TimelineBuilder";
import type { SolveTimeline } from "../../packages/types/src/analysis";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
import { OLL_CASES } from "../../packages/algorithm-db/src/seed/cfop-oll";
import { PLL_CASES } from "../../packages/algorithm-db/src/seed/cfop-pll";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";

// ── Datos (autoritativo: cuberoot.me/recon/2510-…) ─────────────────────────
// NOTA: el scramble de la reconstrucción es el de arriba de la página (el
// "WCA scramble" que guarda nuestro JSON es el oficial de la competición; la
// solución está escrita contra ESTE).

const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

interface Phase {
  name: string;
  moves: string;
  slot?: "FR" | "FL" | "BL" | "BR";
  annotatedCase?: string;
}

const PHASES: Phase[] = [
  { name: "inspection", moves: "z y" },
  { name: "cross", moves: "D2 L U R' U'", annotatedCase: "W Cross" },
  { name: "F2L 1", moves: "x' D' L' U L U' L' U L D", slot: "BL", annotatedCase: "F2L 39 (Pj)" },
  { name: "F2L 2", moves: "U2 y' L' U L U' L' U L U2 L' U L", slot: "FR", annotatedCase: "F2L 11 (Jm)" },
  { name: "F2L 3", moves: "U2 U L U' L'", slot: "FL", annotatedCase: "F2L 1 (Jb)" },
  { name: "F2L 4", moves: "y' R' U2 R U R' U' R", slot: "BR", annotatedCase: "F2L 18 (Ci)" },
  { name: "OLL", moves: "R' U' R' F R F' U R", annotatedCase: "OLL 46" },
  { name: "PLL", moves: "U' R U R' U'D R2 U' R U' R' U R' U R2 D'", annotatedCase: "PLL Gd" },
];

// ── Tokenizador (quirks de CubeRoot) ───────────────────────────────────────

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz"; // sin corchetes: se interpola dentro de [ … ]

function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  s = s.replace(new RegExp(`([${FACE}])([0-9]+)'`, "g"), (_m, f: string, nS: string) => {
    const n = Number(nS) % 4;
    if (n === 0) return "";
    if (n === 1) return `${f}'`;
    if (n === 2) return `${f}2`;
    return f;
  });
  return s.trim().split(/\s+/).filter(Boolean).flatMap((t) => expandWideMoves(t));
}

// ── Grupo de rotación (24, incl. identidad) ────────────────────────────────

const fullSig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}`;
function genRotations(): string[] {
  const seen = new Set<string>([fullSig(new CubeState())]);
  const queue: { seq: string; key: string }[] = [{ seq: "", key: fullSig(new CubeState()) }];
  const out: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur.seq);
    for (const m of ["x", "y", "z"]) {
      const seq = (cur.seq + " " + m).trim();
      const c = new CubeState();
      c.applySequence(seq);
      const k = fullSig(c);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ seq, key: k });
      }
    }
  }
  return out;
}
const ROTS = genRotations();
const AUFS = ["", "U", "U2", "U'"];

function isRotationOfSolved(c: CubeState): boolean {
  const key = fullSig(c);
  return ROTS.some((r) => {
    const t = new CubeState();
    if (r) t.applySequence(r);
    return fullSig(t) === key;
  });
}

// ── Convenciones de color ──────────────────────────────────────────────────
// Motor/catálogo (Kociemba, U=blanco): cross AMARILLA en D = piezas 4-7 (ep),
// esquinas CL = 4-7 (cp), LL = piezas 0-3.
// Solver CubeRoot (blanco en D): cross BLANCA en D = piezas 0-3 (ep),
// esquinas CL = 0-3 (cp), LL = piezas 4-7.

const CATALOG = {
  crossEdges: [4, 5, 6, 7],
  yAnchor: 4, // arista amarilla-roja (DR) en posición 4
  clCorners: [4, 5, 6, 7],
  llCorners: [0, 1, 2, 3],
  llEdges: [0, 1, 2, 3],
  label: "catálogo (amarilla)",
};
const SOLVER = {
  crossEdges: [0, 1, 2, 3],
  yAnchor: 0, // arista blanca-roja (UR) en posición 4 (DR del frame blanco)
  clCorners: [0, 1, 2, 3],
  llCorners: [4, 5, 6, 7],
  llEdges: [4, 5, 6, 7],
  label: "solver (blanca)",
};

type Convention = typeof CATALOG;

/** Normaliza un estado a su convención: cross en D (eo=0) + arista ancla en DR. */
function normalizeCrossFrame(state: CubeState, conv: Convention): CubeState | null {
  for (const r of ROTS) {
    const t = state.clone();
    if (r) t.applySequence(r);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const d = ep.slice(4, 8);
    if (
      ep[4] === conv.yAnchor &&
      new Set(d).size === 4 &&
      d.every((p) => conv.crossEdges.includes(p)) &&
      eo.slice(4, 8).every((o) => o === 0)
    ) {
      return t;
    }
  }
  return null;
}

/** Cross del solver resuelta en ALGÚN frame (por color: piezas 0-3 en D con eo=0). */
function whiteCrossInAnyFrame(state: CubeState): boolean {
  for (const r of ROTS) {
    const t = r ? state.clone() : state;
    if (r) t.applySequence(r);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const d = ep.slice(4, 8);
    if (new Set(d).size === 4 && d.every((p) => p <= 3) && eo.slice(4, 8).every((o) => o === 0)) return true;
  }
  return false;
}

/** Slots del solver en el frame normalizado (blanco en D). */
const SOLVER_SLOTS: Record<string, { c: number; p: number; e: number }> = {
  FR: { c: 0, p: 4, e: 8 },
  FL: { c: 1, p: 5, e: 9 },
  BL: { c: 2, p: 6, e: 10 },
  BR: { c: 3, p: 7, e: 11 },
};
function slotComplete(norm: CubeState, slot: keyof typeof SOLVER_SLOTS): boolean {
  const { c, p, e } = SOLVER_SLOTS[slot];
  return (
    Array.from(norm.cp)[p] === c &&
    Array.from(norm.co)[p] === 0 &&
    Array.from(norm.ep)[e] === e &&
    Array.from(norm.eo)[e] === 0
  );
}

/** Slot que pasa de incompleto a completo entre pre y post (convención del solver). */
function solvedSlot(pre: CubeState, post: CubeState): string | null {
  const preN = normalizeCrossFrame(pre, SOLVER);
  const postN = normalizeCrossFrame(post, SOLVER);
  if (!preN || !postN) return null;
  for (const s of Object.keys(SOLVER_SLOTS) as (keyof typeof SOLVER_SLOTS)[]) {
    if (slotComplete(postN, s) && !slotComplete(preN, s)) return s;
  }
  return null;
}

// ── Identificación de casos por ROLES (convención-independiente) ───────────

/** Firma F2L: normaliza a su convención, min AUF, roles CL0-3/M0-3 de las 8 piezas F2L. */
function f2lRoleSig(state: CubeState, conv: Convention): string | null {
  const norm = normalizeCrossFrame(state, conv);
  if (!norm) return null;
  // Mapas SEPARADOS: esquinas y aristas comparten IDs de pieza (0-3).
  const cornerRole = new Map<number, string>();
  const edgeRole = new Map<number, string>();
  conv.clCorners.forEach((p, i) => cornerRole.set(p, `CL${i}`));
  for (let i = 0; i < 4; i++) edgeRole.set(8 + i, `M${i}`);
  let best: string | null = null;
  for (const a of AUFS) {
    const t = norm.clone();
    if (a) t.applySequence(a);
    const cp = Array.from(t.cp);
    const co = Array.from(t.co);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const entries: string[] = [];
    for (let p = 0; p < 8; p++) {
      const r = cornerRole.get(cp[p]);
      if (r !== undefined) entries.push(`${r}@${p}#${co[p]}`);
    }
    for (let p = 0; p < 12; p++) {
      const r = edgeRole.get(ep[p]);
      if (r !== undefined) entries.push(`${r}@${p}#${eo[p]}`);
    }
    const key = entries.sort().join("|");
    if (best === null || key < best) best = key;
  }
  return best;
}

/** Firma OLL: orientaciones de la última capa (posiciones 0-3), min AUF. */
function ollSig(state: CubeState, conv: Convention): string | null {
  const norm = normalizeCrossFrame(state, conv);
  if (!norm) return null;
  let best: string | null = null;
  for (const a of AUFS) {
    const t = norm.clone();
    if (a) t.applySequence(a);
    const key = `${Array.from(t.co).slice(0, 4).join(",")}|${Array.from(t.eo).slice(0, 4).join(",")}`;
    if (best === null || key < best) best = key;
  }
  return best;
}

/** Firma PLL: permutación de la última capa con roles L0-3, min AUF. */
function pllSig(state: CubeState, conv: Convention): string | null {
  const norm = normalizeCrossFrame(state, conv);
  if (!norm) return null;
  const cornerRole = new Map<number, string>();
  const edgeRole = new Map<number, string>();
  conv.llCorners.forEach((p, i) => cornerRole.set(p, `C${i}`));
  conv.llEdges.forEach((p, i) => edgeRole.set(p, `E${i}`));
  let best: string | null = null;
  for (const a of AUFS) {
    const t = norm.clone();
    if (a) t.applySequence(a);
    const cp = Array.from(t.cp);
    const co = Array.from(t.co);
    const ep = Array.from(t.ep);
    const eo = Array.from(t.eo);
    const entries: string[] = [];
    for (let p = 0; p < 4; p++) {
      const r = cornerRole.get(cp[p]);
      if (r !== undefined) entries.push(`${r}@${p}#${co[p]}`);
    }
    for (let p = 0; p < 4; p++) {
      const r = edgeRole.get(ep[p]);
      if (r !== undefined) entries.push(`${r}@${p}#${eo[p]}`);
    }
    const key = entries.sort().join("|");
    if (best === null || key < best) best = key;
  }
  return best;
}

// ── Índices del catálogo (convención amarilla) ─────────────────────────────

function buildF2LIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  let collisions = 0;
  let unindexed = 0;
  for (const c of ALL_F2L_CASES) {
    const state = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
    const sig = f2lRoleSig(state, CATALOG);
    if (sig === null) {
      unindexed++;
      continue;
    }
    const prev = idx.get(sig);
    if (prev !== undefined) {
      collisions++;
      console.log(`  [catálogo] COLISIÓN de firma: ${prev} y ${c.caseDef.caseNumber}`);
    }
    idx.set(sig, c.caseDef.caseNumber);
  }
  console.log(`[catálogo] F2L: ${ALL_F2L_CASES.length} casos indexados por ROLES (colisiones: ${collisions}, sin cross: ${unindexed})`);
  return idx;
}

function buildOLLIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  let collisions = 0;
  for (const c of OLL_CASES) {
    const state = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
    const key = ollSig(state, CATALOG);
    if (key === null) continue;
    const prev = idx.get(key);
    if (prev !== undefined) {
      collisions++;
      console.log(`  [catálogo] COLISIÓN OLL: ${prev} y ${c.caseDef.caseNumber}`);
    }
    idx.set(key, c.caseDef.caseNumber);
  }
  console.log(`[catálogo] OLL: ${OLL_CASES.length} casos indexados por ROLES (colisiones: ${collisions})`);
  return idx;
}

function buildPLLIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  let collisions = 0;
  for (const c of PLL_CASES) {
    const state = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
    const key = pllSig(state, CATALOG);
    if (key === null) continue;
    const prev = idx.get(key);
    if (prev !== undefined) {
      collisions++;
      console.log(`  [catálogo] COLISIÓN PLL: ${prev} y ${c.caseDef.caseNumber}`);
    }
    idx.set(key, c.caseDef.caseNumber);
  }
  console.log(`[catálogo] PLL: ${PLL_CASES.length} casos indexados por ROLES (colisiones: ${collisions})`);
  return idx;
}

// ── Algs ───────────────────────────────────────────────────────────────────

function rotationStripped(moves: string[]): string[] {
  return moves.filter((m) => !/^[xyz]/.test(m));
}
function trimAuf(moves: string[]): string[] {
  let out = [...moves];
  while (out.length && /^U/.test(out[0])) out = out.slice(1);
  return out;
}
function sameAlg(a: string[], b: string[]): boolean {
  const na = trimAuf(rotationStripped(a));
  const nb = trimAuf(rotationStripped(b));
  return na.length === nb.length && na.every((m, i) => m === nb[i]);
}

// ── Ejecución ──────────────────────────────────────────────────────────────

function main() {
  console.log("=".repeat(76));
  console.log("Verificación end-to-end · CubeRoot recon #2510 · Liam Walton 9.64");
  console.log("=".repeat(76));

  // 1) Timeline + coherencia
  const allTokens: string[] = [];
  const boundaries: { name: string; start: number; end: number; slot?: string; annotatedCase?: string }[] = [];
  let idx = 0;
  for (const p of PHASES) {
    const toks = tokenize(p.moves);
    allTokens.push(...toks);
    boundaries.push({ name: p.name, start: idx, end: idx + toks.length - 1, slot: p.slot, annotatedCase: p.annotatedCase });
    idx += toks.length;
  }

  const state = new CubeState();
  state.applySequence(SCRAMBLE);
  const states: CubeState[] = [];
  for (const t of allTokens) {
    state.applySequence(t);
    states.push(state.clone());
  }

  const final = states[states.length - 1];
  const exact = final.isSolved();
  const rotSolved = isRotationOfSolved(final);
  console.log(`\n[1] Coherencia (scramble+solución → solved): exacto=${exact} · rotación-de-resuelto=${rotSolved} · ${exact ? "✅" : rotSolved ? "⚠️ (frame rotado del solver)" : "❌"}`);
  console.log(`    Tokens: ${allTokens.length} (${62} STM según cuberoot, 5 rotaciones) · Fases: ${PHASES.length}`);

  // 2) Diagnóstico: el PhaseSplitter actual NO puede detectar fases en cross blanca
  const timeline: SolveTimeline = {
    solveId: "cuberoot-2510",
    method: "CFOP",
    entries: states.map((s, i) => {
      const d = { face: "U", direction: 1, cubeTimestamp: i, hostTimestamp: i } as const;
      return { index: i, move: d, displayMove: d, state: TimelineBuilder.toSnapshot(s), hostTimestamp: i };
    }),
    phases: [],
    initialStateSource: "scramble",
    startTimestamp: 0,
    endTimestamp: states.length,
  };
  const canonical = PhaseSplitter.split(timeline, CFOPDefinition);
  const colorNeutral = PhaseSplitter.split(timeline, CFOPDefinition, { colorNeutral: true });
  console.log("\n[2] PhaseSplitter ACTUAL (por qué no detecta este solve):");
  console.log(`    canonical: ${canonical.length} fases · colorNeutral: ${colorNeutral.length} fases`);
  console.log("    → los masks exigen la cross AMARILLA en D (piezas 4-7, Kociemba), pero el");
  console.log("      solver construye la cross BLANCA (piezas 0-3): son piezas físicas distintas");
  console.log("      y ninguna rotación las une → detección imposible con los masks actuales.");
  console.log("    → Por eso Fase 0.5 (reco.nz) solo detectaba ~25%: mismo bug de convención.");

  // 3) Verificación de fases POR COLOR (convención del solver)
  const preOf = (b: { start: number }) =>
    b.start === 0
      ? (() => {
          const s = new CubeState();
          s.applySequence(SCRAMBLE);
          return s;
        })()
      : states[b.start - 1];

  const crossOk = whiteCrossInAnyFrame(states[boundaries[1].end]);
  console.log("\n[3] Verificación de fases POR COLOR (cross blanca del solver):");
  console.log(`    ✅/❌ cross    → ${crossOk ? "cross blanca resuelta tras el paso (algún frame)" : "cross NO detectada"}`);

  for (let k = 2; k <= 5; k++) {
    const pre = preOf(boundaries[k]);
    const post = states[boundaries[k].end];
    const slot = solvedSlot(pre, post);
    console.log(`    ${PHASES[k].name.padEnd(6)} → slot completado: ${slot ?? "??"} (anotado: ${PHASES[k].slot}) ${slot === PHASES[k].slot ? "✅" : slot ? "⚠️ distinto" : "❌"}`);
  }
  const f2lDone = whiteCrossInAnyFrame(states[boundaries[5].end]) && (() => {
    const norm = normalizeCrossFrame(states[boundaries[5].end], SOLVER);
    if (!norm) return false;
    return Object.keys(SOLVER_SLOTS).every((s) => slotComplete(norm, s as keyof typeof SOLVER_SLOTS));
  })();
  console.log(`    F2L total → ${f2lDone ? "✅ todos los slots completos tras F2L 4" : "❌"}`);

  const ollOk = (() => {
    const norm = normalizeCrossFrame(states[boundaries[6].end], SOLVER);
    if (!norm) return false;
    return (
      Array.from(norm.co).slice(0, 4).every((o) => o === 0) &&
      Array.from(norm.eo).slice(0, 4).every((o) => o === 0)
    );
  })();
  console.log(`    OLL       → ${ollOk ? "✅ última capa orientada tras OLL" : "❌"}`);
  console.log(`    PLL       → ${exact || rotSolved ? "✅ final resuelto (exacto o rotación)" : "❌"}`);

  // 4) Identificación de casos por ROLES
  const f2lIdx = buildF2LIndex();
  const ollIdx = buildOLLIndex();
  const pllIdx = buildPLLIndex();

  console.log("\n[4] Identificación de casos por ROLES (convención-independiente):");
  for (let k = 2; k <= 5; k++) {
    const pre = preOf(boundaries[k]);
    const detected = pre ? f2lIdx.get(f2lRoleSig(pre, SOLVER) ?? "") : undefined;
    const annotatedNum = String(PHASES[k].annotatedCase).match(/F2L (\d+)/)?.[1];
    console.log(
      `    ${PHASES[k].name.padEnd(6)} anotado=${String(PHASES[k].annotatedCase).padEnd(14)} detectado=${String(detected ?? "??").padEnd(8)} → ${detected === undefined ? "❌ no detectado" : detected.replace("F2L ", "") === annotatedNum ? "✅ coincide" : "⚠️ otro caso: " + detected}`,
    );
  }

  const preOll = preOf(boundaries[6]);
  const ollDetected = preOll ? ollIdx.get(ollSig(preOll, SOLVER) ?? "") : undefined;
  console.log(`    OLL    anotado=OLL 46       detectado=${String(ollDetected).padEnd(8)} → ${ollDetected === "OLL 46" ? "✅" : "⚠️"}`);

  const prePll = preOf(boundaries[7]);
  const pllDetected = prePll ? pllIdx.get(pllSig(prePll, SOLVER) ?? "") : undefined;
  console.log(`    PLL    anotado=PLL Gd       detectado=${String(pllDetected).padEnd(8)} → ${pllDetected === "Gd" ? "✅" : "⚠️"}`);

  // 5) ¿Tenemos los algs usados?
  console.log("\n[5] ¿Tenemos los algs usados en el catálogo?");
  for (let k = 2; k <= 5; k++) {
    const pre = preOf(boundaries[k]);
    const detected = pre ? f2lIdx.get(f2lRoleSig(pre, SOLVER) ?? "") : undefined;
    const caseData = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === detected);
    const used = tokenize(PHASES[k].moves);
    const hit = caseData?.algorithms.find((a) => sameAlg(used, a.moves));
    console.log(
      `    ${PHASES[k].name.padEnd(6)} usado=[${used.join(" ")}]`,
      hit ? `→ ✅ alg en catálogo (${hit.id.slice(0, 8)}, votes=${hit.votes})` : `→ ${caseData ? `⚠️ variante/hueco (${caseData.algorithms.length} algs)` : "❌ caso no detectado"}`,
    );
  }
  const usedOll = tokenize(PHASES[6].moves);
  const ollCase = OLL_CASES.find((c) => c.caseDef.caseNumber === ollDetected);
  const ollHit = ollCase?.algorithms.find((a) => sameAlg(usedOll, a.moves));
  console.log(`    OLL    usado=[${usedOll.join(" ")}]`, ollHit ? `→ ✅ alg en catálogo` : `→ ${ollCase ? `⚠️ variante (${ollCase.algorithms.length} algs)` : "❌"}`);
  const usedPll = tokenize(PHASES[7].moves);
  const pllCase = PLL_CASES.find((c) => c.caseDef.caseNumber === pllDetected);
  const pllHit = pllCase?.algorithms.find((a) => sameAlg(usedPll, a.moves));
  console.log(`    PLL    usado=[${usedPll.join(" ")}]`, pllHit ? `→ ✅ alg en catálogo` : `→ ${pllCase ? `⚠️ variante (${pllCase.algorithms.length} algs)` : "❌"}`);

  console.log("\n" + "=".repeat(76));
  const allOk = (exact || rotSolved) && crossOk && f2lDone && ollOk && ollDetected === "OLL 46" && pllDetected === "Gd";
  console.log(allOk ? "RESULTADO GLOBAL: ✅ la reconstrucción se reproduce (fases por color + casos por roles)" : "RESULTADO GLOBAL: ⚠️ revisar detalle arriba");
  console.log("=".repeat(76));
}

main();
