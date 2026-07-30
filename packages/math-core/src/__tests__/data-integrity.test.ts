/**
 * Nivel 3 — Data Integrity / Round-Trip Tests
 *
 * Verifies that data survives serialization → deserialization without
 * loss of information. Critical for database persistence and JSON
 * import/export.
 */
import { describe, it, expect } from 'vitest';
import {
  CubeState,
  Cube2x2State,
  FaceletStringConverter,
  Cube2x2FaceletConverter,
} from '../index';

// ────────────────────────────────────────────────────────────────────────
//  D1: CubeState → toFaceletString → fromFaceletString → toFaceletString
// ────────────────────────────────────────────────────────────────────────

describe('D1 — CubeState facelet string round-trip', () => {
  it('solved state round-trip produces identical facelet string', () => {
    const state = new CubeState();
    const f1 = FaceletStringConverter.toFaceletString(state);

    const restored = FaceletStringConverter.fromFaceletString(f1);
    const f2 = FaceletStringConverter.toFaceletString(restored);

    expect(f2).toBe(f1);
    expect(f1).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });

  it('scrambled state round-trip produces identical facelet string', () => {
    const state = new CubeState();
    state.applySequence("R U R' U' F2 L B D' R'");
    const f1 = FaceletStringConverter.toFaceletString(state);

    const restored = FaceletStringConverter.fromFaceletString(f1);
    const f2 = FaceletStringConverter.toFaceletString(restored);

    // The restored state may not be identical to the original
    // (different CP/CO/EP/EO combinations can produce the same facelets),
    // but the facelet string round-trip should be stable:
    // fromFaceletString(toFaceletString(X)) → toFaceletString should = toFaceletString(X)
    expect(f2).toBe(f1);
  });

  it('fromFaceletString rejects strings with wrong length', () => {
    expect(() => FaceletStringConverter.fromFaceletString('UU')).toThrow('Invalid facelet string length');
    expect(() => FaceletStringConverter.fromFaceletString('X'.repeat(54))).toThrow('Invalid corner at position');
  });

  it('fromFaceletString on solved facelets produces solved state', () => {
    const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
    const state = FaceletStringConverter.fromFaceletString(solved);
    expect(state.isSolved()).toBe(true);
  });

  it('multiple random states survive round-trip', () => {
    const scrambles = [
      "U R F D L B",
      "R2 U2 F' B L D' R U",
      "D L B' R F U' D2 R2",
      "F R U R' U' F'",
      "R U R' U R U2 R'", // Sune
    ];

    for (const scramble of scrambles) {
      const state = new CubeState();
      state.applySequence(scramble);
      const f1 = FaceletStringConverter.toFaceletString(state);

      const restored = FaceletStringConverter.fromFaceletString(f1);
      const f2 = FaceletStringConverter.toFaceletString(restored);

      expect(f2).toBe(f1);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
//  D2: Cube2x2State → toFaceletString → fromFaceletString → toFaceletString
// ────────────────────────────────────────────────────────────────────────

describe('D2 — Cube2x2State facelet string round-trip', () => {
  it('solved 2×2 state round-trip produces identical facelet string', () => {
    const state = new Cube2x2State();
    const f1 = Cube2x2FaceletConverter.toFaceletString(state);

    const restored = Cube2x2FaceletConverter.fromFaceletString(f1);
    const f2 = Cube2x2FaceletConverter.toFaceletString(restored);

    expect(f2).toBe(f1);
    expect(f1.length).toBe(24);
  });

  it('scrambled 2×2 state round-trip produces identical facelet string', () => {
    const state = new Cube2x2State();
    state.applySequence("U R F U2 R' F2");
    const f1 = Cube2x2FaceletConverter.toFaceletString(state);

    const restored = Cube2x2FaceletConverter.fromFaceletString(f1);
    const f2 = Cube2x2FaceletConverter.toFaceletString(restored);

    expect(f2).toBe(f1);
  });

  it('fromFaceletString on solved 2×2 facelets produces solved state', () => {
    // 4 of each color in standard order: UUUU RRRR FFFF DDDD LLLL BBBB
    const solved = 'UUUURRRRFFFFDDDDLLLLBBBB';
    const state = Cube2x2FaceletConverter.fromFaceletString(solved);
    expect(state.isSolved()).toBe(true);
  });

  it('fromFaceletString rejects wrong length', () => {
    expect(() => Cube2x2FaceletConverter.fromFaceletString('UU')).toThrow('24');
  });

  it('multiple 2×2 scrambles survive round-trip', () => {
    const scrambles = [
      "U R F",
      "R2 U' F",
      "U R U' R' F2",
      "R U2 R' U' R U' R'",
    ];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);
      const f1 = Cube2x2FaceletConverter.toFaceletString(state);

      const restored = Cube2x2FaceletConverter.fromFaceletString(f1);
      const f2 = Cube2x2FaceletConverter.toFaceletString(restored);

      expect(f2).toBe(f1);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
//  D3: CubeState → toJSON → reconstruct
// ────────────────────────────────────────────────────────────────────────

describe('D3 — CubeState toJSON round-trip', () => {
  it('solved state survives toJSON round-trip', () => {
    const state = new CubeState();
    const json = state.toJSON();

    expect(json.isSolved).toBe(true);
    expect(json.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(json.co).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(json.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(json.eo).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Reconstruct from JSON
    const restored = new CubeState(json.cp, json.co, json.ep, json.eo);
    expect(restored.isSolved()).toBe(true);
  });

  it('scrambled state survives toJSON round-trip', () => {
    const state = new CubeState();
    state.applySequence("R U R' U' F2");
    const json = state.toJSON();

    const restored = new CubeState(json.cp, json.co, json.ep, json.eo);
    expect(restored.isSolved()).toBe(json.isSolved);

    // Facelet strings should match
    const f1 = FaceletStringConverter.toFaceletString(state);
    const f2 = FaceletStringConverter.toFaceletString(restored);
    expect(f2).toBe(f1);
  });

  it('toJSON handles bigint internal state correctly (no TypeError)', () => {
    const state = new CubeState();
    state.applySequence("U R F D L B");

    // JSON.stringify must NOT throw "Do not know how to serialize a BigInt"
    expect(() => JSON.stringify(state)).not.toThrow();

    const result = JSON.parse(JSON.stringify(state));
    expect(result.cp).toHaveLength(8);
    expect(result.co).toHaveLength(8);
    expect(result.ep).toHaveLength(12);
    expect(result.eo).toHaveLength(12);
  });
});

// ────────────────────────────────────────────────────────────────────────
//  D5: CubeMoveEvent[] → JSON.stringify → JSON.parse
// ────────────────────────────────────────────────────────────────────────

describe('D5 — CubeMoveEvent[] JSON round-trip', () => {
  it('array of move events survives JSON round-trip', () => {
    const moves = [
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: 100, hostTimestamp: 200 },
      { face: 'R' as const, direction: -1 as const, cubeTimestamp: 300, hostTimestamp: 400 },
      { face: 'F' as const, direction: 2 as const, cubeTimestamp: 500, hostTimestamp: 600 },
    ];

    const json = JSON.stringify(moves);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].face).toBe('U');
    expect(parsed[0].direction).toBe(1);
    expect(parsed[0].cubeTimestamp).toBe(100);
    expect(parsed[0].hostTimestamp).toBe(200);
    expect(parsed[1].face).toBe('R');
    expect(parsed[2].direction).toBe(2);
  });

  it('empty array survives JSON round-trip', () => {
    const json = JSON.stringify([]);
    expect(JSON.parse(json)).toEqual([]);
  });

  it('array with many moves survives', () => {
    const faces: Array<'U' | 'R' | 'F' | 'D' | 'L' | 'B'> = ['U', 'R', 'F', 'D', 'L', 'B'];
    const directions: Array<1 | -1 | 2> = [1, -1, 2];
    const moves = [];

    for (let i = 0; i < 100; i++) {
      moves.push({
        face: faces[i % 6],
        direction: directions[i % 3],
        cubeTimestamp: i * 10,
        hostTimestamp: i * 10 + 5,
      });
    }

    const json = JSON.stringify(moves);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(100);
    expect(parsed[99].cubeTimestamp).toBe(990);
  });

  it('moves with null cubeTimestamp survive JSON round-trip', () => {
    const moves = [
      { face: 'U' as const, direction: 1 as const, cubeTimestamp: null as unknown as number, hostTimestamp: 200 },
    ];

    const json = JSON.stringify(moves);
    const parsed = JSON.parse(json);
    expect(parsed[0].cubeTimestamp).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────
//  D6: Cube2x2State binary representation integrity
// ────────────────────────────────────────────────────────────────────────

describe('D6 — Cube2x2State clone + structural integrity', () => {
  it('clone produces identical cp and co', () => {
    const state = new Cube2x2State();
    state.applySequence("U R F U2 R'");

    const clone = state.clone();
    for (let i = 0; i < 8; i++) {
      expect(clone.cp[i]).toBe(state.cp[i]);
      expect(clone.co[i]).toBe(state.co[i]);
    }
  });

  it('clone is independent (mutations on clone do not affect original)', () => {
    const state = new Cube2x2State();
    const clone = state.clone();

    clone.applySequence("U R F");
    expect(clone.isSolved()).toBe(false);
    expect(state.isSolved()).toBe(true);
  });

  it('reset restores solved state', () => {
    const state = new Cube2x2State();
    state.applySequence("U R F U2 R'");
    expect(state.isSolved()).toBe(false);

    state.reset();
    expect(state.isSolved()).toBe(true);
  });

  it('invertNotation followed by applySequence yields solved', () => {
    const scrambles = [
      'U', 'R', 'F',
      'U2 R', "F' U",
      'U R F', "R2 U' F",
      "U R U' R'",
    ];

    for (const scramble of scrambles) {
      const state = new Cube2x2State();
      state.applySequence(scramble);

      const inverse = Cube2x2State.invertNotation(scramble);
      state.applySequence(inverse);

      expect(state.isSolved()).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
//  D4: OrientationTimeline → JSON.stringify → JSON.parse
// ────────────────────────────────────────────────────────────────────────

describe('D4 — OrientationTimeline JSON round-trip', () => {
  it('compact orientation timeline (moveIndex, orientationIndex tuples) survives JSON RT', () => {
    // Standard format: array of [moveIndex, orientationIndex] tuples
    const timeline = [
      [0, 0],
      [5, 3],
      [12, 7],
      [20, 15],
      [30, 23],
    ];

    const json = JSON.stringify(timeline);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(5);
    expect(parsed[0]).toEqual([0, 0]);
    expect(parsed[4]).toEqual([30, 23]);
    expect(parsed[2][0]).toBe(12);
    expect(parsed[2][1]).toBe(7);
  });

  it('empty orientation timeline survives JSON RT', () => {
    const timeline: [number, number][] = [];
    const json = JSON.stringify(timeline);
    expect(JSON.parse(json)).toEqual([]);
  });

  it('single-keyframe timeline survives JSON RT', () => {
    const timeline: [number, number][] = [[0, 0]];
    const json = JSON.stringify(timeline);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([[0, 0]]);
  });

  it('timeline with all 24 orientation indices survives JSON RT', () => {
    const timeline: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      timeline.push([i * 2, i]);
    }

    const json = JSON.stringify(timeline);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(24);
    expect(parsed[23][1]).toBe(23);
    expect(parsed[0][0]).toBe(0);
  });

  it('timeline handles large move indices', () => {
    const timeline: [number, number][] = [[999999, 23]];
    const json = JSON.stringify(timeline);
    const parsed = JSON.parse(json);
    expect(parsed[0][0]).toBe(999999);
    expect(parsed[0][1]).toBe(23);
  });

  it('orientationTimeline as undefined (no gyro solve) survives', () => {
    const solveData = {
      id: 's1',
      sessionId: 'ses1',
      timeMs: 5000,
      moves: [] as { face: string; direction: number; cubeTimestamp: number; hostTimestamp: number }[],
      orientationTimeline: undefined,
    };

    const json = JSON.stringify(solveData);
    const parsed = JSON.parse(json);
    expect(parsed.orientationTimeline).toBeUndefined();
  });
});

describe('Move2x2 notation round-trip', () => {
  it('each Move2x2 value maps to a valid notation and back', () => {
    // Test all 18 moves
    for (let m = 0; m < 18; m++) {
      const notation = Cube2x2State.moveToNotation(m as import('../Cube2x2State').Move2x2);
      expect(notation).toBeTruthy();

      const state = new Cube2x2State();
      state.applySequence(notation);
      // Should not throw
    }
  });

  it('invertNotation produces valid inverse sequence', () => {
    const state = new Cube2x2State();
    state.applySequence("U");

    const inverse = Cube2x2State.invertNotation("U");
    expect(inverse).toBe("U'");

    state.applySequence(inverse);
    expect(state.isSolved()).toBe(true);
  });
});
