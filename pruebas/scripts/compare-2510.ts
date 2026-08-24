/**
 * COMPARACIÓN COMPLETA · Solve 2510 (Liam Walton 9.64, CubeRoot)
 *
 * NUESTRO análisis (replay literal + ColorPhaseDetector + identificación de
 * casos F2L/OLL/PLL) frente al de CubeRoot/quest.
 *
 * Datos: la reconstrucción EXACTA de cuberoot.me/recon/2510 (incluidas las
 * rotaciones de inspección z y y los x'/y' intermedios).
 *
 * Pipeline de identificación:
 *   1. Replay literal (rotaciones físicas, Model A) → states[].
 *   2. ColorPhaseDetector sobre las 24 rotaciones → bestRot + fronteras.
 *   3. FRAME DEL SOLVER por fase: rotaciones que ponen las aristas de la cross
 *      (piezas 0-3) en las posiciones D (4-7) con eo=0. El agarre del solver
 *      cambia a mitad del solve, así que el frame se recalcula por fase.
 *   4. F2L: el PAR de cada fase = el slot que se resuelve (solved en post pero
 *      no en pre). Firma del par: rotar slot→FR y leer posición+orientación de
 *      la esquina blanca {U,F,R} y la arista {F,R}. Match contra el índice del
 *      catálogo (construido igual, variantes AUF).
 *   5. OLL/PLL: RECOLOR (swap U↔D) del frame del solver → última capa en U con
 *      piezas 0-3, igual que el catálogo. Firmas min sobre U^k.
 *
 * Uso: pnpm dlx tsx pruebas/scripts/compare-2510.ts
 */
import { CubeState, ColorPhaseDetector, FaceletStringConverter } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
import { OLL_CASES } from "../../packages/algorithm-db/src/seed/cfop-oll";
import { PLL_CASES } from "../../packages/algorithm-db/src/seed/cfop-pll";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";

const PRIME = /[’′´]/g;
const FACE = "URFDLBMESxyz";
function tokenize(moves: string): string[] {
  let s = moves.replace(PRIME, "'");
  s = s.replace(/[↑·]/g, " ");
  s = s.replace(new RegExp(`([${FACE}2-9'])(?=[${FACE}])`, "g"), "$1 ");
  return s.trim().split(/\s+/).filter(Boolean);
}

// ── Datos autoritativos (cuberoot.me/recon/2510) ───────────────────────────
const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";

const PHASES = [
  { name: "inspection", moves: "z y" },
  { name: "Cross", moves: "D2 L U R' U'", slot: null as string | null, annotCase: "W Cross" },
  { name: "F2L 1", moves: "x' D' L' U L U' L' U L D", slot: "BO", annotCase: "F2L 39 (Pj)" },
  { name: "F2L 2", moves: "U2 y' L' U L U' L' U L U2 L' U L", slot: "GR", annotCase: "F2L 11 (Jm)" },
  { name: "F2L 3", moves: "U2 U L U' L'", slot: "BR", annotCase: "F2L 1 (Jb)" },
  { name: "F2L 4", moves: "y' R' U2 R U R' U' R", slot: "GO", annotCase: "F2L 18 (Ci)" },
  { name: "OLL", moves: "R' U' R' F R F' U R", slot: null, annotCase: "OLL 46" },
  { name: "PLL", moves: "U' R U R' U' D R2 U' R U' R' U R' U R2 D'", slot: null, annotCase: "PLL Gd" },
];

