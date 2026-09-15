import { Cube3DEngine } from '../core/Cube3DEngine';
import { registerPuzzle3D } from './registry';
import type { Puzzle3DEngineFactory, Puzzle3DSpec } from './types';

/**
 * Builder for the NxN cube family (2×2–7×7+). This is a thin wrapper around
 * the existing `Cube3DEngine` (whose `order` option already handles any N) —
 * registering it here makes the family part of the multi-puzzle terrain
 * without changing a single line of the engine.
 *
 * `order` travels inside the spec (`{ kind: 'nxn-cube', order }`) instead of
 * the engine options, so non-cube kinds can carry their own parameters later.
 */
export const nxnPuzzle3DFactory: Puzzle3DEngineFactory = {
  kind: 'nxn-cube',
  build(spec: Puzzle3DSpec, options) {
    if (spec.kind !== 'nxn-cube') {
      throw new Error('nxn-cube factory received a non-nxn spec');
    }
    return new Cube3DEngine({ ...options, order: spec.order });
  },
};

/** Register (or re-register, e.g. after a test reset) the nxn-cube builder. */
export function registerNxnPuzzle3D(): void {
  registerPuzzle3D(nxnPuzzle3DFactory);
}

// Self-register on import (same pattern as scrambleProviders in apps/web), so
// importing @cubalyze/cube-3d-engine always has the nxn family available.
registerNxnPuzzle3D();
