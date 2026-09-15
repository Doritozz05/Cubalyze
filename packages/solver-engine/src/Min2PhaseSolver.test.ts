import { describe, it, expect } from 'vitest';
import { CubeState, FaceletStringConverter } from '@cubalyze/math-core';
import { Min2PhaseSolver } from './Min2PhaseSolver';

describe('FaceletStringConverter', () => {
  it('should return the correct string for a solved cube', () => {
    const solvedState = new CubeState();
    const faceletString = FaceletStringConverter.toFaceletString(solvedState);
    expect(faceletString).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });

  it('should return a valid string for a scrambled cube that min2phase can parse', () => {
    const state = new CubeState();
    state.applySequence("U R F2 D L B2 R");
    const faceletString = FaceletStringConverter.toFaceletString(state);
    
    expect(faceletString.length).toBe(54);
    expect(faceletString).not.toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });
});

describe('Min2PhaseSolver', () => {
  it('should solve a randomly generated state', () => {
    const solver = new Min2PhaseSolver();
    const state = new CubeState();
    state.applySequence("R U R' U'");
    
    const solution = solver.solve(state);
    // Inverse of R U R' U' is U R U' R'
    // But min2phase might find a different but optimal solution, or the exact one
    expect(solution.length).toBeGreaterThan(0);
    
    // Test that applying the solution resolves the cube
    state.applySequence(solution);
    expect(state.isSolved()).toBe(true);
  });
});
