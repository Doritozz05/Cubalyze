import { describe, it, expect } from 'vitest';
import { generateRandomSetup } from '../setupGenerator';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';

describe('setupGenerator', () => {
  it('generates a non-empty setup scramble for T-perm', () => {
    const tPermMoves = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"];
    const setup = generateRandomSetup(tPermMoves, 'Y');
    expect(setup).toBeTruthy();
    expect(setup.length).toBeGreaterThan(0);
  });

  it('targetFace="Y" generates a setup that when executed with Yellow on top (z2 state) alters the Yellow face', () => {
    // Sune (OLL 27): R U R' U R U2 R'
    const sune = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"];
    const setup = generateRandomSetup(sune, 'Y');

    // Create a cube state with Yellow on Top (z2 rotated: U=Yellow, D=White)
    const state = new CubeState();
    state.applySequence('z2');
    state.applySequence(setup);

    const facelets = FaceletStringConverter.toFaceletString(state);
    const topFacelets = facelets.substring(0, 9); // Top face (Yellow under z2)

    // Under z2 (Yellow on top), executing the setup scramble alters the top face (Yellow)
    expect(topFacelets).not.toBe('DDDDDDDDD');
  });
});
