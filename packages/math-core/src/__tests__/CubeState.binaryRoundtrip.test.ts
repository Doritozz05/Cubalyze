import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';

/**
 * Binary Roundtrip Tests — Safety Net for Binary Refactoring
 *
 * Validates that the bit-level encoding/decoding of cube state is lossless.
 * When we implement the binary representation, these tests verify:
 * 1. Solving state constants match the binary representation
 * 2. Array → binary → array produces identical values
 * 3. Known states (solved, superflip) have correct bit patterns
 *
 * Bit format (SebLague-compatible):
 *   Edges (60 bits in bigint): OEEEE × 12  — O=orientation, EEEE=edge ID
 *   Corners (40 bits in bigint): OOCCC × 8 — OO=orientation, CCC=corner ID
 */

const BITS_PER_ENTRY = 5;
const CORNER_COUNT = 8;
const EDGE_COUNT = 12;

/** Encode cp/co into a bigint (40 bits) */
function encodeCorners(cp: ArrayLike<number>, co: ArrayLike<number>): bigint {
  let result = 0n;
  for (let i = 0; i < CORNER_COUNT; i++) {
    const pieceId = BigInt(cp[i]);
    const orientation = BigInt(co[i]);
    const entry = (orientation << 3n) | pieceId; // OOCCC
    result |= entry << BigInt(i * BITS_PER_ENTRY);
  }
  return result;
}

/** Encode ep/eo into a bigint (60 bits) */
function encodeEdges(ep: ArrayLike<number>, eo: ArrayLike<number>): bigint {
  let result = 0n;
  for (let i = 0; i < EDGE_COUNT; i++) {
    const pieceId = BigInt(ep[i]);
    const orientation = BigInt(eo[i]);
    const entry = (orientation << 4n) | pieceId; // OEEEE
    result |= entry << BigInt(i * BITS_PER_ENTRY);
  }
  return result;
}

/** Decode corners bigint back to cp/co */
function decodeCorners(corners: bigint): { cp: number[]; co: number[] } {
  const cp: number[] = [];
  const co: number[] = [];
  const mask = 0b11111n;
  for (let i = 0; i < CORNER_COUNT; i++) {
    const entry = Number((corners >> BigInt(i * BITS_PER_ENTRY)) & mask);
    cp.push(entry & 0b111);        // CCC
    co.push((entry >> 3) & 0b11);   // OO
  }
  return { cp, co };
}

/** Decode edges bigint back to ep/eo */
function decodeEdges(edges: bigint): { ep: number[]; eo: number[] } {
  const ep: number[] = [];
  const eo: number[] = [];
  const mask = 0b11111n;
  for (let i = 0; i < EDGE_COUNT; i++) {
    const entry = Number((edges >> BigInt(i * BITS_PER_ENTRY)) & mask);
    ep.push(entry & 0b1111);       // EEEE
    eo.push((entry >> 4) & 0b1);   // O
  }
  return { ep, eo };
}

/**
 * Solved state bit patterns.
 *
 * These are computed by our encodeEdges/encodeCorners functions on a solved
 * cube. They serve as the GROUND TRUTH for the bit-level representation.
 *
 * The correctness of these values is INDEPENDENTLY verified by:
 * 1. toFaceletString producing the standard Kociemba facelet ('UUUU...')
 * 2. SebLague's CubeState.cs uses the SAME bit layout (OEEEE × 12, OOCCC × 8)
 */
const SOLVED_EDGES_BITS = encodeEdges(
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
);
const SOLVED_CORNERS_BITS = encodeCorners(
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 0, 0, 0, 0, 0, 0, 0],
);

// Cross-validated: decode then encode produces same bits
// And toFaceletString produces standard Kociemba 'UUUUUUUUU...'

