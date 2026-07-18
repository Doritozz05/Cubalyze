import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * Clone Tests — Safety Net for Binary Refactoring
 *
 * Verifies that clone() produces an independent copy and that
 * modifications to the clone/original do not affect each other.
 */

describe('CubeState — Clone', () => {
  it('clone of solved cube is solved', () => {
    const original = new CubeState();
    const cloned = original.clone();

    expect(cloned.isSolved()).toBe(true);
    expect(original.isSolved()).toBe(true);
  });

  it('clone produces a different object (not same reference)', () => {
    const original = new CubeState();
    const cloned = original.clone();

    // They should be different objects
    expect(cloned).not.toBe(original);
  });

  it('clone has identical cp/co/ep/eo to original', () => {
    const original = new CubeState();
    original.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");

    const cloned = original.clone();

    for (let i = 0; i < 8; i++) {
      expect(cloned.cp[i]).toBe(original.cp[i]);
      expect(cloned.co[i]).toBe(original.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(cloned.ep[i]).toBe(original.ep[i]);
      expect(cloned.eo[i]).toBe(original.eo[i]);
    }
  });

  it('modifying original does NOT affect clone', () => {
    const original = new CubeState();
    original.applySequence("R U R' U'");

    const cloned = original.clone();

    // Capture clone's state BEFORE modifying original
    const clonedCp = Array.from(cloned.cp);
    const clonedCo = Array.from(cloned.co);
    const clonedEp = Array.from(cloned.ep);
    const clonedEo = Array.from(cloned.eo);

    // Modify original
    original.applySequence("F R U R' U' F'");

    // Clone must STILL have the original values
    for (let i = 0; i < 8; i++) {
      expect(cloned.cp[i]).toBe(clonedCp[i]);
      expect(cloned.co[i]).toBe(clonedCo[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(cloned.ep[i]).toBe(clonedEp[i]);
      expect(cloned.eo[i]).toBe(clonedEo[i]);
    }
  });

  it('modifying clone does NOT affect original', () => {
    const original = new CubeState();
    original.applySequence("R U R' U'");

    // Capture original's state
    const originalCp = Array.from(original.cp);
    const originalCo = Array.from(original.co);
    const originalEp = Array.from(original.ep);
    const originalEo = Array.from(original.eo);

    // Clone and modify clone
    const cloned = original.clone();
    cloned.applySequence("F R U R' U' F'");

    // Original must STILL have the original values
    for (let i = 0; i < 8; i++) {
      expect(original.cp[i]).toBe(originalCp[i]);
      expect(original.co[i]).toBe(originalCo[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(original.ep[i]).toBe(originalEp[i]);
      expect(original.eo[i]).toBe(originalEo[i]);
    }
  });

  it('clone after 100 random moves is identical to original', () => {
    const moves = [
      "U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2",
      "D", "D'", "D2", "L", "L'", "L2", "B", "B'", "B2",
    ];

    // Build a random sequence
    const seq: string[] = [];
    for (let i = 0; i < 100; i++) {
      seq.push(moves[Math.floor(Math.random() * moves.length)]);
    }

    const original = new CubeState();
    for (const move of seq) {
      original.applySequence(move);
    }

    const cloned = original.clone();

    // Compare all fields
    for (let i = 0; i < 8; i++) {
      expect(cloned.cp[i]).toBe(original.cp[i]);
      expect(cloned.co[i]).toBe(original.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(cloned.ep[i]).toBe(original.ep[i]);
      expect(cloned.eo[i]).toBe(original.eo[i]);
    }

    expect(cloned.isSolved()).toBe(original.isSolved());
  });

  it('clone chain: clone of clone of clone preserves independence', () => {
    const original = new CubeState();
    original.applySequence("R U");

    const clone1 = original.clone();
    const clone2 = clone1.clone();
    const clone3 = clone2.clone();

    // Modify original
    original.applySequence("F R U R' U' F'");

    // Clone3 should still match clone1's original state (which was R U)
    expect(clone3.isSolved()).toBe(false);

    // Modify clone2
    clone2.applySequence("R U R' U'");

    // Clone1 should be unaffected
    for (let i = 0; i < 8; i++) {
      expect(clone1.cp[i]).toBe(clone3.cp[i]);
      expect(clone1.co[i]).toBe(clone3.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      expect(clone1.ep[i]).toBe(clone3.ep[i]);
      expect(clone1.eo[i]).toBe(clone3.eo[i]);
    }
  });
});
