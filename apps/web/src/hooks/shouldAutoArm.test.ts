import { describe, it, expect } from "vitest";
import { shouldAutoArm, type AutoArmInputs } from "./shouldAutoArm";

describe("shouldAutoArm", () => {
  /**
   * Regression coverage for the Mode 1 (scramble ON + inspection ON + Smart
   * Cube) bug discovered by the first code review: auto-arm must NOT fire
   * when inspection is enabled, otherwise the inspection ceremony is
   * silently bypassed.
   */
  it("does NOT auto-arm when inspection is enabled (Mode 1 regression)", () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: true, // ← the regression trigger
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it("auto-arms ONLY when smart cube + scrambleVerif + !inspection + idle (Mode 2)", () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(true);
  });

  it("does not auto-arm without a smart cube even if other prefs match", () => {
    const inputs: AutoArmInputs = {
      smartCube: false,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it("does not auto-arm when scramble verification is disabled", () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: false,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it("does not auto-arm when engine is not idle", () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: false,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it("never auto-arms in Mode 4 (no scramble, no inspection)", () => {
    // Mode 4 explicitly requires the user to tap/press Space to arm —
    // auto-arming on a scramble that does not exist is meaningless.
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: false,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it("exhaustive truth-table over the 16 possible input tuples", () => {
    // The complete 2^4 truth table. Only ONE tuple must return true —
    // a fully defensive check that future refactors cannot silently
    // enable extra auto-arm scenarios.
    const booleans = [false, true] as const;
    let trueCount = 0;
    for (const smartCube of booleans) {
      for (const scrambleVerif of booleans) {
        for (const inspection of booleans) {
          for (const stateIsIdle of booleans) {
            const inputs: AutoArmInputs = {
              smartCube,
              scrambleVerif,
              inspection,
              stateIsIdle,
            };
            if (shouldAutoArm(inputs)) {
              trueCount++;
              // Assert exactly which tuple qualifies.
              expect(inputs).toEqual({
                smartCube: true,
                scrambleVerif: true,
                inspection: false,
                stateIsIdle: true,
              });
            }
          }
        }
      }
    }
    expect(trueCount).toBe(1);
  });
});
