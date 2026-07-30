import min2phase from 'min2phase.js';
import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import { ISolver } from './RandomStateGenerator';

export class Min2PhaseSolver implements ISolver {
  private initialized = false;

  constructor() {
    // Lazy initialization — initFull() is called on first solve() or on explicit init().
  }

  /**
   * Pre-initialise the WASM pruning tables.
   * Call this at app startup to avoid the ~150-350ms delay on the first solve.
   * Safe to call multiple times (idempotent).
   */
  public init(): void {
    if (this.initialized) return;
    min2phase.initFull();
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.init();
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
