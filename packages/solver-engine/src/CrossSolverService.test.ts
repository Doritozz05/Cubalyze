import { describe, it, expect } from 'vitest';
import { CubeState, Edge } from '@cubalyze/math-core';
import { CrossSolverService } from './CrossSolverService';

describe('CrossSolverService', () => {
  it('solves solved state with 0 moves', () => {
    const res = CrossSolverService.solve('', { face: 'U', maxSolutions: 2 });
    expect(res.face).toBe('U');
    expect(res.depth).toBe(0);
    expect(res.solutions.length).toBeGreaterThanOrEqual(1);
    expect(res.solutions[0].moveCount).toBe(0);
    expect(res.solutions[0].preRotation).toBe('z2');
  });

  it('solves White cross (U) with z2 pre-rotation and remapped bottom moves', () => {
    // Scramble is U (turns white face) -> raw solve on U is U'.
    // With z2 pre-rotation, U' remaps to D'. Full alg: "z2 D'".
    const res = CrossSolverService.solve("U", { face: 'U', maxSolutions: 2 });
    expect(res.face).toBe('U');
    expect(res.depth).toBe(1);
    expect(res.solutions.length).toBe(2);
    expect(res.solutions[0].preRotation).toBe('z2');
    expect(res.solutions[0].moves).toBe("D'");
    expect(res.solutions[0].notation).toBe("z2 D'");
    expect(res.solutions[0].moveCount).toBe(1);
    expect(res.bestColorNeutral).toBeDefined();
    expect(res.bestColorNeutral?.face).toBe('D');
    expect(res.bestColorNeutral?.depth).toBe(0);

    // Verify executing "z2 D'" on a scrambled cube (scramble "U") places all 4 white edges on the bottom D face
    const cube = new CubeState();
    cube.applySequence("U");
    cube.applySequence(res.solutions[0].notation);

    // In this rotated frame, White is on D.
    // The 4 D-layer edge positions (DF=5, DR=4, DB=7, DL=6) should contain the 4 white edge pieces (UR=0, UF=1, UL=2, UB=3)
    const whiteEdges = new Set([Edge.UR, Edge.UF, Edge.UL, Edge.UB]);
    expect(whiteEdges.has(cube.ep[Edge.DF])).toBe(true);
    expect(whiteEdges.has(cube.ep[Edge.DR])).toBe(true);
    expect(whiteEdges.has(cube.ep[Edge.DB])).toBe(true);
    expect(whiteEdges.has(cube.ep[Edge.DL])).toBe(true);
    // All 4 edges have orientation 0 (flat with white center on bottom)
    expect(cube.eo[Edge.DF]).toBe(0);
    expect(cube.eo[Edge.DR]).toBe(0);
    expect(cube.eo[Edge.DB]).toBe(0);
    expect(cube.eo[Edge.DL]).toBe(0);
  });

  it('solves Yellow cross (D) without pre-rotation', () => {
    // Scramble is D -> solve on D is D', no pre-rotation needed
    const res = CrossSolverService.solve("D", { face: 'D', maxSolutions: 2 });
    expect(res.face).toBe('D');
    expect(res.depth).toBe(1);
    expect(res.solutions.length).toBeGreaterThanOrEqual(1);
    expect(res.solutions[0].preRotation).toBe('');
    expect(res.solutions[0].moves).toBe("D'");
    expect(res.solutions[0].notation).toBe("D'");
    expect(res.solutions[0].moveCount).toBe(1);
  });

  it('finds optimal cross for 3-move scramble on White (default)', () => {
    // F R U
    const res = CrossSolverService.solve("F R U", { maxSolutions: 2 });
    expect(res.face).toBe('U');
    expect(res.depth).toBeLessThanOrEqual(3);
    expect(res.solutions.length).toBeGreaterThanOrEqual(1);
    expect(res.solutions[0].preRotation).toBe('z2');
    expect(res.solutions[0].moveCount).toBe(res.depth);
  });

  it('supports other faces (e.g. Green / F with x pre-rotation)', () => {
    const res = CrossSolverService.solve("F", { face: 'F', maxSolutions: 2 });
    expect(res.face).toBe('F');
    expect(res.depth).toBe(1);
    expect(res.solutions[0].preRotation).toBe("x'");
    expect(res.solutions[0].moveCount).toBe(1);
  });

  it('solves demo scramble on D (Yellow) and verifies solved cross pieces', () => {
    const scramble = "D2 L' F2 U' B2 R2 D B2 D' F2 U' B' L2 R2 D' F' U2 R'";
    const res = CrossSolverService.solve(scramble, { face: 'D', maxSolutions: 2 });
    expect(res.depth).toBe(5);
    expect(res.solutions.length).toBe(2);
    expect(res.solutions[0].moves).toBe("F U' R' F2 L2");

    // Verify cross is solved on bottom D
    const cube = new CubeState();
    cube.applySequence(scramble);
    cube.applySequence(res.solutions[0].notation);

    expect(cube.ep[Edge.DF]).toBe(Edge.DF);
    expect(cube.ep[Edge.DR]).toBe(Edge.DR);
    expect(cube.ep[Edge.DB]).toBe(Edge.DB);
    expect(cube.ep[Edge.DL]).toBe(Edge.DL);
    expect(cube.eo[Edge.DF]).toBe(0);
    expect(cube.eo[Edge.DR]).toBe(0);
    expect(cube.eo[Edge.DB]).toBe(0);
    expect(cube.eo[Edge.DL]).toBe(0);
  });

  it('solves demo scramble on U (White) and verifies solved cross pieces after z2', () => {
    const scramble = "D2 L' F2 U' B2 R2 D B2 D' F2 U' B' L2 R2 D' F' U2 R'";
    const res = CrossSolverService.solve(scramble, { face: 'U', maxSolutions: 2 });
    expect(res.depth).toBe(7);
    expect(res.solutions.length).toBe(2);
    expect(res.solutions[0].preRotation).toBe("z2");
    expect(res.solutions[0].moves).toBe("L F D' F D' F R");

    // Verify cross is solved on bottom D with z2 pre-rotation
    const cube = new CubeState();
    cube.applySequence(scramble);
    cube.applySequence(res.solutions[0].notation);

    // After z2:
    // White is on D -> White-Green piece (UF) is at DF position
    // White-Orange piece (UL) is at DR position (Orange is on Right after z2)
    // White-Blue piece (UB) is at DB position
    // White-Red piece (UR) is at DL position (Red is on Left after z2)
    expect(cube.ep[Edge.DF]).toBe(Edge.UF);
    expect(cube.ep[Edge.DR]).toBe(Edge.UL);
    expect(cube.ep[Edge.DB]).toBe(Edge.UB);
    expect(cube.ep[Edge.DL]).toBe(Edge.UR);
    expect(cube.eo[Edge.DF]).toBe(0);
    expect(cube.eo[Edge.DR]).toBe(0);
    expect(cube.eo[Edge.DB]).toBe(0);
    expect(cube.eo[Edge.DL]).toBe(0);
  });
});

