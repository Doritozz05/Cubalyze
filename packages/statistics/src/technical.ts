/**
 * technical.ts — Headless SESSION TECHNICAL statistics.
 *
 * `computeStats` aggregates raw TIMES (WCA averages, mean). This module
 * aggregates the TECHNICAL per-solve metrics that the analysis pipeline
 * already computes (phases, economy, rotations, lookahead, cross, recognition
 * cost) so the Insights session view can show technical trends and graphs.
 *
 * Pure, framework-agnostic, no UI deps. It accepts the shared `SolveMetrics`
 * (via `TechnicalSolveInput` below) so it can be tested headlessly and reused
 * by any consumer.
 */
import type { SolveMetrics } from "@cubalyze/types";

// ─── Input contract ─────────────────────────────────────────────────────────

/**
 * Accepts either the full solve object (`{ analysis }`), a raw `SolveMetrics`,
 * or nothing — so callers can pass `solves` straight through.
 */
export type TechnicalSolveInput =
  | {
      analysis?: SolveMetrics | null;
      time?: number;
      timestamp?: number;
      moves?: import("@cubalyze/types").CubeMoveEvent[];
    }
  | SolveMetrics
  | null
  | undefined;

function analysisOf(s: TechnicalSolveInput): SolveMetrics | undefined {
  if (s == null) return undefined;
  if (typeof s === "object" && "analysis" in s) {
    const a = (s as { analysis?: SolveMetrics | null }).analysis;
    return a ?? undefined;
  }
  return s as SolveMetrics;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Nearest-rank percentile on an already-sorted ascending array. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q));
  return sorted[idx];
}

/** Running count of solves that actually expose this optional field. */
type Total = { sum: number; n: number };

function total(): Total {
  return { sum: 0, n: 0 };
}
function push(t: Total, v: number | null | undefined): void {
  if (v != null && Number.isFinite(v)) {
    t.sum += v;
    t.n++;
  }
}

// ─── Phase time stats ───────────────────────────────────────────────────────

export interface PhaseTechnicalStats {
  /** "Cross", "F2L", "OLL", "PLL", ... */
  phaseName: string;
  /** Number of analysed solves that had this phase active (not skipped). */
  count: number;
  avgMs: number | null;
  p25Ms: number | null;
  p50Ms: number | null;
  p75Ms: number | null;
  avgMoves: number | null;
  avgTps: number | null;
  /** Mean share of the solve spent in this phase (0–100). */
  avgSharePct: number | null;
  /** Mean recognition time (phases that carry recognitionMs). */
  avgRecognitionMs: number | null;
  /** Mean of recognition / phase duration (0–1). */
  recognitionRatio: number | null;
}

export function derivePhaseTimeStats(
  input: TechnicalSolveInput[],
): PhaseTechnicalStats[] {
  const rows = new Map<string, number[][]>(); // phaseName -> [ms, moves, tps, sharePct, recMs, recRatio]
  for (const s of input) {
    const a = analysisOf(s);
    if (!a?.phases?.length) continue;
    const totalMs = a.totalTimeMs > 0 ? a.totalTimeMs : a.phases.reduce((x, p) => x + p.durationMs, 0);
    for (const p of a.phases) {
      if (p.skipped) continue;
      const sharePct = totalMs > 0 ? (p.durationMs / totalMs) * 100 : 0;
      const rec = p.recognitionMs != null && p.durationMs > 0 ? p.recognitionMs / p.durationMs : Number.NaN;
      const arr = rows.get(p.phaseName) ?? [];
      arr.push([
        p.durationMs,
        p.moveCount,
        p.tps,
        sharePct,
        p.recognitionMs ?? Number.NaN,
        rec,
      ]);
      rows.set(p.phaseName, arr);
    }
  }

  const out: PhaseTechnicalStats[] = [];
  for (const [phaseName, arr] of rows) {
    const ms = arr.map((r) => r[0]).sort((a, b) => a - b);
    out.push({
      phaseName,
      count: arr.length,
      avgMs: mean(arr.map((r) => r[0])),
      p25Ms: percentile(ms, 0.25),
      p50Ms: percentile(ms, 0.5),
      p75Ms: percentile(ms, 0.75),
      avgMoves: mean(arr.map((r) => r[1])),
      avgTps: mean(arr.map((r) => r[2])),
      avgSharePct: mean(arr.map((r) => r[3])),
      avgRecognitionMs: mean(arr.map((r) => (Number.isFinite(r[4]) ? r[4] : Number.NaN)).filter((v) => Number.isFinite(v))),
      recognitionRatio: mean(arr.map((r) => (Number.isFinite(r[5]) ? r[5] : Number.NaN)).filter((v) => Number.isFinite(v))),
    });
  }
  return out.sort((a, b) => b.avgSharePct! - a.avgSharePct!);
}

// ─── Economy ────────────────────────────────────────────────────────────────

