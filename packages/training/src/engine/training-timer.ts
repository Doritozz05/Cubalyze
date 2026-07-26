/**
 * @cubeforge/training — Training Timer
 *
 * Factory for creating a drill-configured TimerEngine.
 * The React hook (useDrillTimer) wraps this factory with
 * React state bindings and keyboard event handling.
 *
 * This module is pure logic — no React dependencies.
 */

import {
  TimerEngine,
} from '@cubeforge/timer-engine';

// ─── Factory ─────────────────────────────────────────────────────────────

/**
 * Creates a TimerEngine configured for training mode.
 *
 * Training mode differs from practice mode in that:
 * - No inspection countdown (useInspection: false)
 * - Hold-to-arm behavior (spacebar hold → ready → release → start)
 * - Designed for quick drill repetition
 */
export function createTrainingTimer(): TimerEngine {
  return new TimerEngine({ useInspection: false });
}
