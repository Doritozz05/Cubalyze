import { beforeEach, describe, expect, it } from "vitest";
import { useVirtualScrambleStore } from "./virtualScrambleStore";

describe("virtualScrambleStore", () => {
  beforeEach(() => {
    // Reset between tests so expectations are deterministic.
    useVirtualScrambleStore.setState({ scramble: "" });
  });

  it("starts empty — the timer's scramble is used until the Cube tab publishes", () => {
    expect(useVirtualScrambleStore.getState().scramble).toBe("");
  });

  it("stores the scramble published by the Cube tab simulator", () => {
    useVirtualScrambleStore.getState().setScramble("R U R' U' R' F R2 U' R' U'");
    expect(useVirtualScrambleStore.getState().scramble).toBe(
      "R U R' U' R' F R2 U' R' U'",
    );
  });

  it("always keeps the latest scramble (never appends)", () => {
    useVirtualScrambleStore.getState().setScramble("R U R' U' R' F R2 U' R' U'");
    useVirtualScrambleStore.getState().setScramble("F R U R' U' F'");
    expect(useVirtualScrambleStore.getState().scramble).toBe("F R U R' U' F'");
  });

  it("notifies subscribers so StageOverlays re-renders the widgets with the new scramble", () => {
    let received = "";
    const unsubscribe = useVirtualScrambleStore.subscribe((s) => {
      received = s.scramble;
    });
    useVirtualScrambleStore.getState().setScramble("U R U' R' U' F U F'");
    expect(received).toBe("U R U' R' U' F U F'");
    unsubscribe();
  });
});