export interface EconomyTechnicalStats {
  count: number;
  avgMoves: number | null;
  avgEfficiencyRatio: number | null;
  avgOptimalMoves: number | null;
  redundanciesTotal: number;
  cancellationsTotal: number;
  overturnsTotal: number;
  avgRedundancyRate: number | null;
  avgForwardDrift: number | null;
}

export function deriveEconomyStats(input: TechnicalSolveInput[]): EconomyTechnicalStats {
  const moves: number[] = [];
  const eff: number[] = [];
  const opt: number[] = [];
  const redRate: number[] = [];
  const drift: number[] = [];
  const canc = total();
  const overturns = total();
  let redundanciesTotal = 0;
  for (const s of input) {
    const a = analysisOf(s);
    if (!a) continue;
    if (Number.isFinite(a.totalMoves)) moves.push(a.totalMoves);
    if (a.efficiency) {
      if (Number.isFinite(a.efficiency.moveEfficiencyRatio)) eff.push(a.efficiency.moveEfficiencyRatio);
      if (Number.isFinite(a.efficiency.optimalMoveCount)) opt.push(a.efficiency.optimalMoveCount);
      redundanciesTotal += a.efficiency.redundancies || 0;
      push(canc, a.efficiency.cancellations);
      push(overturns, a.efficiency.overturns);
      if (Number.isFinite(a.efficiency.forwardDrift)) drift.push(a.efficiency.forwardDrift);
    }
    if (a.redundancy && Number.isFinite(a.redundancy.redundancyRate)) {
      redRate.push(a.redundancy.redundancyRate);
      redundanciesTotal += a.redundancy.totalRedundancies || 0;
    }
  }
  return {
    count: moves.length,
    avgMoves: mean(moves),
    avgEfficiencyRatio: mean(eff),
    avgOptimalMoves: mean(opt),
    redundanciesTotal,
    cancellationsTotal: Math.round(canc.sum),
    overturnsTotal: Math.round(overturns.sum),
    avgRedundancyRate: mean(redRate),
    avgForwardDrift: mean(drift),
  };
}

// ─── Rotations ──────────────────────────────────────────────────────────────

export interface RotationTechnicalStats {
  count: number;
  avgPerSolve: number | null;
  solvesWithoutRotationPct: number | null;
  redundantRotationsTotal: number;
  avgRotationToMoveRatio: number | null;
  /** Sum of rotations attributed to each phase. */
  byPhase: Record<string, number>;
  /** Mean rotations inside the F2L phase per F2L pair. */
  avgPerPair: number | null;
}

export function deriveRotationStats(input: TechnicalSolveInput[]): RotationTechnicalStats {
  const perSolve: number[] = [];
  const ratio: number[] = [];
  let noRot = 0;
  let analysed = 0;
  let redundantTotal = 0;
  const byPhase: Record<string, number> = {};
  const f2lRot = total();
  const pairCount = total();
  for (const s of input) {
    const a = analysisOf(s);
    if (!a) continue;
    analysed++;
    const r = a.rotation;
    if (r) {
      perSolve.push(r.totalCount || 0);
      redundantTotal += r.redundantRotations || 0;
      if (r.rotationToMoveRatio != null && Number.isFinite(r.rotationToMoveRatio)) {
        ratio.push(r.rotationToMoveRatio);
      }
      for (const [ph, c] of Object.entries(r.byPhase || {})) {
        byPhase[ph] = (byPhase[ph] || 0) + c;
      }
      if (r.byPhase?.F2L != null) push(f2lRot, r.byPhase.F2L);
      if (r.totalCount === 0) noRot++;
    }
    const pairs = a.cfop?.f2lPairs?.length;
    if (typeof pairs === "number" && Number.isFinite(pairs)) push(pairCount, pairs);
  }

  return {
    count: analysed,
    avgPerSolve: mean(perSolve),
    solvesWithoutRotationPct: analysed > 0 ? (noRot / analysed) * 100 : null,
    redundantRotationsTotal: redundantTotal,
    avgRotationToMoveRatio: mean(ratio),
    byPhase,
    // avg per pair over the whole session: total F2L rotations / total pairs.
    avgPerPair: pairCount.sum > 0 ? f2lRot.sum / pairCount.sum : null,
  };
}

// ─── Lookahead / pauses / pacing ────────────────────────────────────────────

export interface LookaheadTechnicalStats {
  count: number;
  avgPauseCount: number | null;
  avgPauseRatio: number | null;
  avgPauseTimeMs: number | null;
  maxPauseTimeMs: number;
  avgCrossToF2LMs: number | null;
  avgLookaheadScore: number | null;
  /* Pacing — from fluidity + peak TPS. */
  avgFluidityStdMs: number | null;
  avgFluidityCV: number | null;
  avgPeakTps: number | null;
  burstsTotal: number;
  decelerationsTotal: number;
  accelerationsTotal: number;
}

