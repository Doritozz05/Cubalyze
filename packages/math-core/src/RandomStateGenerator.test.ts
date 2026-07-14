import { describe, it, expect } from 'vitest';
import { RandomStateGenerator, ISolver } from './RandomStateGenerator';
import { CubeState } from './CubeState';

// Dummy solver for tests
class DummySolver implements ISolver {
  solve(state: CubeState): string {
    // We just return a valid dummy solution length >= 2 to pass the loop
    if (state.isSolved()) return "";
    return "U R2 F'"; 
  }
}

describe('RandomStateGenerator', () => {
  it('should generate valid permutations (parity matches)', () => {
    for (let i = 0; i < 100; i++) {
      const state = RandomStateGenerator.generateRandomState();
      
      let cpInversions = 0;
      for (let j = 0; j < 7; j++) {
        for (let k = j + 1; k < 8; k++) {
          if (state.cp[j] > state.cp[k]) cpInversions++;
        }
      }
      
      let epInversions = 0;
      for (let j = 0; j < 11; j++) {
        for (let k = j + 1; k < 12; k++) {
          if (state.ep[j] > state.ep[k]) epInversions++;
        }
      }
      
      expect(cpInversions % 2).toBe(epInversions % 2);
    }
  });

  it('should generate valid corner and edge orientations', () => {
    for (let i = 0; i < 100; i++) {
      const state = RandomStateGenerator.generateRandomState();
      
      let coSum = 0;
      for (let j = 0; j < 8; j++) coSum += state.co[j];
      expect(coSum % 3).toBe(0);
      
      let eoSum = 0;
      for (let j = 0; j < 12; j++) eoSum += state.eo[j];
      expect(eoSum % 2).toBe(0);
    }
  });

  it('should generate a valid scramble using the solver', () => {
    const solver = new DummySolver();
    const scramble = RandomStateGenerator.generateScramble(solver);
    expect(scramble).toBe("F R2 U'"); // Inverted of U R2 F'
  });

  it('should generate batch scrambles', () => {
    const solver = new DummySolver();
    const scrambles = RandomStateGenerator.generateScrambleBatch(solver, 5);
    expect(scrambles.length).toBe(5);
    expect(scrambles[0]).toBe("F R2 U'");
  });
});
