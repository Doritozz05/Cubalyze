import { describe, expect, it } from 'vitest';
import { hintFor, type HintContext } from './hintFor';
import type { TimerState } from '@/types';

describe('hintFor', () => {
  const allPhases: TimerState[] = [
    'idle',
    'inspection',
    'armed',
    'holding',
    'ready',
    'running',
    'stopped',
  ];

  const cubes = [false, true];
  const scrPref = [false, true];
  const inspPref = [false, true];

  const ctxs: HintContext[] = cubes.flatMap((c) =>
    scrPref.flatMap((s) => inspPref.map((i) => ({
      smartCube: c,
      scrambleVerif: s,
      inspection: i,
    }))),
  );

  it('never returns an undefined / empty string for any combination', () => {
    for (const phase of allPhases) {
      for (const hasLast of [false, true]) {
        for (const ctx of ctxs) {
          const text = hintFor(phase, hasLast, ctx);
          expect(text, `${phase}/${hasLast}/${JSON.stringify(ctx)}`).toBeTypeOf('string');
          expect(text.length, `${phase}/${hasLast}/${JSON.stringify(ctx)}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('inspection phase always reports "inspecting"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('inspection', false, ctx)).toBe('inspecting');
      expect(hintFor('inspection', true, ctx)).toBe('inspecting');
    }
  });

  it('armed phase always reports "make a move to start"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('armed', false, ctx)).toBe('make a move to start');
      expect(hintFor('armed', true, ctx)).toBe('make a move to start');
    }
  });

  it('holding phase always reports "keep holding"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('holding', false, ctx)).toBe('keep holding');
    }
  });

  it('ready phase always reports "release to start"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('ready', false, ctx)).toBe('release to start');
    }
  });

  it('stopped phase always reports "solve saved"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('stopped', false, ctx)).toBe('solve saved');
    }
  });

  it('running phase varies between manual and smart cube only', () => {
    for (const ctx of ctxs) {
      const expected = ctx.smartCube ? 'make a move to stop' : 'press to stop';
      expect(hintFor('running', false, ctx)).toBe(expected);
    }
  });

  describe('idle phase copy branches on the (smartCube, scrambleVerif, inspection) tuple', () => {
    it('manual mode defaults to "press & hold to start" / "hold to start next"', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: false };
      expect(hintFor('idle', false, ctx)).toBe('press & hold to start');
      expect(hintFor('idle', true, ctx)).toBe('hold to start next');
    });

    it('manual mode + scrambleVerif still shows the manual copy (no auto)', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: true, inspection: false };
      expect(hintFor('idle', false, ctx)).toBe('press & hold to start');
    });

    it('manual mode + inspection still shows the manual copy (no auto)', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true };
      expect(hintFor('idle', false, ctx)).toBe('press & hold to start');
    });

    it('smart cube + scrambleVerif ON shows "complete the scramble"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: false };
      expect(hintFor('idle', false, ctx)).toBe('complete the scramble');

      const ctx2: HintContext = { smartCube: true, scrambleVerif: true, inspection: true };
      expect(hintFor('idle', true, ctx2)).toBe('complete the scramble');
    });

    it('smart cube + scrambleVerif OFF + inspection ON shows "press space to start inspection"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: false, inspection: true };
      expect(hintFor('idle', false, ctx)).toBe('press space to start inspection');
    });

    it('smart cube + scrambleVerif OFF + inspection OFF (Mode 4) shows "tap or press space to arm"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: false, inspection: false };
      expect(hintFor('idle', false, ctx)).toBe('tap or press space to arm');
      expect(hintFor('idle', true, ctx)).toBe('tap or press space to arm');
    });
  });

  it('does not leak "press & hold to start" into smart-cube phases', () => {
    for (const ctx of ctxs.filter((c) => c.smartCube)) {
      const idleText = hintFor('idle', false, ctx);
      // The smart-cube idle copy is intentional, not the generic manual one.
      expect(idleText).not.toBe('press & hold to start');
    }
  });
});
