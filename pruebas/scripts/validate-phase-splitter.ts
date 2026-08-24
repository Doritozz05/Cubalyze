/**
 * Fase 0.5 — Validación del PhaseSplitter contra el ground truth de reco.nz
 *
 * Los reconstructores de reco.nz etiquetan cada paso de la solución
 * ("cross", "1st pair"…, "OLL", "PLL"). Eso ES la división de fases real del
 * solve (ground truth). Este script:
 *
 *   1. Selecciona solves 3x3 con comentarios CFOP canónicos (set estricto).
 *   2. Construye el timeline (scramble + TODOS los tokens, incluidas rotaciones).
 *   3. Corre 3 detectores de fases:
 *        canonical     — PhaseSplitter con máscaras D-ancladas (defecto actual).
 *        colorNeutral  — PhaseSplitter color-neutral (6 caras de cross).
 *        invariant     — máscaras satisfechas salvo rotación de cubo (24 rotaciones).
 *   4. Compara los límites detectados contra los rangos esperados de los
 *      comentarios y mide aciertos por fase + cobertura completa.
 *
 * Objetivo: cuantificar cuánto se pierde por las rotaciones reales (y saber si
 * merece la pena añadir invarianza a rotación al PhaseSplitter de producción).
 *
 * Uso: pnpm dlx tsx pruebas/scripts/validate-phase-splitter.ts [N]
 *   N = tamaño de muestra (default 120).
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  CubeState,
  CFOPDefinition,
  StateMatcher,
  expandWideMoves,
  CrossMask,
  F2LMask,
  OLLMask,
  PLLMask,
  StringToMove,
  ColorPhaseDetector,
} from "../../packages/math-core/src/index";
import type { PhaseMask } from "../../packages/math-core/src/methods/IMethodDefinition";
import { PhaseSplitter } from "../../packages/analysis-engine/src/phases/PhaseSplitter";
import { TimelineBuilder } from "../../packages/analysis-engine/src/timeline/TimelineBuilder";
import type { SolveTimeline, PhaseSegment } from "../../packages/types/src/analysis";

const N = parseInt(process.argv[2] || "120", 10);

interface ReconzStep {
  moves: string;
  comment: string;
}
interface ReconzSolve {
  id: number;
  solver: string;
  time: number;
  puzzle: string;
  date: string;
  scramble: string;
  steps: ReconzStep[];
}

const ALL = JSON.parse(
  readFileSync(resolve(__dirname, "../generated/reconz-solves.json"), "utf-8"),
) as ReconzSolve[];

// ── Normalización de notación ──────────────────────────────────────────────

const PRIME = /[’′´]/g;

/** Normaliza un comentario (los comentarios sí van en minúsculas). */
const normComment = (s: string): string => s.replace(PRIME, "'").trim().toLowerCase();

/** Normaliza una cadena de movimientos (¡preserva mayúsculas! StringToMove es case-sensitive). */
const normMoves = (s: string): string => {
  // reco.nz usa potencias con prima: "U3'" = U⁻³ = U, "R2'" = R² = R2…
  // ("2'"→"2" ya lo cubre expandWideMoves, pero solo vale porque R2 es auto-inversa;
  // la regla general es Xn' = X^(-n mod 4).)
  return s
    .replace(PRIME, "'")
    .replace(/([URFDLBMESxyz])([0-9]+)'/g, (_m, face: string, nStr: string) => {
      const n = Number(nStr) % 4;
      if (n === 0) return ""; // X⁴' = identidad
      if (n === 1) return `${face}'`;
      if (n === 2) return `${face}2`;
      return face; // n === 3 → X⁻³ = X
    })
    .trim();
};

/** Expande un string de movimientos a tokens elementales (wide, U2', paréntesis). */
function expandTokens(moves: string): string[] {
  return expandWideMoves(normMoves(moves)).filter(Boolean);
}

/** True si todos los tokens expandidos son movimientos conocidos por el motor. */
function isValidTokens(moves: string): boolean {
  for (const t of expandTokens(moves)) {
    if (StringToMove[t] === undefined) return false;
  }
  return true;
}

// ── Clasificación CFOP estricta (ground truth desde los comentarios) ───────

const PAIR_RE = /^[1-4](?:st|nd|rd|th)(?: & [1-4](?:st|nd|rd|th))* pairs?$/;
const CROSS = new Set(["cross", "xcross", "xxcross"]);
const OLL = new Set(["oll", "oll(cp)", "coll"]);
const PLL = new Set(["pll", "epll"]);

