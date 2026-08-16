import { describe, it, expect } from 'vitest';
import { SolveSchema, SessionSchema, ProfileSchema } from '../src/index.js';

function makeValidSolve(puzzleType?: string) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sessionId: '123e4567-e89b-12d3-a456-426614174001',
    timeMs: 12500,
    timestamp: Date.now(),
    scramble: "R U R' U'",
    penalty: 'none',
    ...(puzzleType !== undefined ? { puzzleType } : {}),
  };
}

function makeValidSession(puzzleType?: string) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Main',
    createdAt: Date.now(),
    ...(puzzleType !== undefined ? { puzzleType } : {}),
  };
}

describe('Models Validation', () => {
  it('should validate a correct solve object', () => {
    const result = SolveSchema.safeParse(makeValidSolve());
    expect(result.success).toBe(true);
  });

  it('should reject invalid time', () => {
    const invalidSolve = {
      ...makeValidSolve(),
      timeMs: -100, // Invalid, must be non-negative
    };
    const result = SolveSchema.safeParse(invalidSolve);
    expect(result.success).toBe(false);
  });
});

describe('SolveSchema — puzzle_type validation against the registry (A2/ADR-002)', () => {
  it('accepts the WCA event codes (333, 222, 333oh, …)', () => {
    for (const t of ['333', '222', '333oh', '444']) {
      const result = SolveSchema.safeParse(makeValidSolve(t));
      expect(result.success, `${t} accepted`).toBe(true);
    }
  });

  it('rejects unknown puzzle_type values, including the pre-ADR-002 scheme', () => {
    for (const junk of ['3x3x3', '2x2x2', '3x3', '2x2', '9x9x9', 'pyraminx', '', '333oh-2']) {
      const result = SolveSchema.safeParse(makeValidSolve(junk));
      expect(result.success, `${junk} rejected`).toBe(false);
    }
  });

  it('puzzle_type stays optional (backward compat)', () => {
    const result = SolveSchema.safeParse(makeValidSolve());
    expect(result.success).toBe(true);
  });
});

function makeValidProfile(mainPuzzle?: string) {
  return {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    ...(mainPuzzle !== undefined ? { mainPuzzle } : {}),
  };
}

describe('ProfileSchema — mainPuzzle validation against the registry (A2/ADR-002)', () => {
  it('accepts WCA codes and defaults to 333 when absent', () => {
    const parsed = ProfileSchema.safeParse(makeValidProfile('222'));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.mainPuzzle).toBe('222');

    const defaulted = ProfileSchema.safeParse(makeValidProfile());
    expect(defaulted.success).toBe(true);
    expect(defaulted.success && defaulted.data.mainPuzzle).toBe('333');
  });

  it('rejects the pre-ADR-002 and legacy spellings (3x3x3, 2x2x2, 3x3, 2x2)', () => {
    for (const junk of ['3x3x3', '2x2x2', '3x3', '2x2', '9x9x9', '']) {
      const result = ProfileSchema.safeParse(makeValidProfile(junk));
      expect(result.success, `${junk} rejected`).toBe(false);
    }
  });
});

describe('SessionSchema — puzzle_type validation against the registry (A2/ADR-002)', () => {
  it('accepts WCA codes and defaults to 333 when absent', () => {
    const parsed = SessionSchema.safeParse(makeValidSession('222'));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.puzzleType).toBe('222');

    const defaulted = SessionSchema.safeParse(makeValidSession());
    expect(defaulted.success).toBe(true);
    expect(defaulted.success && defaulted.data.puzzleType).toBe('333');
  });

  it('rejects unknown puzzle_type values, including the pre-ADR-002 scheme', () => {
    for (const junk of ['3x3x3', '2x2x2', '3x3', '9x9x9', 'pyraminx', '']) {
      const result = SessionSchema.safeParse(makeValidSession(junk));
      expect(result.success, `${junk} rejected`).toBe(false);
    }
  });
});
