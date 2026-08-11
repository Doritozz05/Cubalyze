/**
 * cross-study.test.ts — deep-study harness (A/B), NOT a CI regression test.
 *
 * Runs the SHARED pipeline on a diverse random sample of 3x3 CFOP solves
 * (time buckets: <4s … 12s+; reconz + cuberoot) in BOTH modes:
 *   - strict  (current behavior: cross = position + orientation)
 *   - relaxed (relaxedCross: cross = permutation only, flipped edges allowed)
 *
 * For each solve prints raw phases, both detections (cross boundary, pairs,
 * OLL/PLL), a per-face cross-status diagnostic at the RAW cross end (why the
 * strict detector diverges / where the relaxed one fires), and a final A/B
 * aggregate: match rate, catastrophic divergences, regressions.
 *
 * Deliberately gated behind RUN_CROSS_STUDY=1 so the default `vitest run`
 * never executes it (it prints hundreds of diagnostic lines and takes ~6s).
 * Run it explicitly when re-running the study:
 *   RUN_CROSS_STUDY=1 pnpm --dir packages/analysis-engine exec vitest run \
 *     src/__tests__/cross-study.test.ts
 */
import { describe, it, expect } from 'vitest';
const ENABLED = process.env.RUN_CROSS_STUDY === '1';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import {
  CubeState,
  FaceletStringConverter,
  ColorPhaseDetector,
  FACE_LETTERS,
  FACE_LAYERS,
  edgeColor,
  edgeFacelet,
  conjugatePhaseStream,
  tokenize,
  type FaceLetter,
} from '@cubeforge/math-core';

