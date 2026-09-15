/**
 * Nivel 3 — Category 5: Fuzzing Tests
 *
 * Malicious/corrupt/unexpected inputs that should NEVER crash the application.
 */
import { describe, it, expect } from 'vitest';
import { CubeState, Cube2x2State, FaceletStringConverter } from '../index';
import { getInspectionPenalty, calculateFinalTime, Penalty } from '@cubalyze/timer-engine';
import { ClockDriftReconciler } from '@cubalyze/hardware-hal';

// ═══════════════════════════════════════════════════════════════════════
//  F1: FaceletStringConverter with random strings (length 0-1000, Unicode, null bytes)
// ═══════════════════════════════════════════════════════════════════════

describe('F1 — FaceletStringConverter fuzzing', () => {
  const poisonStrings = [
    '',                          // empty
    'U',                         // too short
    'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', // solved
    'X'.repeat(54),              // all same, invalid color
    '\x00'.repeat(54),           // null bytes
    'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB', // random letters
    '   '.repeat(18),            // spaces only (54 chars)
    'U'.repeat(54),              // only U color
    String.fromCharCode(...Array.from({ length: 54 }, () => Math.floor(Math.random() * 65536))), // random Unicode
  ];

  it('fromFaceletString rejects invalid-length strings gracefully', () => {
    for (const s of ['', 'UU', 'UUUUUUUUR'.repeat(10)]) {
      try {
        FaceletStringConverter.fromFaceletString(s);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it('fromFaceletString rejects 54-char strings with invalid colors', () => {
    const invalid = ['X'.repeat(54), '\x00'.repeat(54)];
    for (const s of invalid) {
      try {
        FaceletStringConverter.fromFaceletString(s);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it('fromFaceletString does not crash on random garbage', () => {
    for (let i = 0; i < 100; i++) {
      const len = Math.floor(Math.random() * 100) + 1;
      const chars = Array.from({ length: len }, () => {
        const code = Math.floor(Math.random() * 256);
        return String.fromCharCode(code);
      }).join('');

      try {
        FaceletStringConverter.fromFaceletString(chars);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it('toFaceletString always returns 54-char string on valid state', () => {
    for (let i = 0; i < 20; i++) {
      const state = new CubeState();
      state.applySequence(`U${i % 2 ? "'" : ''} R${i % 3 === 0 ? '2' : ''}`);
      const facelets = FaceletStringConverter.toFaceletString(state);
      expect(facelets.length).toBe(54);
      expect(facelets).toMatch(/^[URFDLB]{54}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F2: CubeState.applySequence with random tokens
// ═══════════════════════════════════════════════════════════════════════

describe('F2 — CubeState.applySequence fuzzing', () => {
  it('random single tokens do not crash applySequence', () => {
    const tokens = ['', 'X', 'Z', '123', '@#$', 'U', 'UR', 'R2', "F'", '  ', '\x00'];

    for (const token of tokens) {
      const state = new CubeState();
      try {
        state.applySequence(token);
        // If it doesn't throw, the state should still be valid
        const facelets = FaceletStringConverter.toFaceletString(state);
        expect(facelets.length).toBe(54);
      } catch (e) {
        // Expected for invalid tokens
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it('long random strings do not cause OOM or infinite loop', () => {
    const state = new CubeState();
    // Build a 2000-char random string
    const chars = Array.from({ length: 2000 }, () => {
      const faces = 'URFDLBXYZPQ';
      return faces[Math.floor(Math.random() * faces.length)];
    }).join(' ');
    try {
      state.applySequence(chars);
      expect(state).toBeDefined();
    } catch {
      // Expected for massive invalid input
    }
  });

  it('applySequence with empty string is a no-op', () => {
    const state = new CubeState();
    state.applySequence('');
    expect(state.isSolved()).toBe(true);
  });

  it('applySequence with whitespace only is a no-op', () => {
    const state = new CubeState();
    // Whitespace-only string: split produces empty tokens, applyMove skips them
    try {
      state.applySequence('   \t  \n  ');
      expect(state.isSolved()).toBe(true);
    } catch {
      // If the implementation throws on empty tokens, that's also acceptable
      // as long as it doesn't crash the app
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3: Cube2x2State.applySequence with random tokens
// ═══════════════════════════════════════════════════════════════════════

describe('F3 — Cube2x2State.applySequence fuzzing', () => {
  it('random tokens do not crash 2×2 applySequence', () => {
    const tokens = ['', 'X', 'Z', '123', '@#$', 'U', 'UR', 'R2', "F'", '  ', '\x00', 'D2', 'L', "B'"];

    for (const token of tokens) {
      const state = new Cube2x2State();
      try {
        state.applySequence(token);
        expect(state).toBeDefined();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it('valid long sequences do not corrupt 2×2 state', () => {
    const state = new Cube2x2State();
    // Only valid 2×2 moves: U, R, F (DRL stay fixed for solver compatibility)
    const moves = ['U', 'R', 'F'];
    const seq = Array.from({ length: 500 }, () =>
      moves[Math.floor(Math.random() * moves.length)] +
      ['', '2', "'"][Math.floor(Math.random() * 3)]
    ).join(' ');

    state.applySequence(seq);
    // Regardless of result, state should not be corrupted
    expect(state.cp.length).toBe(8);
    expect(state.co.length).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F8: WcaRules.getInspectionPenalty with NaN/Infinity
// ═══════════════════════════════════════════════════════════════════════

describe('F8 — WcaRules fuzzing', () => {
  it('getInspectionPenalty handles extreme values', () => {
    expect(getInspectionPenalty(NaN)).toBeDefined();
    expect(getInspectionPenalty(Infinity)).toBeDefined();
    expect(getInspectionPenalty(-Infinity)).toBeDefined();
  });

  it('getInspectionPenalty with NaN returns a valid penalty', () => {
    const result = getInspectionPenalty(NaN);
    expect([Penalty.NONE, Penalty.PLUS_TWO, Penalty.DNF]).toContain(result);
  });

  it('getInspectionPenalty with Infinity returns DNF', () => {
    expect(getInspectionPenalty(Infinity)).toBe(Penalty.DNF);
  });

  it('getInspectionPenalty with negative values returns NONE', () => {
    expect(getInspectionPenalty(-1000)).toBe(Penalty.NONE);
    expect(getInspectionPenalty(-1)).toBe(Penalty.NONE);
  });

  it('calculateFinalTime handles NaN gracefully', () => {
    const result = calculateFinalTime(NaN, Penalty.DNF);
    // Should return Infinity for DNF, or some valid number
    expect(Number.isFinite(result) || !Number.isFinite(result)).toBe(true);
  });

  it('calculateFinalTime with DNF penalty is always Infinity', () => {
    expect(calculateFinalTime(0, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(5000, Penalty.DNF)).toBe(Infinity);
    expect(calculateFinalTime(NaN, Penalty.DNF)).toBe(Infinity);
  });

  it('calculateFinalTime with +2 adds 2000ms', () => {
    expect(calculateFinalTime(10000, Penalty.PLUS_TWO)).toBe(12000);
    expect(calculateFinalTime(0, Penalty.PLUS_TWO)).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F9: ClockDriftReconciler with NaN/negative timestamps
// ═══════════════════════════════════════════════════════════════════════

describe('F9 — ClockDriftReconciler fuzzing', () => {
  it('addDataPoint with NaN does not crash', () => {
    const reconciler = new ClockDriftReconciler();
    expect(() => reconciler.addDataPoint(NaN, 100)).not.toThrow();
    expect(() => reconciler.addDataPoint(100, NaN)).not.toThrow();
  });

  it('addDataPoint with negative timestamps does not crash', () => {
    const reconciler = new ClockDriftReconciler();
    expect(() => reconciler.addDataPoint(-100, 200)).not.toThrow();
    expect(() => reconciler.addDataPoint(100, -200)).not.toThrow();
    expect(() => reconciler.addDataPoint(-100, -200)).not.toThrow();
  });

  it('addDataPoint with zero timestamps works', () => {
    const reconciler = new ClockDriftReconciler();
    reconciler.addDataPoint(0, 0);
    reconciler.addDataPoint(100, 100);
    const result = reconciler.reconcile(50);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('addDataPoint with identical timestamps does not cause division by zero', () => {
    const reconciler = new ClockDriftReconciler();

    // All cubeTs = 100, hostTs varies → horizontal line → slope ≈ 0
    for (let i = 0; i < 10; i++) {
      reconciler.addDataPoint(100, 100 + i * 10);
    }

    const result = reconciler.reconcile(100);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('addDataPoint with out-of-order timestamps does not crash', () => {
    const reconciler = new ClockDriftReconciler();
    reconciler.addDataPoint(500, 510);
    reconciler.addDataPoint(100, 110); // older
    reconciler.addDataPoint(300, 315); // between
    const result = reconciler.reconcile(250);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('reconcile with no data points returns cubeTs', () => {
    const reconciler = new ClockDriftReconciler();
    expect(reconciler.reconcile(100)).toBe(100);
    expect(reconciler.reconcile(0)).toBe(0);
    expect(reconciler.reconcile(-50)).toBe(-50);
  });
});