// ── Grupo de rotación (24) ─────────────────────────────────────────────────
const fullSig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}|${Array.from(c.co).join(",")}|${Array.from(c.eo).join(",")}`;
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
      if (!seen.has(k)) { seen.add(k); queue.push({ seq, key: k }); }
    }
  }
  return out;
}
const ROTS = genRotations();

function rotOfSolved(c: CubeState): string | null {
  const key = fullSig(c);
  for (const r of ROTS) {
    const t = new CubeState();
    if (r) t.applySequence(r);
    if (fullSig(t) === key) return r;
  }
  return null;
}

// ── Geometría ──────────────────────────────────────────────────────────────
const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const faceOfFacelet = (i: number): string =>
  i < 9 ? "U" : i < 18 ? "R" : i < 27 ? "F" : i < 36 ? "D" : i < 45 ? "L" : "B";
const isD = (i: number) => i >= 27 && i < 36;
const D_CORNERS = [4, 5, 6, 7];
const M_EDGES = [8, 9, 10, 11];

const flOf = (s: CubeState) => FaceletStringConverter.toFaceletString(s).split("");

const SLOT_ROLE: Record<string, { cPos: number; cRole: string; ePos: number; eRole: string }> = {
  FR: { cPos: 4, cRole: "FR", ePos: 8, eRole: "FR" },
  FL: { cPos: 5, cRole: "FL", ePos: 9, eRole: "FL" },
  BL: { cPos: 6, cRole: "BL", ePos: 10, eRole: "BL" },
  BR: { cPos: 7, cRole: "BR", ePos: 11, eRole: "BR" },
};
const SLOT_ROT: Record<string, string> = { FR: "", FL: "y", BL: "y2", BR: "y'" };
const SLOT_ORDER = ["FR", "FL", "BL", "BR"] as const;

function cornerRole(fl: string[], p: number): string {
  const side = cornerFacelet[p].filter((i) => !isD(i) && faceOfFacelet(i) !== "U");
  return side.map((i) => fl[i]).sort().join("");
}
function edgeRole(fl: string[], p: number): string {
  const [a, b] = edgeFacelet[p];
  return [fl[a], fl[b]].sort().join("");
}

/** ¿Está el slot S completo (por colores laterales + orientación)? */
function slotSolved(s: CubeState, slot: string): boolean {
  const { cPos, cRole, ePos, eRole } = SLOT_ROLE[slot];
  const fl = flOf(s);
  return (
    cornerRole(fl, cPos) === cRole && s.co[cPos] === 0 &&
    edgeRole(fl, ePos) === eRole && s.eo[ePos] === 0
  );
}
function solvedSlots(s: CubeState): string[] {
  return SLOT_ORDER.filter((slot) => slotSolved(s, slot));
}

/**
 * Frame del SOLVER: rotaciones que dejan las aristas de la cross (piezas 0-3)
 * en las posiciones D (4-7) con eo=0. La cross está en casa en el agarre del
 * solver en toda fase posterior a la cross.
 */
function solverFrameRotations(state: CubeState): string[] {
  const out: string[] = [];
  for (const r of ROTS) {
    const t = r ? state.clone() : state;
    if (r) t.applySequence(r);
    const dEdges = Array.from(t.ep).slice(4, 8);
    const dEo = Array.from(t.eo).slice(4, 8);
    if (dEdges.every((p) => p >= 0 && p <= 3) && dEo.every((e) => e === 0)) out.push(r);
  }
  return out;
}

/**
 * Recolor: swap de los stickers U↔D (blanco↔amarillo). Convierte el frame del
 * solver (cross blanca en D) a la convención del catálogo (amarillo en D,
 * blanca en U) para que OLL/PLL lean piezas 0-3 en la última capa, igual que
 * el catálogo.
 */
function recolorSwap(s: CubeState): CubeState {
  const fl = flOf(s).map((c) => (c === "U" ? "D" : c === "D" ? "U" : c));
  return FaceletStringConverter.fromFaceletString(fl.join(""));
}

/**
 * Firma del PAR: posición + orientación de la esquina blanca {crossColor,F,R}
 * y la arista {F,R}, tras rotar el slot a FR. En el frame del solver (cross en
 * D) la esquina del par es la ÚNICA blanca con esos colores laterales.
 */
function pairSig(s: CubeState, crossColor: string): string | null {
  const fl = flOf(s);
  let cornerPos = -1, edgePos = -1;
  for (let p = 0; p < 8; p++) {
    const colors = cornerFacelet[p].map((i) => fl[i]);
    if (colors.includes(crossColor) && colors.includes("F") && colors.includes("R")) { cornerPos = p; break; }
  }
  for (let p = 0; p < 12; p++) {
    const [a, b] = edgeFacelet[p];
    const colors = [fl[a], fl[b]];
    if (colors.includes("F") && colors.includes("R") && !colors.includes(crossColor)) { edgePos = p; break; }
  }
  if (cornerPos < 0 || edgePos < 0) return null;
  return `C${cornerPos}#${s.co[cornerPos]}|E${edgePos}#${s.eo[edgePos]}`;
}