export function deriveLookaheadStats(input: TechnicalSolveInput[]): LookaheadTechnicalStats {
  const pauseCount: number[] = [];
  const pauseRatio: number[] = [];
  const pauseTime: number[] = [];
  const crossF2L: number[] = [];
  const lookahead: number[] = [];
  const fluidStd: number[] = [];
  const fluidCV: number[] = [];
  const peakTps: number[] = [];
  let maxPause = 0;
  let bursts = 0;
  let dec = 0;
  let acc = 0;
  for (const s of input) {
    const a = analysisOf(s);
    if (!a) continue;
    if (a.pauses) {
      if (Number.isFinite(a.pauses.totalCount)) pauseCount.push(a.pauses.totalCount);
      if (Number.isFinite(a.pauses.pauseRatio)) pauseRatio.push(a.pauses.pauseRatio);
      if (Number.isFinite(a.pauses.totalPauseTimeMs)) pauseTime.push(a.pauses.totalPauseTimeMs);
      if (a.pauses.maxDurationMs > maxPause) maxPause = a.pauses.maxDurationMs;
    }
    if (a.cfop) {
      if (Number.isFinite(a.cfop.crossToF2LTransitionMs)) crossF2L.push(a.cfop.crossToF2LTransitionMs);
      if (Number.isFinite(a.cfop.f2lLookaheadScore)) lookahead.push(a.cfop.f2lLookaheadScore);
    }
    if (a.fluidity) {
      if (Number.isFinite(a.fluidity.stdDevMs)) fluidStd.push(a.fluidity.stdDevMs);
      if (Number.isFinite(a.fluidity.coefficientOfVariation)) fluidCV.push(a.fluidity.coefficientOfVariation);
      bursts += a.fluidity.burstCount || 0;
      dec += a.fluidity.decelerationCount || 0;
      acc += a.fluidity.accelerationCount || 0;
    }
    if (a.tps && Number.isFinite(a.tps.peakInstantaneous)) peakTps.push(a.tps.peakInstantaneous);
  }
  return {
    count: lookahead.length || crossF2L.length || pauseCount.length,
    avgPauseCount: mean(pauseCount),
    avgPauseRatio: mean(pauseRatio),
    avgPauseTimeMs: mean(pauseTime),
    maxPauseTimeMs: maxPause,
    avgCrossToF2LMs: mean(crossF2L),
    avgLookaheadScore: mean(lookahead),
    avgFluidityStdMs: mean(fluidStd),
    avgFluidityCV: mean(fluidCV),
    avgPeakTps: mean(peakTps),
    burstsTotal: bursts,
    decelerationsTotal: dec,
    accelerationsTotal: acc,
  };
}

// ─── Cross ──────────────────────────────────────────────────────────────────

export interface CrossTechnicalStats {
  count: number;
  avgCrossMoves: number | null;
  avgCrossEfficiency: number | null;
  avgCrossTps: number | null;
  /** Number of solves with an xcross/x-pair detected at cross completion. */
  xcrossCount: number;
  xcrossPct: number | null;
  skips: { oll: number; pll: number };
}

export function deriveCrossStats(input: TechnicalSolveInput[]): CrossTechnicalStats {
  const moves: number[] = [];
  const eff: number[] = [];
  const tps: number[] = [];
  let xcross = 0;
  let analysed = 0;
  const skips = { oll: 0, pll: 0 };
  for (const s of input) {
    const a = analysisOf(s);
    if (!a) continue;
    const cfop = a.cfop;
    if (!cfop) continue;
    analysed++;
    if (Number.isFinite(cfop.crossMoves)) moves.push(cfop.crossMoves);
    if (Number.isFinite(cfop.crossEfficiency)) eff.push(cfop.crossEfficiency);
    if (Number.isFinite(cfop.crossTPS)) tps.push(cfop.crossTPS);
    const ct = a.detectionReport?.crossType;
    if (ct && ct !== "plain") xcross++;
    const sks = a.detectionReport?.skips ?? [];
    if (sks.includes("oll")) skips.oll++;
    if (sks.includes("pll")) skips.pll++;
  }
  return {
    count: analysed,
    avgCrossMoves: mean(moves),
    avgCrossEfficiency: mean(eff),
    avgCrossTps: mean(tps),
    xcrossCount: xcross,
    xcrossPct: analysed > 0 ? (xcross / analysed) * 100 : null,
    skips,
  };
}

// ─── Recognition cost (LL) ──────────────────────────────────────────────────

export interface RecognitionCost {
  phase: "OLL" | "PLL";
  count: number;
  avgRecognitionMs: number | null;
  avgExecutionMs: number | null;
  /** Recognition ÷ (recognition + execution), 0–1. */
  recognitionShare: number | null;
}

