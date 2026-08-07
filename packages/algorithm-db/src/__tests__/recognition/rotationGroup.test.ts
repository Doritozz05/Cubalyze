import { describe, expect, it } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import {
  ROTATION_GROUP,
  applyRotation,
  findRotationOfSolved,
  isRotationOfSolved,
  findCrossOnDFrames,
  facePermutationOf,
  invertSequence,
} from '../../recognition/rotationGroup';

describe('rotationGroup', () => {
  it('generates exactly 24 distinct rotations', () => {
    expect(ROTATION_GROUP).toHaveLength(24);
    const keys = new Set(
      ROTATION_GROUP.map((r) => {
        const s = applyRotation(new CubeState(), r);
        return `${Array.from(s.cp)}|${Array.from(s.ep)}|${Array.from(s.co)}|${Array.from(s.eo)}`;
      }),
    );
    expect(keys.size).toBe(24);
  });

  it('every rotation of solved is detected and inverted back to solved', () => {
    for (const r of ROTATION_GROUP) {
      const state = applyRotation(new CubeState(), r);
      expect(isRotationOfSolved(state)).toBe(true);
      const found = findRotationOfSolved(state);
      expect(found).not.toBeNull();
      const back = applyRotation(state, invertSequence(found!));
      expect(back.isSolved()).toBe(true);
    }
  });

  it('a scrambled state is not a rotation of solved', () => {
    const state = new CubeState();
    state.applySequence("R U R' U'");
    expect(isRotationOfSolved(state)).toBe(false);
  });

  it('findCrossOnDFrames returns 4 frames for a solved-ish cross and none for a real scramble', () => {
    // White cross on D (catalog convention: pieces 4-7) is already on D.
    const solved = new CubeState();
    const frames = findCrossOnDFrames(solved, [4, 5, 6, 7]);
    expect(frames.length).toBeGreaterThan(0);
    // No frame can put arbitrary cross edges on D from a genuinely scrambled
    // state (a real WCA scramble breaks the D cross).
    const scrambled = new CubeState();
    scrambled.applySequence("R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2");
    expect(findCrossOnDFrames(scrambled, [4, 5, 6, 7])).toHaveLength(0);
  });

  it('a U turn does not break the cross-on-D frames (AUF invariance)', () => {
    const solved = new CubeState();
    for (const auf of ['', 'U', 'U2', "U'"]) {
      const state = solved.clone();
      if (auf) state.applySequence(auf);
      expect(findCrossOnDFrames(state, [4, 5, 6, 7]).length).toBeGreaterThan(0);
    }
  });

  it('facePermutationOf is consistent for y rotations', () => {
    const permY = facePermutationOf('y');
    // After y, position F holds the original L face, position R the original F face.
    expect(permY.F).toBe('L');
    expect(permY.R).toBe('F');
    expect(permY.U).toBe('U');
    expect(permY.D).toBe('D');
    const permIdentity = facePermutationOf('');
    expect(permIdentity.F).toBe('F');
    expect(permIdentity.R).toBe('R');
  });
});
