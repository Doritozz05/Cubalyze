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

export interface CreateTrainingTimerOptions {
  /** Enable WCA-style 15s inspection countdown (e.g. full-solve views). Default false. */
  useInspection?: boolean;
}

// ─── Factory ─────────────────────────────────────────────────────────────

/**
 * Creates a TimerEngine configured for training mode.
 *
 * Training mode differs from practice mode in that:
 * - No inspection countdown by default (useInspection: false)
 * - Hold-to-arm behavior (spacebar hold → ready → release → start)
 * - Designed for quick drill repetition
 *
 * This is the single factory the training UI uses — useDrillTimer wraps it
 * with React state bindings and the shared keyboard handling.
 */
export function createTrainingTimer(options: CreateTrainingTimerOptions = {}): TimerEngine {
  return new TimerEngine({ useInspection: options.useInspection ?? false });
}
