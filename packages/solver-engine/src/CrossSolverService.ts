/**
 * @cubeforge/solver-engine — CrossSolverService
 *
 * Modular, reusable high-level service to solve the cross for any scramble.
 * Supports solving on any of the 6 faces in WCA standard orientation:
 *   • U: White (default)
 *   • D: Yellow
 *   • F: Green
 *   • B: Blue
 *   • L: Orange
 *   • R: Red
 *
 * Speedcubing CFOP standard: The cross is ALWAYS solved on the BOTTOM (D) face.
 * To solve on the target color, the cube is reoriented during inspection:
 *   • White (U)  -> z2 (keeps Green in front, White to bottom)
 *   • Yellow (D) -> no rotation (already on bottom)
 *   • Green (F)  -> x' (Green to bottom)
 *   • Blue (B)   -> x (Blue to bottom)
 *   • Orange (L) -> z' (Orange to bottom)
 *   • Red (R)    -> z (Red to bottom)
 *
 * Solution moves are automatically remapped to the cuber's rotated body frame
 * using MoveTransformer and OrientationTable, guaranteeing that executing the
 * returned pre-rotation followed by the moves solves the cross on the bottom face.
 */

import { CubeState, MoveTransformer, OrientationTable } from '@cubeforge/math-core';
import {
  PhaseSolver,
  solveCross,
  type PhaseSolution,
} from './PhaseSolver';

export type CubeFace = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';

export interface CrossSolutionItem {
  /** Pre-ALG inspection rotation to put cross on bottom (e.g. "z2", "x'", or "" if none). */
  preRotation: string;
  /** Cross moves remapped to the rotated body frame. */
  moves: string;
  /** Full algorithm notation (e.g. "z2 D R' F D2" or "D R' F D2"). */
  notation: string;
  /** Number of face turns in the cross (excluding pre-rotation). */
  moveCount: number;
}

export interface CrossSolutionResult {
  face: CubeFace;
  depth: number;
  solutions: CrossSolutionItem[];
}

export interface CrossSolverOptions {
  /** Target cross face (default 'U' = White). */
  face?: CubeFace;
  /** Maximum number of solutions to return (default 2). */
  maxSolutions?: number;
  /** Maximum depth to search (default 8, which covers all possible cross states). */
  maxDepth?: number;
}

interface FacePreRotation {
  rotation: string;
  orientationToken: string | null;
}

const FACE_PRE_ROTATIONS: Record<CubeFace, FacePreRotation> = {
  U: { rotation: 'z2', orientationToken: 'z2' },
  D: { rotation: '',   orientationToken: null },
  F: { rotation: "x'", orientationToken: "x'" },
  B: { rotation: 'x',  orientationToken: 'x' },
  L: { rotation: "z'", orientationToken: "z'" },
  R: { rotation: 'z',  orientationToken: 'z' },
};

export class CrossSolverService {
  /**
   * Solve cross from a scramble string on the given face (default 'U' = White).
   * Guarantees returning up to `maxSolutions` (default 2) shortest solutions,
   * remapped with the appropriate pre-rotation so the cross is solved on bottom (D).
   */
  static solve(scramble: string, options: CrossSolverOptions = {}): CrossSolutionResult {
    const face: CubeFace = options.face ?? 'U';
    const maxSolutions = options.maxSolutions ?? 2;
    const maxDepth = options.maxDepth ?? 8;

    const state = new CubeState();
    if (scramble && scramble.trim().length > 0) {
      try {
        state.applySequence(scramble);
      } catch {
        // If scramble is invalid, return empty solutions
        return {
          face,
          depth: 0,
          solutions: [],
        };
      }
    }

    // First search for optimal solutions at the lowest depth
    const optimalSolutions: PhaseSolution[] = solveCross(state, face, {
      maxDepth,
      maxSolutions,
    });

    const pre = FACE_PRE_ROTATIONS[face];
    const orientation = pre.orientationToken
      ? OrientationTable.rotationEntryFor(pre.orientationToken)
      : null;

    const mapSolution = (s: PhaseSolution): CrossSolutionItem => {
      const moves = orientation
        ? MoveTransformer.remapScrambleString(s.notation, orientation)
        : s.notation;
      const notation = pre.rotation ? `${pre.rotation} ${moves}`.trim() : moves;
      return {
        preRotation: pre.rotation,
        moves,
        notation,
        moveCount: s.moveCount,
      };
    };

    if (optimalSolutions.length === 0) {
      return {
        face,
        depth: 0,
        solutions: [],
      };
    }

    const optimalDepth = optimalSolutions[0].moveCount;
    const results: CrossSolutionItem[] = optimalSolutions.map(mapSolution);

    // If we only found 1 optimal solution but user wants 2, we can search at optimalDepth + 1
    if (results.length < maxSolutions && optimalDepth < maxDepth) {
      const moreSolutions = solveCross(state, face, {
        maxDepth: optimalDepth + 1,
        maxSolutions: maxSolutions * 2,
      });
      const existingKeys = new Set(results.map((r) => r.moves));
      for (const s of moreSolutions) {
        const item = mapSolution(s);
        if (!existingKeys.has(item.moves)) {
          results.push(item);
          existingKeys.add(item.moves);
          if (results.length >= maxSolutions) break;
        }
      }
    }

    return {
      face,
      depth: optimalDepth,
      solutions: results.slice(0, maxSolutions),
    };
  }
}

