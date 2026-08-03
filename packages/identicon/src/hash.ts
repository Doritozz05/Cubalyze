/**
 * @cubeforge/identicon — Deterministic hashing & PRNG
 *
 * CubeMark is generated from a stable seed (the user's anonymous `user_id`).
 * The hash pipeline must be:
 *  - deterministic (same seed → same glyph, forever),
 *  - synchronous (no Web Crypto async in the render path),
 *  - dependency-free, and
 *  - avalanche-flavoured (a small seed change → unrelated glyph).
 *
 * FNV-1a (32-bit) is not cryptographic, but with per-slot salts it produces
 * 32 bytes of well-distributed entropy — the same class of approach used by
 * GitHub identicons and DiceBear. Docs/plan_profile Fase 8 documents this
 * (adopted over SHA-256: synchronous determinism, zero dependencies).
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash of a string. */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Per-slot salts widen the derived entropy (8 × 4 bytes = 32 bytes). */
const HASH_SALTS = [
  'cubeforge',
  'forgemark',
  'cubemark',
  'identicon',
  'profile',
  'avatar',
  'seed',
  'glyph',
] as const;

/**
 * Derive 32 deterministic bytes from a seed string.
 * Each 4-byte slot hashes a different salt so adjacent seeds differ wildly.
 */
export function hashSeed(seed: string): Uint8Array {
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) {
    const slot = fnv1a32(`${seed}:${HASH_SALTS[i % HASH_SALTS.length]}:${i}`);
    view.setUint32(i * 4, slot, true);
  }
  return out;
}

/**
 * mulberry32 — small, fast, deterministic PRNG (32-bit state).
 * Returns floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Read a little-endian uint32 from a byte array (offset in bytes). */
export function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
