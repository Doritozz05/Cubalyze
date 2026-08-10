/**
 * pseudo-cross.test.ts — Pseudo/partial cross detection (reconz-11663
 * "pseudo xcross", reconz-4319 "pseudo cross", reconz-3467 "partial cross").
 *
 * The solver leaves the cross edges misordered (or partial) inside the
 * written cross block and fixes the order inside the F2L pairs, so the
 * state-based cross only completes much later. PhaseSplitter then cuts the
 * Cross phase at the WRITTEN boundary and labels it 'pseudo xcross' — but
 * only when the written cross region ends far (>= PSEUDO_CROSS_MIN_GAP)
 * before any valid cross exists, and only in relaxed mode (a late STRICT
 * cross is the signature of flip-late solves relaxed already resolves).
 *
 * Regression guards for the written-region rule (analyzeSolveText):
 *  - cuberoot-1419: the written cross is SPLIT across two blocks ("W psT"
 *    then "xcross (BO)"); the reconstructionist's cross ends at the FIRST
 *    cross-named block (the xcross one) — the region must NOT stop at the
 *    psT setup block, or the cross is wrongly cut at 2 instead of 8.
 *  - cuberoot-1359 / 1748: the FIRST block is already cross-named ("Y/W
 *    pscross"); the region ends THERE (raw@6), never extended into the
 *    following "xcross" block (raw@10 would be a false regression).
 *
 * Fixtures come from the shared reconstructions dataset
 * (apps/web/public/reconstructions/data/chunk-*.json).
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

const DATA_DIR = path.resolve(
  __dirname,
  '../../../../apps/web/public/reconstructions/data',
);

function load(key: string): { setup: string; text: string; time: number } {
  for (let c = 0; c < 60; c++) {
    const f = path.join(DATA_DIR, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    const rec = (data.solves ?? []).find((s: { key: string }) => s.key === key);
    if (rec) return { setup: rec.scramble, text: rec.text, time: rec.time };
  }
  throw new Error(`${key} not found in dataset`);
}

function analyze(key: string, relaxedCross = true) {
  const rec = load(key);
  const { reconstruction, timeline } = analyzeSolveText({
    setup: rec.setup,
    solution: rec.text,
    method: 'CFOP',
    relaxedCross,
  });
  const report = timeline.detectionReport!;
  const cross = report.phases.find((p) => p.phaseName === 'Cross');
  const f2l = report.phases.find((p) => p.phaseName === 'F2L');
  return { reconstruction, report, cross, f2l };
}

describe('pseudo-cross detection', () => {
  it('cuts the cross at the written boundary for reconz-11663 (pseudo xcross)', () => {
    const { reconstruction, report, cross, f2l } = analyze('reconz-11663');
    expect(reconstruction.cross.type).toBe('pseudo xcross');
    expect(report.crossType).toBe('pseudo xcross');
    // Written block: "U' R' D' R' D F D R D" — 9 face moves, ends@8.
    expect(cross?.startIndex).toBe(0);
    expect(cross?.endIndex).toBe(8);
    expect(cross?.moveCount).toBe(9);
    expect(reconstruction.cross.moves.join(' ')).toBe(
      "U' R' D' R' D F D R D",
    );
    // F2L starts right after the written block and is ONE undifferentiated
    // row (the pairs never complete classic slots — ZBLS/edge-control).
    expect(f2l?.startIndex).toBe(9);
    expect(reconstruction.pairs.length).toBe(1);
    expect(reconstruction.pairs[0].slot).toBe('');
    // The F2L row owns the rest of the solve up to the OLL completion.
    expect(reconstruction.pairs[0].completionIndex).toBe(f2l!.endIndex);
  });

  it('cuts the cross at the written boundary for reconz-4319 (pseudo cross)', () => {
    const { reconstruction, cross } = analyze('reconz-4319');
    expect(reconstruction.cross.type).toBe('pseudo xcross');
    expect(cross?.endIndex).toBe(5);
  });

  it('cuts the cross at the written boundary for reconz-3467 (partial cross)', () => {
    const { reconstruction, cross } = analyze('reconz-3467');
    expect(reconstruction.cross.type).toBe('pseudo xcross');
    expect(cross?.endIndex).toBe(3);
  });

  it('does NOT fire in strict mode (flip-late crosses stay on the state cross)', () => {
    // 11663 strict: the state cross completes at 33; relaxed mode is the
    // only path that cuts at the written block.
    const strict = analyze('reconz-11663', false);
    expect(strict.cross?.endIndex).toBe(33);
    expect(strict.reconstruction.cross.type).not.toBe('pseudo xcross');
    const relaxed = analyze('reconz-11663', true);
    expect(relaxed.cross?.endIndex).toBe(8);
  });

  it('keeps a split written cross region whole for cuberoot-1419 (W psT + xcross)', () => {
    // Written blocks: "r' D R // W psT" (ends@2) + "D R U' R' D R // xcross
    // (BO)" (ends@8). The reconstructionist's cross ends at the FIRST
    // cross-named block — the region spans the psT setup, so the cross is
    // NOT cut early and the xcross completes at 8.
    const { reconstruction, report, cross } = analyze('cuberoot-1419');
    expect(reconstruction.cross.type).not.toBe('pseudo xcross');
    expect(cross?.endIndex).toBe(8);
    // The xcross block does finish cross + first pair.
    expect(report.crossType).toBe('xcross');
  });

  it('keeps a first-block-cross region short for cuberoot-1359 (Y pscross)', () => {
    // Labels: insp · Y pscross · xcross · … The written cross ends at the
    // pscross block (raw@6); extending into the "xcross" block would push
    // the boundary to 10 and wrongly cut the cross at 6.
    const { reconstruction, cross } = analyze('cuberoot-1359');
    expect(reconstruction.cross.type).not.toBe('pseudo xcross');
    expect(cross?.endIndex).toBe(6);
  });

  it('keeps a first-block-cross region short for cuberoot-1748 (W pscross)', () => {
    const { reconstruction, cross } = analyze('cuberoot-1748');
    expect(reconstruction.cross.type).not.toBe('pseudo xcross');
    expect(cross?.endIndex).toBe(6);
  });
});
