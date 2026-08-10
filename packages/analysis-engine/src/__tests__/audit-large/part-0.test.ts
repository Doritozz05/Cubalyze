/** audit-large part 0 — slice 0 of the dataset (parallel worker). */
import { describe, expect, it } from 'vitest';
import { loadAll, runPart } from './shared';

describe('large-scale audit (part 0)', { skip: process.env.RUN_AUDIT !== '1' }, () => {
  it('classifies slice 0', { timeout: 900_000 }, () => {
    const all = loadAll();
    const n = Math.ceil(all.length / 6);
    const out = require('node:path').join(__dirname, 'out-part-0.json');
    const r = runPart(0 * n, Math.min(all.length, (0 + 1) * n), out);
    console.log('PART0 n=' + r.slice + ' perfect=' + r.perfect + ' minor=' + r.minor + ' disaster=' + r.disaster + ' unlabelled=' + r.unlabelled);
    expect(r.slice).toBeGreaterThan(0);
  });
});