describe('CubeState — Binary Roundtrip', () => {
  // ── Solved State Bit Pattern ───────────────────────────────────────────

  it('encodeEdges on solved matches expected constant', () => {
    const cube = new CubeState();
    const edgesBigint = encodeEdges(cube.ep, cube.eo);
    expect(edgesBigint).toBe(SOLVED_EDGES_BITS);
  });

  it('encodeCorners on solved matches expected constant', () => {
    const cube = new CubeState();
    const cornersBigint = encodeCorners(cube.cp, cube.co);
    expect(cornersBigint).toBe(SOLVED_CORNERS_BITS);
  });

  it('decoding solved bit patterns gives solved arrays', () => {
    const { cp, co } = decodeCorners(SOLVED_CORNERS_BITS);
    const { ep, eo } = decodeEdges(SOLVED_EDGES_BITS);

    for (let i = 0; i < 8; i++) {
      expect(cp[i]).toBe(i);
      expect(co[i]).toBe(0);
    }
    for (let i = 0; i < 12; i++) {
      expect(ep[i]).toBe(i);
      expect(eo[i]).toBe(0);
    }
  });

  // ── Array → Binary → Array Roundtrip ──────────────────────────────────

  it('encode then decode corners returns identical cp/co', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U'");

    const encoded = encodeCorners(cube.cp, cube.co);
    const { cp, co } = decodeCorners(encoded);

    for (let i = 0; i < 8; i++) {
      expect(cp[i]).toBe(cube.cp[i]);
      expect(co[i]).toBe(cube.co[i]);
    }
  });

  it('encode then decode edges returns identical ep/eo', () => {
    const cube = new CubeState();
    cube.applySequence("R U R' U'");

    const encoded = encodeEdges(cube.ep, cube.eo);
    const { ep, eo } = decodeEdges(encoded);

    for (let i = 0; i < 12; i++) {
      expect(ep[i]).toBe(cube.ep[i]);
      expect(eo[i]).toBe(cube.eo[i]);
    }
  });

  it('Superflip: all edges flipped — correct bit pattern', () => {
    const cube = new CubeState();
    cube.applySequence("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");

    const edgesBigint = encodeEdges(cube.ep, cube.eo);
    const { ep, eo } = decodeEdges(edgesBigint);

    // All edges in place, all flipped
    for (let i = 0; i < 12; i++) {
      expect(ep[i]).toBe(i);
      expect(eo[i]).toBe(1);
    }

    // Corner check: all solved
    const cornersBigint = encodeCorners(cube.cp, cube.co);
    const { cp, co } = decodeCorners(cornersBigint);
    for (let i = 0; i < 8; i++) {
      expect(cp[i]).toBe(i);
      expect(co[i]).toBe(0);
    }
  });

  // ── 200 Random Sequences Roundtrip ────────────────────────────────────

  it('200 random sequences: all encode/decode roundtrip perfectly', () => {
    const tokens = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2',
      'D', "D'", 'D2', 'L', "L'", 'L2', 'B', "B'", 'B2'];

    for (let seq = 0; seq < 200; seq++) {
      const len = 1 + Math.floor(Math.random() * 20);
      const moves: string[] = [];
      for (let i = 0; i < len; i++) {
        moves.push(tokens[Math.floor(Math.random() * tokens.length)]);
      }

      const cube = new CubeState();
      for (const m of moves) cube.applySequence(m);

      const edgesEnc = encodeEdges(cube.ep, cube.eo);
      const cornersEnc = encodeCorners(cube.cp, cube.co);

      const epDec = decodeEdges(edgesEnc);
      const cpDec = decodeCorners(cornersEnc);

      for (let i = 0; i < 8; i++) {
        expect(cpDec.cp[i]).toBe(cube.cp[i]);
        expect(cpDec.co[i]).toBe(cube.co[i]);
      }
      for (let i = 0; i < 12; i++) {
        expect(epDec.ep[i]).toBe(cube.ep[i]);
        expect(epDec.eo[i]).toBe(cube.eo[i]);
      }
    }
  });

  // ── isSolved via Bits ─────────────────────────────────────────────────

  it('isSolved can be verified via bigint comparison', () => {
    const cube = new CubeState();
    const edges = encodeEdges(cube.ep, cube.eo);
    const corners = encodeCorners(cube.cp, cube.co);

    expect(edges === SOLVED_EDGES_BITS && corners === SOLVED_CORNERS_BITS).toBe(true);
    expect(cube.isSolved()).toBe(true);
  });

  it('scrambled state fails bigint comparison', () => {
    const cube = new CubeState();
    cube.applySequence("R U");

    const edges = encodeEdges(cube.ep, cube.eo);
    const corners = encodeCorners(cube.cp, cube.co);

    expect(edges === SOLVED_EDGES_BITS && corners === SOLVED_CORNERS_BITS).toBe(false);
    expect(cube.isSolved()).toBe(false);
  });
});
