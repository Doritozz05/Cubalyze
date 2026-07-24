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
      case 'r': case 'Rw': result.push('R', "M'"); break;
      case "r'": case "Rw'": result.push("R'", 'M'); break;
      case 'r2': case 'Rw2': result.push('R2', 'M2'); break;

      case 'l': case 'Lw': result.push('L', 'M'); break;
      case "l'": case "Lw'": result.push("L'", "M'"); break;
      case 'l2': case 'L2w': case 'Lw2': result.push('L2', 'M2'); break;

      case 'f': case 'Fw': result.push('F', 'S'); break;
      case "f'": case "Fw'": result.push("F'", "S'"); break;
      case 'f2': case 'Fw2': result.push('F2', 'S2'); break;

      case 'u': case 'Uw': result.push('U', "E'"); break;
      case "u'": case "Uw'": result.push("U'", 'E'); break;
      case 'u2': case 'Uw2': result.push('U2', 'E2'); break;

      case 'd': case 'Dw': result.push('D', 'E'); break;
      case "d'": case "Dw'": result.push("D'", "E'"); break;
      case 'd2': case 'Dw2': result.push('D2', 'E2'); break;

      case 'b': case 'Bw': result.push('B', "S'"); break;
      case "b'": case "Bw'": result.push("B'", 'S'); break;
      case 'b2': case 'Bw2': result.push('B2', 'S2'); break;

      default:
        result.push(t);
        break;
    }
  }

  return result;
}