interface StepInfo {
  comment: string;
  start: number;
  end: number;
}
interface Ranges {
  crossRange: [number, number];
  f2lRange: [number, number];
  ollRange: [number, number];
  pllRange: [number, number];
  total: number;
}

/** Devuelve los rangos esperados por fase si el solve es CFOP canónico; null si no. */
function classify(steps: ReconzStep[]): Ranges | null {
  if (steps.some((s) => normComment(s.comment) === "")) return null;

  const tokenized: StepInfo[] = [];
  let idx = 0;
  for (const s of steps) {
    if (!isValidTokens(s.moves)) return null; // notación desconocida → no clasificable
    const toks = expandTokens(s.moves);
    tokenized.push({ comment: normComment(s.comment), start: idx, end: idx + toks.length - 1 });
    idx += toks.length;
  }
  const meaningful = tokenized.filter((s) => s.comment !== "inspection");

  // 'auf' solo como último paso
  if (meaningful.some((s, i) => s.comment === "auf" && i !== meaningful.length - 1)) return null;

  const crossSteps = meaningful.filter((s) => CROSS.has(s.comment));
  const ollSteps = meaningful.filter((s) => OLL.has(s.comment));
  const pllSteps = meaningful.filter((s) => PLL.has(s.comment));
  if (crossSteps.length !== 1 || ollSteps.length !== 1 || pllSteps.length !== 1) return null;

  // Cobertura de pares 1-4
  const pairCoverage = new Set<number>();
  let lastPairStep: StepInfo | null = null;
  for (const s of meaningful) {
    if (PAIR_RE.test(s.comment)) {
      lastPairStep = s;
      for (const m of s.comment.match(/[1-4]/g) ?? []) pairCoverage.add(Number(m));
    } else if (
      !CROSS.has(s.comment) &&
      !OLL.has(s.comment) &&
      !PLL.has(s.comment) &&
      s.comment !== "auf"
    ) {
      return null; // comentario desconocido → no es CFOP canónico
    }
  }
  if (pairCoverage.size !== 4 || !lastPairStep) return null;
  for (const n of [1, 2, 3, 4]) if (!pairCoverage.has(n)) return null;

  // Orden estructural
  const cross = crossSteps[0];
  const oll = ollSteps[0];
  const pll = pllSteps[0];
  if (!(cross.start < lastPairStep.end && lastPairStep.end < oll.start && oll.start < pll.start))
    return null;

  const last = meaningful[meaningful.length - 1];
  const pllEnd = last.comment === "auf" ? last.end : pll.end;
  return {
    crossRange: [cross.start, cross.end],
    f2lRange: [lastPairStep.start, lastPairStep.end],
    ollRange: [oll.start, oll.end],
    pllRange: [pll.start, pllEnd],
    total: idx,
  };
}

// ── Construcción del timeline sintético ─────────────────────────────────────

function buildTimeline(
  id: number,
  scramble: string,
  steps: ReconzStep[],
): { timeline: SolveTimeline; states: CubeState[] } {
  const state = new CubeState();
  if (scramble) state.applySequence(scramble);

  const tokens: string[] = [];
  for (const s of steps) tokens.push(...expandTokens(s.moves));

  const entries: SolveTimeline["entries"] = [];
  const states: CubeState[] = [];
  let ts = 0;
  for (let i = 0; i < tokens.length; i++) {
    state.applySequence(tokens[i]);
    states.push(state.clone());
    const dummy = { face: "U", direction: 1, cubeTimestamp: ts, hostTimestamp: ts } as const;
    entries.push({
      index: i,
      move: dummy,
      displayMove: dummy,
      state: TimelineBuilder.toSnapshot(state),
      hostTimestamp: ts,
    });
    ts += 100;
  }

  const timeline: SolveTimeline = {
    solveId: String(id),
    method: "CFOP",
    entries,
    phases: [],
    initialStateSource: "scramble",
    startTimestamp: 0,
    endTimestamp: ts,
  };
  return { timeline, states };
}

// ── Detectores ──────────────────────────────────────────────────────────────

type Detected = Record<string, { completionIndex: number | undefined; skipped: boolean }>;

function toDetected(phases: PhaseSegment[]): Detected {
  const out: Detected = {};
  for (const p of phases) out[p.phaseName] = { completionIndex: p.completionIndex, skipped: !!p.skipped };
  return out;
}

const detectCanonical = (timeline: SolveTimeline): Detected =>
  toDetected(PhaseSplitter.split(timeline, CFOPDefinition));

