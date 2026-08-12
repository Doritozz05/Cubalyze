import { describe, it, expect } from "vitest";
import { wideTokenToMoveEvents } from "../useVirtualCubeSession";
import { createVirtualCubeAdapter } from "@/utils/virtualCubeAdapter";

describe("wideTokenToMoveEvents — virtual solve state expansion", () => {
  it("expands a wide move into its face + slice halves (b → B + S')", () => {
    expect(wideTokenToMoveEvents("b")).toEqual([
      { face: "B", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "S", direction: -1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
  });

  it("keeps primes on the right half (r' → R' + M)", () => {
    expect(wideTokenToMoveEvents("r'")).toEqual([
      { face: "R", direction: -1, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "M", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
  });

  it("maps 180° wide turns to direction 2 (u2 → U2 + E2)", () => {
    expect(wideTokenToMoveEvents("u2")).toEqual([
      { face: "U", direction: 2, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "E", direction: 2, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
  });

  it("covers every wide face (l, f, d — primes and 2s)", () => {
    expect(wideTokenToMoveEvents("l")).toEqual([
      { face: "L", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "M", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
    expect(wideTokenToMoveEvents("f'")).toEqual([
      { face: "F", direction: -1, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "S", direction: -1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
    expect(wideTokenToMoveEvents("d2")).toEqual([
      { face: "D", direction: 2, cubeTimestamp: 0, hostTimestamp: 0 },
      { face: "E", direction: 2, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
  });

  it("passes standalone slices and plain faces through unchanged", () => {
    expect(wideTokenToMoveEvents("M'")).toEqual([
      { face: "M", direction: -1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
    expect(wideTokenToMoveEvents("R")).toEqual([
      { face: "R", direction: 1, cubeTimestamp: 0, hostTimestamp: 0 },
    ]);
  });
});

describe("virtual cube adapter — wide token + display pairing", () => {
  it("emits the solver-frame display label before its conjugated token", () => {
    const adapter = createVirtualCubeAdapter();
    const tokens: string[] = [];
    const displays: string[] = [];
    adapter.tokens$!.subscribe((t) => tokens.push(t));
    adapter.tokenDisplay$!.subscribe((d) => displays.push(d));

    // Under a y grip the user performs "r" but the validator receives "b".
    adapter.pushToken("b", "r");
    adapter.pushToken("f'", "f'");

    // Same emission order, and each display pairs with its token.
    expect(displays).toEqual(["r", "f'"]);
    expect(tokens).toEqual(["b", "f'"]);
  });

  it("falls back to the token itself when no display label is given", () => {
    const adapter = createVirtualCubeAdapter();
    const displays: string[] = [];
    adapter.tokenDisplay$!.subscribe((d) => displays.push(d));
    adapter.pushToken("u2");
    expect(displays).toEqual(["u2"]);
  });

  it("carries the display label on face moves (slices under a grip)", () => {
    const adapter = createVirtualCubeAdapter();
    const moves: import("@cubeforge/types").CubeMoveEvent[] = [];
    adapter.moves$!.subscribe((m) => moves.push(m));
    // User performs M' but under a y grip the conjugated slice is S'.
    adapter.pushMove("S", -1, "M'");
    expect(moves[0].face).toBe("S");
    expect(moves[0].direction).toBe(-1);
    expect(moves[0].displayNotation).toBe("M'");
  });
});
