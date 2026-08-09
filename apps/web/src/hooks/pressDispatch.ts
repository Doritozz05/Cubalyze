/**
 * Pure decision helper for the idle-state press dispatch used by
 * `useSolveSession`.
 *
 * Decides what a Space/tap does when the engine is IDLE (pre-arm):
 *   - "arm"        → READY_FOR_MOVE gate: the first physical cube move
 *                    starts the solve.
 *   - "inspection" → start the WCA inspection countdown.
 *   - "down"       → manual hold-and-release timer (no cube gate).
 *
 * Priority:
 *   1. Smart Cube + Scramble Verification OFF (Modes 3 & 4) → arm. This must
 *      win over Inspection (default ON) — otherwise the space key launches
 *      the inspection ceremony and the documented "Scramble Verification OFF
 *      + Smart Cube" flow (see TimerEngine.arm) is unreachable.
 *   2. Inspection ON → inspection (Mode 1 with a cube, or any no-cube setup).
 *   3. Smart Cube + Scramble Verification ON + Inspection OFF (Mode 2) → arm.
 *   4. Manual → down.
 */
export type IdlePressAction = "arm" | "inspection" | "down";

export interface IdlePressInputs {
  smartCube: boolean;
  scrambleVerif: boolean;
  inspection: boolean;
}

export function resolveIdlePress(inputs: IdlePressInputs): IdlePressAction {
  if (inputs.smartCube && !inputs.scrambleVerif) return "arm";
  if (inputs.inspection) return "inspection";
  if (inputs.smartCube) return "arm";
  return "down";
}
