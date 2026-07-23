/**
 * Utilities for expanding wide moves and normalizing algorithm notation.
 */

/**
 * Expand algorithm move tokens into face moves and slice moves.
 *
 * Wide moves (r, l, f, u, d, b) are expanded into face + slice moves
 * (e.g. r → R M'). This preserves the cube's fixed spatial reference frame —
 * unlike expanding to whole-cube rotations (e.g. r → x L') which shifts the
 * reference frame mid-sequence and corrupts case-state / diagram generation.
 *
 * Slice moves (M, S, E) and whole-cube rotations (x, y, z) are passed through as-is.
 *
 * @param movesInput Single algorithm string (space-separated) or array of move tokens.
 * @returns Array of elementary move tokens.
 */
export function expandWideMoves(movesInput: string | string[]): string[] {
  const tokens = typeof movesInput === 'string'
    ? movesInput.trim().split(/\s+/).filter(Boolean)
    : movesInput;

  const result: string[] = [];

  for (let t of tokens) {
    t = t.replace(/[()]/g, '').replace(/2'/g, '2');
    switch (t) {
      // Wide moves → face + slice (preserves reference frame)
      case 'r': result.push('R', "M'"); break;
      case "r'": result.push("R'", 'M'); break;
      case 'r2': result.push('R2', 'M2'); break;

      case 'l': result.push('L', 'M'); break;
      case "l'": result.push("L'", "M'"); break;
      case 'l2': result.push('L2', 'M2'); break;

      case 'f': result.push('F', 'S'); break;
      case "f'": result.push("F'", "S'"); break;
      case 'f2': result.push('F2', 'S2'); break;

      case 'u': result.push('U', "E'"); break;
      case "u'": result.push("U'", 'E'); break;
      case 'u2': result.push('U2', 'E2'); break;

      case 'd': result.push('D', 'E'); break;
      case "d'": result.push("D'", "E'"); break;
      case 'd2': result.push('D2', 'E2'); break;

      case 'b': result.push('B', "S'"); break;
      case "b'": result.push("B'", 'S'); break;
      case 'b2': result.push('B2', 'S2'); break;

      default:
        result.push(t);
        break;
    }
  }

  return result;
}
