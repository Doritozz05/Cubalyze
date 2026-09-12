/**
 * The canonical form of a smart cube id.
 *
 * These rules decide whether "the cube I bound yesterday" is still "the cube I
 * just connected". A mistake here is invisible until it silently stops matching
 * (or worse, matches the wrong cube), so every spelling that can reach the
 * Locker is pinned below.
 */
import { describe, it, expect } from 'vitest';
import {
  formatSmartId,
  normalizeSmartId,
  reverseSmartIdBytes,
  smartIdsMatch,
} from '../smart-cube-id.js';

describe('normalizeSmartId', () => {
  it('canonicalises the printed form', () => {
    expect(normalizeSmartId('AA:BB:CC:DD:EE:FF')).toBe('AABBCCDDEEFF');
  });

  it('accepts every separator a person or a keyboard may use', () => {
    expect(normalizeSmartId('aa-bb-cc-dd-ee-ff')).toBe('AABBCCDDEEFF');
    expect(normalizeSmartId('AA BB CC DD EE FF')).toBe('AABBCCDDEEFF');
    expect(normalizeSmartId('aa.bb.cc.dd.ee.ff')).toBe('AABBCCDDEEFF');
    expect(normalizeSmartId('aa_bb_cc_dd_ee_ff')).toBe('AABBCCDDEEFF');
    expect(normalizeSmartId('  AABBCCDDEEFF ')).toBe('AABBCCDDEEFF');
  });

  it('is case-insensitive', () => {
    expect(normalizeSmartId('aabbccddeeff')).toBe('AABBCCDDEEFF');
    expect(normalizeSmartId('AaBbCcDdEeFf')).toBe('AABBCCDDEEFF');
  });

  it('rejects anything that is not 12 hex digits', () => {
    expect(normalizeSmartId('AABBCCDDEEF')).toBeNull(); // 11
    expect(normalizeSmartId('AABBCCDDEEFFF')).toBeNull(); // 13
    expect(normalizeSmartId('')).toBeNull();
    expect(normalizeSmartId('   ')).toBeNull();
  });

  it('rejects non-hex characters instead of coercing them', () => {
    expect(normalizeSmartId('GG:BB:CC:DD:EE:FF')).toBeNull();
    expect(normalizeSmartId('AA:BB:CC:DD:EE:ZZ')).toBeNull();
    // A printed serial is not an address: the Locker has `serial` for that, and
    // quietly turning one into the other would make two different cubes match.
    expect(normalizeSmartId('SN-1234')).toBeNull();
    expect(normalizeSmartId('ABC-DEF-123-456')).toBe('ABCDEF123456');
  });

  it('tolerates null and undefined', () => {
    expect(normalizeSmartId(null)).toBeNull();
    expect(normalizeSmartId(undefined)).toBeNull();
  });
});

describe('formatSmartId', () => {
  it('groups the canonical form into byte pairs', () => {
    expect(formatSmartId('aabbccddeeff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(formatSmartId('AA-BB-CC-DD-EE-FF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('returns null for anything that is not an id', () => {
    expect(formatSmartId('nope')).toBeNull();
    expect(formatSmartId(null)).toBeNull();
  });
});

describe('reverseSmartIdBytes', () => {
  it('reverses bytes, not characters', () => {
    expect(reverseSmartIdBytes('0123456789AB')).toBe('AB8967452301');
    // The distinction matters: a character reversal would give "BA9876543210",
    // which is not what the GAN protocol's backwards walk produces.
    expect(reverseSmartIdBytes('0123456789AB')).not.toBe('BA9876543210');
  });

  it('is an involution', () => {
    const once = reverseSmartIdBytes('AABBCCDDEEFF');
    expect(reverseSmartIdBytes(once)).toBe('AABBCCDDEEFF');
  });
});

describe('smartIdsMatch', () => {
  it('matches the same address written differently', () => {
    expect(smartIdsMatch('AA:BB:CC:DD:EE:FF', 'aabbccddeeff')).toBe(true);
    expect(smartIdsMatch('AA-BB-CC-DD-EE-FF', 'AA BB CC DD EE FF')).toBe(true);
  });

  it('matches a hand-typed address against the byte-reversed one the protocol reads', () => {
    // What the connector reads from the cube (bytes walked backwards)...
    const fromCube = 'FFEEDDCCBBAA';
    // ...and what the label / the user types.
    const printed = 'AA:BB:CC:DD:EE:FF';
    expect(smartIdsMatch(fromCube, printed)).toBe(true);
    expect(smartIdsMatch(printed, fromCube)).toBe(true);
  });

  it('does not match different addresses', () => {
    expect(smartIdsMatch('AABBCCDDEEFF', 'AABBCCDDEE00')).toBe(false);
  });

  it('never matches when either side is unusable', () => {
    expect(smartIdsMatch(null, 'AABBCCDDEEFF')).toBe(false);
    expect(smartIdsMatch('AABBCCDDEEFF', undefined)).toBe(false);
    expect(smartIdsMatch('not-an-id', 'not-an-id')).toBe(false);
    expect(smartIdsMatch('', '')).toBe(false);
  });
});
