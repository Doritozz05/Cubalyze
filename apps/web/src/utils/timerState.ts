"use client";

import { TimerState as EngineState } from "@cubeforge/timer-engine";
import type { TimerState } from "@/types";

/**
 * Map a TimerEngine state to the UI TimerState string union.
 *
 * Single source of truth for the engine→UI state mapping, previously
 * duplicated between useDrillTimer (`mapState`) and useSolveSession
 * (`mapEngineStateToUIState`). Both hooks now import this.
 */
export function mapTimerState(engineState: EngineState): TimerState {
  switch (engineState) {
    case EngineState.IDLE:
      return "idle";
    case EngineState.INSPECTION:
      return "inspection";
    case EngineState.READY_FOR_MOVE:
      return "ready_for_move";
    case EngineState.TOUCHING:
      return "holding";
    case EngineState.READY:
      return "ready";
    case EngineState.RUNNING:
      return "running";
    case EngineState.COOLDOWN:
    case EngineState.STOPPED:
      return "stopped";
    default:
      return "idle";
  }
}
