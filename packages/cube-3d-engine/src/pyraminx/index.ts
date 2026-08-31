import { registerPuzzle3D } from '../puzzle/registry';
import type { Puzzle3DEngineFactory, Puzzle3DSpec } from '../puzzle/types';
import { PyraminxEngine } from './PyraminxEngine';

export * from './PyraminxGeometry';
export * from './PyraminxMeshFactory';
export * from './PyraminxModel';
export * from './PyraminxEngine';
export * from './PyraminxReplayEngine';

/**
 * Builder for the Pyraminx family (vertex-turning tetrahedron, 4 axes, ±120°).
 * The spec carries no parameters today: `{ kind: 'pyraminx' }`.
 */
export const pyraminxPuzzle3DFactory: Puzzle3DEngineFactory = {
  kind: 'pyraminx',
  build(spec: Puzzle3DSpec, options) {
    if (spec.kind !== 'pyraminx') {
      throw new Error('pyraminx factory received a non-pyraminx spec');
    }
    return new PyraminxEngine({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      pixelRatio: options.pixelRatio,
      contextEvictable: options.contextEvictable,
      onContextEvicted: options.onContextEvicted,
    });
  },
};

/** Register (or re-register, e.g. after a test reset) the pyraminx builder. */
export function registerPyraminxPuzzle3D(): void {
  registerPuzzle3D(pyraminxPuzzle3DFactory);
}

// Self-register on import (same pattern as nxn-cube and scrambleProviders),
// so importing @cubeforge/cube-3d-engine always has the pyraminx family.
registerPyraminxPuzzle3D();
