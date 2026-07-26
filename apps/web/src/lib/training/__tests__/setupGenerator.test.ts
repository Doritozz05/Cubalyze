import { describe, it, expect } from 'vitest';
import { generateRandomSetup } from '@cubeforge/training';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';

describe('setupGenerator', () => {
  it('generates a non-empty setup scramble for T-perm', () => {
    const tPermMoves = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"];
    const setup = generateRandomSetup(tPermMoves, 'Y');
    expect(setup).toBeTruthy();
    expect(setup.length).toBeGreaterThan(0);
  });

  it('targetFace="Y" generates a setup that alters the Down (Yellow) face when executed from standard White-top orientation', () => {
    // Sune (OLL 27): R U R' U R U2 R'
    const sune = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"];
    const setup = generateRandomSetup(sune, 'Y');

    // Create a solved cube state (U=White, D=Yellow)
    const state = new CubeState();
    state.applySequence(setup);

    const facelets = FaceletStringConverter.toFaceletString(state);
    const topFacelets = facelets.substring(0, 9);   // U face (White)
    const downFacelets = facelets.substring(9, 18); // D face (Yellow)

    // Setup scramble must leave U (White) solved and alter D (Yellow)
    expect(topFacelets).toBe('UUUUUUUUU');
    expect(downFacelets).not.toBe('DDDDDDDDD');
  });

  it('handles wide move algorithms like OLL 5 without Error in scramble', () => {
    const oll5Moves = ['Rw', 'U2', "R'", "U'", 'R', "U'", "Rw'"];
    const setup = generateRandomSetup(oll5Moves, 'Y');
    expect(setup).toBeTruthy();
    expect(setup).not.toContain('Error');
    expect(setup).not.toContain("6'");
  });
});