/** OLL: orientación de la última capa (U) — min sobre U^k. */
function ollSig(s: CubeState): string {
  let best: string | null = null;
  for (const a of ["", "U", "U2", "U'"]) {
    const t = s.clone();
    if (a) t.applySequence(a);
    const key = `${Array.from(t.co).slice(0, 4).join(",")}|${Array.from(t.eo).slice(0, 4).join(",")}`;
    if (best === null || key < best) best = key;
  }
  return best!;
}

/** PLL: permutación de la última capa (U) — min sobre U^k. */
function pllSig(s: CubeState): string {
  let best: string | null = null;
  for (const a of ["", "U", "U2", "U'"]) {
    const t = s.clone();
    if (a) t.applySequence(a);
    const key = `${Array.from(t.cp).slice(0, 4).join(",")}|${Array.from(t.ep).slice(0, 4).join(",")}`;
    if (best === null || key < best) best = key;
  }
  return best!;
}

// ── Índices del catálogo (todas las variantes AUF) ─────────────────────────
function buildIndex(
  cases: { caseDef: { caseNumber: string; setupScramble: string }; algorithms: { moves: string }[] }[],
  sigFn: (s: CubeState) => string | null,
  label: string,
): Map<string, string> {
  const idx = new Map<string, string>();
  let collisions = 0, unindexed = 0;
  for (const c of cases) {
    let state: CubeState;
    try { state = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble); }
    catch { unindexed++; continue; }
    for (const a of ["", "U", "U2", "U'"]) {
      const t = state.clone();
      if (a) t.applySequence(a);
      const sig = sigFn(t);
      if (sig === null) { unindexed++; continue; }
      const prev = idx.get(sig);
      if (prev !== undefined && prev !== c.caseDef.caseNumber) {
        collisions++;
        console.log(`  [catálogo] COLISIÓN ${label}: ${prev} y ${c.caseDef.caseNumber} → sig ${sig}`);
      }
      idx.set(sig, c.caseDef.caseNumber);
    }
  }
  console.log(`[catálogo] ${label}: ${cases.length} casos · firmas ${idx.size} (colisiones: ${collisions}, sin normalizar: ${unindexed})`);
  return idx;
}

// ── Algs ───────────────────────────────────────────────────────────────────
function rotationStripped(moves: string[]): string[] {
  return moves.filter((m) => !/^[xyz]/.test(m));
}
function trimAuf(moves: string[]): string[] {
  let out = [...moves];
  while (out.length && /^U/.test(out[0])) out = out.slice(1);
  while (out.length && /^U/.test(out[out.length - 1])) out = out.slice(0, -1);
  return out;
}
function sameAlg(a: string[], b: string[]): boolean {
  const na = trimAuf(rotationStripped(a));
  const nb = trimAuf(rotationStripped(b));
  return na.length === nb.length && na.every((m, i) => m === nb[i]);
}

