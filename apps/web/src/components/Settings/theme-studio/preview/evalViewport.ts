/**
 * Evaluates the viewport-relative `clamp()` expressions used by the real
 * timer stage against the VIRTUAL viewport (the simulated device size).
 *
 * Tailwind's `vw`/`vh` inside the scaled preview resolve against the real
 * browser viewport, so copying the classes verbatim can never match. Since
 * the virtual screen measures exactly what the real device would, evaluating
 * here yields the identical pixel value. 1rem = 16px (repo never changes it).
 */

const REM = 16;

const clamp = (min: number, v: number, max: number) =>
  Math.max(min, Math.min(v, max));

/** Round to 0.1px — browsers render fractional sizes, so `Math.round` drifts. */
export function px(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Timer digits: `text-[clamp(3rem,min(15vw,18vh),9.5rem)]`. */
export function evalTimerDigits(vw: number, vh: number): number {
  return clamp(3 * REM, Math.min(0.15 * vw, 0.18 * vh), 9.5 * REM);
}

/** PB delta: `text-[clamp(1rem,3vw,1.8rem)]`. */
export function evalDelta(vw: number): number {
  return clamp(1 * REM, 0.03 * vw, 1.8 * REM);
}

/** Scramble tokens: `text-[clamp(0.75rem,min(1.6vw,1.9vh),1rem)]`. */
export function evalScrambleToken(vw: number, vh: number): number {
  return clamp(0.75 * REM, Math.min(0.016 * vw, 0.019 * vh), 1 * REM);
}

/**
 * Timer surface min-height.
 * Phones (`max-lg`): `min-h-[clamp(280px,38vh,440px)]`.
 * Desktop: `min-h-[clamp(150px,22vh,420px)]`.
 * Coarse-pointer tablets on lg: `lg:min-h-[clamp(150px,22vh,360px)]`.
 */
export function evalTimerMinH(
  vh: number,
  regime: 'phone' | 'desktop' | 'coarse-tablet',
): number {
  if (regime === 'phone') return clamp(280, 0.38 * vh, 440);
  if (regime === 'coarse-tablet') return clamp(150, 0.22 * vh, 360);
  return clamp(150, 0.22 * vh, 420);
}
