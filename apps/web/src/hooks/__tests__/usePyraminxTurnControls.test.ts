import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PyraminxEngine as PyraminxEngineT,
  PyraminxPick,
} from "@cubalyze/cube-3d-engine";

// Hook-level tests need no real React reconciler: the hook only uses refs,
// callbacks and one effect (window listeners — stubbed below), so the same
// mock pattern as useCubeTurnControls.test.ts applies.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (fn: unknown) => fn,
    useEffect: (fn: () => void) => fn(),
  };
});

import {
  pruneGhostPointers,
  usePyraminxTurnControls,
  type PyraminxPointerEntry,
} from "../usePyraminxTurnControls";

/** A pick whose +120° U-turn tangent projects to screen-UP (world +y with the
 *  identity camera): position (1,0,0), axis U = (0,0,1) → t = a × p = (0,1,0).
 *  A 40px DOWNWARD drag (dy = +40) then resolves cos = −1 → the plain "U". */
// `position` is a three.js Vector3 in the engine types; the resolver only
// reads x/y/z, so a plain object is enough at runtime (cast for the type).
const PICK = {
  kind: "edge",
  position: { x: 1, y: 0, z: 0 },
  candidates: [{ vertex: "U", scope: "layer" }],
} as unknown as PyraminxPick;

function useSetup(pick: PyraminxPick | null = null) {
  const onTurn = vi.fn();
  // getWorldAxis returns a Vector3-like: the hook scales it by the puzzle
  // scale when building the spatial-fallback vertex positions.
  const mockAxis = (x: number, y: number, z: number) => ({
    x,
    y,
    z,
    multiplyScalar: (s: number) => ({ x: x * s, y: y * s, z: z * s }),
  });
  const mockEngine = {
    pickSticker: vi.fn().mockReturnValue(pick),
    isAnimating: vi.fn().mockReturnValue(false),
    getWorldAxis: vi.fn((v: string) =>
      v === "U" ? mockAxis(0, 0, 1) : mockAxis(0, 0, -1),
    ),
    model: { root: { scale: { x: 1.8 } } },
    sceneManager: {
      camera: {
        updateMatrixWorld: vi.fn(),
        matrixWorld: {
          elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        },
      },
    },
  } as unknown as PyraminxEngineT;

  const engineRef = { current: mockEngine };
  const controls = usePyraminxTurnControls({
    engineRef,
    minSwipeDistance: 14,
    onTurn,
  });

  const mockCanvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  } as unknown as HTMLCanvasElement;

  return { controls, mockCanvas, mockEngine, onTurn };
}

describe("pruneGhostPointers (the ghost-pointer wedge)", () => {
  const entry = (id: number, ageMs: number, moved: boolean): [number, PyraminxPointerEntry] => [
    id,
    { x: 0, y: 0, t: 10_000 - ageMs, moved },
  ];

  it("drops entries older than the TTL even if they moved", () => {
    const map = new Map<number, PyraminxPointerEntry>([
      entry(1, 4000, true), // ghost: way past the TTL
      entry(2, 100, true), // live finger
    ]);
    pruneGhostPointers(map, 10_000, true);
    expect([...map.keys()]).toEqual([2]);
  });

  it("at pointer-down drops UNMOVED entries past the arm grace (the wedge heal)", () => {
    const map = new Map<number, PyraminxPointerEntry>([
      entry(1, 400, false), // ghost: never moved, old enough to drop
      entry(2, 400, true), // moved finger survives the grace rule
      entry(3, 100, false), // just-landed second finger: kept (fresh)
    ]);
    pruneGhostPointers(map, 10_000, true);
    expect([...map.keys()].sort()).toEqual([2, 3]);
  });

  it("a freshly-armed pointer (age ~0, unmoved) is never dropped", () => {
    const map = new Map<number, PyraminxPointerEntry>([entry(1, 0, false)]);
    pruneGhostPointers(map, 10_000, true);
    expect(map.size).toBe(1);
  });

  it("the move path (atPointerDown=false) only applies the TTL rule", () => {
    const map = new Map<number, PyraminxPointerEntry>([
      entry(1, 400, false), // unmoved but NOT at pointer-down: kept
      entry(2, 4000, true), // TTL applies everywhere
    ]);
    pruneGhostPointers(map, 10_000, false);
    expect([...map.keys()]).toEqual([1]);
  });
});

describe("usePyraminxTurnControls — ghost-pointer recovery", () => {
  beforeEach(() => {
    // The hook's effect registers window-level pointerup/cancel/lostcapture
    // and blur listeners; in node they are harmless stubs.
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a normal drag fires the turn", () => {
    const { controls, mockCanvas, onTurn } = useSetup(PICK);
    const down = {
      pointerId: 1,
      clientX: 200,
      clientY: 200,
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;
    const move = {
      pointerId: 1,
      clientX: 200,
      clientY: 240, // 40px downward drag = along the −tangent → "U"
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;

    controls.pointerHandlers.onPointerDown(down);
    controls.pointerHandlers.onPointerMove(move);

    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith("U");
  });

  it("a lost pointerup does NOT wedge the drag system", async () => {
    const { controls, mockCanvas, onTurn } = useSetup(PICK);
    const down = (id: number) =>
      ({
        pointerId: id,
        clientX: 200,
        clientY: 200,
        target: mockCanvas,
      }) as unknown as React.PointerEvent<HTMLCanvasElement>;
    const move = (id: number) =>
      ({
        pointerId: id,
        clientX: 200,
        clientY: 240,
        target: mockCanvas,
      }) as unknown as React.PointerEvent<HTMLCanvasElement>;

    // Gesture 1: pointer 1 goes down; its pointerup is LOST (the browser
    // never delivers it — capture loss, remount, navigation teardown…).
    controls.pointerHandlers.onPointerDown(down(1));

    // Let the unmoved ghost age past the arm-grace window (250 ms).
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Gesture 2: a fresh pointer. The ghost must be pruned at pointer-down
    // and the drag must resolve exactly as if the ghost never existed.
    controls.pointerHandlers.onPointerDown(down(2));
    controls.pointerHandlers.onPointerMove(move(2));
    controls.pointerHandlers.onPointerUp({
      ...move(2),
      pointerId: 2,
    } as unknown as React.PointerEvent<HTMLCanvasElement>);

    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith("U");
  });
});
