import { expandWideMoves } from '@cubeforge/math-core';
import type { AlgorithmCase, Algorithm } from '../schema';

const OLL_SUBSET_ID = '00000000-0000-4000-9000-000000000002';

/**
 * Compute move-count metrics from the ORIGINAL string notation (before
 * expansion into face + slice tokens).  Counting from the original
 * representation avoids double-counting wide moves — a wide move like `r`
 * counts as 1 HTM, whereas its expansion `R M'` would naively count as 2.
 */
function computeMetricFromString(movesStr: string, metric: 'htm' | 'qtm' | 'stm'): number {
  const tokens = movesStr.trim().split(/\s+/).filter(Boolean);
  let count = 0;

  for (let t of tokens) {
    t = t.replace(/[()]/g, '').replace(/2'/g, '2');
    const base = t[0];
    const isRotation = base === 'x' || base === 'y' || base === 'z';

    if (metric === 'stm') {
      if (isRotation) continue;
      count++;
      continue;
    }

    if (isRotation) continue;

    if (metric === 'htm') {
      count++;
    } else {
      // QTM: half-turns count as 2, everything else 1
      count += t.includes('2') ? 2 : 1;
    }
  }

  return count;
}

function alg(
  id: string, caseId: string, moves: string[], isDefault = true,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  triggers: string[] = [], notes?: string,
  moveCount?: { htm: number; qtm: number; stm: number },
): Algorithm {
  return {
    id, caseId, moves,
    moveCount: moveCount ?? { htm: 0, qtm: 0, stm: 0 },
    isDefault, source: 'SpeedCubeDB', difficulty, triggers, notes,
    isMirror: false, isInverse: false, isCustom: false, sortOrder: 0,
  };
}

function caseUuid(n: number): string {
  return `30000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}
function algUuid(n: number, variant = 0): string {
  return `40000000-0000-4000-a000-${String(n * 10 + variant).padStart(12, '0')}`;
}

/**
 * Returns the real probability of each OLL case based on its rotational symmetry:
 *   1/216  — OLL 20  (4-fold / 90° symmetry: appears identical from every AUF)
 *   1/108  — OLL 1, 21, 55, 56, 57  (2-fold / 180° symmetry)
 *   1/54   — all other 51 cases (no rotational symmetry)
 *
 * Verification: 1×(1/216) + 5×(1/108) + 51×(1/54)
 *             = 1/216 + 10/216 + 204/216 = 215/216  ✓  (remaining 1/216 = OLL skip)
 */
function ollProbability(n: number): string {
  if (n === 20) return '1/216';
  if ([1, 21, 55, 56, 57].includes(n)) return '1/108';
  return '1/54';
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
  const moves = expandWideMoves(movesStr);
  const metrics = {
    htm: computeMetricFromString(movesStr, 'htm'),
    qtm: computeMetricFromString(movesStr, 'qtm'),
    stm: computeMetricFromString(movesStr, 'stm'),
  };
  return {
    caseDef: {
      id: caseUuid(n), subsetId: OLL_SUBSET_ID,
      caseNumber: `OLL ${n}`, name: `OLL ${n}`,
      recognitionPatterns: [],
      setupScramble,
      diagramType: '2d-top',
      diagram2D: {},
      probability: ollProbability(n), difficulty, category, tags, puzzleType: '3x3x3',
    },
    algorithms: [alg(algUuid(n), caseUuid(n), moves, true, difficulty, [], notes, metrics)],
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
