import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * Pre-refactor safety tests — covers breakage points specific to the
 * Proxy adapter migration.
 *
 * These must pass BEFORE and AFTER the hybrid refactoring.
 */
describe('CubeState — Pre-refactor Safety (Proxy readiness)', () => {
  // ── Direct index write ─────────────────────────────────────────────────

  it('state.cp[3] = 5 mutates the state correctly', () => {
    const state = new CubeState();

    // Direct write
    state.cp[3] = 5;
    expect(state.cp[3]).toBe(5);
    expect(state.isSolved()).toBe(false);

    // Restore to solved
    state.cp[3] = 3;
    expect(state.cp[3]).toBe(3);
    expect(state.isSolved()).toBe(true);
  });

  it('state.eo[5] = 1 flips an edge orientation', () => {
    const state = new CubeState();
    state.eo[5] = 1;
    expect(state.eo[5]).toBe(1);
    expect(state.isSolved()).toBe(false);

    state.eo[5] = 0;
    expect(state.eo[5]).toBe(0);
    expect(state.isSolved()).toBe(true);
  });

  it('swap two corners via direct cp assignment', () => {
    const state = new CubeState();
    const tmp = state.cp[0];
    state.cp[0] = state.cp[1];
    state.cp[1] = tmp;

    expect(state.cp[0]).toBe(1);
    expect(state.cp[1]).toBe(0);
    expect(state.isSolved()).toBe(false);
  });

  it('swap two edges via direct ep assignment', () => {
    const state = new CubeState();
    const tmp = state.ep[0];
    state.ep[0] = state.ep[1];
    state.ep[1] = tmp;

    expect(state.ep[0]).toBe(1);
    expect(state.ep[1]).toBe(0);
    expect(state.isSolved()).toBe(false);
  });

  // ── Array.from() compatibility ──────────────────────────────────────────

  it('Array.from(state.cp) returns correct values for solved', () => {
    const state = new CubeState();
    const arr = Array.from(state.cp);
    expect(arr).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(arr).toHaveLength(8);
  });

  it('Array.from(state.ep) returns correct values for solved', () => {
    const state = new CubeState();
    const arr = Array.from(state.ep);
    expect(arr).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(arr).toHaveLength(12);
  });

  it('Array.from(state.cp) on scrambled state returns correct values', () => {
    const state = new CubeState();
    state.applySequence("R U R' U'");

    const arr = Array.from(state.cp);
    // Verify it's a valid permutation
    const set = new Set(arr);
    expect(set.size).toBe(8);
    for (let i = 0; i < 8; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(0);
      expect(arr[i]).toBeLessThanOrEqual(7);
      expect(state.cp[i]).toBe(arr[i]); // Consistency check
    }
  });

  it('Array.from(state.co) returns correct orientation values', () => {
    const state = new CubeState();
    state.applySequence("R U");

    const arr = Array.from(state.co);
    expect(arr).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(0);
      expect(arr[i]).toBeLessThanOrEqual(2);
      expect(state.co[i]).toBe(arr[i]);
    }
  });

  it('Array.from(state.ep) on scrambled returns valid permutation', () => {
    const state = new CubeState();
    state.applySequence("F R U R' U' F'");

    const arr = Array.from(state.ep);
    const set = new Set(arr);
    expect(set.size).toBe(12);
    for (let i = 0; i < 12; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(0);
      expect(arr[i]).toBeLessThanOrEqual(11);
      expect(state.ep[i]).toBe(arr[i]);
    }
  });

  it('Array.from(state.eo) returns correct orientation values', () => {
    const state = new CubeState();
    state.applySequence("F"); // F move flips some edges

    const arr = Array.from(state.eo);
    expect(arr).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(0);
      expect(arr[i]).toBeLessThanOrEqual(1);
      expect(state.eo[i]).toBe(arr[i]);
    }
  });

  // ── .set() method compatibility ──────────────────────────────────────────

  it('state.cp.set(number[]) works', () => {
    const state = new CubeState();
    state.cp.set([3, 0, 1, 2, 4, 5, 6, 7]);
    expect(state.cp[0]).toBe(3);
    expect(state.cp[1]).toBe(0);
  });

  it('state.ep.set(number[]) works', () => {
    const state = new CubeState();
    state.ep.set([3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(state.ep[0]).toBe(3);
    expect(state.ep[1]).toBe(0);
  });

  it('state.co.set(number[]) works', () => {
    const state = new CubeState();
    state.co.set([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.co[0]).toBe(1);
    expect(state.isSolved()).toBe(false);
  });

  it('state.eo.set(number[]) works', () => {
    const state = new CubeState();
    state.eo.set([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.eo[0]).toBe(1);
    expect(state.isSolved()).toBe(false);
  });

  it('.set() from Int8Array works (cross-compat)', () => {
    const state = new CubeState();
    const src = new Int8Array([3, 0, 1, 2, 4, 5, 6, 7]);
    state.cp.set(src);
    expect(state.cp[0]).toBe(3);
  });

  // ── .length property ────────────────────────────────────────────────────

  it('state.cp.length is 8', () => {
    expect(new CubeState().cp.length).toBe(8);
  });

  it('state.ep.length is 12', () => {
    expect(new CubeState().ep.length).toBe(12);
  });

  it('state.co.length is 8', () => {
    expect(new CubeState().co.length).toBe(8);
  });

  it('state.eo.length is 12', () => {
    expect(new CubeState().eo.length).toBe(12);
  });

  // ── Spread operator ─────────────────────────────────────────────────────

  it('spread [...state.cp] works', () => {
    const state = new CubeState();
    expect([...state.cp]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('spread [...state.ep] works', () => {
    const state = new CubeState();
    expect([...state.ep]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  // ── for...of iteration ──────────────────────────────────────────────────

  it('for...of on state.cp iterates all corners', () => {
    const state = new CubeState();
    const result: number[] = [];
    for (const v of state.cp) result.push(v);
    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('for...of on state.ep iterates all edges', () => {
    const state = new CubeState();
    const result: number[] = [];
    for (const v of state.ep) result.push(v);
    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  // ── Out-of-bounds indices ──────────────────────────────────────────────

  it('state.cp[-1] returns undefined (out of bounds)', () => {
    const state = new CubeState();
    expect(state.cp[-1]).toBeUndefined();
  });

  it('state.cp[8] returns undefined (out of bounds)', () => {
    const state = new CubeState();
    expect(state.cp[8]).toBeUndefined();
  });

  it('state.ep[12] returns undefined (out of bounds)', () => {
    const state = new CubeState();
    expect(state.ep[12]).toBeUndefined();
  });

  // ── String index access (should work same as numeric) ─────────────────

  it("state.cp['3'] works same as state.cp[3]", () => {
    const state = new CubeState();
    expect(state.cp['3']).toBe(3);
    state.cp['3'] = 5;
    expect(state.cp[3]).toBe(5);
  });

  // ── Write isolation: writing one index doesn't corrupt others ──────────

  it('write to cp[3] does not corrupt cp[0] or co[3]', () => {
    const state = new CubeState();
    state.cp[3] = 7;
    expect(state.cp[0]).toBe(0);
    expect(state.co[3]).toBe(0);
  });

  it('write to eo[5] does not corrupt ep[5] or other eo values', () => {
    const state = new CubeState();
    state.eo[5] = 1;
    expect(state.ep[5]).toBe(5);
    expect(state.eo[0]).toBe(0);
  });

  // ── Object.keys() compatibility ───────────────────────────────────────

  it('Object.keys(state.cp) returns string indices', () => {
    const state = new CubeState();
    const keys = Object.keys(state.cp);
    expect(keys).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });

  // ── Invalid value writes ───────────────────────────────────────────────

  it('cp out-of-range value is masked to 3-bit width', () => {
    const state = new CubeState();
    state.cp[0] = 9;
    // With 3-bit cp field, 9 (0b1001) is masked to 1 (0b001)
    expect(state.cp[0]).toBe(1);
    expect(state.isSolved()).toBe(false);
  });

  // ── Mutation after clone must be independent ────────────────────────────

  it('clone + direct mutation: original is unaffected', () => {
    const orig = new CubeState();
    orig.applySequence("R U");

    const cloned = orig.clone();
    cloned.cp[0] = 7;
    cloned.eo[5] = 1;

    // Original must be unchanged
    expect(orig.cp[0]).not.toBe(7);
    expect(orig.eo[5]).not.toBe(1);
  });
});
