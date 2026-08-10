import { describe, it, expect } from 'vitest';
import { OrientationTable } from '../orientation/OrientationTable';

/**
 * OrientationTable.decompose — shortest base-rotation path for every element
 * of the 24-orientation group. The replay engine uses it to turn a collapsed
 * "diagonal" grip change into sequential single-axis rotations.
 */
describe('OrientationTable.decompose', () => {
  it('identity decomposes to []', () => {
    expect(OrientationTable.decompose(OrientationTable.IDENTITY)).toEqual([]);
  });

  it('single base rotations decompose to themselves', () => {
    for (const name of ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']) {
      const entry = OrientationTable.rotationEntryFor(name)!;
      const parts = OrientationTable.decompose(entry);
      expect(parts).toHaveLength(1);
      expect(parts[0].id).toBe(entry.id);
    }
  });

  it('every entry decomposes into base rotations that compose back to it (≤ 2)', () => {
    for (const entry of OrientationTable.ENTRIES) {
      const parts = OrientationTable.decompose(entry);
      expect(parts.length).toBeLessThanOrEqual(2);
      let acc = OrientationTable.IDENTITY;
      for (const p of parts) {
        acc = OrientationTable.compose(acc, p);
      }
      expect(acc.id).toBe(entry.id);
    }
  });

  it('a two-step element (y then z) decomposes into exactly 2 base rotations that compose back', () => {
    const y = OrientationTable.rotationEntryFor('y')!;
    const z = OrientationTable.rotationEntryFor('z')!;
    const yz = OrientationTable.compose(y, z);
    const parts = OrientationTable.decompose(yz);
    // y∘z is NOT a single base rotation → must be 2 steps. (Multiple valid
    // factorizations exist — e.g. [x', y] and [y, z] both equal y∘z — so only
    // the length and the composition are asserted.)
    expect(parts).toHaveLength(2);
    let acc = OrientationTable.IDENTITY;
    for (const p of parts) acc = OrientationTable.compose(acc, p);
    expect(acc.id).toBe(yz.id);
  });
});