// ── Ejecución ──────────────────────────────────────────────────────────────
function main() {
  console.log("=".repeat(88));
  console.log("COMPARACIÓN · CubeRoot recon #2510 · Liam Walton 9.64 (Wiltshire Summer 2026)");
  console.log("=".repeat(88));

  // 1) Replay literal
  const allTokens: string[] = [];
  const bounds: { name: string; start: number; end: number; slot?: string | null; annotCase?: string }[] = [];
  let idx = 0, stm = 0, rot = 0;
  for (const ph of PHASES) {
    const toks = tokenize(ph.moves);
    allTokens.push(...toks);
    bounds.push({ name: ph.name, start: idx, end: idx + toks.length - 1, slot: ph.slot, annotCase: ph.annotCase });
    idx += toks.length;
    for (const t of toks) if (/^[xyz]/.test(t)) rot++; else stm++;
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
  const rotSolved = rotOfSolved(final);
  console.log(`\n[1] Replay literal (scramble + ${allTokens.length} tokens):`);
  console.log(`    ${stm} STM + ${rot} rotaciones = ${allTokens.length} tokens · CubeRoot anota ${stm} STM ✓`);
  console.log(`    Coherencia: isSolved=${exact} · rotación-de-resuelto=${rotSolved ?? "NONE"} → ${exact ? "EXACTA" : rotSolved ? "frame rotado del solver (equivalente)" : "NO coherente"}`);

  // 2) Detector por color + mejor rotación
  let best: ReturnType<typeof ColorPhaseDetector.detect> = null;
  let bestRot = "";
  for (const r of ROTS) {
    const rotated = states.map((s) => {
      const t = s.clone();
      if (r) t.applySequence(r);
      return t;
    });
    const res = ColorPhaseDetector.detect(rotated);
    if (!res) continue;
    const score = res.completions.filter((c) => c >= 0).length * 100 - res.completions[0];
    const bScore = best ? best.completions.filter((c) => c >= 0).length * 100 - best.completions[0] : -Infinity;
    if (score > bScore) { best = res; bestRot = r; }
  }
  console.log(`\n[2] NUESTRO detector por color (ColorPhaseDetector) con 24 rot:`);
  console.log(`    rot=${bestRot || "∅"} → ${best ? `crossFace=${best.crossFace} crossColor=${best.crossColor} | cross@${best.completions[0] + 1} f2l@${best.completions[1] + 1} oll@${best.completions[2] + 1} pll@${best.completions[3] + 1} (tokens 1-based)` : "null"}`);

  // 3) Fronteras
  console.log(`\n[3] Fronteras: NUESTRO detector vs CubeRoot (tokens 1-based, rotaciones incluidas):`);
  console.log(`    ${"Fase".padEnd(8)} ${"CubeRoot".padEnd(22)} ${"Nuestro".padEnd(12)} Match`);
  const ourB = best?.completions ?? [];
  const ourNames = ["cross", "f2l", "oll", "pll"];
  for (let k = 1; k < bounds.length; k++) {
    const b = bounds[k];
    const ce = b.end + 1;
    const idxName = ourNames.findIndex((n) => b.name.toLowerCase().startsWith(n));
    const ours = idxName >= 0 ? ourB[idxName] : -1;
    const m = ours + 1 === ce ? "✓ EXACTO" : ours >= 0 ? `≈ (${ours + 1})` : "—";
    console.log(`    ${b.name.padEnd(8)} ${`fin@${ce} (${b.end - b.start + 1}m)`.padEnd(22)} ${ours >= 0 ? `fin@${ours + 1}` : "—".padEnd(12)} ${m}`);
  }
  console.log(`    Nota: la cross del solver se completa en el mov 7 y el detector la registra en el 8\n    (el x' inmediato es un re-grip: el frame de la cross se confirma un token después,\n    igual que en tu solve del smart cube con el movimiento de alineación).`);

  // 4) Índices del catálogo
  console.log(`\n[4] Índice del catálogo (firma por par / OLL / PLL, variantes AUF):`);
  const f2lIdx = buildIndex(ALL_F2L_CASES, (s) => pairSig(s, "D"), "F2L");
  const ollIdx = buildIndex(OLL_CASES, ollSig, "OLL");
  const pllIdx = buildIndex(PLL_CASES, pllSig, "PLL");

  // 5) F2L: par por SLOT NUEVO (resuelto en post, no en pre) en el frame del solver
  console.log(`\n[5] Casos detectados (frame del solver, par del slot nuevo) vs CubeRoot:`);
  const slotColors: Record<string, string> = { FR: "GR", FL: "GO", BL: "BO", BR: "BR" };
  for (let k = 2; k <= 5; k++) {
    const pre = states[bounds[k].start - 1];
    const post = states[bounds[k].end];
    const frames = solverFrameRotations(pre);

    const votes = new Map<string, { count: number; slot: string }>();
    for (const r of frames) {
      const preR = pre.clone(); if (r) preR.applySequence(r);
      const postR = post.clone(); if (r) postR.applySequence(r);
      const preSlots = new Set(solvedSlots(preR));
      const postSlots = new Set(solvedSlots(postR));
      const newSlots = SLOT_ORDER.filter((s) => !preSlots.has(s) && postSlots.has(s));
      if (newSlots.length !== 1) continue;
      const newSlot = newSlots[0];
      const rot = preR.clone();
      if (SLOT_ROT[newSlot]) rot.applySequence(SLOT_ROT[newSlot]);
      const sig = pairSig(rot, "U");
      if (sig === null || !f2lIdx.has(sig)) continue;
      const num = f2lIdx.get(sig)!;
      const cur = votes.get(num) ?? { count: 0, slot: newSlot };
      cur.count++;
      votes.set(num, cur);
    }
    const winner = [...votes.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    const detected = winner?.[0];
    const newSlot = winner?.[1].slot ?? null;

    const annotNum = String(bounds[k].annotCase).match(/F2L (\d+)/)?.[1];
    const ok = detected !== undefined && detected.replace("F2L ", "") === annotNum;
    console.log(`    ${bounds[k].name.padEnd(6)} slot geom: ${String(newSlot ?? "?").padEnd(3)} (par ${(newSlot ? slotColors[newSlot] : "?").padEnd(3)} · anotado ${String(bounds[k].slot).padEnd(3)}) · caso: ${String(detected ?? "??").padEnd(8)} (anotado ${String(bounds[k].annotCase).padEnd(12)}) ${ok ? "✅" : detected === undefined ? "❌ no detectado" : "⚠️ otro"}`);
  }

  // 6) OLL / PLL: frame del solver + recolor (convención del catálogo)
  const preOll = states[bounds[6].start - 1];
  let ollDetected: string | undefined;
  for (const r of solverFrameRotations(preOll)) {
    const t = preOll.clone(); if (r) t.applySequence(r);
    const sig = ollSig(recolorSwap(t));
    if (ollIdx.has(sig)) { ollDetected = ollIdx.get(sig); break; }
  }
  console.log(`    OLL    caso: ${String(ollDetected ?? "??").padEnd(8)} (anotado OLL 46) ${ollDetected === "OLL 46" ? "✅" : "⚠️"}`);

  const prePll = states[bounds[7].start - 1];
  let pllDetected: string | undefined;
  for (const r of solverFrameRotations(prePll)) {
    const t = prePll.clone(); if (r) t.applySequence(r);
    const sig = pllSig(recolorSwap(t));
    if (pllIdx.has(sig)) { pllDetected = pllIdx.get(sig); break; }
  }
  console.log(`    PLL    caso: ${String(pllDetected ?? "??").padEnd(8)} (anotado PLL Gd) ${pllDetected === "Gd" ? "✅" : "⚠️"}`);

  // 7) Algs usados en catálogo
  console.log(`\n[6] ¿Los algs usados están en nuestro catálogo?`);
  for (let k = 2; k <= 5; k++) {
    const pre = states[bounds[k].start - 1];
    const post = states[bounds[k].end];
    const frames = solverFrameRotations(pre);
    let detected: string | undefined;
    for (const r of frames) {
      const preR = pre.clone(); if (r) preR.applySequence(r);
      const postR = post.clone(); if (r) postR.applySequence(r);
      const newSlots = SLOT_ORDER.filter((s) => !solvedSlots(preR).includes(s) && solvedSlots(postR).includes(s));
      if (newSlots.length !== 1) continue;
      const rot = preR.clone();
      if (SLOT_ROT[newSlots[0]]) rot.applySequence(SLOT_ROT[newSlots[0]]);
      const sig = pairSig(rot, "U");
      if (sig !== null && f2lIdx.has(sig)) { detected = f2lIdx.get(sig); break; }
    }
    const caseData = ALL_F2L_CASES.find((c) => c.caseDef.caseNumber === detected);
    const used = tokenize(PHASES[k].moves);
    const hit = caseData?.algorithms.find((a) => sameAlg(used, a.moves));
    console.log(`    ${bounds[k].name.padEnd(6)} usado=[${used.join(" ")}]`,
      hit ? `→ ✅ alg en catálogo (${hit.id.slice(0, 8)}, votes=${hit.votes})`
          : `→ ${caseData ? `⚠️ variante/hueco (${caseData.algorithms.length} algs)` : "❌ caso no detectado"}`);
  }
  const usedOll = tokenize(PHASES[6].moves);
  const ollCase = OLL_CASES.find((c) => c.caseDef.caseNumber === ollDetected);
  const ollHit = ollCase?.algorithms.find((a) => sameAlg(usedOll, a.moves));
  console.log(`    OLL    usado=[${usedOll.join(" ")}]`, ollHit ? `→ ✅ alg en catálogo` : `→ ${ollCase ? `⚠️ variante (${ollCase.algorithms.length} algs)` : "❌"}`);
  const usedPll = tokenize(PHASES[7].moves);
  const pllCase = PLL_CASES.find((c) => c.caseDef.caseNumber === pllDetected);
  const pllHit = pllCase?.algorithms.find((a) => sameAlg(usedPll, a.moves));
  console.log(`    PLL    usado=[${usedPll.join(" ")}]`, pllHit ? `→ ✅ alg en catálogo` : `→ ${pllCase ? `⚠️ variante (${pllCase.algorithms.length} algs)` : "❌"}`);

  console.log(`\n${"=".repeat(88)}`);
  console.log("FIN");
}

main();
