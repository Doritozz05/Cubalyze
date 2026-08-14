"use client";

import { preferencesStore } from "@cubeforge/state";

/**
 * Optional haptic feedback for the touch regime (<768px).
 *
 * Wraps `navigator.vibrate` with the app's own guardrails so haptics are:
 *   - **Touch-only**: the gate checks `window.matchMedia("(max-width: 767px)")`
 *     so desktop (>=768px) NEVER vibrates — the F8 "desktop is sacred" rule.
 *   - **Opt-out**: respects `preferencesStore.haptics` (Settings → General).
 *   - **Safe**: no-ops when `navigator.vibrate` is missing (desktop Chrome,
 *     iOS Safari, etc.) or when the browser blocks it.
 *
 * Patterns are kept subtle (10–30ms) so they feel like native tactile taps,
 * not buzzes. Longer patterned bursts are reserved for celebrations (PB).
 */

function isTouchRegime(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function hapticsEnabled(): boolean {
  return preferencesStore.getState().haptics;
}

function canVibrate(): boolean {
  if (!isTouchRegime()) return false;
  if (!hapticsEnabled()) return false;
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Best-effort vibration — canVibrate() already proved the API exists. */
function vibrate(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore — vibration is best-effort */
  }
}

/** Light tap — sheet opens, tab switch, penalty pill, generic confirm. */
export function hapticTap(): void {
  vibrate(10);
}

/** Medium pulse — a solve starts (timer begins running). */
export function hapticStart(): void {
  vibrate(20);
}

/** Short double-tap — a solve stops (timer finalized). */
export function hapticStop(): void {
  vibrate([12, 30, 12]);
}

/** Celebration burst — a new Personal Best milestone. */
export function hapticCelebrate(): void {
  vibrate([20, 40, 20, 40, 60]);
}
