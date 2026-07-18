import {
  PhaseMask,
} from './IMethodDefinition';

/**
 * PASO 4 — Compiled phase mask for O(1) state matching.
 *
 * A PhaseMask like the D-cross ("DF, DR, DB, DL edges in their exact positions
 * with orientation 0") can be expressed as a fixed pair of bigint tuples:
 *   maskCorners × valueCorners — what _corners bits must look like
 *   maskEdges  × valueEdges   — what _edges  bits must look like
 *
 * The match predicate is then:
 *   (state._corners & maskCorners) === valueCorners
 *   && (state._edges  & maskEdges)  === valueEdges
 *
 * That's O(1) — two bitwise ANDs and two bigint comparisons. The full
 * PhaseMask only needs to be compiled once per mask instance; the
 * StateMatcher caches the result in a WeakMap.
 *
 * Encoding reminder (matches CubeState.ts):
 *   Corners are 5 bits: OOCCC (orient bits 3-4, piece-id bits 0-2).
 *   Edges   are 5 bits: OEEEE (orient bit 4, piece-id bits 0-3).
 *   Position i lives at bit offset i * 5 (bigint shift).
 */
export interface CompiledMask {
  /** Bits in `_corners` that must match. */
  maskCorners: bigint;
  /** Required values for those bits. */
  valueCorners: bigint;
  /** Bits in `_edges` that must match. */
  maskEdges: bigint;
  /** Required values for those bits. */
  valueEdges: bigint;
}

// ── Constants matching the CubeState encoding ──────────────────────────

const POS_BITS = 5n;
const CORNER_PIECE_MASK = 0b111n;     // 3 bits for the piece id
const CORNER_ORIENT_MASK = 0b11n;     // 2 bits for orientation
const CORNER_ORIENT_SHIFT = 3n;       // orient bits live at positions 3-4 within the 5-bit slot
const EDGE_PIECE_MASK = 0b1111n;      // 4 bits for the piece id
const EDGE_ORIENT_MASK = 0b1n;        // 1 bit for orientation
const EDGE_ORIENT_SHIFT = 4n;         // orient bit lives at position 4 within the 5-bit slot

/**
 * Compile a PhaseMask into bigint tuples for O(1) matching.
 *
 * Returns `null` if ANY rule has `requiredEp` / `requiredCp` undefined — those
 * are "find this piece anywhere" rules which cannot be expressed as a fixed
 * bitmask (they require per-state scanning). Callers (StateMatcher) must
 * fall back to the linear scanner in that case.
 *
 * Rules with `requiredEo` / `requiredCo` undefined still compile: the piece-id
 * bits remain in the mask but the orientation bits are NOT included. Only the
 * bits that MUST equal a fixed value are added to the mask.
 */
export function compilePhaseMask(mask: PhaseMask): CompiledMask | null {
  let maskC = 0n;
  let valueC = 0n;
  let maskE = 0n;
  let valueE = 0n;

  // ── Edges: position-bound rules (id at requiredEp, optional requiredEo) ──
  if (mask.edges) {
    for (const rule of mask.edges) {
      if (rule.requiredEp === undefined) return null;
      const pos = rule.requiredEp;
      const shift = BigInt(pos) * POS_BITS;
      maskE |= EDGE_PIECE_MASK << shift;
      valueE |= BigInt(rule.id & 0b1111) << shift;
      if (rule.requiredEo !== undefined) {
        maskE |= EDGE_ORIENT_MASK << (shift + EDGE_ORIENT_SHIFT);
        valueE |= BigInt(rule.requiredEo & 0b1) << (shift + EDGE_ORIENT_SHIFT);
      }
    }
  }

  // ── Corners: position-bound rules (id at requiredCp, optional requiredCo) ──
  if (mask.corners) {
    for (const rule of mask.corners) {
      if (rule.requiredCp === undefined) return null;
      const pos = rule.requiredCp;
      const shift = BigInt(pos) * POS_BITS;
      maskC |= CORNER_PIECE_MASK << shift;
      valueC |= BigInt(rule.id & 0b111) << shift;
      if (rule.requiredCo !== undefined) {
        maskC |= CORNER_ORIENT_MASK << (shift + CORNER_ORIENT_SHIFT);
        valueC |= BigInt(rule.requiredCo & 0b11) << (shift + CORNER_ORIENT_SHIFT);
      }
    }
  }

  // ── Edge positions (orientation only — piece id is irrelevant) ──
  if (mask.edgePositions) {
    for (const rule of mask.edgePositions) {
      if (rule.requiredEo === undefined) continue;
      const pos = rule.pos;
      const shift = BigInt(pos) * POS_BITS;
      maskE |= EDGE_ORIENT_MASK << (shift + EDGE_ORIENT_SHIFT);
      valueE |= BigInt(rule.requiredEo & 0b1) << (shift + EDGE_ORIENT_SHIFT);
    }
  }

  // ── Corner positions (orientation only — piece id is irrelevant) ──
  if (mask.cornerPositions) {
    for (const rule of mask.cornerPositions) {
      if (rule.requiredCo === undefined) continue;
      const pos = rule.pos;
      const shift = BigInt(pos) * POS_BITS;
      maskC |= CORNER_ORIENT_MASK << (shift + CORNER_ORIENT_SHIFT);
      valueC |= BigInt(rule.requiredCo & 0b11) << (shift + CORNER_ORIENT_SHIFT);
    }
  }

  return {
    maskCorners: maskC,
    valueCorners: valueC,
    maskEdges: maskE,
    valueEdges: valueE,
  };
}

/**
 * Compare two CompiledMasks for equality — used by tests to ensure that
 * re-compiling a mask produces identical results (caching sanity).
 *
 * This is not used at runtime; it's exposed for tests and for code that
 * wants to deduplicate masks.
 */
export function compiledMasksEqual(a: CompiledMask, b: CompiledMask): boolean {
  return a.maskCorners === b.maskCorners
      && a.valueCorners === b.valueCorners
      && a.maskEdges === b.maskEdges
      && a.valueEdges === b.valueEdges;
}
