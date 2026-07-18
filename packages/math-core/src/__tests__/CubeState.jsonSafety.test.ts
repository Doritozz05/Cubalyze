import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { Move } from '../Constants';

/**
 * Post-multi-agent-battle regression tests.
 *
 * The battle identified these critical risks:
 *   1. JSON.stringify(new CubeState()) crashing on bigint properties.
 *      Fix: added toJSON() that returns plain-array shape.
 *   2. External mutation of the MoveBitTable singleton via __getMoveBitTable
 *      would corrupt every applyMove() in the process.
 *      Fix: defensive deep-copy returned.
 *
 * These tests confirm both fixes hold.
 */

describe('CubeState — JSON.stringify safety (PASO post-battle fix #1)', () => {
  it('does NOT throw on JSON.stringify of a solved cube', () => {
    const cube = new CubeState();
    // Pre-fix this would have thrown TypeError: Do not know how to serialize a BigInt
    expect(() => JSON.stringify(cube)).not.toThrow();
  });

  it('does NOT throw on JSON.stringify of a scrambled cube', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U'");
    expect(() => JSON.stringify(cube)).not.toThrow();
  });

  it('toJSON returns plain-array shape (no bigints leaked)', () => {
    const cube = new CubeState();
    cube.applySequence("R U");

    const json = cube.toJSON();

    expect(json.cp).toBeInstanceOf(Array);
    expect(json.co).toBeInstanceOf(Array);
    expect(json.ep).toBeInstanceOf(Array);
    expect(json.eo).toBeInstanceOf(Array);

    expect(json.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7].length === 8 ? expect.any(Array) : expect.any(Array));
    expect(json.cp.length).toBe(8);
    expect(json.co.length).toBe(8);
    expect(json.ep.length).toBe(12);
    expect(json.eo.length).toBe(12);

    // No bigint in the output
    const strings = JSON.stringify(json);
    expect(strings.includes('BigInt')).toBe(false);
    expect(strings).not.toContain('_edges');
    expect(strings).not.toContain('_corners');
  });

  it('JSON.stringify result round-trips via toJSON', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U'");

    const serialized = JSON.stringify(cube);
    const parsed = JSON.parse(serialized);

    expect(parsed.cp).toEqual([...cube.cp]);
    expect(parsed.co).toEqual([...cube.co]);
    expect(parsed.ep).toEqual([...cube.ep]);
    expect(parsed.eo).toEqual([...cube.eo]);
    expect(parsed.isSolved).toBe(false);
  });

  it('JSON.stringify of solved cube is fully serializable and represents identity state', () => {
    const cube = new CubeState();
    const json = JSON.parse(JSON.stringify(cube));
    expect(json.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(json.co).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(json.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(json.eo).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(json.isSolved).toBe(true);
  });

  it('toJSON output mirrors pre-refactor Int8Array snapshot', () => {
    // The pre-refactor cube state serialized as {cp: Int8Array, co: Int8Array, ep: Int8Array, eo: Int8Array}.
    // After applying toJSON we still get cp/co/ep/eo arrays with the same numeric values.
    const cube = new CubeState();
    cube.applySequence("R U2 R' U2 R U2 R' U2");  // Sune setup-ish

    const json = cube.toJSON();

    // Array.from iterates through Proxy Adapter — should produce identical numbers to adapter read.
    for (let i = 0; i < 8; i++) {
      expect(json.cp[i]).toBe(cube.cp[i]);
      expect(json.co[i]).toBe(cube.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(json.ep[i]).toBe(cube.ep[i]);
      expect(json.eo[i]).toBe(cube.eo[i]);
    }
  });
});

describe('CubeState — __getMoveBitTable defensive copy (PASO post-battle fix #2)', () => {
  it('returned MoveBitTable is decoupled from the singleton (mutating it does not affect cube moves)', () => {
    // Capture the live U1 move table BEFORE mutation
    const liveBefore = CubeState.__getMoveBitTableLive(Move.U1);
    const cornersSrcBefore = liveBefore.cornersSrc[0];
    const cornersTwistBefore = liveBefore.cornersTwist[0];

    // Get a defensive copy and mutate it aggressively
    const copy = CubeState.__getMoveBitTable(Move.U1);
    copy.cornersSrc[0] = 99;
    copy.cornersTwist[0] = 99;
    copy.edgesSrc[0] = 99;
    copy.edgesFlip[0] = 99;

    // The singleton must NOT have changed
    const liveAfter = CubeState.__getMoveBitTableLive(Move.U1);
    expect(liveAfter.cornersSrc[0]).toBe(cornersSrcBefore);
    expect(liveAfter.cornersTwist[0]).toBe(cornersTwistBefore);

    // And applying U1 to a fresh solved cube must produce the correct (U-cycled) corner positions
    const cube = new CubeState();
    cube.applyMove(Move.U1);
    expect(cube.cp[0]).toBe(3); // UBR → URF (well, the inverse: UBR piece at position 0)
    expect(cube.cp[1]).toBe(0);
  });

  it('each call to __getMoveBitTable returns a fresh copy (no aliasing)', () => {
    const a = CubeState.__getMoveBitTable(Move.R1);
    const b = CubeState.__getMoveBitTable(Move.R1);
    expect(a).not.toBe(b);
    expect(a.cornersSrc).not.toBe(b.cornersSrc);
    expect(a.cornersTwist).not.toBe(b.cornersTwist);
  });

  it('10000 applyMove cycles still produce correct state after defensive-copy stress', () => {
    // Warm-up
    CubeState.initTables();

    // Grab and corrupt one defensive copy
    const corrupt = CubeState.__getMoveBitTable(Move.R1);
    corrupt.cornersSrc[0] = 99;
    corrupt.cornersTwist[0] = 99;

    // Run a long scramble — every R1 should produce correct results
    const cube = new CubeState();
    for (let i = 0; i < 10000; i++) {
      cube.applyMove(Move.R1);
    }

    // After 10000 R1 moves = 10000 mod 4 = 0 (full cycle), cube is solved.
    expect(cube.isSolved()).toBe(true);
  });
});
