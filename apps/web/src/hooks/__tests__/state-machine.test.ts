import { describe, it, expect } from 'vitest';
import { shouldAutoArm, type AutoArmInputs } from '../shouldAutoArm';

/**
 * State machine / move collection tests.
 *
 * Validates the auto-arm decision logic that controls whether
 * the first move is swallowed or collected. This is critical for
 * ensuring the timeline contains all moves from the solve.
 */
describe('State Machine — Auto-arm', () => {
  // ── shouldAutoArm decision matrix ───────────────────────────────────────

  it('auto-arms when: smartCube=true, scrambleVerif=true, inspection=false, idle=true', () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(true);
  });

  it('does NOT auto-arm when smartCube is false', () => {
    const inputs: AutoArmInputs = {
      smartCube: false,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it('does NOT auto-arm when scrambleVerif is false', () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: false,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it('does NOT auto-arm when inspection is true', () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: true,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it('does NOT auto-arm when state is NOT idle', () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: true,
      inspection: false,
      stateIsIdle: false,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  it('does NOT auto-arm with only smartCube + stateIsIdle (missing scrambleVerif)', () => {
    const inputs: AutoArmInputs = {
      smartCube: true,
      scrambleVerif: false,
      inspection: false,
      stateIsIdle: true,
    };
    expect(shouldAutoArm(inputs)).toBe(false);
  });

  // ── Full decision matrix ───────────────────────────────────────────────

  it('exhaustive truth table: only Mode 2 triggers auto-arm', () => {
    const bools = [true, false];
    const results: { inputs: AutoArmInputs; expected: boolean }[] = [];

    for (const smartCube of bools) {
      for (const scrambleVerif of bools) {
        for (const inspection of bools) {
          for (const stateIsIdle of bools) {
            const inputs: AutoArmInputs = {
              smartCube,
              scrambleVerif,
              inspection,
              stateIsIdle,
            };
            const expected =
              smartCube && scrambleVerif && !inspection && stateIsIdle;
            results.push({ inputs, expected });
          }
        }
      }
    }

    for (const { inputs, expected } of results) {
      expect(
        shouldAutoArm(inputs),
        `shouldAutoArm(${JSON.stringify(inputs)}) should be ${expected}`,
      ).toBe(expected);
    }
  });
});
