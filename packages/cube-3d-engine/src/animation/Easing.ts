/**
 * Mathematical easing functions for cube rotation animations.
 * Extracted to its own module per TDD-0006 specification.
 *
 * All functions take a progress value t ∈ [0, 1] and return a
 * transformed value in [0, 1].
 */

// ─── Easing function type ────────────────────────────────────────────────

export type EasingFn = (t: number) => number;

// ─── Easing Strategy (for adaptive selection) ────────────────────────────

export type EasingStrategy = 'bounce' | 'smooth' | 'fast' | 'linear';

/**
 * Selects the appropriate easing function based on animation context.
 *
 * - 'bounce': easeOutBack — premium feel for slow/medium moves
 * - 'smooth': easeOutQuint — smooth deceleration, no bounce, for fast moves
 * - 'fast':   easeOutCubic — quick deceleration when catching up
 * - 'linear': linear — instant, for snap/catch-up mode
 */
export function getEasing(strategy: EasingStrategy): EasingFn {
  switch (strategy) {
    case 'bounce': return easeOutBack;
    case 'smooth': return easeOutQuint;
    case 'fast':   return easeOutCubic;
    case 'linear': return linear;
    default:       return easeOutBack; // Safety fallback
  }
}

// ─── Easing Functions ────────────────────────────────────────────────────

/**
 * Quadratic ease-in-out — smooth acceleration then deceleration.
 * This is the standard easing used by both CubeForge and Sebastian Lague.
 *
 * f(t) = 2t²           for t < 0.5
 * f(t) = -1 + (4-2t)t  for t ≥ 0.5
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
}

/**
 * Cubic ease-in-out — slightly more pronounced than quadratic.
 * Useful for longer animations where you want a more dramatic effect.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4.0 * t * t * t
    : 1.0 - Math.pow(-2.0 * t + 2.0, 3) / 2.0;
}

/**
 * Linear interpolation — no easing, constant speed.
 * Useful for snapping or instant-mode animations.
 */
export function linear(t: number): number {
  return t;
}

/**
 * Ease-out-back — overshoots slightly then settles, giving a bouncy "premium" feel.
 * Perfect for cube rotations: the piece slightly overshoots then snaps back.
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Ease-out quad — quick deceleration from start, gentle settle.
 * f(t) = 1 - (1-t)²
 * Great for fast move sequences where bounce would feel sluggish.
 */
export function easeOutQuad(t: number): number {
  return 1.0 - (1.0 - t) * (1.0 - t);
}

/**
 * Ease-out cubic — stronger deceleration than quad.
 * f(t) = 1 - (1-t)³
 * Used when the animation is behind and needs to finish quick without bounce.
 */
export function easeOutCubic(t: number): number {
  return 1.0 - Math.pow(1.0 - t, 3);
}

/**
 * Ease-out quint — pronounced deceleration for a premium smooth feel.
 * f(t) = 1 - (1-t)⁵
 * Best for medium-speed moves: fast start, smooth finish, zero bounce.
 */
export function easeOutQuint(t: number): number {
  return 1.0 - Math.pow(1.0 - t, 5);
}
