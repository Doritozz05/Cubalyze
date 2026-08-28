import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';

const DATA_DIR = path.resolve(
  __dirname,
  '../../../../apps/web/public/reconstructions/data',
);

function findRecord(key: string) {
  for (let c = 0; c < 60; c++) {
    const f = path.join(DATA_DIR, `chunk-${String(c).padStart(3, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).solves ?? []) {
      if (s.key === key) return s;
    }
  }
  return null;
}

function analyze(key: string) {
  const rec = findRecord(key);
  if (!rec) throw new Error('record not found: ' + key);
  return analyzeSolveText({
    setup: rec.scramble,
    inspection: rec.recognition?.inspection ?? '',
    solution: rec.text,
    method: 'CFOP',
    relaxedCross: true,
  }).reconstruction;
}

describe('F2L pair colors (scheme-applied, rotation independent)', () => {
  it('reconz-9679: rotated frame — pairs carry their REAL physical colors', () => {
    // B-cross frame with a rotated scheme: the slot's canonical letters
    // (e.g. ['U','L']) are NOT the physical colors — the pair is actually
    // blue+orange. frontColor/sideColor must be the scheme-applied stickers.
    const recon = analyze('reconz-9679');
    const bySlot = new Map(recon.pairs.map((p) => [p.slot, p]));
    const ul = bySlot.get('UL')!;
    expect(ul.frontColor).toBe('L'); // orange
    expect(ul.sideColor).toBe('B'); // blue
    const dr = bySlot.get('DR')!;
    expect(dr.frontColor).toBe('R'); // red
    expect(dr.sideColor).toBe('F'); // green
  });

  it('reconz-9589: canonical frame — colors match the slot letters', () => {
    const recon = analyze('reconz-9589');
    const fr = recon.pairs.find((p) => p.slot === 'FR')!;
    expect(fr.frontColor).toBe('F');
    expect(fr.sideColor).toBe('R');
    const bl = recon.pairs.find((p) => p.slot === 'BL')!;
    expect(bl.frontColor).toBe('L');
    expect(bl.sideColor).toBe('B');
  });
});
