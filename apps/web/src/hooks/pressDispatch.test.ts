import { describe, it, expect } from "vitest";
import { resolveIdlePress, type IdlePressInputs } from "./pressDispatch";

describe("resolveIdlePress — idle press dispatch (regression coverage)", () => {
  it("REGRESSION: cube + scramble verification OFF arms even when inspection is ON (Mode 3)", () => {
    // Inspection (default ON) must NOT shadow the smart-cube arm gate.
    const inputs: IdlePressInputs = { smartCube: true, scrambleVerif: false, inspection: true };
    expect(resolveIdlePress(inputs)).toBe("arm");
  });

  it("Mode 4: cube + scramble verification OFF + inspection OFF arms", () => {
    const inputs: IdlePressInputs = { smartCube: true, scrambleVerif: false, inspection: false };
    expect(resolveIdlePress(inputs)).toBe("arm");
  });

  it("Mode 1: cube + scramble verification ON + inspection ON starts inspection", () => {
    const inputs: IdlePressInputs = { smartCube: true, scrambleVerif: true, inspection: true };
    expect(resolveIdlePress(inputs)).toBe("inspection");
  });

  it("Mode 2: cube + scramble verification ON + inspection OFF arms", () => {
    const inputs: IdlePressInputs = { smartCube: true, scrambleVerif: true, inspection: false };
    expect(resolveIdlePress(inputs)).toBe("arm");
  });

  it("no cube + inspection ON starts inspection", () => {
    const inputs: IdlePressInputs = { smartCube: false, scrambleVerif: false, inspection: true };
    expect(resolveIdlePress(inputs)).toBe("inspection");
  });

  it("no cube + inspection OFF: manual hold-and-release", () => {
    const inputs: IdlePressInputs = { smartCube: false, scrambleVerif: false, inspection: false };
    expect(resolveIdlePress(inputs)).toBe("down");
  });

  it("no cube: scrambleVerif is irrelevant to the dispatch", () => {
    expect(resolveIdlePress({ smartCube: false, scrambleVerif: true, inspection: false })).toBe("down");
    expect(resolveIdlePress({ smartCube: false, scrambleVerif: true, inspection: true })).toBe("inspection");
  });

  it("exhaustive truth table over the 8 input tuples", () => {
    const booleans = [false, true] as const;
    const seen: string[] = [];
    for (const cube of booleans) {
      for (const verif of booleans) {
        for (const insp of booleans) {
          const inputs: IdlePressInputs = { smartCube: cube, scrambleVerif: verif, inspection: insp };
          const key = `${cube}/${verif}/${insp}`;
          seen.push(key);
          const expected = cube && !verif ? "arm" : insp ? "inspection" : cube ? "arm" : "down";
          expect(resolveIdlePress(inputs), key).toBe(expected);
        }
      }
    }
    expect(seen).toHaveLength(8);
  });
});
