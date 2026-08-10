/** audit-large part 4 — slice 4 of the dataset (parallel worker). */
import { describe, expect, it } from 'vitest';
import { loadAll, runPart } from './shared';

describe('large-scale audit (part 4)', { skip: process.env.RUN_AUDIT !== '1' }, () => {
  it('classifies slice 4', { timeout: 900_000 }, () => {
    const all = loadAll();
    const n = Math.ceil(all.length / 6);
    const out = require('node:path').join(__dirname, 'out-part-4.json');
    const r = runPart(4 * n, Math.min(all.length, (4 + 1) * n), out);
    console.log('PART4 n=' + r.slice + ' perfect=' + r.perfect + ' minor=' + r.minor + ' disaster=' + r.disaster + ' unlabelled=' + r.unlabelled);
    expect(r.slice).toBeGreaterThan(0);
  });
});
