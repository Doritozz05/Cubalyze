import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../../timeline/TimelineBuilder';
import { PhaseSplitter } from '../../phases/PhaseSplitter';
import { CFOPDefinition, CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { makeSolveFromScramble } from '../test-helpers';
import { recognizeSolve } from '../../recognition/solveRecognition';

/**
 * Bridge tests: TimelineBuilder → PhaseSplitter → recognizeSolve.
 *
 * The metrics pipeline (TimelineBuilder → PhaseSplitter → MetricsAggregator)
 * computes TIMINGS; recognizeSolve adds CASE RECOGNITION on the SAME phases
 * and scramble, so both views are consistent and no metrics functionality is
 * lost (the bridge is a pure companion, not a replacement). The deep case
 * matching itself is verified by algorithm-db's oracle tests; here we verify
 * the integration contract.
 */
describe('solveRecognition — bridge to the formal recognition pipeline', () => {
  it('returns a well-formed recognition for a coherent CFOP solve', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    const recognition = recognizeSolve(timeline, scramble);

    // A solved-back stream must be recognized as solved
    expect(recognition).not.toBeNull();
    expect(recognition!.finalSolved).toBe(true);

    // Structural invariants — every field is present and typed
    expect(typeof recognition!.finalRotation === 'string' || recognition!.finalRotation === null).toBe(true);
    expect(recognition!.inspection).toBeTypeOf('string');
    expect(recognition!.crossVerified).toBeTypeOf('boolean');
    expect(Array.isArray(recognition!.pairs)).toBe(true);
    for (const pair of recognition!.pairs) {
      expect(typeof pair.pairNumber).toBe('number');
      expect(['FR', 'FL', 'BL', 'BR', null]).toContain(pair.slot);
      expect(pair.caseNumber === null || typeof pair.caseNumber === 'string').toBe(true);
      expect(Array.isArray(pair.candidates)).toBe(true);
      expect(typeof pair.verified).toBe('boolean');
      expect(Array.isArray(pair.aufMove)).toBe(true);
    }
    if (recognition!.oll) {
      expect(recognition!.oll.caseNumber === null || typeof recognition!.oll.caseNumber === 'string').toBe(true);
      expect(typeof recognition!.oll.verified).toBe('boolean');
    }
    if (recognition!.pll) {
      expect(recognition!.pll.caseNumber === null || typeof recognition!.pll.caseNumber === 'string').toBe(true);
      expect(typeof recognition!.pll.verified).toBe('boolean');
    }
    expect(Array.isArray(recognition!.debug)).toBe(true);
  });

  it('is deterministic: same timeline produces identical output', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const run = () => {
      const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
      PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
      return recognizeSolve(timeline, scramble);
    };

    const result1 = run();
    const result2 = run();
    expect(result1).toEqual(result2);
  });

  it('returns null when the timeline has no phases', () => {
    const timeline = TimelineBuilder.build([], 'CFOP');
    expect(recognizeSolve(timeline, '')).toBeNull();
  });

  it('accepts an inspection option and still produces a full result', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    const recognition = recognizeSolve(timeline, scramble, { inspection: 'x2' });
    expect(recognition).not.toBeNull();
    expect(recognition!.finalSolved).toBe(true);
    expect(recognition!.inspection).toBeTypeOf('string');
  });

  it('replays from the timeline\'s real initial state (smart-cube facelets path)', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // The scrambled cube's facelet string = what a smart cube reports at start.
    const scrambled = new CubeState();
    scrambled.applySequence(scramble);
    const initialFacelets = FaceletStringConverter.toFaceletString(scrambled);

    // Seed the timeline from facelets (the smart-cube path). The bridge must
    // derive the initial state from the timeline itself (NOT from the
    // scramble) so the recognition agrees with the timeline's physical
    // states — a solve completed from these facelets must end solved.
    const timeline = TimelineBuilder.build(
      solveMoves, 'CFOP', undefined, scramble, initialFacelets,
    );
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);
    expect(timeline.initialStateSource).toBe('initial-facelets');

    const recognition = recognizeSolve(timeline, scramble);
    expect(recognition).not.toBeNull();
    expect(recognition!.finalSolved).toBe(true);
  });
});
