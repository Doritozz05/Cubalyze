/**
 * Mathematical easing functions for cube rotation animations.
 * Extracted to its own module per TDD-0006 specification.
 *
 * All functions take a progress value t ∈ [0, 1] and return a
 * transformed value in [0, 1].
 */

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
