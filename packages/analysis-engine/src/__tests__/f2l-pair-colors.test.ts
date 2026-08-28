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
      if (s.key === key || s.id === key) return s;
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

describe('F2L pair colors (scheme-applied, rotation independent, render-ordered)', () => {
  it('reconz-9679: rotated frame — pairs carry their REAL physical colors', () => {
    // B-cross frame with a rotated scheme: the slot's canonical letters
    // (e.g. ['U','L']) are NOT the physical colors — the pair is actually
    // blue+orange. leftColor/rightColor must be the scheme-applied stickers
    // in render order: UL's L sticker (orange) goes LEFT, its U sticker
    // (blue) RIGHT; DR's R sticker (red) LEFT, its D sticker (green) RIGHT.
    const recon = analyze('reconz-9679');
    const bySlot = new Map(recon.pairs.map((p) => [p.slot, p]));
    const ul = bySlot.get('UL')!;
    expect(ul.leftColor).toBe('L'); // orange — left of the render
    expect(ul.rightColor).toBe('B'); // blue — right of the render
    const dr = bySlot.get('DR')!;
    expect(dr.leftColor).toBe('R'); // red — left of the render
    expect(dr.rightColor).toBe('F'); // green — right of the render
  });

  it('reconz-9589: canonical frame — colors match the slot letters', () => {
    const recon = analyze('reconz-9589');
    const fr = recon.pairs.find((p) => p.slot === 'FR')!;
    expect(fr.leftColor).toBe('F'); // green-left
    expect(fr.rightColor).toBe('R'); // red-right
    const bl = recon.pairs.find((p) => p.slot === 'BL')!;
    expect(bl.leftColor).toBe('L'); // orange-left
    expect(bl.rightColor).toBe('B'); // blue-right
  });

  it('cuberoot-2286: mirror pairs are distinct — FL is orange-left, never a second green-left', () => {
    // The yellow-cross solve from the F2L color bug report: canonical frame,
    // FR must be green-left/red-right and its mirror FL orange-left/
    // green-right (never green-left/orange-right).
    const recon = analyze('cuberoot-2286');
    const bySlot = new Map(recon.pairs.map((p) => [p.slot, p]));
    expect(bySlot.get('FR')!.leftColor).toBe('F');
    expect(bySlot.get('FR')!.rightColor).toBe('R');
    expect(bySlot.get('FL')!.leftColor).toBe('L');
    expect(bySlot.get('FL')!.rightColor).toBe('F');
    // BR seen from outside: B sticker (blue) on the left, R (red) on the
    // right — the same "view from outside" convention as FR/FL.
    expect(bySlot.get('BR')!.leftColor).toBe('B');
    expect(bySlot.get('BR')!.rightColor).toBe('R');
    expect(bySlot.get('BL')!.leftColor).toBe('L');
    expect(bySlot.get('BL')!.rightColor).toBe('B');
    // All four views must be pairwise distinct.
    const views = ['FR', 'FL', 'BR', 'BL'].map(
      (s) => `${bySlot.get(s)!.leftColor}${bySlot.get(s)!.rightColor}`,
    );
    expect(new Set(views).size).toBe(4);
  });

  it('cuberoot-2286: each pair carries the model slot id so the mini cube rotates to its home slot', () => {
    // The mini cube should rotate the canonical FR-pair model to the pair's
    // own home slot, so the two colors land on the front/right stickers in
    // leftColor/rightColor order. Model ids: 0=FR, 1=FL, 2=BL, 3=BR.
    const recon = analyze('cuberoot-2286');
    const bySlot = new Map(recon.pairs.map((p) => [p.slot, p]));
    expect(bySlot.get('FR')!.renderSlotIndex).toBe(0);
    expect(bySlot.get('FL')!.renderSlotIndex).toBe(1);
    expect(bySlot.get('BL')!.renderSlotIndex).toBe(2);
    expect(bySlot.get('BR')!.renderSlotIndex).toBe(3);
  });

  it('reconz-9679: B-cross pairs still carry a defined, stable slot id', () => {
    // A B cross's slots live at U-layer corners (UBR/ULB) plus DRB/DBL, so
    // no single y-rotation can put all four distinct at the front — the ids
    // are stable per slot but not necessarily all distinct. What matters:
    // every pair has a valid model slot so the view is never undefined.
    const recon = analyze('reconz-9679');
    for (const p of recon.pairs) {
      expect([0, 1, 2, 3]).toContain(p.renderSlotIndex);
    }
  });
});
