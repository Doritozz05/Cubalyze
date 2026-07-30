import { expandWideMoves } from '@cubeforge/math-core';
import type { AlgorithmCase, Algorithm } from '../schema';

// ─── Subset IDs (from methodRegistry.ts) ───────────────────────────────────
const OLL_SUBSET_ID = '00000000-0000-4000-9000-000000000051';
const PBL_SUBSET_ID = '00000000-0000-4000-9000-000000000052';

// ─── UUID helpers ──────────────────────────────────────────────────────────

function caseUuid(n: number): string {
  return `60000000-0000-4000-b000-${String(n).padStart(12, '0')}`;
}
function algUuid(n: number, variant = 0): string {
  return `70000000-0000-4000-b000-${String(n * 10 + variant).padStart(12, '0')}`;
}

// ─── Metrics ───────────────────────────────────────────────────────────────

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
      count += t.includes('2') ? 2 : 1;
    }
  }

  return count;
}

function alg(
  id: string,
  caseId: string,
  moves: string[],
  movesStr: string,
  isDefault = true,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  triggers: string[] = [],
  notes?: string,
): Algorithm {
  return {
    id, caseId, moves,
    moveCount: {
      htm: computeMetricFromString(movesStr, 'htm'),
      qtm: computeMetricFromString(movesStr, 'qtm'),
      stm: computeMetricFromString(movesStr, 'stm'),
    },
    isDefault, source: 'SpeedCubeDB', difficulty, triggers, notes,
    isMirror: false, isInverse: false,
  };
}

type AlgInput = { moves: string; isDefault?: boolean; tags?: string[] };

// ─── Make Ortega OLL case ──────────────────────────────────────────────────

function makeOllCase(
  n: number,
  name: string,
  category: string,
  algorithmsData: AlgInput[],
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  tags: string[] = [],
): { caseDef: AlgorithmCase; algorithms: Algorithm[] } {
  const caseId = caseUuid(100 + n);
  return {
    caseDef: {
      id: caseId,
      subsetId: OLL_SUBSET_ID,
      caseNumber: `Ortega OLL ${name}`,
      name: `Ortega OLL — ${name}`,
      recognitionPatterns: [],
      setupScramble: '',
      diagramType: 'none',
      difficulty,
      category,
      tags,
      puzzleType: '2x2x2',
    },
    algorithms: algorithmsData.map((algData, i) => {
      const moves = expandWideMoves(algData.moves);
      return alg(
        algUuid(100 + n, i),
        caseId,
        moves,
        algData.moves,
        algData.isDefault ?? (i === 0),
        difficulty,
        algData.tags ?? [],
      );
    }),
  };
}

// ─── Make Ortega PBL case ──────────────────────────────────────────────────

function makePblCase(
  n: number,
  name: string,
  category: string,
  algorithmsData: AlgInput[],
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  tags: string[] = [],
): { caseDef: AlgorithmCase; algorithms: Algorithm[] } {
  const caseId = caseUuid(200 + n);
  return {
    caseDef: {
      id: caseId,
      subsetId: PBL_SUBSET_ID,
      caseNumber: `Ortega PBL ${name}`,
      name: `Ortega PBL — ${name}`,
      recognitionPatterns: [],
      setupScramble: '',
      diagramType: 'none',
      difficulty,
      category,
      tags,
      puzzleType: '2x2x2',
    },
    algorithms: algorithmsData.map((algData, i) => {
      const moves = expandWideMoves(algData.moves);
      return alg(
        algUuid(200 + n, i),
        caseId,
        moves,
        algData.moves,
        algData.isDefault ?? (i === 0),
        difficulty,
        algData.tags ?? [],
      );
    }),
  };
}

// ─── Ortega OLL Cases (7) ─────────────────────────────────────────────────