const detectColorNeutral = (timeline: SolveTimeline): Detected =>
  toDetected(PhaseSplitter.split(timeline, CFOPDefinition, { colorNeutral: true }));

// Invarianza a rotación: las 24 rotaciones del cubo por BFS (x/y/z).
// IMPORTANTE: debe incluir la IDENTIDAD. Las máscaras (Cross/F2L/OLL/PLL)
// están ancladas a la cara D; un estado con la F2L completa en la cara D
// absoluta SOLO encaja con la identidad (las demás rotaciones mueven las
// capas resueltas a otras caras que la máscara rechaza).
function genRotationSeqs(): string[] {
  const sig = (c: CubeState) => `${Array.from(c.cp).join(",")}|${Array.from(c.ep).join(",")}`;
  const seen = new Set<string>();
  const out: string[] = [];
  const queue: { seq: string; key: string }[] = [{ seq: "", key: sig(new CubeState()) }];
  seen.add(queue[0].key);
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur.seq);
    for (const m of ["x", "y", "z"]) {
      const seq = (cur.seq + " " + m).trim();
      const c = new CubeState();
      c.applySequence(seq);
      const k = sig(c);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ seq, key: k });
      }
    }
  }
  return out; // 24 secuencias (la primera es la identidad "")
}

const ROTATIONS = genRotationSeqs();

/** True si el estado es el cubo resuelto salvo una rotación global de frame. */
function isRotationOfSolved(c: CubeState): boolean {
  const cpKey = Array.from(c.cp).join(",");
  const epKey = Array.from(c.ep).join(",");
  for (const seq of ROTATIONS) {
    const t = new CubeState();
    if (seq) t.applySequence(seq);
    if (Array.from(t.cp).join(",") === cpKey && Array.from(t.ep).join(",") === epKey) return true;
  }
  return false;
}

function matchesMaskInvariant(state: CubeState, mask: PhaseMask): boolean {
  for (const seq of ROTATIONS) {
    const s = seq ? state.clone() : state;
    if (seq) s.applySequence(seq);
    if (StateMatcher.matchesMask(s, mask)) return true;
  }
  return false;
}

/** Mismo bucle que PhaseSplitter.runDetection pero con matching invariante a rotación. */
function detectInvariant(states: CubeState[], masks: readonly PhaseMask[]): Detected {
  const out: Detected = {};
  let phaseIndex = 0;
  let searchFrom = 0;
  let prevCompletion = -1;
  while (phaseIndex < masks.length) {
    const mask = masks[phaseIndex];
    let completionIndex = -1;
    for (let i = searchFrom; i < states.length; i++) {
      if (matchesMaskInvariant(states[i], mask)) {
        completionIndex = i;
        break;
      }
    }
    if (completionIndex < 0) break;
    out[mask.name] = { completionIndex, skipped: completionIndex === prevCompletion };
    prevCompletion = completionIndex;
    searchFrom = completionIndex;
    phaseIndex++;
  }
  return out;
}

/**
 * Detector POR COLOR (nuevo): fases reconocidas por la geometría de las
 * pegatinas (cross de CUALQUIER color en CUALQUIER cara), combinado con las
 * 24 rotaciones de frame para reconstrucciones escritas en el frame del
 * solver. Complementa a los detectores por-pieza: arregla la cross blanca en
 * D (estilo estándar), invisible para todas las máscaras ancladas a piezas.
 */
const PHASE_NAMES = ["Cross", "F2L", "OLL", "PLL"] as const;

function betterDetected(a: Detected, b: Detected | null): boolean {
  if (!b) return Object.keys(a).length > 0;
  const aCount = Object.keys(a).length;
  const bCount = Object.keys(b).length;
  if (aCount !== bCount) return aCount > bCount;
  const aCross = a.Cross?.completionIndex ?? Number.MAX_SAFE_INTEGER;
  const bCross = b.Cross?.completionIndex ?? Number.MAX_SAFE_INTEGER;
  if (aCross !== bCross) return aCross < bCross;
  const aSum = Object.values(a).reduce((s, p) => s + (p.completionIndex ?? 0), 0);
  const bSum = Object.values(b).reduce((s, p) => s + (p.completionIndex ?? 0), 0);
  return aSum < bSum;
}

