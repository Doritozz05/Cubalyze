import min2phase from 'min2phase.js';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { ISolver } from './RandomStateGenerator';

export class Min2PhaseSolver implements ISolver {
  private initialized = false;

  constructor() {
    // We can lazily initialize or initialize here.
    // min2phase.initFull() takes about ~150-350ms and calculates pruning tables.
  }

  private ensureInitialized() {
    if (!this.initialized) {
      min2phase.initFull();
      this.initialized = true;
    }
  }

  public solve(state: CubeState): string {
    this.ensureInitialized();
    const faceletString = FaceletStringConverter.toFaceletString(state);
    
    // min2phase.solve returns the shortest sequence (<= 21 moves) to solve the given facelet string
    const solution = min2phase.solve(faceletString);
    
    return solution || "";
  }
}
