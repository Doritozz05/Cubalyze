import { beforeAll, describe, expect, it } from 'vitest';
import { hintFor, type HintContext } from './hintFor';
import i18n from '@/i18n';
import type { TimerState } from '@/types';

describe('hintFor', () => {
  // The hint text is localized — pin the active language to English so the
  // assertions below compare against the canonical strings.
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  const allPhases: TimerState[] = [
    'idle',
    'inspection',
    'ready_for_move',
    'holding',
    'ready',
    'running',
    'stopped',
  ];

  const cubes = [false, true];
  const scrPref = [false, true];
  const inspPref = [false, true];
  const scrambled = [false, true];

  const ctxs: HintContext[] = cubes.flatMap((c) =>
    scrPref.flatMap((s) => inspPref.flatMap((i) => scrambled.map((sc) => ({
      smartCube: c,
      scrambleVerif: s,
      inspection: i,
      isScrambled: sc,
    })))),
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

  it('ready_for_move phase always reports "make a move to start"', () => {
    for (const ctx of ctxs) {
      expect(hintFor('ready_for_move', false, ctx)).toBe('make a move to start');
      expect(hintFor('ready_for_move', true, ctx)).toBe('make a move to start');
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

  it('stopped phase reports the same prompt as idle phase', () => {
    for (const ctx of ctxs) {
      expect(hintFor('stopped', false, ctx)).toBe(hintFor('idle', false, ctx));
      expect(hintFor('stopped', true, ctx)).toBe(hintFor('idle', true, ctx));
    }
  });

  it('running phase varies between manual and smart cube only', () => {
    for (const ctx of ctxs) {
      const expected = ctx.smartCube ? 'make a move to stop' : 'press to stop';
      expect(hintFor('running', false, ctx)).toBe(expected);
    }
  });

  describe('idle phase copy branches on the (smartCube, scrambleVerif, inspection, isScrambled) tuple', () => {
    it('manual mode defaults to "press & hold Space to start" / "hold Space to start next"', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: false, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('press & hold Space to start');
      expect(hintFor('idle', true, ctx)).toBe('hold Space to start next');
    });

    it('manual mode + scrambleVerif still shows the manual copy (no auto)', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: true, inspection: false, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('press & hold Space to start');
    });

    it('manual mode + inspection shows "press Space to start inspection"', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('press Space to start inspection');
      expect(hintFor('idle', true, ctx)).toBe('press Space to start inspection');
    });

    it('smart cube + scrambleVerif ON + not scrambled shows "complete the scramble"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: false, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('complete the scramble');

      const ctx2: HintContext = { smartCube: true, scrambleVerif: true, inspection: true, isScrambled: false };
      expect(hintFor('idle', true, ctx2)).toBe('complete the scramble');
    });

    it('smart cube + scrambleVerif ON + scrambled + inspection OFF shows "make a move to start"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: false, isScrambled: true };
      expect(hintFor('idle', false, ctx)).toBe('make a move to start');
    });

    it('smart cube + scrambleVerif ON + scrambled + inspection ON shows "press Space to start inspection"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: true, isScrambled: true };
      expect(hintFor('idle', false, ctx)).toBe('press Space to start inspection');
    });

    it('smart cube + scrambleVerif OFF + inspection ON (Mode 3) shows "tap or press Space to start"', () => {
      // Scramble Verification OFF: pressing the start key arms the cube gate
      // (READY_FOR_MOVE) — the first physical move starts the solve.
      // Inspection is intentionally NOT offered in this mode.
      const ctx: HintContext = { smartCube: true, scrambleVerif: false, inspection: true, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('tap or press Space to start');
      expect(hintFor('idle', true, ctx)).toBe('tap or press Space to start');
    });

    it('smart cube + scrambleVerif OFF + inspection OFF (Mode 4) shows "tap or press Space to start"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: false, inspection: false, isScrambled: false };
      expect(hintFor('idle', false, ctx)).toBe('tap or press Space to start');
      expect(hintFor('idle', true, ctx)).toBe('tap or press Space to start');
    });

    it('interpolates the user-configured start key label instead of Space', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true, isScrambled: false, startKeyLabel: 'N' };
      expect(hintFor('idle', false, ctx)).toBe('press N to start inspection');
      const ctx2: HintContext = { smartCube: true, scrambleVerif: false, inspection: false, isScrambled: false, startKeyLabel: 'Intro' };
      expect(hintFor('idle', false, ctx2)).toBe('tap or press Intro to start');
    });
  });

  it('does not leak "press & hold to start" into smart-cube phases', () => {
    for (const ctx of ctxs.filter((c) => c.smartCube)) {
      const idleText = hintFor('idle', false, ctx);
      expect(idleText).not.toBe('press & hold to start');
    }
  });

  it('does not leak "release to start" (which belongs to READY) into ready_for_move', () => {
    const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: false, isScrambled: false };
    expect(hintFor('ready_for_move', false, ctx)).toBe('make a move to start');
    expect(hintFor('ready', false, ctx)).toBe('release to start');
  });

  describe('coarse-pointer devices (no keyboard) use generic copy without "space"/"hold"', () => {
    it('manual + inspection shows "press to start inspection"', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true, isScrambled: false, coarsePointer: true };
      expect(hintFor('idle', false, ctx)).toBe('press to start inspection');
      expect(hintFor('idle', true, ctx)).toBe('press to start inspection');
    });

    it('smart cube + scrambleVerif ON + scrambled + inspection ON shows "press to start inspection"', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: true, inspection: true, isScrambled: true, coarsePointer: true };
      expect(hintFor('idle', false, ctx)).toBe('press to start inspection');
    });

    it('smart cube + scrambleVerif OFF shows "tap to start" (Modes 3 & 4)', () => {
      const ctx: HintContext = { smartCube: true, scrambleVerif: false, inspection: true, isScrambled: false, coarsePointer: true };
      expect(hintFor('idle', false, ctx)).toBe('tap to start');
      const ctx2: HintContext = { smartCube: true, scrambleVerif: false, inspection: false, isScrambled: false, coarsePointer: true };
      expect(hintFor('idle', true, ctx2)).toBe('tap to start');
    });

    it('manual mode without inspection shows "tap to start" / "tap to start next"', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: false, isScrambled: false, coarsePointer: true };
      expect(hintFor('idle', false, ctx)).toBe('tap to start');
      expect(hintFor('idle', true, ctx)).toBe('tap to start next');
    });

    it('does not leak "space" or "hold" wording on coarse pointers in the start prompts', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true, isScrambled: false, coarsePointer: true };
      // The idle/stopped prompts are the ones that mention space/hold on
      // desktop; the transient holding/ready phases keep their shared copy.
      for (const phase of ['idle', 'stopped'] as TimerState[]) {
        for (const hasLast of [false, true]) {
          const text = hintFor(phase, hasLast, ctx);
          expect(text.toLowerCase(), `${phase}/${hasLast}`).not.toMatch(/space|hold/);
        }
      }
    });

    it('fine-pointer (keyboard) contexts keep the key/hold wording', () => {
      const ctx: HintContext = { smartCube: false, scrambleVerif: false, inspection: true, isScrambled: false, coarsePointer: false };
      expect(hintFor('idle', false, ctx)).toBe('press Space to start inspection');
    });
  });
});
