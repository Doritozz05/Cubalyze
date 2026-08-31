/**
 * Puzzle3D registry tests.
 *
 * Covers the multi-puzzle seam:
 *   • nxn-cube is registered (the family that exists today)
 *   • declared-but-unimplemented kinds throw an honest error (never a
 *     silent 3×3 fallback)
 *   • duplicate registrations are rejected
 *   • create dispatches the spec + build options to the registered factory
 *
 * NOTE: no real Cube3DEngine is constructed here (needs WebGL) — the nxn
 * builder is only asserted to exist; the WebGL construction path is covered
 * by the existing engine suite.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createPuzzle3DEngine,
  getPuzzle3DFactory,
  listPuzzle3DKinds,
  registerPuzzle3D,
  resetPuzzle3DRegistry,
} from '../registry';
import { nxnPuzzle3DFactory, registerNxnPuzzle3D } from '../nxn';
import type { Puzzle3DBuildOptions, Puzzle3DEngineFactory, Puzzle3DSpec } from '../types';

afterEach(() => {
  resetPuzzle3DRegistry();
  registerNxnPuzzle3D(); // restore the real nxn registration
});

describe('Puzzle3D registry', () => {
  it('nxn-cube is registered with a builder', () => {
    expect(getPuzzle3DFactory('nxn-cube')).toBe(nxnPuzzle3DFactory);
    expect(listPuzzle3DKinds()).toContain('nxn-cube');
  });

  it('declared-but-unimplemented kinds throw an honest error', () => {
    // 'skewb' is declared in Puzzle3DKind but has no builder yet (pyraminx
    // now has one) — the registry must refuse it, never silently fall back.
    const spec: Puzzle3DSpec = { kind: 'skewb' };
    expect(() =>
      createPuzzle3DEngine(spec, {} as Puzzle3DBuildOptions),
    ).toThrow(/no registered 3D builder/);
  });

  it('rejects duplicate registrations', () => {
    expect(() => registerPuzzle3D(nxnPuzzle3DFactory)).toThrow(/already registered/);
  });

  it('dispatches to the registered factory with the spec and build options', () => {
    const spy: Puzzle3DEngineFactory = {
      kind: 'pyraminx',
      build(spec, options) {
        expect(spec).toEqual({ kind: 'pyraminx' });
        expect(options.width).toBe(320);
        expect(options.height).toBe(240);
        return { specKind: spec.kind } as never;
      },
    };
    registerPuzzle3D(spy);

    const engine = createPuzzle3DEngine(
      { kind: 'pyraminx' },
      { canvas: {} as HTMLCanvasElement, width: 320, height: 240 },
    );
    expect(engine).toEqual({ specKind: 'pyraminx' });
  });

  it('reset clears the registry and re-registration restores nxn', () => {
    resetPuzzle3DRegistry();
    expect(listPuzzle3DKinds()).toEqual([]);
    registerNxnPuzzle3D();
    expect(listPuzzle3DKinds()).toEqual(['nxn-cube']);
  });
});
