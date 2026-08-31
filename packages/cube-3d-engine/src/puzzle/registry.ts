import type { Cube3DEngine } from '../core/Cube3DEngine';
import type { Puzzle3DBuildOptions, Puzzle3DEngineFactory, Puzzle3DKind, Puzzle3DSpec } from './types';

/**
 * Multi-puzzle 3D registry — maps a {@link Puzzle3DKind} to the factory that
 * builds its engine. The professional "puzzle = definition + registry" seam:
 * adding a puzzle means writing its builder (its own folder) and registering
 * it here. The core engine and every existing caller stay untouched.
 *
 * Honesty rule (same as `packages/events`): a kind may be *declared* in
 * `Puzzle3DKind` without being *implemented*. `createPuzzle3DEngine` throws a
 * clear error for those — never a silent 3×3 fallback.
 */
const builders = new Map<Puzzle3DKind, Puzzle3DEngineFactory>();

/** Register a factory under its kind. Duplicate kinds are rejected. */
export function registerPuzzle3D(factory: Puzzle3DEngineFactory): void {
  if (builders.has(factory.kind)) {
    throw new Error(`Puzzle3D "${factory.kind}" is already registered`);
  }
  builders.set(factory.kind, factory);
}

/** Look up the registered factory for a kind, if any. */
export function getPuzzle3DFactory(kind: Puzzle3DKind): Puzzle3DEngineFactory | undefined {
  return builders.get(kind);
}

/** All kinds with a registered builder. */
export function listPuzzle3DKinds(): Puzzle3DKind[] {
  return [...builders.keys()];
}

/**
 * Build the 3D engine for a puzzle spec via its registered factory.
 * Throws when the kind has no builder yet (declared but unimplemented).
 */
export function createPuzzle3DEngine(
  spec: Puzzle3DSpec,
  options: Puzzle3DBuildOptions,
): Cube3DEngine {
  const factory = builders.get(spec.kind);
  if (!factory) {
    throw new Error(`Puzzle3D "${spec.kind}" has no registered 3D builder yet`);
  }
  return factory.build(spec, options);
}

/**
 * Test hook — wipes the registry so tests get a deterministic starting point.
 * Not meant for app code; tests must re-register the base kinds afterwards
 * (see `registerNxnPuzzle3D`).
 */
export function resetPuzzle3DRegistry(): void {
  builders.clear();
}
