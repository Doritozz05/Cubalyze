import type { Cube3DEngine, Cube3DEngineOptions } from '../core/Cube3DEngine';

/**
 * The common surface every puzzle engine exposes — camera, lifecycle and
 * render scheduling. Puzzle-specific move APIs stay on the concrete engine
 * classes (e.g. `Cube3DEngine.rotateLayers`, `PyraminxEngine.rotateVertex`);
 * the registry and the panel seam only depend on this shared contract.
 */
export interface Puzzle3DEngine {
  resize(width: number, height: number): void;
  dispose(): void;
  requestRender(): void;
  isContextEvicted(): boolean;
  rotateCamera(dx: number, dy: number): void;
  zoomCamera(deltaY: number): void;
  resetCamera(smooth?: boolean): Promise<void> | void;
  setIsometricView(smooth?: boolean, radius?: number): Promise<void> | void;
  setCameraDragActive(active: boolean): void;
}

/**
 * Families of twisty puzzles the 3D engine can render. Only kinds with a
 * registered builder are constructible — the same honesty rule as the WCA
 * event registry (declared ≠ implemented): 'nxn-cube' today, the rest are
 * declared for the roadmap and throw a clear error until their builder lands.
 *
 * The NxN family (2×2–7×7+) shares ONE engine parameterized by `order`; every
 * other kind is its own family (own geometry, turn axes and piece set):
 *   - pyraminx: vertex-turning tetrahedron (4 axes, ±120°)
 *   - skewb:    corner-turning cube (4 body-diagonal axes, ±120°)
 *   - megaminx: face-turning dodecahedron (12 axes, ±72°)
 *   - fto:      face-turning octahedron (8 axes, ±120°)
 *   - sq1:      square-1 (cuboid, 30° increments)
 *   - clock:    clock (wheels + pins)
 */
export type Puzzle3DKind =
  | 'nxn-cube'
  | 'pyraminx'
  | 'skewb'
  | 'megaminx'
  | 'fto'
  | 'sq1'
  | 'clock';

/** Declarative description of which puzzle to build (discriminated union). */
export type Puzzle3DSpec =
  | { kind: 'nxn-cube'; order: number }
  | { kind: Exclude<Puzzle3DKind, 'nxn-cube'> };

/**
 * Options handed to a puzzle builder — everything {@link Cube3DEngineOptions}
 * accepts EXCEPT `order` (the order travels inside the spec for nxn-cube).
 * Built with Omit so the option surface never drifts from the engine.
 */
export type Puzzle3DBuildOptions = Omit<Cube3DEngineOptions, 'order'>;

/**
 * Builds the 3D engine for one puzzle family. Registered by kind in the
 * puzzle registry; each kind has exactly one factory.
 */
export interface Puzzle3DEngineFactory {
  readonly kind: Puzzle3DKind;
  /** Construct the engine for this kind. Must throw on a mismatched spec. */
  build(spec: Puzzle3DSpec, options: Puzzle3DBuildOptions): Puzzle3DEngine;
}
