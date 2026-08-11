/**
 * audit-large/shared.ts — shared harness for the large-scale solve audit.
 *
 * Classifies every CFOP solve into three buckets using the SAME validated
 * metric as the divergence study (raw cross end = first /cross/i phase,
 * entry space via conjugatePhaseStream):
 *
 *   perfect  — final solved, |ourCrossEnd − rawCrossEnd| ≤ 2, OLL/PLL skip
 *              agreement. The reconstructionist's write-up is reproduced.
 *   minor    — final solved but a FEW tokens off: cross diff 3–6 (the
 *              xcross wide-move / alignment window), or skip mismatch with a
 *              right cross. Human-plausible, no broken segmentation.
 *   disaster — cross diff > 6, or the solve does not end solved, or the F2L
 *              phase exists but zero pairs were found. Broken output.
 *   unlabelled — no written cross block (flat/unlabelled) → cross diff n/a.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../../reconstruction/analyzeSolveText';
import { conjugatePhaseStream, tokenize } from '@cubeforge/math-core';

export interface Rec {
  key: string;
  source?: string;
  solver?: string;
  time: number;
  scramble: string;
  text: string;
  phases: { label: string; moves: string }[];
  recognition?: { inspection?: string };
}

export type AuditBucket = 'perfect' | 'minor' | 'disaster' | 'unlabelled';

export interface AuditResult {
  key: string;
  source: string;
  time: number;
  raw: number;
  our: number;
  diff: number;
  finalSolved: boolean;
  skipMatch: boolean;
  crossType: string;
  pairCount: number;
  warnings: string[];
  bucket: AuditBucket;
}

const FACE_MOVE_RE = /^[URFDLB][2']?$/;
const DATA_DIR = path.resolve(
  __dirname,
  '../../../../../apps/web/public/reconstructions/data',
);

export function loadAll(): Rec[] {
  const out: Rec[] = [];
  for (let c = 0; c < 60; c++) {
    const f = path.join(DATA_DIR, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).solves ?? []) {
      if (s.puzzle !== '3x3' || s.method !== 'CFOP') continue;
      if (!s.scramble || !s.text || !Array.isArray(s.phases)) continue;
      out.push(s as Rec);
    }
  }
  return out;
}

export interface PartReport {
  slice: number;
  perfect: number;
  minor: number;
  disaster: number;
  unlabelled: number;
  perfectPct: number;
  total: number;
  /** Aggregated diff histogram (perfect+minor only, keyed by diff value). */
  diffHist: Record<number, number>;
}

/** Run the audit over a slice [start, end) and persist per-solve results to a
 *  JSON file so a node aggregator can build the full report. */
export function runPart(start: number, end: number, outFile: string): PartReport {
  const all = loadAll();
  const slice = all.slice(start, end);
  const counts = { perfect: 0, minor: 0, disaster: 0, unlabelled: 0 } as Record<string, number>;
  const diffHist: Record<number, number> = {};
  const results: AuditResult[] = [];
  for (const rec of slice) {
    let r: AuditResult;
    try {
      r = classify(rec);
    } catch {
      r = {
        key: rec.key, source: rec.source ?? '?', time: rec.time,
        raw: -2, our: -2, diff: NaN, finalSolved: false, skipMatch: false,
        crossType: 'THREW', pairCount: 0, warnings: ['threw'], bucket: 'disaster',
      };
    }
    counts[r.bucket]++;
    if (r.bucket === 'perfect' || r.bucket === 'minor') {
      const d = Math.round(r.diff);
      diffHist[d] = (diffHist[d] ?? 0) + 1;
    }
    results.push(r);
  }
  fs.writeFileSync(outFile, JSON.stringify(results));
  return {
    slice: slice.length,
    perfect: counts.perfect,
    minor: counts.minor,
    disaster: counts.disaster,
    unlabelled: counts.unlabelled,
    perfectPct: slice.length > 0 ? counts.perfect / slice.length : 0,
    total: slice.length,
    diffHist,
  };
}

/** Raw cross end (same metric as divergence-study.rawCrossEnd). */
export function rawCrossEnd(rec: Rec): number {
  const inspection = rec.recognition?.inspection ?? '';
  const crossIdx = rec.phases.findIndex((p) => /cross/i.test(p.label));
  if (crossIdx < 0) return -1;
  const { perPhase } = conjugatePhaseStream([
    tokenize(inspection),
    ...rec.phases.map((p) => tokenize(p.moves)),
  ]);
  let acc = 0;
  for (let k = 0; k <= crossIdx; k++) {
    acc += perPhase[k + 1].filter((t) => FACE_MOVE_RE.test(t)).length;
  }
  return acc - 1;
}

/** Classify one solve with the production text-route config (relaxed cross). */
export function classify(rec: Rec): AuditResult {
  const inspection = rec.recognition?.inspection ?? '';
  const out = analyzeSolveText({
    setup: rec.scramble,
    inspection,
    solution: rec.text,
    method: 'CFOP',
    relaxedCross: true,
  });
  const { reconstruction, timeline } = out;
  const report = timeline.detectionReport!;
  const cross = report.phases.find((p) => p.phaseName === 'Cross');
  const f2l = report.phases.find((p) => p.phaseName === 'F2L');
  const raw = rawCrossEnd(rec);
  const our = cross?.endIndex ?? -1;
  const diff = raw >= 0 ? our - raw : NaN;

  // OLL/PLL skip agreement against the raw labels. A standalone trailing
  // AUF (no PLL block) is a PLL SKIP — the permutation was solved at OLL,
  // only the alignment remains (reconz-5061 "U2 // AUF"); a PLL block
  // keeps its trailing AUF.
  const rawOll = rec.phases.find((p) => /oll/i.test(p.label));
  const rawPllExecuted = !!rec.phases.find((p) => /pll/i.test(p.label));
  const ourOllSkip = reconstruction.oll?.skipped === true;
  const ourPllSkip = reconstruction.pll?.skipped === true;
  const skipMatch = ourOllSkip === !rawOll && ourPllSkip === !rawPllExecuted;

  const pairCount = reconstruction.pairs.length;
  const warnings = report.warnings ?? [];

  let bucket: AuditBucket;
  if (raw < 0) {
    bucket = 'unlabelled';
  } else if (reconstruction.finalSolved && Math.abs(diff) <= 2 && skipMatch) {
    bucket = 'perfect';
  } else if (
    reconstruction.finalSolved &&
    Math.abs(diff) <= 6 &&
    !(f2l && pairCount === 0)
  ) {
    // Cross within the alignment/xcross window (±6) but not the tight ±2, or
    // skip mismatch — still a coherent solve, just a few tokens off.
    bucket = 'minor';
  } else {
    bucket = 'disaster';
  }

  return {
    key: rec.key,
    source: rec.source ?? '?',
    time: rec.time,
    raw,
    our,
    diff: Number.isNaN(diff) ? NaN : diff,
    finalSolved: reconstruction.finalSolved,
    skipMatch,
    crossType: reconstruction.cross.type,
    pairCount,
    warnings,
    bucket,
  };
}
