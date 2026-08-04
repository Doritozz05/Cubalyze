import { describe, it, expect } from 'vitest';
import { parseScrambleMoves, scrambleMoveDurationMs } from '../animation/ScrambleAnimator';

describe('parseScrambleMoves', () => {
  it('parses basic WCA moves into axis/layer/angle rotations', () => {
    const moves = parseScrambleMoves("R U R' F2");
    expect(moves).toEqual([
      { axis: 'x', layerValue: 1, angle: -90 },   // R
      { axis: 'y', layerValue: 1, angle: -90 },   // U
      { axis: 'x', layerValue: 1, angle: 90 },    // R'
      { axis: 'z', layerValue: 1, angle: -180 },  // F2
    ]);
  });

  it('maps all six faces to the correct axis/layer (including L/B/D)', () => {
    const moves = parseScrambleMoves('D L B2');
    expect(moves).toEqual([
      { axis: 'y', layerValue: -1, angle: 90 },   // D (angleSign +1)
      { axis: 'x', layerValue: -1, angle: 90 },   // L (angleSign +1)
      { axis: 'z', layerValue: -1, angle: 180 },  // B2 (angleSign +1, 2×90)
    ]);
  });

  it('handles double and prime suffixes on every face', () => {
    const moves = parseScrambleMoves("U2 L'");
    expect(moves).toEqual([
      { axis: 'y', layerValue: 1, angle: -180 },
      { axis: 'x', layerValue: -1, angle: -90 },
    ]);
  });

  it('ignores extra whitespace and line breaks', () => {
    expect(parseScrambleMoves('  R  U  ')).toHaveLength(2);
    expect(parseScrambleMoves('\nR U\n')).toHaveLength(2);
  });

  it('returns null for an empty scramble', () => {
    expect(parseScrambleMoves('')).toBeNull();
    expect(parseScrambleMoves('   ')).toBeNull();
  });

  it('returns null when a token is not a rotatable face (wide move)', () => {
    expect(parseScrambleMoves('r U')).toBeNull();
    expect(parseScrambleMoves("R u' F")).toBeNull();
  });

  it('returns null when a token is a cube rotation (x/y/z)', () => {
    expect(parseScrambleMoves('x R U')).toBeNull();
    expect(parseScrambleMoves('R y')).toBeNull();
  });

  it('returns null on garbage tokens', () => {
    expect(parseScrambleMoves('R R2 R22')).toBeNull();
    expect(parseScrambleMoves('Q U')).toBeNull();
  });
});

describe('scrambleMoveDurationMs', () => {
  it('gives 160ms for a 90° turn with the default base', () => {
    expect(scrambleMoveDurationMs(90)).toBe(160);
    expect(scrambleMoveDurationMs(-90)).toBe(160);
  });

  it('doubles the duration for a 180° turn (adaptive per angle)', () => {
    expect(scrambleMoveDurationMs(180)).toBe(320);
    expect(scrambleMoveDurationMs(-180)).toBe(320);
  });

  it('respects a custom base duration', () => {
    expect(scrambleMoveDurationMs(90, 200)).toBe(200);
    expect(scrambleMoveDurationMs(180, 200)).toBe(400);
  });
});