export const ORTEGA_OLL_CASES = [
  makeOllCase(0, 'Sune', 'Sune', [
    { moves: "R U R' U R U2 R'", isDefault: true },
    { moves: "R U R2 U' R2 U R" },
    { moves: "R U' L' U R' U' L" },
    { moves: "y' R' U2 R U R' U R" },
  ], 'beginner', ['sune']),

  makeOllCase(1, 'Anti Sune', 'Anti Sune', [
    { moves: "R U2 R' U' R U' R'", isDefault: true },
    { moves: "y L' U' L U' L' U2 L" },
    { moves: "y' R' U' R U' R' U2 R" },
    { moves: "R' F R F' R U R'" },
  ], 'beginner', ['antisune']),

  makeOllCase(2, 'Pi', 'Pi', [
    { moves: "F R U R' U' R U R' U' F'", isDefault: true },
    { moves: "R U' R2 U R2 U R2 U' R" },
    { moves: "R U2 R2 U' R2 U' R2 U2 R" },
    { moves: "y' R' F R2 U' R2 F R" },
  ], 'intermediate', ['pi']),

  makeOllCase(3, 'P', 'P', [
    { moves: "F R U R' U' F'", isDefault: true },
    { moves: "y2 F U R U' R' F'" },
    { moves: "y' R2 D R' U2 R D' R' U2 R'" },
    { moves: "y R2 D' R U2 R' D R U2 R" },
  ], 'beginner', ['p']),

  makeOllCase(4, 'L', 'L', [
    { moves: "y F' R U R' U' R' F R", isDefault: true },
    { moves: "F R U' R' U' R U R' F'" },
    { moves: "F R' F' R U R U' R'" },
    { moves: "F' R U R' U' R' F R" },
  ], 'intermediate', ['l']),

  makeOllCase(5, 'T', 'T', [
    { moves: "R U R' U' R' F R F'", isDefault: true },
    { moves: "R U2 R U2 R2" },
    { moves: "U R U R' U' F' U' F" },
    { moves: "y2 x U' L' U R' U' L U R" },
  ], 'beginner', ['t']),

  makeOllCase(6, 'H', 'H', [
    { moves: "R2 U2 R' U2 R2", isDefault: true },
    { moves: "R2 U2 R U2 R2" },
    { moves: "F R U R' U' R U R' U' R U R' U' F'" },
    { moves: "y R U R' U R U' R' U R U2 R'" },
  ], 'intermediate', ['h']),
];

// ─── Ortega PBL Cases (6) ─────────────────────────────────────────────────
// SpeedCubeDB lists Adj Opp and Opp Adj as separate cases.

export const ORTEGA_PBL_CASES = [
  makePblCase(0, 'Adj', 'Adjacent swap (top)', [
    { moves: "y R U R' F' R U R' U' R' F R2 U' R'", isDefault: true },
    { moves: "y R' F R F' R U2 R' U R U2 R'" },
    { moves: "y R U R' U' R' F R2 U' R' U' R U R' F'" },
    { moves: "y2 R' F R' F2 R U' R' F2 R2" },
  ], 'beginner', ['adjacent']),

  makePblCase(1, 'Opp', 'Opposite swap (top)', [
    { moves: "R U' R' U' F2 U' R U R' U F2", isDefault: true },
    { moves: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
    { moves: "R U' R' U' F2 U' R U R' D R2" },
    { moves: "z2 R U' R' U' F2 U' R U R' U R2 B2" },
  ], 'beginner', ['opposite']),

  makePblCase(2, 'Opp Opp', 'Both layers opposite', [
    { moves: "R2 F2 R2", isDefault: true },
    { moves: "R2 B2 R2" },
    { moves: "x R2 U2 R2" },
    { moves: "x' R2 U2 R2" },
  ], 'beginner', ['opposite', 'opposite']),

  makePblCase(3, 'Adj Adj', 'Both layers adjacent', [
    { moves: "R2 U' B2 U2 R2 U' R2", isDefault: true },
    { moves: "y2 R2 U' R2 U2 F2 U' R2" },
    { moves: "R2 U R2 U2 F2 U F2" },
    { moves: "R2 U' F2 U2 R2 U' B2" },
  ], 'intermediate', ['adjacent', 'adjacent']),

  makePblCase(4, 'Adj Opp', 'Adjacent top + Opposite bottom', [
    { moves: "R U' R F2 R' U R'", isDefault: true },
    { moves: "R' F R' F2 R U' R" },
    { moves: "y2 R' U R' F2 R F' R" },
    { moves: "y2 R' U L' U2 R U' L" },
  ], 'intermediate', ['adjacent', 'opposite']),

  makePblCase(5, 'Opp Adj', 'Opposite top + Adjacent bottom', [
    { moves: "y R2 U R2 U' R2 U R2 U' R2", isDefault: true },
    { moves: "R' D R' F2 R D' R" },
    { moves: "z2 R U' R F2 R' U R'" },
    { moves: "y R2 U' R2 U R2 U' R2 U R2" },
  ], 'intermediate', ['opposite', 'adjacent']),
];