function detectColor(states: CubeState[]): Detected {
  let best: Detected | null = null;
  for (const seq of ROTATIONS) {
    const rotated = seq
      ? states.map((s) => {
          const c = s.clone();
          c.applySequence(seq);
          return c;
        })
      : states;
    const res = ColorPhaseDetector.detect(rotated);
    if (!res || res.completions[0] < 0) continue;
    const det: Detected = {};
    let prev = -1;
    for (let k = 0; k < PHASE_NAMES.length; k++) {
      const idx = res.completions[k];
      if (idx < 0) break;
      det[PHASE_NAMES[k]] = { completionIndex: idx, skipped: idx === prev };
      prev = idx;
    }
    if (betterDetected(det, best)) best = det;
  }
  return best ?? {};
}

// ── Evaluación vs ground truth ──────────────────────────────────────────────

type EvalResult = Record<"cross" | "f2l" | "oll" | "pll", boolean>;

function evaluate(det: Detected, r: Ranges): EvalResult {
  const hit = (name: string, range: [number, number]): boolean => {
    const p = det[name];
    return !!p && p.completionIndex !== undefined && p.completionIndex >= range[0] && p.completionIndex <= range[1];
  };
  const cross = hit("Cross", r.crossRange);
  const f2l = hit("F2L", r.f2lRange);
  const oll = hit("OLL", r.ollRange);
  const pll = hit("PLL", r.pllRange);
  return { cross, f2l, oll, pll };
}

// ── Ejecución ───────────────────────────────────────────────────────────────

