/**
 * Pure utility for compacting consecutive identical moves in a display
 * notation array using modular arithmetic.
 *
 * # Rules
 * - Consecutive moves of the same base face (F/R/U/L/D/B) are merged.
 * - Consecutive rotations (x/y/z) are merged.
 * - Different bases break the grouping: F R F stays F R F.
 * - Rotations break face-move groupings and vice versa.
 * - Unknown tokens pass through unchanged.
 *
 * # Mathematics
 * Each token is parsed into `{ base, stepValue }` where:
 *   CW  (no suffix) → +1 quarter-turn
 *   CCW (')         → −1 quarter-turn
 *   180° (2)        → +2 quarter-turns
 *
 * Consecutive same-base steps are summed, then taken modulo 4:
 *   mod 0 → dropped (identity, net zero)
 *   mod 1 → base only (F)
 *   mod 2 → base + "2" (F2)
 *   mod 3 → base + "'" (F')
 *
 * This is purely a presentation-layer transform. It does NOT alter
 * raw moves, cube state, analysis, solving, or scrambles.
 *
 * @example
 * compactMoveNotation(["F", "F"])           // → ["F2"]
 * compactMoveNotation(["F", "F", "F"])      // → ["F'"]
 * compactMoveNotation(["F", "F", "F", "F"]) // → []
 * compactMoveNotation(["y", "y"])           // → ["y2"]
 * compactMoveNotation(["R", "U", "R"])      // → ["R", "U", "R"]
 * compactMoveNotation(["F", "y", "F"])      // → ["F", "y", "F"]
 */
export function compactMoveNotation(tokens: string[]): string[] {
  if (tokens.length === 0) return [];

  const parsed = tokens.map(parseToken);
  const result: string[] = [];

  let i = 0;
  while (i < parsed.length) {
    const current = parsed[i];

    // Non-compactable tokens pass through unchanged
    if (current === null) {
      result.push(tokens[i]);
      i++;
      continue;
    }

    // Accumulate consecutive same-base tokens
    let totalSteps = current.stepValue;
    let j = i + 1;

    while (j < parsed.length) {
      const next = parsed[j];
      if (next !== null && next.base === current.base) {
        totalSteps += next.stepValue;
        j++;
      } else {
        break;
      }
    }

    // Emit compacted result
    const emitted = serializeSteps(current.base, totalSteps);
    if (emitted !== null) {
      result.push(emitted);
    }

    i = j;
  }

  return result;
}

// ─── Internals ──────────────────────────────────────────────────────────────

interface ParsedToken {
  /** Base face/axis: F, R, U, L, D, B, x, y, z */
  base: string;
  /** Net quarter-turn effect: CW=+1, CCW=−1, 180°=+2 */
  stepValue: number;
}

const COMPACTABLE_BASES = new Set([
  'F', 'R', 'U', 'L', 'D', 'B', // face moves
  'M', 'E', 'S',                // slice moves
  'x', 'y', 'z',                // rotations
]);

/**
 * Parse a notation token into its base and step value.
 * Returns null for non-compactable tokens (unknown notation, or tokens
 * that don't map to a rotatable axis/face).
 */
function parseToken(token: string): ParsedToken | null {
  if (token.length < 1) return null;

  const base = token[0];
  if (!COMPACTABLE_BASES.has(base)) return null;

  const suffix = token.slice(1);

  let stepValue: number;
  if (suffix === "'" || suffix === "2'") {
    stepValue = -1;
  } else if (suffix === '2') {
    stepValue = 2;
  } else if (suffix === '') {
    stepValue = 1;
  } else {
    return null; // unknown suffix
  }

  return { base, stepValue };
}

/**
 * Serialize accumulated steps into a notation token.
 * Returns null if the net effect is identity (mod 4 === 0).
 */
function serializeSteps(base: string, totalSteps: number): string | null {
  // Normalize to [0, 3] range for quarter turns
  const mod = ((totalSteps % 4) + 4) % 4;

  switch (mod) {
    case 0:
      return null;      // identity — drop
    case 1:
      return base;      // CW
    case 2:
      return base + '2'; // 180°
    case 3:
      return base + "'"; // CCW (≡ 3 CW)
    default:
      return null;
  }
}
