import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { conjugatePhaseStream, tokenize } from '@cubeforge/math-core';

const FACE_MOVE_RE = /^[URFDLB][2']?$/;

interface ChunkRecord {
  key: string;
  puzzle: string;
  method: string;
  scramble: string;
  text: string;
  phases: { label: string; moves: string }[];
  recognition?: { inspection?: string; crossVerified?: boolean };
}

function loadRecords(): ChunkRecord[] {
  const dir = path.resolve(__dirname, '../../../../apps/web/public/recon-data/data');
  const out: ChunkRecord[] = [];
  for (let c = 0; c < 6; c++) {
    const f = path.join(dir, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const s of data.solves ?? []) {
      if (s.puzzle !== '3x3' || s.method !== 'CFOP') continue;
      out.push(s);
    }
  }
  return out;
}

/** Face-move end index of every raw phase (in the conjugated stream). */
function rawEndIndices(rec: ChunkRecord): number[] {
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

describe('Fase 2 comparison harness', () => {
  it('prints raw vs ours for clean, verified solves', { timeout: 120_000 }, () => {
    const records = loadRecords();
    const clean: ChunkRecord[] = [];
    let checked = 0;
    for (const rec of records) {
      checked++;
      if (checked > 900) break;
      if (rec.recognition?.crossVerified !== true) continue;
      // Resolve exactly through our API?
      const inspection = rec.recognition?.inspection ?? '';
      try {
        const { reconstruction } = analyzeSolveText({
          setup: rec.scramble,
          inspection,
          solution: rec.text,
        });
        if (reconstruction.finalSolved === true) {
          clean.push(rec);
          if (clean.length >= 10) break;
        }
      } catch {
        /* skip */
      }
    }

    console.log(`\n=== FASE 2 SESSION — ${clean.length} clean verified solves (of ${checked} checked) ===\n`);

    let crossMatch = 0;
    let skipMatch = 0;
    const rows: string[] = [];

    for (const rec of clean) {
      const inspection = rec.recognition?.inspection ?? '';
      const { reconstruction, timeline } = analyzeSolveText({
        setup: rec.scramble,
        inspection,
        solution: rec.text,
      });

      // RAW boundary: end index of the last phase whose label mentions cross.
      const ends = rawEndIndices(rec);
      const crossIdx = rec.phases.reduce(
        (last, p, i) => (/cross/i.test(p.label) ? i : last),
        -1,
      );
      const rawCrossEnd = crossIdx >= 0 ? ends[crossIdx] : -1;
      const rawF2LStart =
        crossIdx >= 0 && crossIdx + 1 < ends.length ? ends[crossIdx] : -1;

      // OURS boundary from the splitter.
      const crossPhase = timeline.phases.find((p) => p.phaseName === 'Cross');
      const f2lPhase = timeline.phases.find((p) => p.phaseName === 'F2L');
      const ourCrossEnd = crossPhase?.endIndex ?? -1;
      const ourF2LStart = crossPhase ? crossPhase.endIndex + 1 : -1;

      // Cross boundary match: allow the documented ±2 alignment window
      // (the cross completes 1-2 moves before the solver stops touching D).
      const crossOk = rawCrossEnd >= 0 && Math.abs(rawCrossEnd - ourCrossEnd) <= 2;
      if (crossOk) crossMatch++;

      // A trailing AUF after a PLL block is the PLL's last move; a STANDALONE
      // trailing AUF (no PLL block) is a PLL SKIP — the permutation was
      // solved at OLL, only the alignment remains (reconz-5061's "U2 //
      // AUF"). WVLS/ZBLS/ZBLL imply OLL completed inside the last F2L slot →
      // OLL skip is expected, not a mismatch.
      const rawOllPhase = rec.phases.find((p) => /oll/i.test(p.label));
      const rawPllPhase = rec.phases.find((p) => /pll/i.test(p.label));
      const ourOllSkip = reconstruction.oll?.skipped === true;
      const ourPllSkip = reconstruction.pll?.skipped === true;
      const rawOllSkip = !rawOllPhase;
      const rawPllSkip = !rawPllPhase;
      const skipOk = ourOllSkip === rawOllSkip && ourPllSkip === rawPllSkip;
      if (skipOk) skipMatch++;

      const verdict = crossOk && skipOk ? '✓ MATCH' : '✗ MISMATCH';
      rows.push(
        `\n── ${rec.key} ${verdict} ──\n` +
          `  RAW  labels : ${rec.phases.map((p) => p.label).join(' · ')}\n` +
          `  RAW  cross  : ${rec.phases
            .filter((p) => /cross/i.test(p.label))
            .map((p) => tokenize(p.moves).filter((t) => FACE_MOVE_RE.test(t)).join(' '))
            .join(' | ')}\n` +
          `  OURS cross  : ${reconstruction.cross.type} [${reconstruction.cross.moves.join(' ')}]  (ends @${ourCrossEnd}, raw ${rawCrossEnd})\n` +
          `  OURS pairs  : ${reconstruction.pairs.length} → ${reconstruction.pairs.map((p) => `${p.slot}(${p.colors.join('')})`).join(', ')}\n` +
          `  OLL/PLL     : ours ${reconstruction.oll ? (reconstruction.oll.skipped ? 'SKIP' : `${reconstruction.oll.moves.length}m`) : '—'} · ` +
          `${reconstruction.pll ? (reconstruction.pll.skipped ? 'SKIP' : `${reconstruction.pll.moves.length}m`) : '—'}` +
          `  | raw ${rawOllPhase ? 'oll' : 'NO-oll'} ${rawPllPhase ? 'pll' : 'NO-pll'} → ${skipOk ? '✓' : '✗'}`,
      );
    }

    console.log(rows.join('\n'));
    console.log(`\n=== SUMMARY (tolerance ±2 for cross): cross ${crossMatch}/${clean.length} · skips ${skipMatch}/${clean.length} ===`);
    expect(clean.length).toBeGreaterThan(0);
  });
});
