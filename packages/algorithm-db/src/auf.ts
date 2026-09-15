import type { CubeState } from '@cubalyze/math-core';

// ─── AUF (Adjust U Face) System ─────────────────────────────────────────
//
// PLL cases can appear in 4 different AUF orientations (U, U2, U', no AUF).
// The canonical orientation for each case is defined by the seed data's
// facelet colors — this module provides tools to detect and apply AUF
// relative to a reference corner permutation.
//
// Corner indices (U-layer): URF=0, UFL=1, ULB=2, UBR=3
// A U move cycles: cp' = [cp[3], cp[0], cp[1], cp[2]] (CW from top)
//
// Usage:
//   1. Get the canonical cp from the seed data (via CaseStateGenerator)
//   2. detectCanonicalAuf(state.cp, canonicalCp) → 0|1|2|3
//   3. normalizeToCanonical(state, canonicalCp) → { state, auf }

/**
 * Detect how many U-layer CW quarter-turns are needed to align a given
 * corner permutation with a reference canonical permutation.
 *
 *   0 = already canonical
 *   1 = U  needed (one CW turn)
 *   2 = U2 needed (two CW / 180°)
 *   3 = U' needed (three CW = one CCW)
 *
 * Only positions 0-3 (U-layer corners) are compared. D-layer (4-7) is
 * assumed solved and ignored.
 *
 * @param cp Current corner permutation (8 elements, from CubeState.cp)
 * @param canonicalCp Reference canonical corner permutation
 * @returns Number of CW U-layer quarter turns (0-3)
 */
export function detectCanonicalAuf(
  cp: ArrayLike<number>,
  canonicalCp: ArrayLike<number>,
): 0 | 1 | 2 | 3 {
  for (let rot = 0; rot < 4; rot++) {
    let match = true;
    for (let i = 0; i < 4; i++) {
      // After `rot` CW rotations of the ORIGINAL state, position `i`
      // receives the piece that was at position `(i - rot + 4) % 4`.
      // So we check: cp[srcIdx] === canonicalCp[i].
      const srcIdx = (i - rot + 4) % 4;
      if (cp[srcIdx] !== canonicalCp[i]) {
        match = false;
        break;
      }
    }
    if (match) return rot as 0 | 1 | 2 | 3;
  }

  throw new Error(
    `Cannot align cp [${Array.from(cp).slice(0, 4)}] to canonical [${Array.from(canonicalCp).slice(0, 4)}]`,
  );
}

/**
 * Generate all 4 AUF variants of a case state.
 *
 *   [0] = original (no AUF)
 *   [1] = U  applied
 *   [2] = U2 applied
 *   [3] = U' applied
 *
 * For symmetric cases (e.g., H perm is invariant under U2), some variants
 * may produce identical states.
 *
 * @param state The case state
 * @returns Array of 4 CubeStates, one per AUF variant
 */
export function generateAufVariants(state: CubeState): CubeState[] {
  const variants: CubeState[] = [];
  for (let auf = 0; auf < 4; auf++) {
    const variant = state.clone();
    const moves = ['', 'U', 'U2', "U'"];
    if (auf > 0) {
      variant.applySequence(moves[auf]);
    }
    variants.push(variant);
  }
  return variants;
}

/**
 * Normalize a case state to its canonical orientation using a reference
 * corner permutation from the seed data.
 *
 *   1. detectCanonicalAuf finds how many CW U turns align state to reference
 *   2. Apply that many U moves to the state to produce the canonical form
 *
 * @param state The (possibly rotated) PLL case state
 * @param canonicalCp Reference canonical corner permutation (8 elements)
 * @returns { canonicalState, auf } where auf is the detected AUF (0-3)
 */
export function normalizeToCanonical(
  state: CubeState,
  canonicalCp: ArrayLike<number>,
): { canonicalState: CubeState; auf: 0 | 1 | 2 | 3 } {
  const auf = detectCanonicalAuf(state.cp, canonicalCp);

  // Apply AUF to bring state to canonical
  const result = state.clone();
  if (auf > 0) {
    const moves = ['', 'U', 'U2', "U'"];
    result.applySequence(moves[auf]);
  }

  return { canonicalState: result, auf };
}
