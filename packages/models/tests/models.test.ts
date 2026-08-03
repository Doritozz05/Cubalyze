import { describe, it, expect } from 'vitest';
import { SolveSchema } from '../src/index.js';

describe('Models Validation', () => {
  it('should validate a correct solve object', () => {
    const validSolve = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      sessionId: '123e4567-e89b-12d3-a456-426614174001',
      timeMs: 12500,
      timestamp: Date.now(),
      scramble: 'R U R\' U\'',
      penalty: 'none'
    };

    const result = SolveSchema.safeParse(validSolve);
    expect(result.success).toBe(true);
  });

  it('should reject invalid time', () => {
    const invalidSolve = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      sessionId: '123e4567-e89b-12d3-a456-426614174001',
      timeMs: -100, // Invalid, must be non-negative
      timestamp: Date.now(),
      scramble: 'R U R\' U\'',
      penalty: 'none'
    };

    const result = SolveSchema.safeParse(invalidSolve);
    expect(result.success).toBe(false);
  });
});