function main() {
  console.log(`[Fase 0.5] Validación del PhaseSplitter vs reco.nz (muestra N=${N})`);
  console.log(`Rotaciones precomputadas: ${ROTATIONS.length} (24 del grupo de rotación, incl. identidad)`);

  const three3x3 = ALL.filter((s) => s.puzzle === "3x3" && s.steps?.length);
  const strict: { solve: ReconzSolve; ranges: Ranges }[] = [];
  let nonStrict = 0;
  for (const s of three3x3) {
    const ranges = classify(s.steps);
    if (ranges) strict.push({ solve: s, ranges });
    else nonStrict++;
  }
  console.log(`3x3 con pasos: ${three3x3.length} · CFOP estrictos: ${strict.length} · no estrictos: ${nonStrict}`);

  // Muestra determinista repartida
  const sample = (() => {
    if (strict.length <= N) return strict;
    const k = Math.ceil(strict.length / N);
    const out: typeof strict = [];
    for (let i = Math.floor(k / 2); i < strict.length; i += k) out.push(strict[i]);
    return out;
  })();

  const detectors = ["canonical", "colorNeutral", "invariant", "color"] as const;
  const totals: Record<string, { solves: number; full: number; cross: number; f2l: number; oll: number; pll: number; skipped: number; coherent: number }> = {};
  for (const d of detectors) {
    totals[d] = { solves: 0, full: 0, cross: 0, f2l: 0, oll: 0, pll: 0, skipped: 0, coherent: 0 };
  }
  const deltas: Record<string, number[]> = { canonical: [], colorNeutral: [], invariant: [], color: [] };
  const examples: unknown[] = [];
  let coherentCount = 0; // resuelto exacto O rotación-de-resuelto (frame distinto)
  let exactCount = 0;
  let rotOfSolvedCount = 0;
  let skippedCount = 0;

  for (const { solve, ranges } of sample) {
    try {
      // Invariante de coherencia: scramble + solución → resuelto
      const c = new CubeState();
      c.applySequence(solve.scramble || "");
      for (const s of solve.steps) c.applySequence(normMoves(s.moves));
      const exact = c.isSolved();
      const rotOfSolved = !exact && isRotationOfSolved(c);
      const coherent = exact || rotOfSolved; // exacto o exacto-en-frame-rotado
      if (coherent) coherentCount++;
      if (exact) exactCount++;
      if (rotOfSolved) rotOfSolvedCount++;

      const { timeline, states } = buildTimeline(solve.id, solve.scramble, solve.steps);
      const res: Record<string, Detected> = {
        canonical: detectCanonical(timeline),
        colorNeutral: detectColorNeutral(timeline),
        invariant: detectInvariant(states, [CrossMask, F2LMask, OLLMask, PLLMask]),
        color: detectColor(states),
      };

      const evalRes: Record<string, EvalResult> = {};
      for (const d of detectors) {
        const ev = evaluate(res[d], ranges);
        evalRes[d] = ev;
        const t = totals[d];
        t.solves++;
        if (ev.cross && ev.f2l && ev.oll && ev.pll) t.full++;
        if (ev.cross) t.cross++;
        if (ev.f2l) t.f2l++;
        if (ev.oll) t.oll++;
        if (ev.pll) t.pll++;
        if (Object.values(res[d]).some((p) => p.skipped)) t.skipped++;
        if (coherent) t.coherent++;
        for (const name of ["Cross", "F2L", "OLL", "PLL"] as const) {
          const p = res[d][name];
          if (p?.completionIndex !== undefined) {
            const range = name === "Cross" ? ranges.crossRange : name === "F2L" ? ranges.f2lRange : name === "OLL" ? ranges.ollRange : ranges.pllRange;
            deltas[d].push(p.completionIndex - range[1]);
          }
        }
      }

      if (examples.length < 6) {
        examples.push({
          id: solve.id,
          solver: solve.solver,
          date: solve.date,
          coherent,
          comments: solve.steps.map((s) => `${normComment(s.comment)}[${s.moves}]`),
          ranges,
          detected: Object.fromEntries(
            detectors.map((d) => [
              d,
              Object.fromEntries(Object.entries(res[d]).map(([k, v]) => [k, v.completionIndex])),
            ]),
          ),
          eval: evalRes,
        });
      }
    } catch {
      skippedCount++; // tokens inválidos en scramble/solución → no evaluable
    }
  }

  // ── Informe ────────────────────────────────────────────────────────────
  const report = {
    generated_at: new Date().toISOString(),
    sample_size: sample.length,
    totals: {
      three3x3: three3x3.length,
      strict: strict.length,
      sample: sample.length,
      evaluated: sample.length - skippedCount,
      skipped: skippedCount,
      exact: exactCount,
      rotOfSolved: rotOfSolvedCount,
      coherent: coherentCount,
      coherentPct: sample.length - skippedCount > 0 ? Math.round((100 * coherentCount) / (sample.length - skippedCount)) : 0,
    },
    detectors: Object.fromEntries(
      detectors.map((d) => {
        const t = totals[d];
        const pct = (n: number) => Math.round((100 * n) / t.solves);
        const dts = deltas[d];
        const mean = dts.length ? Math.round(10 * (dts.reduce((a, b) => a + b, 0) / dts.length)) / 10 : 0;
        const median = dts.length ? dts.slice().sort((a, b) => a - b)[Math.floor(dts.length / 2)] : 0;
        return [
          d,
          {
            solves: t.solves,
            fullMatchPct: pct(t.full),
            crossPct: pct(t.cross),
            f2lPct: pct(t.f2l),
            ollPct: pct(t.oll),
            pllPct: pct(t.pll),
            skippedPct: pct(t.skipped),
            coherentPct: pct(t.coherent),
            deltaVsExpectedEnd: { mean, median, min: dts.length ? Math.min(...dts) : 0, max: dts.length ? Math.max(...dts) : 0 },
          },
        ];
      }),
    ),
    examples,
  };

  writeFileSync(
    resolve(__dirname, "../generated/phase-splitter-validation.json"),
    JSON.stringify(report, null, 1),
  );

  console.log("\n=== Resumen ===");
  console.log(`Muestra: ${sample.length} solves CFOP estrictos · evaluados: ${sample.length - skippedCount} · no evaluables: ${skippedCount}`);
  console.log(`Coherencia (scramble+solución→solved): exactos ${exactCount} (${sample.length - skippedCount > 0 ? Math.round(100 * exactCount / (sample.length - skippedCount)) : 0}%) · exactos-en-frame-rotado ${rotOfSolvedCount} · con errores ${sample.length - skippedCount - coherentCount} (${sample.length - skippedCount > 0 ? Math.round(100 * (sample.length - skippedCount - coherentCount) / (sample.length - skippedCount)) : 0}%)`);
  console.log("");
  console.log("Detector        | full | cross |  f2l |  oll |  pll | skip | Δ medio");
  console.log("────────────────┼──────┼───────┼──────┼──────┼──────┼──────┼────────");
  for (const d of detectors) {
    const r = report.detectors[d] as any;
    console.log(
      `${d.padEnd(15)} | ${String(r.fullMatchPct).padStart(3)}% | ${String(r.crossPct).padStart(4)}% | ${String(r.f2lPct).padStart(3)}% | ${String(r.ollPct).padStart(3)}% | ${String(r.pllPct).padStart(3)}% | ${String(r.skippedPct).padStart(3)}% | ${String(r.deltaVsExpectedEnd.mean).padStart(5)}`,
    );
  }
  console.log("\nΔ = completionIndex detectado − fin esperado del paso (índices de tokens expandidos).");
  console.log("Detalle completo en pruebas/generated/phase-splitter-validation.json");
}

main();