export function deriveRecognitionCosts(input: TechnicalSolveInput[]): RecognitionCost[] {
  const rec = { OLL: total(), PLL: total() };
  const exec = { OLL: total(), PLL: total() };
  for (const s of input) {
    const cfop = analysisOf(s)?.cfop;
    if (!cfop) continue;
    push(rec.OLL, cfop.ollRecognitionMs);
    push(exec.OLL, cfop.ollExecutionMs);
    push(rec.PLL, cfop.pllRecognitionMs);
    push(exec.PLL, cfop.pllExecutionMs);
  }
  const cost = (phase: "OLL" | "PLL"): RecognitionCost => {
    const r = rec[phase].n > 0 ? rec[phase].sum / rec[phase].n : null;
    const e = exec[phase].n > 0 ? exec[phase].sum / exec[phase].n : null;
    const share =
      r != null && e != null && r + e > 0
        ? r / (r + e)
        : null;
    return {
      phase,
      count: Math.min(rec[phase].n, exec[phase].n),
      avgRecognitionMs: r,
      avgExecutionMs: e,
      recognitionShare: share,
    };
  };
  return cost("OLL").count > 0 ? [cost("OLL"), cost("PLL")] : cost("PLL").count > 0 ? [cost("PLL")] : [];
}

// ─── Convenience aggregate ──────────────────────────────────────────────────

export interface SessionTechnicalStats {
  counts: { total: number; analysed: number };
  phases: PhaseTechnicalStats[];
  economy: EconomyTechnicalStats;
  rotations: RotationTechnicalStats;
  lookahead: LookaheadTechnicalStats;
  cross: CrossTechnicalStats;
  recognition: RecognitionCost[];
}

/** Aggregate everything above into a single object for the session view. */
export function deriveSessionTechnicalStats(
  solves: TechnicalSolveInput[],
): SessionTechnicalStats {
  const analysed = solves
    .map(analysisOf)
    .filter((a): a is SolveMetrics => !!a?.phases).length;
  return {
    counts: { total: solves.filter((s) => s != null).length, analysed },
    phases: derivePhaseTimeStats(solves),
    economy: deriveEconomyStats(solves),
    rotations: deriveRotationStats(solves),
    lookahead: deriveLookaheadStats(solves),
    cross: deriveCrossStats(solves),
    recognition: deriveRecognitionCosts(solves),
  };
}

// ─── Move-level metrics (fingerprint / face usage / pacing) ────────────────

import type { CubeMoveEvent } from "@cubalyze/types";

export interface MoveMetrics {
  count: number;
  /** Wall-clock duration (last − first timestamp), 0 when < 2 moves. */
  durationMs: number;
  tps: number;
  /** Move counts per face (U/D/L/R/F/B + any slice letters present). */
  faceFreq: Record<string, number>;
  /** Percent of all moves per face (0–100). */
  facePct: Record<string, number>;
  /** The most-used face letter. */
  dominantFace: string | null;
  /** Share of moves that are double turns (R2). */
  doublesPct: number | null;
  /** Number of wide moves (r, etc.) when recorded. */
  wideCount: number;
  /** Consecutive moves on the same face (R R or R R2), a habit signal. */
  consecutiveSameFace: number;
  /** Inter-move gap stats (ms) — pacing/rhythm. */
  gapMeanMs: number | null;
  gapStdMs: number | null;
  gapMaxMs: number | null;
}

/**
 * Per-solve move-level metrics: the solve "fingerprint" (which faces/how
 * much/double turns), plus inter-move pacing variability from timestamps.
 * Pure and headless — no UI deps.
 */
export function deriveMoveMetrics(
  moves: CubeMoveEvent[] | null | undefined,
): MoveMetrics {
  const list = Array.isArray(moves) ? moves : [];
  if (list.length === 0) {
    return {
      count: 0,
      durationMs: 0,
      tps: 0,
      faceFreq: {},
      facePct: {},
      dominantFace: null,
      doublesPct: null,
      wideCount: 0,
      consecutiveSameFace: 0,
      gapMeanMs: null,
      gapStdMs: null,
      gapMaxMs: null,
    };
  }

  const faceFreq: Record<string, number> = {};
  let doubles = 0;
  let wide = 0;
  let consecutive = 0;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const f = m.face;
    faceFreq[f] = (faceFreq[f] ?? 0) + 1;
    if (m.direction === 2) doubles++;
    if (m.wide === true) wide++;
    if (i > 0 && list[i - 1].face === f) consecutive++;
  }

  const facePct: Record<string, number> = {};
  for (const f of Object.keys(faceFreq)) {
    facePct[f] = (faceFreq[f] / list.length) * 100;
  }
  const dominantFace =
    list.length > 0
      ? Object.keys(faceFreq).sort((a, b) => faceFreq[b] - faceFreq[a])[0]
      : null;

  const ts = list.map((m) => m.hostTimestamp).filter((t) => Number.isFinite(t));
  const durationMs =
    ts.length > 1 ? Math.max(0, ts[ts.length - 1] - ts[0]) : 0;
  const tps = durationMs > 0 ? (list.length / durationMs) * 1000 : 0;

  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) {
    const d = ts[i] - ts[i - 1];
    if (Number.isFinite(d) && d >= 0) gaps.push(d);
  }
  const gapMean = gaps.length > 0 ? mean(gaps) : null;
  const gapStd =
    gaps.length > 1
      ? Math.sqrt(
          gaps.reduce((acc, g) => acc + (g - gapMean!) ** 2, 0) / gaps.length,
        )
      : null;

  return {
    count: list.length,
    durationMs,
    tps,
    faceFreq,
    facePct,
    dominantFace,
    doublesPct: list.length > 0 ? (doubles / list.length) * 100 : null,
    wideCount: wide,
    consecutiveSameFace: consecutive,
    gapMeanMs: gapMean,
    gapStdMs: gapStd,
    gapMaxMs: gaps.length > 0 ? Math.max(...gaps) : null,
  };
}

