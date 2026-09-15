/**
 * divergence-study.test.ts — rigorous A/B divergence study (strict vs
 * relaxed cross), NOT a CI regression test.
 *
 * Uses the SAME metric as the pipeline (conjugatePhaseStream + face-move
 * counting) to compute the raw cross end, then classifies every solve where
 * strict and relaxed disagree into: strictGood (regression), relaxedGood
 * (fix), bothGood (different but both ok), bothBad.
 *
 * Gated behind RUN_DIVERGENCE_STUDY=1 so the default `vitest run` never
 * executes it (it analyzes 300 solves and prints diagnostics):
 *   RUN_DIVERGENCE_STUDY=1 pnpm --dir packages/analysis-engine exec vitest run \
 *     src/__tests__/divergence-study.test.ts
 *
 * Latest run (300 solves, seed 314159, after the E-layer DP frame fix):
 *   bothGood 211 · relaxedGood (FIX) 74 · strictGood (REGR) 0 · bothBad 15
 */
import { describe, it, expect } from 'vitest';
const ENABLED = process.env.RUN_DIVERGENCE_STUDY === '1';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { conjugatePhaseStream, tokenize } from '@cubalyze/math-core';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rec {
  key: string;
  solver: string;
  time: number;
  scramble: string;
  text: string;
  phases: { label: string; moves: string }[];
  recognition?: { inspection?: string };
}

const FACE_MOVE_RE = /^[URFDLB][2']?$/;

function loadAll(): Rec[] {
  const dir = path.resolve(__dirname, '../../../../apps/web/public/recon-data/data');
  const out: Rec[] = [];
  for (let c = 0; c < 60; c++) {
    const f = path.join(dir, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).solves ?? []) {
      if (s.puzzle !== '3x3' || s.method !== 'CFOP') continue;
      if (!s.scramble || !s.text || !Array.isArray(s.phases)) continue;
      out.push(s as Rec);
    }
  }
  return out;
}

/** Raw cross end using the SAME conjugation the pipeline uses. */
function rawCrossEnd(rec: Rec): number {
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

function crossEndOf(rec: Rec, relaxedCross: boolean): { end: number; type: string; warnings: string[] } {
  const inspection = rec.recognition?.inspection ?? '';
  const { timeline, reconstruction } = analyzeSolveText({
    setup: rec.scramble, inspection, solution: rec.text, relaxedCross,
  });
  const cross = timeline.phases.find((p) => p.phaseName === 'Cross');
  return { end: cross?.endIndex ?? -1, type: reconstruction.cross.type, warnings: reconstruction.warnings };
}

describe('divergence classification (A/B study, gated)', { skip: !ENABLED }, () => {
  it('classifies divergences on a 300-solve sample with the correct metric', { timeout: 180_000 }, () => {
    const all = loadAll();
    const rand = mulberry32(314159);
    const sample: Rec[] = [];
    for (let i = 0; i < 300 && all.length > 0; i++) {
      sample.push(all.splice(Math.floor(rand() * all.length), 1)[0]);
    }

    let strictGood = 0, relaxedGood = 0, bothGood = 0, bothBad = 0;
    let noRawCross = 0;
    const regressions: { key: string; time: number; s: number; r: number; raw: number; labels: string }[] = [];
    const fixes: { key: string; time: number; s: number; r: number; raw: number }[] = [];
    const bothBadCases: { key: string; time: number; s: number; r: number; raw: number; labels: string; stype: string; rtype: string }[] = [];

    for (const rec of sample) {
      const raw = rawCrossEnd(rec);
      if (raw < 0) {
        noRawCross++;
        continue;
      }
      let s: { end: number; type: string; warnings: string[] };
      let r: { end: number; type: string; warnings: string[] };
      try {
        s = crossEndOf(rec, false);
        r = crossEndOf(rec, true);
      } catch {
        continue;
      }
      const sMatch = Math.abs(s.end - raw) <= 2;
      const rMatch = Math.abs(r.end - raw) <= 2;
      if (sMatch && rMatch) {
        bothGood++;
        if (s.end !== r.end) {
          console.log(`  bothGood-diff ${rec.key} s@${s.end} r@${r.end} raw@${raw}`);
        }
      } else if (sMatch && !rMatch) {
        strictGood++;
        regressions.push({ key: rec.key, time: rec.time, s: s.end, r: r.end, raw, labels: rec.phases.map((p) => p.label).join(' · ') });
      } else if (!sMatch && rMatch) {
        relaxedGood++;
        fixes.push({ key: rec.key, time: rec.time, s: s.end, r: r.end, raw });
      } else {
        bothBad++;
        bothBadCases.push({ key: rec.key, time: rec.time, s: s.end, r: r.end, raw, labels: rec.phases.map((p) => p.label).join(' · '), stype: s.type, rtype: r.type });
      }
    }

    console.log(`\n=== DIVERGENCE CLASSIFICATION (300 solves, correct metric) ===`);
    console.log(`bothGood        : ${bothGood}`);
    console.log(`strictGood (REGR): ${strictGood}`);
    for (const g of regressions) {
      console.log(`   ✗ ${g.key} (${g.time}s) s@${g.s} r@${g.r} raw@${g.raw} | ${g.labels}`);
    }
    console.log(`relaxedGood(FIX): ${relaxedGood}`);
    for (const f of fixes) {
      console.log(`   ✓ ${f.key} (${f.time}s) s@${f.s} r@${f.r} raw@${f.raw}`);
    }
    console.log(`bothBad         : ${bothBad}`);
    console.log(`no written cross : ${noRawCross} (skipped — flat or unlabelled)`);
    for (const b of bothBadCases) {
      console.log(`   ✗✗ ${b.key} (${b.time}s) s@${b.s} [${b.stype}] r@${b.r} [${b.rtype}] raw@${b.raw} | ${b.labels}`);
    }
    expect(sample.length).toBeGreaterThan(0);
  });

  it('prints detail for the 6 known regression keys', { timeout: 60_000 }, () => {
    const keys = ['reconz-1988', 'cuberoot-1824', 'reconz-8155', 'reconz-10589', 'reconz-1205', 'reconz-6757'];
    const all = loadAll();
    const byKey = new Map(all.map((r) => [r.key, r]));
    for (const k of keys) {
      const rec = byKey.get(k);
      if (!rec) { console.log(`${k}: not found`); continue; }
      const raw = rawCrossEnd(rec);
      console.log(`\n══ ${k} ══ ${rec.solver} ${rec.time}s`);
      console.log(`  text: ${rec.text.split('\n').map((l) => l.trim()).join(' | ')}`);
      console.log(`  labels: ${rec.phases.map((p) => p.label).join(' · ')}`);
      console.log(`  rawCrossEnd (correct) = ${raw}`);
      const s = crossEndOf(rec, false);
      const r = crossEndOf(rec, true);
      console.log(`  STRICT: end@${s.end} type=${s.type} warnings=[${s.warnings.join(', ')}]`);
      console.log(`  RELAX : end@${r.end} type=${r.type} warnings=[${r.warnings.join(', ')}]`);
    }
    expect(keys.length).toBe(6);
  });
});
