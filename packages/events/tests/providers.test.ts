import { describe, expect, it } from "vitest";
import {
  EVENT_REGISTRY,
  generateScramble,
  getEvent,
  getScrambleProvider,
  getScrambleProviders,
  registerScrambleProvider,
  validateScramble,
  type ScrambleProvider,
} from "../src";

/**
 * TDD A4 — ScrambleProvider contract. The events package is solver-agnostic,
 * so these tests use a fake provider; the real 2×2/3×3 implementations are
 * registered by the app and covered by the app-level test suite.
 */

const FAKE_ID = "test-fake-provider";

function makeFake(scramble = "R U R'"): ScrambleProvider {
  return {
    id: FAKE_ID,
    generate: () => scramble,
    validate: (_event, s) => s === scramble,
  };
}

describe("provider registry", () => {
  it("registers and looks up a provider by id", () => {
    const p = makeFake();
    registerScrambleProvider(p);
    expect(getScrambleProvider(FAKE_ID)).toBe(p);
    expect(getScrambleProviders()).toContain(p);
  });

  it("rejects duplicate registration under the same id", () => {
    const a: ScrambleProvider = { ...makeFake("A"), id: "dup-test-id" };
    const b: ScrambleProvider = { ...makeFake("B"), id: "dup-test-id" };
    registerScrambleProvider(a);
    expect(() => registerScrambleProvider(b)).toThrow(/already registered/);
  });

  it("returns undefined for unknown ids", () => {
    expect(getScrambleProvider("no-such-provider")).toBeUndefined();
  });
});

describe("generateScramble — honest accessor (no silent default)", () => {
  // A spec wired to the FAKE provider. (The real 333 spec declares
  // "min2phase-random-state", registered by the app at startup.)
  const specWithFake = { ...getEvent("333")!, scrambleProvider: FAKE_ID };

  it("returns the provider's scramble when the event has one", () => {
    expect(generateScramble(specWithFake)).toBe("R U R'");
  });

  it("returns null when the event has no provider declared", () => {
    // Events pending a scramble implementation (e.g. 4×4–7×7, Pyraminx…)
    // must NOT fall back to anything — null is the honest answer.
    for (const event of EVENT_REGISTRY) {
      if (event.scrambleProvider === null) {
        expect(generateScramble(event)).toBeNull();
        expect(validateScramble(event, "R U R'")).toBe(false);
      }
    }
  });

  it("returns null when the declared provider is not registered", () => {
    const unregistered = { ...specWithFake, scrambleProvider: "ghost-provider" };
    expect(generateScramble(unregistered)).toBeNull();
  });

  it("validates through the registered provider", () => {
    expect(validateScramble(specWithFake, "R U R'")).toBe(true);
    expect(validateScramble(specWithFake, "something else")).toBe(false);
  });
});
