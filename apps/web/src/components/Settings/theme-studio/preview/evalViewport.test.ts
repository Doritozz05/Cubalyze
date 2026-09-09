import { describe, expect, it } from 'vitest';
import {
  evalDelta,
  evalScrambleToken,
  evalTimerDigits,
  evalTimerMinH,
  px,
} from './evalViewport';

describe('evalViewport', () => {
  it('matches clamp(3rem,min(15vw,18vh),9.5rem) per device', () => {
    // Desktop 1080×680: min(162, 122.4) = 122.4.
    expect(evalTimerDigits(1080, 680)).toBeCloseTo(122.4, 5);
    // Tablet 768×680: min(115.2, 122.4) = 115.2.
    expect(evalTimerDigits(768, 680)).toBeCloseTo(115.2, 5);
    // Mobile 390×780: min(58.5, 140.4) = 58.5.
    expect(evalTimerDigits(390, 780)).toBeCloseTo(58.5, 5);
  });

  it('clamps at both ends', () => {
    expect(evalTimerDigits(2000, 2000)).toBe(152);
    expect(evalTimerDigits(100, 100)).toBe(48);
  });

  it('matches the delta and scramble clamps', () => {
    expect(evalDelta(1080)).toBeCloseTo(28.8, 5);
    expect(evalDelta(390)).toBe(16);
    expect(evalScrambleToken(1080, 680)).toBeCloseTo(12.92, 2);
    expect(evalScrambleToken(390, 780)).toBeCloseTo(12, 5);
  });

  it('matches the timer min-height regimes', () => {
    expect(evalTimerMinH(680, 'desktop')).toBeCloseTo(150, 5);
    expect(evalTimerMinH(680, 'coarse-tablet')).toBeCloseTo(150, 5);
    expect(evalTimerMinH(780, 'phone')).toBeCloseTo(296.4, 1);
  });

  it('px() keeps one decimal', () => {
    expect(px(58.55)).toBe(58.6);
    expect(px(122.4)).toBe(122.4);
  });
});