// ─── Case intelligence (session distribution) ───────────────────────────────

export type CaseIntelligencePhase = "F2L" | "OLL" | "PLL";

export interface CaseIntelligence {
  /** "F2L 39" / "OLL 24" / "Ta" etc. */
  caseNumber: string;
  /** Human-ish name (BirdF2L / alg case names). */
  caseName: string;
  phase: CaseIntelligencePhase;
  count: number;
  avgTimeMs: number | null;
  avgMoves: number | null;
  avgTps: number | null;
  p75TimeMs: number | null;
  /**
   * Average RECOGNITION time for this case — the gap before the pair/OLL/PLL
   * is executed (per occurrence). Splitting rec vs exec is what separates
   * "I'm slow because I mis-recognize" from "I'm slow because I execute the
   * moves slowly" — the two diagnostic axes pros care most about.
   */
  avgRecognitionMs: number | null;
  /** Average EXECUTION time for this case (the actual turning/driving time). */
  avgExecutionMs: number | null;
}

interface CaseBucket {
  key: CaseIntelligencePhase;
  /** Per occurrence. Columns: 0=recognitionMs, 1=executionMs, 2=moves, 3=tps. */
  nums: number[];
  name: string;
}

/**
 * Session distribution of recognized F2L/OLL/PLL cases: how often each case
 * appeared, its average time/moves/TPS, and the slow tail (p75). Lets the UI
 * surface "your weakest case" purely from data.
 */
export function deriveCaseIntelligence(
  input: TechnicalSolveInput[],
): CaseIntelligence[] {
  const buckets = new Map<string, CaseBucket>();
  const key = (k: CaseIntelligencePhase, caseNumber: string) => `${k}:${caseNumber}`;

  for (const s of input) {
    const a = analysisOf(s);
    const cfop = a?.cfop;
    if (!cfop) continue;

    // F2L pairs — time/moves/tps are per pair; recognition = the gap before
    // the pair's first move, execution = the pair's own turning time.
    for (const p of cfop.f2lPairs) {
      const c = p.detectedCase;
      if (!c?.caseNumber) continue;
      const id = key("F2L", c.caseNumber);
      let b = buckets.get(id);
      if (!b) {
        b = { key: "F2L", nums: [], name: c.caseName ?? c.caseNumber };
        buckets.set(id, b);
      }
      b.nums.push(p.recognitionMs || 0, p.timeMs, p.moves || 0, p.tps || 0);
    }

    // Last layer — recognition and execution are already split by the
    // analysis pipeline (ollRecognitionMs / ollExecutionMs).
    const phases = a?.phases ?? [];
    const ollPhase = phases.find((p) => p.phaseName === "OLL");
    const pllPhase = phases.find((p) => p.phaseName === "PLL");
    if (cfop.ollCase?.caseNumber) {
      const id = key("OLL", cfop.ollCase.caseNumber);
      let b = buckets.get(id);
      if (!b) {
        b = { key: "OLL", nums: [], name: cfop.ollCase.caseName ?? cfop.ollCase.caseNumber };
        buckets.set(id, b);
      }
      b.nums.push(cfop.ollRecognitionMs || 0, cfop.ollExecutionMs || 0, ollPhase?.moveCount ?? 0, cfop.ollTPS || 0);
    }
    if (cfop.pllCase?.caseNumber) {
      const id = key("PLL", cfop.pllCase.caseNumber);
      let b = buckets.get(id);
      if (!b) {
        b = { key: "PLL", nums: [], name: cfop.pllCase.caseName ?? cfop.pllCase.caseNumber };
        buckets.set(id, b);
      }
      b.nums.push(cfop.pllRecognitionMs || 0, cfop.pllExecutionMs || 0, pllPhase?.moveCount ?? 0, cfop.pllTPS || 0);
    }
  }

  const out: CaseIntelligence[] = [];
  for (const [id, b] of buckets) {
    const rec: number[] = [];
    const exec: number[] = [];
    const moves: number[] = [];
    const tps: number[] = [];
    for (let i = 0; i < b.nums.length; i += 4) {
      if (Number.isFinite(b.nums[i])) rec.push(b.nums[i]);
      if (Number.isFinite(b.nums[i + 1])) exec.push(b.nums[i + 1]);
      if (Number.isFinite(b.nums[i + 2])) moves.push(b.nums[i + 2]);
      if (Number.isFinite(b.nums[i + 3]) && b.nums[i + 3] > 0) tps.push(b.nums[i + 3]);
    }
    const times = rec.map((r, i) => r + (exec[i] ?? 0));
    const count = exec.length;
    out.push({
      caseNumber: id.slice(id.indexOf(":") + 1),
      caseName: b.name,
      phase: b.key,
      count,
      avgTimeMs: mean(times),
      avgMoves: mean(moves),
      avgTps: mean(tps),
      p75TimeMs: percentile([...times].sort((x, y) => x - y), 0.75),
      avgRecognitionMs: mean(rec),
      avgExecutionMs: mean(exec),
    });
  }
  return out.sort((a, b) => b.count - a.count || a.phase.localeCompare(b.phase));
}

