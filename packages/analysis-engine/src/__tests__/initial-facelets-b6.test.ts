import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import {
  CubeState,
  FaceletStringConverter,
  CFOPDefinition,
} from '@cubeforge/math-core';
import { makeMoves, makeSolveFromScramble } from './test-helpers';

/**
 * B6 REGRESSION TESTS — deterministic phase detection from real cube facelets.
 *
 * Background:
 *   Before B6, TimelineBuilder started the reconstructed cube state from the
 *   `scramble` string. This worked when Scramble Verification was ON (the
 *   validator ensures the cube matches the displayed scramble) but was
 *   UNRELIABLE when verification was OFF (Modes 3 & 4): the displayed/persisted
 *   scramble may differ from the cube's actual state (e.g. the user scrambled
 *   by hand, or a reconnection lost a move), so the reconstructed state
 *   diverged from reality and NO phase mask ever matched → "CFOP all 0.00".
 *
 * B6 fix:
 *   TimelineBuilder.build now accepts an optional `initialFacelets` (54-char
 *   Kociemba string from the Smart Cube's FACELETS event). When provided and
 *   not a stale "solved" state, it is used as ground truth INSTEAD of the
 *   scramble. This mirrors how Cubeast/csTimer handle offline solves: the
 *   initial state comes from the cube, not from an assumed scramble.
 *
 * These tests guard:
 *   1. FaceletStringConverter.fromFaceletString round-trips correctly.
 *   2. TimelineBuilder uses initialFacelets when provided (and it differs
 *      from the scramble-based state when the scramble is wrong).
 *   3. The "stale solved facelets + scramble provided" fallback works.
 *   4. Phase detection succeeds from real facelets even with a WRONG scramble.
 */

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('B6: FaceletStringConverter.fromFaceletString', () => {
  it('round-trips the solved state', () => {
    const solved = new CubeState();
    const facelets = FaceletStringConverter.toFaceletString(solved);
    const reconstructed = FaceletStringConverter.fromFaceletString(facelets);
    expect(reconstructed.isSolved()).toBe(true);
    expect(Array.from(reconstructed.cp)).toEqual(Array.from(solved.cp));
    expect(Array.from(reconstructed.co)).toEqual(Array.from(solved.co));
    expect(Array.from(reconstructed.ep)).toEqual(Array.from(solved.ep));
    expect(Array.from(reconstructed.eo)).toEqual(Array.from(solved.eo));
  });

  it('round-trips a scrambled state', () => {
    const state = new CubeState();
    state.applySequence("R U R' U' R' F R2 U' R' U' R U R' F'");
    const facelets = FaceletStringConverter.toFaceletString(state);
    const reconstructed = FaceletStringConverter.fromFaceletString(facelets);
    expect(Array.from(reconstructed.cp)).toEqual(Array.from(state.cp));
    expect(Array.from(reconstructed.co)).toEqual(Array.from(state.co));
    expect(Array.from(reconstructed.ep)).toEqual(Array.from(state.ep));
    expect(Array.from(reconstructed.eo)).toEqual(Array.from(state.eo));
    expect(facelets).not.toBe(SOLVED);
  });

  it('round-trips a state with edge flips and corner twists', () => {
    const state = new CubeState();
    state.applySequence("F B L R U D F' B'");
    const facelets = FaceletStringConverter.toFaceletString(state);
    const reconstructed = FaceletStringConverter.fromFaceletString(facelets);
    expect(Array.from(reconstructed.cp)).toEqual(Array.from(state.cp));
    expect(Array.from(reconstructed.co)).toEqual(Array.from(state.co));
    expect(Array.from(reconstructed.ep)).toEqual(Array.from(state.ep));
    expect(Array.from(reconstructed.eo)).toEqual(Array.from(state.eo));
  });

  it('throws on invalid length', () => {
    expect(() => FaceletStringConverter.fromFaceletString('UUUU')).toThrow(
      /Invalid facelet string length/,
    );
  });
});

