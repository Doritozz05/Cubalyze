import type { AlgorithmCase, Algorithm } from '../schema';

const OLL_SUBSET_ID = '00000000-0000-4000-9000-000000000002';

function computeMetric(moves: string[], metric: 'htm' | 'qtm' | 'stm'): number {
  let count = 0;
  for (const m of moves) {
    const base = m[0];
    const isSlice = base === 'M' || base === 'S' || base === 'E';
    if (metric === 'stm') { if (isSlice) count++; continue; }
    if (isSlice) { if (metric === 'htm') count++; continue; }
    if (base === 'x' || base === 'y' || base === 'z') continue;
    if (metric === 'htm') count++;
    else count += m.includes('2') ? 2 : 1;
  }
  return count;
}

function alg(
  id: string, caseId: string, moves: string[], isDefault = true,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  triggers: string[] = [], notes?: string,
): Algorithm {
  return {
    id, caseId, moves,
    moveCount: { htm: computeMetric(moves,'htm'), qtm: computeMetric(moves,'qtm'), stm: computeMetric(moves,'stm') },
    isDefault, source: 'SpeedCubeDB', difficulty, triggers, notes,
    isMirror: false, isInverse: false,
  };
}

function caseUuid(n: number): string {
  return `30000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}
function algUuid(n: number, variant = 0): string {
  return `40000000-0000-4000-a000-${String(n * 10 + variant).padStart(12, '0')}`;
}

/**
 * Expand algorithm move tokens into face moves and whole-cube rotations.
 *
 * Wide moves (r, l, f, u, d, b) and slice moves (M, S, E) are expanded using
 * whole-cube rotations (x, y, z) + opposite face turns. This ensures that
 * slice moves do NOT falsely cancel outer-layer face turns when inverted.
 */
function parseMoves(movesStr: string): string[] {
  const tokens = movesStr.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (let t of tokens) {
    t = t.replace(/[()]/g, '').replace(/2'/g, '2');
    switch (t) {
      // Wide moves
      case 'r': result.push('x', "L'"); break;
      case "r'": result.push("x'", 'L'); break;
      case 'r2': result.push('x2', 'L2'); break;

      case 'l': result.push("x'", "R'"); break;
      case "l'": result.push('x', 'R'); break;
      case 'l2': result.push('x2', 'R2'); break;

      case 'f': result.push('z', "B'"); break;
      case "f'": result.push("z'", 'B'); break;
      case 'f2': result.push('z2', 'B2'); break;

      case 'u': result.push('y', "D'"); break;
      case "u'": result.push("y'", 'D'); break;
      case 'u2': result.push('y2', 'D2'); break;

      case 'd': result.push("y'", "U'"); break;
      case "d'": result.push('y', 'U'); break;
      case 'd2': result.push('y2', 'U2'); break;

      case 'b': result.push("z'", "F'"); break;
      case "b'": result.push('z', 'F'); break;
      case 'b2': result.push('z2', 'F2'); break;

      // Slice moves
      case 'M': result.push("x'", "R'", 'L'); break;
      case "M'": result.push('x', 'R', "L'"); break;
      case 'M2': result.push('x2', 'R2', 'L2'); break;

      case 'S': result.push('z', "F'", 'B'); break;
      case "S'": result.push("z'", 'F', "B'"); break;
      case 'S2': result.push('z2', 'F2', 'B2'); break;

      case 'E': result.push("y'", 'U', "D'"); break;
      case "E'": result.push('y', "U'", 'D'); break;
      case 'E2': result.push('y2', 'U2', 'D2'); break;

      default: result.push(t); break;
    }
  }
  return result;
}

function makeOllCase(
  n: number,
  category: string,
  setupScramble: string,
  movesStr: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  tags: string[] = [],
  notes?: string,
): { caseDef: AlgorithmCase; algorithms: Algorithm[] } {
  const moves = parseMoves(movesStr);
  return {
    caseDef: {
      id: caseUuid(n), subsetId: OLL_SUBSET_ID,
      caseNumber: `OLL ${n}`, name: `OLL ${n}`,
      recognitionPatterns: [],
      setupScramble,
      diagramType: '2d-top',
      diagram2D: { highlightedPieces: [] },
      probability: '1/54', difficulty, category, tags, puzzleType: '3x3x3',
    },
    algorithms: [alg(algUuid(n), caseUuid(n), moves, true, difficulty, [], notes)],
  };
}

// ─── All 57 Verified SpeedCubeDB OLL Cases ──────────────────────────────────

export const OLL_CASES = [
  makeOllCase(1, "Dot Case", "F R' F' R U2' F R' F' R2' U2' R'", "R U2 R2 F R F' U2 R' F R F'", 'intermediate', ['dot']),
  makeOllCase(2, "Dot Case", "f U R U' R' f' F U R U' R' F'", "F R U R' U' F' f R U R' U' f'", 'intermediate', ['dot']),
  makeOllCase(3, "Dot Case", "F U R U' R' F' U f U R U' R' f' y", "y' f R U R' U' f' U' F R U R' U' F'", 'intermediate', ['dot']),
  makeOllCase(4, "Dot Case", "F U R U' R' F' U' f U R U' R' f' y", "y' f R U R' U' f' U F R U R' U' F'", 'intermediate', ['dot']),
  makeOllCase(5, "Square Shapes", "r' U' R U' R' U2' r", "r' U2 R U R' U r", 'intermediate', ['square']),
  makeOllCase(6, "Square Shapes", "r U R' U R U2' r'", "r U2 R' U' R U' r'", 'intermediate', ['square']),
  makeOllCase(7, "Lightning Shapes", "r U2' R' U' R U' r'", "r U R' U R U2 r'", 'intermediate', ['lightning']),
  makeOllCase(8, "Lightning Shapes", "r' U2' R U R' U r y2'", "y2 r' U' R U' R' U2 r", 'intermediate', ['lightning']),
  makeOllCase(9, "Fish Shapes", "F U R U' R2' F' R U R U' R' y'", "y R U R' U' R' F R2 U R' U' F'", 'intermediate', ['fish']),
  makeOllCase(10, "Fish Shapes", "R U2' R' F R' F' R U' R U' R'", "R U R' U R' F R F' R U2 R'", 'intermediate', ['fish']),
  makeOllCase(11, "Lightning Shapes", "M U' R U2' R' U' R U' R2' r", "r' R2 U R' U R U2 R' U M'", 'intermediate', ['lightning']),
  makeOllCase(12, "Lightning Shapes", "F U R U' R' F' U' F U R U' R' F'", "F R U R' U' F' U F R U R' U' F'", 'intermediate', ['lightning']),
  makeOllCase(13, "Knight Move Shapes", "F' U' F r U' r' U r U r'", "r U' r' U' r U r' F' U F", 'intermediate', ['knight']),
  makeOllCase(14, "Knight Move Shapes", "F U F' R' F R U' R' F' R", "R' F R U R' F' R F U' F'", 'intermediate', ['knight']),
  makeOllCase(15, "Knight Move Shapes", "r' U' r U' R' U R r' U r", "r' U' r R' U' R U r' U r", 'intermediate', ['knight']),
  makeOllCase(16, "Knight Move Shapes", "r U r' U R U' R' r U' r'", "r U r' R U R' U' r U' r'", 'intermediate', ['knight']),
  makeOllCase(17, "Dot Case", "F R' F' R U2' F R' F' R U' R U' R'", "R U R' U R' F R F' U2 R' F R F'", 'intermediate', ['dot']),
  makeOllCase(18, "Dot Case", "r' U2' R U R' U r2' U2' R' U' R U' r'", "y R U2 R2 F R F' U2 M' U R U' r'", 'intermediate', ['dot']),
  makeOllCase(19, "Dot Case", "F R' F' R M U R U' R' U' M'", "M U R U R' U' M' R' F R F'", 'intermediate', ['dot']),
  makeOllCase(20, "Dot Case", "r U R' U' M2' U R U' R' U' M'", "r U R' U' M2 U R U' R' U' M'", 'intermediate', ['dot']),
  makeOllCase(21, "OCLL", "R U R' U R U' R' U R U2' R' y'", "R U R' U R U' R' U R U2 R'", 'beginner', ['ocll']),
  makeOllCase(22, "OCLL", "R' U2' R2' U R2' U R2' U2' R'", "R U2 R2 U' R2 U' R2 U2 R", 'beginner', ['ocll']),
  makeOllCase(23, "OCLL", "R U2' R D R' U2' R D' R2'", "R2 D R' U2 R D' R' U2 R'", 'beginner', ['ocll']),
  makeOllCase(24, "OCLL", "F R' F' r U R U' r'", "r U R' U' r' F R F'", 'beginner', ['ocll']),
  makeOllCase(25, "OCLL", "R' F' r U R U' r' F y'", "y F' r U R' U' r' F R", 'beginner', ['ocll']),
  makeOllCase(26, "OCLL", "R U R' U R U2' R' y'", "y R U2 R' U' R U' R'", 'beginner', ['ocll','antisune']),
  makeOllCase(27, "OCLL", "R U2' R' U' R U' R'", "R U R' U R U2 R'", 'beginner', ['ocll','sune']),
  makeOllCase(28, "All Corners Oriented", "R U R' U' M' U R U' r'", "r U R' U' M U R U' R'", 'intermediate', ['corners-oriented']),
  makeOllCase(29, "Awkward Shapes", "M F R' F' R U R U' R' U' M'", "y R U R' U' R U' R' F' U' F R U R'", 'intermediate', ['awkward']),
  makeOllCase(30, "Awkward Shapes", "F U R U2' R' U R U2' R' U' F' y2'", "y2 F U R U2 R' U' R U2 R' U' F'", 'intermediate', ['awkward']),
  makeOllCase(31, "P Shapes", "R' F R U R' U' F' U R", "R' U' F U R U' R' F' R", 'beginner', ['p']),
  makeOllCase(32, "P Shapes", "f R' F' R U R U' R' S'", "S R U R' U' R' F R f'", 'beginner', ['p']),
  makeOllCase(33, "T Shapes", "F R' F' R U R U' R'", "R U R' U' R' F R F'", 'beginner', ['t']),
  makeOllCase(34, "C Shapes", "F U R' U' R' F' R U R2' U' R' y2'", "y2 R U R2 U' R' F R U R U' F'", 'intermediate', ['c']),
  makeOllCase(35, "Fish Shapes", "R U2' R' F R' F' R2' U2' R'", "R U2 R2 F R F' R U2 R'", 'intermediate', ['fish']),
  makeOllCase(36, "W Shapes", "F' L F L' U' L' U' L U L' U L y2'", "y2 L' U' L U' L' U L U L F' L' F", 'intermediate', ['w']),
  makeOllCase(37, "Fish Shapes", "F R U' R' U R U R' F'", "F R' F' R U R U' R'", 'intermediate', ['fish']),
  makeOllCase(38, "W Shapes", "F R' F' R U R U R' U' R U' R'", "R U R' U R U' R' U' R' F R F'", 'intermediate', ['w']),
  makeOllCase(39, "Lightning Shapes", "L U F' U' L' U L F L' y'", "y L F' L' U' L U F U' L'", 'intermediate', ['lightning']),
  makeOllCase(40, "Lightning Shapes", "R' U' F U R U' R' F' R y'", "y R' F R U R' U' F' U R", 'intermediate', ['lightning']),
  makeOllCase(41, "Awkward Shapes", "F U R U' R' F' R U2' R' U' R U' R' y2'", "y2 R U R' U R U2 R' F R U R' U' F'", 'intermediate', ['awkward']),
  makeOllCase(42, "Awkward Shapes", "F U R U' R' F' R' U2' R U R' U R", "R' U' R U' R' U2 R F R U R' U' F'", 'intermediate', ['awkward']),
  makeOllCase(43, "P Shapes", "f' U' L' U L f", "f' L' U' L U f", 'beginner', ['p']),
  makeOllCase(44, "P Shapes", "f U R U' R' f'", "f R U R' U' f'", 'beginner', ['p']),
  makeOllCase(45, "T Shapes", "F U R U' R' F'", "F R U R' U' F'", 'beginner', ['t']),
  makeOllCase(46, "C Shapes", "R' U' F R' F' R U R", "R' U' R' F R F' U R", 'intermediate', ['c']),
  makeOllCase(47, "L Shapes", "F' U' L' U L U' L' U L F", "F' L' U' L U L' U' L U F", 'intermediate', ['l']),
  makeOllCase(48, "L Shapes", "F U R U' R' U R U' R' F'", "F R U R' U' R U R' U' F'", 'intermediate', ['l']),
  makeOllCase(49, "L Shapes", "r' U r2' U' r2' U' r2' U r' y2'", "y2 r U' r2 U r2 U r2 U' r", 'intermediate', ['l']),
  makeOllCase(50, "L Shapes", "r U' r2' U r2' U r2' U' r", "r' U r2 U' r2 U' r2 U r'", 'intermediate', ['l']),
  makeOllCase(51, "Line Shapes", "f U R U' R' U R U' R' f'", "f R U R' U' R U R' U' f'", 'intermediate', ['line']),
  makeOllCase(52, "Line Shapes", "F R U R' d R' U' R U' R'", "R U R' U R d' R U' R' F'", 'intermediate', ['line']),
  makeOllCase(53, "L Shapes", "r' U2' R U R' U' R U R' U r", "r' U' R U' R' U R U' R' U2 r", 'intermediate', ['l']),
  makeOllCase(54, "L Shapes", "r U2' R' U' R U R' U' R U' r'", "r U R' U R U' R' U R U2 r'", 'intermediate', ['l']),
  makeOllCase(55, "Line Shapes", "F R' F' U2' R U R' U R2' U2' R'", "R U2 R2 U' R U' R' U2 F R F'", 'intermediate', ['line']),
  makeOllCase(56, "Line Shapes", "r U r' R U R' U' R U R' U' r U' r'", "r U r' U R U' R' U R U' R' r U' r'", 'intermediate', ['line']),
  makeOllCase(57, "All Corners Oriented", "r U R' U' M U R U' R'", "R U R' U' M' U R U' r'", 'intermediate', ['corners-oriented']),
];