// ─── Skill Radar Profile (Universal 6 Axes) ────────────────────────────────

export type SkillAxisId =
  | "tps"
  | "lookahead"
  | "economy"
  | "ergonomics"
  | "recognition"
  | "consistency";

export interface SkillAxisData {
  id: SkillAxisId;
  labelKey: string;
  score: number; // 0–100 integer
  rawValue: number | null;
  formattedValue: string;
  unit: string;
  benchmark: string;
  status: "strength" | "balanced" | "bottleneck";
}

export interface SkillRadarProfile {
  axes: SkillAxisData[];
  overallScore: number;
  primaryStrength: SkillAxisData | null;
  primaryBottleneck: SkillAxisData | null;
  analysedCount: number;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sigmoid(x: number, mid: number, k: number): number {
  return 100 / (1 + Math.exp(-k * (x - mid)));
}

/**
 * Pure calculation of the 6 universal speedcubing skill dimensions for a session.
 * Method-agnostic: evaluates TPS, Lookahead, Economy, Ergonomics, Recognition, and Session Consistency.
 */
export function deriveSkillRadarProfile(
  input: TechnicalSolveInput[] | TechnicalSolveInput,
): SkillRadarProfile {
  const solves = (Array.isArray(input) ? input : [input]).filter((s) => s != null);
  const stats = deriveSessionTechnicalStats(solves);
  const totalCount = solves.length;

  if (totalCount === 0) {
    const defaultAxes: SkillAxisData[] = [
      { id: "tps", labelKey: "radar.tps", score: 0, rawValue: null, formattedValue: "—", unit: "TPS", benchmark: "> 4.0", status: "balanced" },
      { id: "lookahead", labelKey: "radar.lookahead", score: 0, rawValue: null, formattedValue: "—", unit: "% pausas", benchmark: "< 30%", status: "balanced" },
      { id: "economy", labelKey: "radar.economy", score: 0, rawValue: null, formattedValue: "—", unit: "movs", benchmark: "< 65", status: "balanced" },
      { id: "ergonomics", labelKey: "radar.ergonomics", score: 0, rawValue: null, formattedValue: "—", unit: "rot", benchmark: "≤ 8.0", status: "balanced" },
      { id: "recognition", labelKey: "radar.recognition", score: 0, rawValue: null, formattedValue: "—", unit: "s", benchmark: "< 0.75s", status: "balanced" },
      { id: "consistency", labelKey: "radar.consistency", score: 0, rawValue: null, formattedValue: "—", unit: "% var", benchmark: "< 18%", status: "balanced" },
    ];
    return {
      axes: defaultAxes,
      overallScore: 0,
      primaryStrength: null,
      primaryBottleneck: null,
      analysedCount: 0,
    };
  }

  // 1. TPS (Global solve speed: total moves / total solve duration in seconds)
  const tpsValues: number[] = [];
  for (const s of solves) {
    const a = analysisOf(s);
    if (a?.tps?.global && Number.isFinite(a.tps.global) && a.tps.global > 0) {
      tpsValues.push(a.tps.global);
    } else if (a?.totalMoves && a.totalTimeMs > 0) {
      tpsValues.push((a.totalMoves / a.totalTimeMs) * 1000);
    } else if (
      typeof s === "object" &&
      "moves" in s &&
      Array.isArray((s as { moves?: unknown[] }).moves) &&
      "time" in s &&
      typeof (s as { time?: number }).time === "number" &&
      (s as { time: number }).time > 0
    ) {
      const moveCount = (s as { moves: unknown[] }).moves.length;
      if (moveCount > 0) {
        tpsValues.push((moveCount / (s as { time: number }).time) * 1000);
      }
    }
  }
  const avgTps = mean(tpsValues);
  // Permissive speedcubing curve: 1.5 TPS -> 28, 2.5 -> 48, 3.2 -> 62, 4.2 -> 79, 5.5 -> 92, 7.0+ -> 98
  const tpsScore = avgTps != null ? clampScore(sigmoid(avgTps, 2.6, 0.75)) : 50;

  // 2. Lookahead (Pause reduction & Continuous Flow)
  const pauseRatio = stats.lookahead.avgPauseRatio;
  let lookaheadScore = 50;
  if (pauseRatio != null) {
    // 15% pause -> 86, 25% -> 76, 35% -> 62, 45% -> 45, 60% -> 23
    lookaheadScore = clampScore(100 - sigmoid(pauseRatio, 0.42, 6.8));
    if (stats.lookahead.avgPauseTimeMs && stats.lookahead.avgPauseTimeMs > 1500) {
      lookaheadScore = Math.max(0, lookaheadScore - 6);
    }
  }

  // 3. Economy (Move efficiency & minimal redundancies)
  // Extract moves from economy stats or direct solve moves
  const moveCounts: number[] = [];
  for (const s of solves) {
    const a = analysisOf(s);
    if (a?.totalMoves && Number.isFinite(a.totalMoves) && a.totalMoves > 0) {
      moveCounts.push(a.totalMoves);
    } else if (typeof s === "object" && "moves" in s && Array.isArray((s as { moves?: unknown[] }).moves)) {
      const l = (s as { moves: unknown[] }).moves.length;
      if (l > 0) moveCounts.push(l);
    }
  }
  const avgMoves = mean(moveCounts) ?? stats.economy.avgMoves;
  let economyScore = 50;
  if (avgMoves != null) {
    // 45 moves -> 87, 55 -> 78, 65 -> 66, 75 -> 50, 88 -> 30, 105 -> 12
    economyScore = clampScore(100 - sigmoid(avgMoves, 75, 0.065));
    if (stats.economy.avgRedundancyRate != null && stats.economy.avgRedundancyRate > 0.06) {
      economyScore = Math.max(0, economyScore - Math.round(stats.economy.avgRedundancyRate * 35));
    }
  }

  // 4. Ergonomics (Rotations & orientation control - calibrated for Smart Cube wide/slice events)
  const rotCounts: number[] = [];
  for (const s of solves) {
    const a = analysisOf(s);
    if (a?.rotation?.totalCount != null && Number.isFinite(a.rotation.totalCount)) {
      rotCounts.push(a.rotation.totalCount);
    }
  }
  const avgRot = mean(rotCounts) ?? stats.rotations.avgPerSolve;
  let ergonomicsScore = 50;
  if (avgRot != null) {
    if (avgRot === 0) {
      ergonomicsScore = 100;
    } else {
      // Calibrated for Smart Cubes (wide moves/M slice regrips): 0 rot -> 100, 4 -> 88, 8 -> 78, 12 -> 63, 15 -> 50, 18 -> 37, 24+ -> 15
      ergonomicsScore = clampScore(100 - sigmoid(avgRot, 15.0, 0.18));
    }
  }

  // 5. Recognition (Mental perception & reaction speed)
  const recTimes: number[] = [];
  for (const rc of stats.recognition) {
    if (rc.avgRecognitionMs != null && Number.isFinite(rc.avgRecognitionMs)) {
      recTimes.push(rc.avgRecognitionMs);
    }
  }
  for (const ph of stats.phases) {
    if (ph.avgRecognitionMs != null && Number.isFinite(ph.avgRecognitionMs)) {
      recTimes.push(ph.avgRecognitionMs);
    }
  }
  const avgRecMs = mean(recTimes);
  let recognitionScore = 50;
  if (avgRecMs != null) {
    // 0.30s -> 88, 0.50s -> 79, 0.75s -> 67, 1.00s -> 50, 1.40s -> 25
    recognitionScore = clampScore(100 - sigmoid(avgRecMs, 1000, 0.0028));
  } else if (stats.cross.avgCrossMoves != null) {
    recognitionScore = 65;
  }

  // 6. Consistency (Session Stability & Improvement-aware variance)
  interface TimedSolve {
    time: number;
    timestamp: number;
  }
  const timedSolves: TimedSolve[] = [];
  for (let i = 0; i < solves.length; i++) {
    const s = solves[i];
    if (!s) continue;
    let t: number | undefined;
    let ts: number | undefined;

    if (typeof s === "object") {
      if ("timestamp" in s && typeof (s as { timestamp?: number }).timestamp === "number" && (s as { timestamp: number }).timestamp > 0) {
        ts = (s as { timestamp: number }).timestamp;
      }
      if ("time" in s && typeof (s as { time?: number }).time === "number" && (s as { time: number }).time > 0) {
        t = (s as { time: number }).time;
      }
    }

    if (t == null) {
      const a = analysisOf(s);
      if (a?.totalTimeMs && a.totalTimeMs > 0) {
        t = a.totalTimeMs;
      }
    }

    if (t != null && t > 0) {
      timedSolves.push({ time: t, timestamp: ts ?? i });
    }
  }

  // Strictly sort chronologically by date/timestamp (oldest date -> newest date).
  // Regardless of how the user sorts the table/list (by fastest, slowest, moves, etc.),
  // the timestamp determines the true chronological timeline of the session.
  const hasTimestamps = timedSolves.some((s) => s.timestamp > 0);
  if (hasTimestamps) {
    timedSolves.sort((a, b) => a.timestamp - b.timestamp);
  }
  const solveTimes = timedSolves.map((s) => s.time);

  let cv: number | null = null;
  let consistencyScore = 80;
  if (solveTimes.length >= 2) {
    const n = solveTimes.length;
    const meanTime = mean(solveTimes) ?? 0;
    const rawStd = Math.sqrt(
      solveTimes.reduce((acc, t) => acc + (t - meanTime) ** 2, 0) / n,
    );
    const rawCv = meanTime > 0 ? rawStd / meanTime : 0;

    // Linear regression over chronological solves (negative slope = times dropping/improving)
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += solveTimes[i];
      sumXY += i * solveTimes[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

    // Detrended variance (variance around the session learning curve)
    let residualSumSq = 0;
    const intercept = (sumY - slope * sumX) / n;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      const res = solveTimes[i] - predicted;
      residualSumSq += res * res;
    }
    const detrendedStd = Math.sqrt(residualSumSq / n);
    const detrendedCv = meanTime > 0 ? detrendedStd / meanTime : 0;

    // Permissive curve: 10% CV -> 88, 20% -> 76, 30% -> 60, 40% -> 44, 55% -> 22
    if (slope < 0) {
      cv = Math.min(rawCv, detrendedCv);
      const base = 100 - sigmoid(cv, 0.35, 7.5);
      const improvementBonus = Math.min(12, Math.round((Math.abs(slope) * n / (meanTime || 1)) * 20));
      consistencyScore = clampScore(base + improvementBonus);
    } else {
      cv = rawCv;
      consistencyScore = clampScore(100 - sigmoid(cv, 0.35, 7.5));
    }
  } else if (solveTimes.length === 1) {
    cv = 0;
    consistencyScore = 85;
  }

  const classify = (score: number): "strength" | "balanced" | "bottleneck" => {
    if (score >= 68) return "strength";
    if (score <= 42) return "bottleneck";
    return "balanced";
  };

  const axes: SkillAxisData[] = [
    {
      id: "tps",
      labelKey: "radar.tps",
      score: tpsScore,
      rawValue: avgTps != null ? Number(avgTps.toFixed(2)) : null,
      formattedValue: avgTps != null ? `${avgTps.toFixed(2)}` : "—",
      unit: "TPS",
      benchmark: "> 4.0",
      status: classify(tpsScore),
    },
    {
      id: "lookahead",
      labelKey: "radar.lookahead",
      score: lookaheadScore,
      rawValue: pauseRatio != null ? Number((pauseRatio * 100).toFixed(1)) : null,
      formattedValue: pauseRatio != null ? `${Math.round(pauseRatio * 100)}%` : "—",
      unit: "pausas",
      benchmark: "< 30%",
      status: classify(lookaheadScore),
    },
    {
      id: "economy",
      labelKey: "radar.economy",
      score: economyScore,
      rawValue: avgMoves != null ? Number(avgMoves.toFixed(1)) : null,
      formattedValue: avgMoves != null ? `${Math.round(avgMoves)}` : "—",
      unit: "movs",
      benchmark: "< 65",
      status: classify(economyScore),
    },
    {
      id: "ergonomics",
      labelKey: "radar.ergonomics",
      score: ergonomicsScore,
      rawValue: avgRot != null ? Number(avgRot.toFixed(1)) : null,
      formattedValue: avgRot != null ? `${avgRot.toFixed(1)}` : "—",
      unit: "rot",
      benchmark: "≤ 8.0",
      status: classify(ergonomicsScore),
    },
    {
      id: "recognition",
      labelKey: "radar.recognition",
      score: recognitionScore,
      rawValue: avgRecMs != null ? Number((avgRecMs / 1000).toFixed(2)) : null,
      formattedValue: avgRecMs != null ? `${(avgRecMs / 1000).toFixed(2)}s` : "—",
      unit: "rec",
      benchmark: "< 0.75s",
      status: classify(recognitionScore),
    },
    {
      id: "consistency",
      labelKey: "radar.consistency",
      score: consistencyScore,
      rawValue: cv != null ? Number((cv * 100).toFixed(1)) : null,
      formattedValue: cv != null ? `${(cv * 100).toFixed(0)}%` : "—",
      unit: "var",
      benchmark: "< 18%",
      status: classify(consistencyScore),
    },
  ];

  const overallScore = Math.round(
    axes.reduce((acc, ax) => acc + ax.score, 0) / axes.length,
  );

  const sortedByScore = [...axes].sort((a, b) => b.score - a.score);
  const primaryStrength = sortedByScore[0].score >= 58 ? sortedByScore[0] : null;
  const primaryBottleneck = sortedByScore[sortedByScore.length - 1].score <= 50 ? sortedByScore[sortedByScore.length - 1] : null;

  return {
    axes,
    overallScore,
    primaryStrength,
    primaryBottleneck,
    analysedCount: totalCount,
  };
}