describe('B6: TimelineBuilder initialFacelets (ground truth)', () => {
  it('uses initialFacelets instead of scramble when provided', () => {
    // Real scramble and its solve
    const realScramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(realScramble);

    // Compute the REAL initial facelets (what the cube actually shows)
    const realState = new CubeState();
    realState.applySequence(realScramble);
    const realFacelets = FaceletStringConverter.toFaceletString(realState);

    // A WRONG scramble (what might be displayed/persisted if verification is off)
    const wrongScramble = "F R U R' U' F'";

    // Build with initialFacelets + WRONG scramble → should use facelets
    const tl = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      wrongScramble,
      realFacelets,
    );

    // Build with only the correct scramble (no facelets) → reference
    const tlRef = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      realScramble,
    );

    // The first entry's state from the facelets-seeded timeline should
    // match the correct-scramble timeline, NOT the wrong-scramble one.
    const firstFromFacelets = TimelineBuilder.fromSnapshot(tl.entries[0].state);
    const firstFromCorrect = TimelineBuilder.fromSnapshot(tlRef.entries[0].state);

    expect(Array.from(firstFromFacelets.cp)).toEqual(
      Array.from(firstFromCorrect.cp),
    );
    expect(Array.from(firstFromFacelets.ep)).toEqual(
      Array.from(firstFromCorrect.ep),
    );

    // And it should NOT match the wrong-scramble state
    const wrongState = new CubeState();
    wrongState.applySequence(wrongScramble);
    expect(Array.from(firstFromFacelets.cp)).not.toEqual(
      Array.from(wrongState.cp),
    );
  });

  it('reaches solved state from real facelets even with a wrong scramble', () => {
    const realScramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(realScramble);

    const realState = new CubeState();
    realState.applySequence(realScramble);
    const realFacelets = FaceletStringConverter.toFaceletString(realState);

    const wrongScramble = "F R U R' U' F'";

    const tl = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      wrongScramble,
      realFacelets,
    );

    const finalState = TimelineBuilder.fromSnapshot(
      tl.entries[tl.entries.length - 1].state,
    );
    expect(finalState.isSolved()).toBe(true);
  });

  it('detects phases from real facelets even with a wrong scramble', () => {
    // A longer scramble ensures the wrong-scramble reconstruction diverges
    // enough that no phase mask matches (phases = []), while the real-facelets
    // path still detects phases. Short scrambles can coincidentally match.
    const realScramble = "R' U' F D2 L2 D' R2 U' B2 D' L2 B2 L' D B D2 B R' D L2 R' U' F";
    const { solveMoves } = makeSolveFromScramble(realScramble);

    const realState = new CubeState();
    realState.applySequence(realScramble);
    const realFacelets = FaceletStringConverter.toFaceletString(realState);

    // A completely different scramble → the reconstruction from the wrong
    // scramble will be far from reality → no phase mask matches.
    const wrongScramble = "F2 L2 B2 U B2 D2 B2 R2 U R2 D' B F D' L' U' F2 L'";

    // WITH B6: real facelets + wrong scramble → reaches solved, phases detected
    const tlFixed = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      wrongScramble,
      realFacelets,
    );
    PhaseSplitter.splitAndAnnotate(tlFixed, CFOPDefinition, {
      colorNeutral: true,
    });

    // WITHOUT B6: only wrong scramble → reconstruction wrong
    const tlBroken = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      wrongScramble,
    );
    PhaseSplitter.splitAndAnnotate(tlBroken, CFOPDefinition, {
      colorNeutral: true,
    });

    // The fix reaches solved and detects phases; the broken path does not.
    const fixedFinal = TimelineBuilder.fromSnapshot(
      tlFixed.entries[tlFixed.entries.length - 1].state,
    );
    const brokenFinal = TimelineBuilder.fromSnapshot(
      tlBroken.entries[tlBroken.entries.length - 1].state,
    );
    expect(fixedFinal.isSolved()).toBe(true);
    expect(brokenFinal.isSolved()).toBe(false);
    expect(tlFixed.phases.length).toBeGreaterThanOrEqual(1);
    expect(tlFixed.phases.length).toBeGreaterThan(tlBroken.phases.length);
  });

  it('falls back to scramble when facelets are solved and scramble is provided', () => {
    // Edge case: a stale solved facelets event arrives (e.g. before the
    // scramble was applied). When a scramble IS provided, we should prefer
    // the scramble (more reliable in that case), not the solved facelets.
    const scramble = "R U R' U'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const tl = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      scramble,
      SOLVED, // stale solved facelets
    );

    // First entry should reflect the SCRAMBLED state, not solved
    const firstState = TimelineBuilder.fromSnapshot(tl.entries[0].state);
    expect(firstState.isSolved()).toBe(false);

    // And the solve should still reach solved at the end
    const finalState = TimelineBuilder.fromSnapshot(
      tl.entries[tl.entries.length - 1].state,
    );
    expect(finalState.isSolved()).toBe(true);
  });

  it('uses solved facelets when no scramble is provided (Mode 4)', () => {
    // Mode 4: no scramble, no verification. If the cube reports solved
    // facelets (e.g. the user didn't scramble), the timeline starts solved
    // and the solve moves are applied from there. This is the rare no-op case.
    const moves = makeMoves("R U R' U'");
    const tl = TimelineBuilder.build(
      moves,
      'CFOP',
      undefined,
      undefined,
      SOLVED,
    );

    const firstState = TimelineBuilder.fromSnapshot(tl.entries[0].state);
    // First move R applied to solved → not solved
    expect(firstState.isSolved()).toBe(false);
  });
});