const FACE_MOVE_RE = /^[URFDLB][2']?$/;

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

interface ChunkRecord {
  key: string;
  solver: string;
  time: number;
  source: string;
  reconstructor?: string;
  stm?: number;
  scramble: string;
  text: string;
  phases: { label: string; moves: string }[];
  recognition?: { inspection?: string; crossVerified?: boolean; finalSolved?: boolean };
}

function loadRecords(): ChunkRecord[] {
  const dir = path.resolve(__dirname, '../../../../apps/web/public/reconstructions/data');
  const out: ChunkRecord[] = [];
  for (let c = 0; c < 60; c++) {
    const f = path.join(dir, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const s of data.solves ?? []) {
      if (s.puzzle !== '3x3' || s.method !== 'CFOP') continue;
      if (!s.scramble || !s.text || !Array.isArray(s.phases)) continue;
      out.push(s as ChunkRecord);
    }
  }
  return out;
}

/** Face-move end index of every raw phase (conjugated stream, no inspection). */
function rawPhaseFaceEnds(rec: ChunkRecord): number[] {
  const inspection = rec.recognition?.inspection ?? '';
  const { perPhase } = conjugatePhaseStream([
    tokenize(inspection),
    ...rec.phases.map((p) => tokenize(p.moves)),
  ]);
  const ends: number[] = [];
  let acc = 0;
  for (const phase of perPhase.slice(1)) {
    acc += phase.filter((t) => FACE_MOVE_RE.test(t)).length;
    ends.push(acc);
  }
  return ends;
}

/** Facelet string of the state at timeline entry `idx`. */
function faceletsAt(timeline: { entries: { state: { cp: number[]; co: number[]; ep: number[]; eo: number[] } }[] }, idx: number): string {
  const snap = timeline.entries[idx].state;
  const cube = new CubeState(snap.cp, snap.co, snap.ep, snap.eo);
  return FaceletStringConverter.toFaceletString(cube);
}

/** Replicate analyzeSolveText's tiebreak-only written-cross hint. */
function preferredCrossIdxFor(rec: ChunkRecord): number | undefined {
  const firstFace = rec.phases.findIndex((p) =>
    tokenize(p.moves).some((t) => FACE_MOVE_RE.test(t)),
  );
  if (firstFace < 0 || firstFace >= rec.phases.length - 1) return undefined;
  let count = 0;
  for (let k = 0; k <= firstFace; k++) {
    count += tokenize(rec.phases[k].moves).filter((t) => FACE_MOVE_RE.test(t)).length;
  }
  return count - 1;
}

/**
 * Earliest index in [lo, hi] where face `face` holds a RELAXED cross of
 * `color` with distinct (permutation-valid) edges, or -1.
 */
function firstRelaxedCrossAt(
  states: CubeState[],
  lo: number,
  hi: number,
  face: FaceLetter,
  color: FaceLetter,
): number {
  for (let i = Math.max(0, lo); i <= Math.min(hi, states.length - 1); i++) {
    if (!relaxedCrossColorsAt(faceletsOf(states[i]), face).includes(color)) continue;
    const pieceSideColors = FACE_LAYERS[face].crossEdges.map(
      (pos) => {
        const [a, b] = edgeColor[states[i].ep[pos]];
        return a === color ? b : a;
      },
    );
    if (new Set(pieceSideColors).size === 4) return i;
  }
  return -1;
}

function faceletsOf(state: CubeState): string {
  return FaceletStringConverter.toFaceletString(state);
}

/** Strict cross: common color of the 4 on-face edge stickers, or null. */
function strictCrossAt(facelets: string, face: FaceLetter): FaceLetter | null {
  const idxs = FACE_LAYERS[face].crossEdges.map(
    (pos) => edgeFacelet[pos].filter((i) => (i < 9 ? 'U' : i < 18 ? 'R' : i < 27 ? 'F' : i < 36 ? 'D' : i < 45 ? 'L' : 'B') === face)[0],
  );
  const c = facelets[idxs[0]];
  for (const i of idxs) if (facelets[i] !== c) return null;
  return c as FaceLetter;
}

/** Relaxed cross colors: colors present on BOTH stickers of all 4 edge positions. */
function relaxedCrossColorsAt(facelets: string, face: FaceLetter): FaceLetter[] {
  const pos = FACE_LAYERS[face].crossEdges.map((e) => edgeFacelet[e]);
  const out: FaceLetter[] = [];
  for (const c of FACE_LETTERS) {
    let ok = true;
    for (const [a, b] of pos) {
      if (facelets[a] !== c && facelets[b] !== c) { ok = false; break; }
    }
    if (ok) out.push(c);
  }
  return out;
}

interface ModeResult {
  crossType: string;
  crossMoves: string[];
  ourCrossEnd: number;
  crossDiff: number;
  crossMatch: boolean;
  pairs: { slot: string; colors: string; moves: string[] }[];
  ollSkipped: boolean;
  ollMoves: number;
  pllSkipped: boolean;
  pllMoves: number;
  finalSolved: boolean;
  skipMatch: boolean;
  warnings: string[];
}

describe('CROSS + F2L deep study (A/B strict vs relaxed)', { skip: !ENABLED }, () => {
  it('prints per-solve A/B and the aggregate comparison', { timeout: 120_000 }, () => {
    const records = loadRecords();
    console.log(`\n=== dataset: ${records.length} CFOP 3x3 records with scramble+text ===\n`);

    const rand = mulberry32(20260215);
    const buckets = [
      ['<4s', (t: number) => t < 4],
      ['4-5s', (t: number) => t >= 4 && t < 5],
      ['5-7s', (t: number) => t >= 5 && t < 7],
      ['7-9s', (t: number) => t >= 7 && t < 9],
      ['9-12s', (t: number) => t >= 9 && t < 12],
      ['12s+', (t: number) => t >= 12],
    ] as const;
    const sample: ChunkRecord[] = [];
    for (const [, pred] of buckets) {
      const pool = records.filter((r) => pred(r.time));
      for (let i = 0; i < 5 && pool.length > 0; i++) {
        sample.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      }
    }
    console.log(`SAMPLE: ${sample.length} solves\n`);

    let analyzed = 0;
    let threw = 0;
    const strict = { solved: 0, cross: 0, skip: 0, catas: 0 };
    const relaxed = { solved: 0, cross: 0, skip: 0, catas: 0 };
    const regressions: string[] = [];
    const fixed: string[] = [];
    const rows: string[] = [];

    for (const rec of sample) {
      const inspection = rec.recognition?.inspection ?? '';
      let base: Awaited<ReturnType<typeof analyzeSolveText>>;
      try {
        base = analyzeSolveText({ setup: rec.scramble, inspection, solution: rec.text });
      } catch (e) {
        threw++;
        rows.push(`\n══ ${rec.key} ✗ THROWS ══ ${String(e).slice(0, 160)}`);
        continue;
      }
      analyzed++;
      const ends = rawPhaseFaceEnds(rec);
      const crossIdx = rec.phases.reduce((last, p, i) => (/cross/i.test(p.label) ? i : last), -1);
      const rawCrossEnd = crossIdx >= 0 ? ends[crossIdx] : -1;

      const run = (relaxedCross: boolean): ModeResult => {
        const { reconstruction, timeline } = analyzeSolveText({
          setup: rec.scramble,
          inspection,
          solution: rec.text,
          relaxedCross,
        });
        const crossPhase = timeline.phases.find((p) => p.phaseName === 'Cross');
        const ourCrossEnd = crossPhase?.endIndex ?? -1;
        const crossDiff = rawCrossEnd >= 0 && ourCrossEnd >= 0 ? ourCrossEnd - rawCrossEnd : NaN;
        const rawOllPhase = rec.phases.find((p) => /oll/i.test(p.label));
        const rawPllPhase = rec.phases.find((p) => /pll/i.test(p.label));
        const ourOllSkip = reconstruction.oll?.skipped === true;
        const ourPllSkip = reconstruction.pll?.skipped === true;
        // A standalone trailing AUF (no PLL block) is a PLL skip, not a PLL
        // execution (reconz-5061 "U2 // AUF"); a PLL block keeps its AUF.
        const skipMatch =
          ourOllSkip === !rawOllPhase && ourPllSkip === !rawPllPhase;
        return {
          crossType: reconstruction.cross.type,
          crossMoves: reconstruction.cross.moves,
          ourCrossEnd,
          crossDiff,
          crossMatch: rawCrossEnd >= 0 && Math.abs(crossDiff) <= 2,
          pairs: reconstruction.pairs.map((p) => ({
            slot: p.slot,
            colors: p.colors.join(''),
            moves: p.moves,
          })),
          ollSkipped: reconstruction.oll?.skipped ?? false,
          ollMoves: reconstruction.oll?.moves.length ?? 0,
          pllSkipped: reconstruction.pll?.skipped ?? false,
          pllMoves: reconstruction.pll?.moves.length ?? 0,
          finalSolved: reconstruction.finalSolved,
          skipMatch,
          warnings: reconstruction.warnings,
        };
      };

      const s = run(false);
      const r = run(true);

      strict.solved += s.finalSolved ? 1 : 0;
      strict.cross += s.crossMatch ? 1 : 0;
      strict.skip += s.skipMatch ? 1 : 0;
      if (!s.crossMatch && Math.abs(s.crossDiff) > 2) strict.catas++;
      relaxed.solved += r.finalSolved ? 1 : 0;
      relaxed.cross += r.crossMatch ? 1 : 0;
      relaxed.skip += r.skipMatch ? 1 : 0;
      if (!r.crossMatch && Math.abs(r.crossDiff) > 2) relaxed.catas++;

      if (s.crossMatch && !r.crossMatch) regressions.push(rec.key);
      if (!s.crossMatch && r.crossMatch) fixed.push(rec.key);

      // ── What the detectors themselves pick, and whether the reconstructor's
      // cross is permutation-complete near the raw end ──
      let diag = '';
      {
        const states = base.timeline.entries.map(
          (e) => new CubeState(e.state.cp, e.state.co, e.state.ep, e.state.eo),
        );
        const pref = preferredCrossIdxFor(rec);
        const dStrict = ColorPhaseDetector.detect(states, pref);
        const dRelax = ColorPhaseDetector.detect(states, pref, { relaxedCross: true });
        const fmt = (d: ReturnType<typeof ColorPhaseDetector.detect> | null): string =>
          d ? `face=${d.crossFace} color=${d.crossColor} @${d.completions[0]}` : 'NONE';
        // Scan the window [rawCrossEnd-2, rawCrossEnd] for the first valid
        // relaxed cross per face — the reconstructor's cross should register
        // there if it is permutation-complete.
        let window = '';
        if (rawCrossEnd >= 0) {
          const hits: string[] = [];
          for (const f of FACE_LETTERS) {
            for (const c of FACE_LETTERS) {
              const at = firstRelaxedCrossAt(states, rawCrossEnd - 2, rawCrossEnd, f, c);
              if (at >= 0) hits.push(`${f}:${c}@${at}`);
            }
          }
          window = `window[${rawCrossEnd - 2}..${rawCrossEnd}] relaxed → ${hits.join(' ') || 'NONE'}`;
        }
        diag = `strictDet ${fmt(dStrict)} · relaxedDet ${fmt(dRelax)} · ${window}`;
      }

      const verdict = (m: ModeResult): string =>
        !m.finalSolved ? '✗ NOT SOLVED' : m.crossMatch && m.skipMatch ? '✓' : '~';

      const lines: string[] = [];
      lines.push(
        `\n══ ${rec.key} ══ ${rec.solver} | ${rec.time}s | ${rec.source}/${rec.reconstructor ?? '?'} | stm=${rec.stm ?? '?'} | raw cross @${rawCrossEnd}`,
      );
      lines.push(`  ${diag}`);
      lines.push(`  RAW  labels: ${rec.phases.map((p) => p.label).join(' · ')}`);
      lines.push(
        `  STRICT ${verdict(s)}: ${s.crossType} [${s.crossMoves.join(' ')}] end@${s.ourCrossEnd} diff=${Number.isNaN(s.crossDiff) ? 'n/a' : s.crossDiff} · ` +
          `pairs=${s.pairs.length} · OLL ${s.ollSkipped ? 'SKIP' : `${s.ollMoves}m`} PLL ${s.pllSkipped ? 'SKIP' : `${s.pllMoves}m`} · solved=${s.finalSolved} ${s.skipMatch ? '' : 'skip✗'}`,
      );
      lines.push(
        `  RELAX  ${verdict(r)}: ${r.crossType} [${r.crossMoves.join(' ')}] end@${r.ourCrossEnd} diff=${Number.isNaN(r.crossDiff) ? 'n/a' : r.crossDiff} · ` +
          `pairs=${r.pairs.length} · OLL ${r.ollSkipped ? 'SKIP' : `${r.ollMoves}m`} PLL ${r.pllSkipped ? 'SKIP' : `${r.pllMoves}m`} · solved=${r.finalSolved} ${r.skipMatch ? '' : 'skip✗'}`,
      );
      if (s.crossMatch !== r.crossMatch || !s.crossMatch) {
        lines.push(`    STRICT pairs: ${s.pairs.map((p) => `${p.slot}(${p.colors})[${p.moves.join(' ')}]`).join(' | ') || 'NONE'}`);
        if (s.pairs.join('') !== r.pairs.join('')) {
          lines.push(`    RELAX  pairs: ${r.pairs.map((p) => `${p.slot}(${p.colors})[${p.moves.join(' ')}]`).join(' | ') || 'NONE'}`);
        }
      }
      rows.push(lines.join('\n'));
    }

    console.log(rows.join('\n'));
    console.log(
      `\n=== A/B SUMMARY (${analyzed} analyzed, ${threw} threw) ===\n` +
        `                STRICT    RELAXED\n` +
        `finalSolved   : ${strict.solved}/${analyzed}      ${relaxed.solved}/${analyzed}\n` +
        `crossMatch±2  : ${strict.cross}/${analyzed}      ${relaxed.cross}/${analyzed}\n` +
        `cross catas(>2): ${strict.catas}         ${relaxed.catas}\n` +
        `skipMatch     : ${strict.skip}/${analyzed}      ${relaxed.skip}/${analyzed}\n` +
        `regressions (strict✓→relax✗): ${regressions.join(', ') || 'NONE'}\n` +
        `fixed (strict✗→relax✓)     : ${fixed.join(', ') || 'NONE'}`,
    );
    expect(analyzed).toBeGreaterThan(0);
  });

  it('F2L deep study: pair quality per solve (relaxed mode)', () => {
    const records = loadRecords();
    const rand = mulberry32(424242);
    const buckets = [
      ['<4s', (t: number) => t < 4],
      ['4-6s', (t: number) => t >= 4 && t < 6],
      ['6-8s', (t: number) => t >= 6 && t < 8],
      ['8-10s', (t: number) => t >= 8 && t < 10],
      ['10-13s', (t: number) => t >= 10 && t < 13],
      ['13s+', (t: number) => t >= 13],
    ] as const;
    const sample: ChunkRecord[] = [];
    for (const [, pred] of buckets) {
      const pool = records.filter((r) => pred(r.time));
      for (let i = 0; i < 5 && pool.length > 0; i++) {
        sample.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      }
    }
    console.log(`\n=== F2L STUDY: ${sample.length} solves ===\n`);

    let garbagePairs = 0;
    let pairCountMatch = 0;
    let badSlotEmpty = 0;
    let emptyPairMatchesXCross = 0;
    const perSlotSize: Record<string, number> = {};
    const notes: string[] = [];

    for (const rec of sample) {
      const inspection = rec.recognition?.inspection ?? '';
      let out: Awaited<ReturnType<typeof analyzeSolveText>>;
      try {
        out = analyzeSolveText({ setup: rec.scramble, inspection, solution: rec.text, relaxedCross: true });
      } catch (e) {
        notes.push(`\n══ ${rec.key} ✗ THROWS ${String(e).slice(0, 120)}`);
        continue;
      }
      const { reconstruction, timeline } = out;
      const rawPairs = rec.phases.filter((p) => /pair/i.test(p.label));
      const pairs = reconstruction.pairs;
      const nonEmpty = pairs.filter((p) => p.moves.length > 0);
      const g = pairs.filter((p) => p.moves.length > 18);

      const sizes = pairs.map((p) => p.moves.length).sort((a, b) => b - a);
      const slotKeys = pairs.map((p) => `${p.slot}(${p.colors.join('')})`);
      const empties = pairs.filter((p) => p.moves.length === 0).map((p) => p.slot);
      if (g.length > 0) garbagePairs += g.length;
      if (pairs.length === rawPairs.length) pairCountMatch++;
      if (empties.length > 0) badSlotEmpty++;

      // An empty slot is legitimate ONLY as an XCross pair (already home at
      // F2L start). Verify: does an XCross hint exist in the raw labels?
      const rawIsXCross = /xcross|x-cross|xxcross/i.test(rec.phases.map((p) => p.label).join(' '));
      if (empties.length > 0 && rawIsXCross) emptyPairMatchesXCross++;

      for (const p of pairs) {
        perSlotSize[p.slot] = (perSlotSize[p.slot] ?? 0) + p.moves.length;
      }

      const lines: string[] = [];
      lines.push(
        `\n══ ${rec.key} ══ ${rec.solver} | ${rec.time}s | rawPairs=${rawPairs.length} ourPairs=${pairs.length} ` +
          `(nonEmpty=${nonEmpty.length}) · crossEnd=${timeline.phases.find((p) => p.phaseName === 'Cross')?.endIndex ?? -1} · solved=${reconstruction.finalSolved}`,
      );
      lines.push(`  RAW labels: ${rec.phases.map((p) => p.label).join(' · ')}`);
      lines.push(
        `  PAIRS: ${pairs.map((p) => `${p.slot}(${p.colors.join('')})[${p.moves.length}]${p.moves.length > 18 ? ' ⚠️' : ''}`).join(' | ') || 'NONE'}`,
      );
      if (pairs.length !== rawPairs.length || g.length > 0 || empties.length > 0) {
        lines.push(`    RAW pair moves: ${rawPairs.map((p) => `${p.label}=[${tokenize(p.moves).filter((t) => FACE_MOVE_RE.test(t) || /^[rludfb][2']?$/.test(t)).length}]`).join(' ')}`);
        lines.push(`    FULL our pairs: ${pairs.map((p) => `${p.slot}: ${p.moves.join(' ')}`).join('  |  ') || 'NONE'}`);
      }
      notes.push(lines.join('\n'));
    }

    console.log(notes.join('\n'));
    console.log(
      `\n=== F2L AGGREGATE (${sample.length} solves) ===\n` +
        `pairCountMatch        : ${pairCountMatch}/${sample.length}\n` +
        `garbage pairs (>18m)  : ${garbagePairs} total\n` +
        `any-empty-slot solves : ${badSlotEmpty} (of which ${emptyPairMatchesXCross} with raw xcross hint)\n` +
        `avg moves/slot        : ${Object.entries(perSlotSize).map(([s, n]) => `${s}:${(n / sample.length).toFixed(1)}`).join(' ')}`,
    );
    expect(sample.length).toBeGreaterThan(0);
  });
});
