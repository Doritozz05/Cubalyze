/**
 * Pure decision helper for the auto-arm transition used by `useSolveSession`.
 *
 * Auto-arming exists ONLY for Mode 2 (Scramble Verification ON + Inspection
 * OFF) with a Smart Cube connected. In any other mode the user must tap or
 * press Space themselves, otherwise we would silently skip required phases
 * (notably the WCA inspection in Mode 1).
 *
 * @example
 * shouldAutoArm({ smartCube: true, scrambleVerif: true, inspection: false, stateIsIdle: true })
 * // → true (Mode 2 + smart cube)
 *
 * shouldAutoArm({ smartCube: true, scrambleVerif: true, inspection: true, stateIsIdle: true })
 * // → false (Mode 1 — keep the inspection ceremony intact)
 */
export interface AutoArmInputs {
  smartCube: boolean;
  scrambleVerif: boolean;
  inspection: boolean;
  stateIsIdle: boolean;
}

export function shouldAutoArm(inputs: AutoArmInputs): boolean {
  return (
    inputs.smartCube &&
    inputs.scrambleVerif &&
    !inputs.inspection &&
    inputs.stateIsIdle
  );
}
