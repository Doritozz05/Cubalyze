/** audit-large/detail.test.ts — print raw vs our LL labels for sampled cases. */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../../reconstruction/analyzeSolveText';
import { loadAll } from './shared';

describe('audit detail (gated)', { skip: process.env.RUN_AUDIT !== '1' }, () => {
  it('prints raw labels vs our LL for the minor-skip sample', () => {
    const all = loadAll();
    const byKey = new Map(all.map((r) => [r.key, r]));
    const keys = [
      'reconz-11451', 'reconz-12564', 'reconz-9590', 'reconz-11719',
      'cuberoot-2010', 'reconz-9108', 'cuberoot-2258',
    ];
    for (const k of keys) {
      const rec = byKey.get(k);
      if (!rec) { console.log(`${k}: NOT FOUND`); continue; }
      const out = analyzeSolveText({
        setup: rec.scramble,
        inspection: rec.recognition?.inspection ?? undefined,
        solution: rec.text,
        method: 'CFOP',
        relaxedCross: true,
      });
      const { reconstruction } = out;
      console.log(`\n══ ${k} (${rec.time}s) ══`);
      console.log(`  RAW labels : ${rec.phases.map((p) => p.label).join(' · ')}`);
      console.log(`  OUR OLL    : ${reconstruction.oll ? (reconstruction.oll.skipped ? 'SKIP' : `${reconstruction.oll.moves.length}m`) : 'null'}`);
      console.log(`  OUR PLL    : ${reconstruction.pll ? (reconstruction.pll.skipped ? 'SKIP' : `${reconstruction.pll.moves.length}m`) : 'null'}`);
      console.log(`  cross=${reconstruction.cross.type} pairs=${reconstruction.pairs.length} solved=${reconstruction.finalSolved}`);
    }
    expect(keys.length).toBeGreaterThan(0);
  });
});
