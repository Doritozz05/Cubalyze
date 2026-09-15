import { describe, it, expect, vi } from "vitest";
import type { Cube3DEngine, CubeLayerPick } from "@cubalyze/cube-3d-engine";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (fn: unknown) => fn,
  };
});

import { useCubeTurnControls } from "../useCubeTurnControls";

describe("useCubeTurnControls — tap vs drag behavior", () => {
  function useSetup(pick: CubeLayerPick | null = null) {
    const onAction = vi.fn();
    const mockEngine = {
      pickLayer: vi.fn().mockReturnValue(pick),
      setCameraDragActive: vi.fn(),
      isAnimating: vi.fn().mockReturnValue(false),
      sceneManager: {
        camera: {
          updateMatrixWorld: vi.fn(),
          matrixWorld: {
            elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          },
        },
      },
      zoomCamera: vi.fn(),
    } as unknown as Cube3DEngine;

    const engineRef = { current: mockEngine };
    const controls = useCubeTurnControls({ engineRef, onAction });

    const mockCanvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as HTMLCanvasElement;

    return { controls, mockCanvas, mockEngine, onAction };
  }

  it("single click / tap on cube face does NOT fire any action", () => {
    const mockPick: CubeLayerPick = {
      face: "F",
      axis: "z",
      axisSign: 1,
      layerValue: 1,
      axisVector: { x: 0, y: 0, z: 1 },
      cubiePosition: { x: 1, y: 0, z: 1 },
      worldPoint: { x: 1.5, y: 0, z: 1.5 },
    };
    const { controls, mockCanvas, onAction } = useSetup(mockPick);

    const downEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;

    const upEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;

    // Pointer down on cube face, then pointer up without moving
    controls.pointerHandlers.onPointerDown(downEvent);
    controls.pointerHandlers.onPointerUp(upEvent);

    expect(onAction).not.toHaveBeenCalled();
  });

  it("face drag exceeding minSwipeDistance DOES fire turn action", () => {
    const mockPick: CubeLayerPick = {
      face: "F",
      axis: "z",
      axisSign: 1,
      layerValue: 1,
      axisVector: { x: 0, y: 0, z: 1 },
      cubiePosition: { x: 1, y: 0, z: 1 },
      worldPoint: { x: 1.5, y: 0, z: 1.5 },
    };
    const { controls, mockCanvas, onAction } = useSetup(mockPick);

    const downEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;

    const moveEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 60, // 40px up drag > 14px minSwipeDistance
      target: mockCanvas,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;

    controls.pointerHandlers.onPointerDown(downEvent);
    controls.pointerHandlers.onPointerMove(moveEvent);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      kind: "turn",
      face: "R",
      direction: 1,
    });
  });
});
