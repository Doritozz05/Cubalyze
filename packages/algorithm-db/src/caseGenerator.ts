import { CubeState, FaceletStringConverter } from '@cubeforge/math-core';
import type { Algorithm, AlgorithmCase } from './schema';

// ─── Visualization Styles ───────────────────────────────────────────────────

export type VisualizationStyle = 'full-color' | 'yellow-gray' | 'orientation-only';

export interface VisualizationConfig {
  style: VisualizationStyle;
  topFace: string;
  frontFace: string;
}

export const SUBSET_VISUALIZATION: Record<string, VisualizationConfig> = {
  PLL: { style: 'full-color', topFace: 'U', frontFace: 'F' },
  OLL: { style: 'yellow-gray', topFace: 'U', frontFace: 'F' },
  COLL: { style: 'full-color', topFace: 'U', frontFace: 'F' },
  CMLL: { style: 'full-color', topFace: 'U', frontFace: 'F' },
  ZBLL: { style: 'full-color', topFace: 'U', frontFace: 'F' },
  F2L: { style: 'full-color', topFace: 'U', frontFace: 'F' },
};

// ─── Color mapping ──────────────────────────────────────────────────────────

const FACE_TO_COLOR: Record<string, string> = {
  U: 'Y', R: 'O', F: 'G', D: 'W', L: 'R', B: 'B',
};

// ─── Notation utilities ─────────────────────────────────────────────────────

export function invertMove(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.endsWith('2')) return token;
  return token + "'";
}

export function invertAlgorithm(algorithm: string): string {
  const tokens = algorithm.trim().split(/\s+/).filter(Boolean);
  return tokens.reverse().map(invertMove).join(' ');
}

export function invertMoveArray(moves: string[]): string[] {
  return moves.slice().reverse().map(invertMove);
}

// ─── Facelet rotation (same principle as MoveTransformer.remapScrambleString) ─

/**
 * Face permutations for whole-cube y rotations.
 *
 * These map each FACE LABEL (U/R/F/D/L/B) to the face label that SHOULD appear
 * in the standard U/F reference frame when the cube state was generated from
 * a rotated reference frame.
 *
 * y (90° CW):  what was on R → now on B, F→R, L→F, B→L
 * y' (90° CCW): what was on R → now on F, B→R, L→B, F→L
 * y2 (180°):   R↔L, F↔B
 *
 * These are the INVERSE face maps from the MoveTransformer convention:
 *   invMap[originalFace] = displayFace
 * where faceMap[position] = original and invMap[original] = position.
 */

// ─── Facelet rotation maps for all 3 axes (x, y, z) ────────────────────────
//
// These map each FACE LABEL (U/R/F/D/L/B) to the face label that SHOULD appear
// in the standard U/F reference frame when the cube state was generated from
// a rotated reference frame.

const ROT_MAPS: Record<string, Record<string, string>> = {
  // y rotations (around U/D axis)
  y: { U: 'U', D: 'D', F: 'R', L: 'F', B: 'L', R: 'B' },
  "y'": { U: 'U', D: 'D', F: 'L', R: 'F', B: 'R', L: 'B' },
  y2: { U: 'U', D: 'D', R: 'L', L: 'R', F: 'B', B: 'F' },

  // x rotations (around R/L axis)
  x: { R: 'R', L: 'L', F: 'U', D: 'F', B: 'D', U: 'B' },
  "x'": { R: 'R', L: 'L', B: 'U', D: 'B', F: 'D', U: 'F' },
  x2: { R: 'R', L: 'L', U: 'D', D: 'U', F: 'B', B: 'F' },

  // z rotations (around F/B axis)
  z: { F: 'F', B: 'B', R: 'U', D: 'R', L: 'D', U: 'L' },
  "z'": { F: 'F', B: 'B', L: 'U', D: 'L', R: 'D', U: 'R' },
  z2: { F: 'F', B: 'B', U: 'D', D: 'U', R: 'L', L: 'R' },
};

// ─── Parity helper ──────────────────────────────────────────────────────────

function getInversions(array: number[]): number {
  let inversions = 0;
  for (let i = 0; i < array.length - 1; i++) {
    for (let j = i + 1; j < array.length; j++) {
      if (array[i] > array[j]) inversions++;
    }
  }
  return inversions;
}

// ─── Case State Generator ───────────────────────────────────────────────────

export class CaseStateGenerator {
  // ── State generation ──────────────────────────────────────────────────

  /** Apply inverse algorithm to solved cube → raw case state. */
  static generateCaseState(moves: string[]): CubeState {
    const state = new CubeState();
    const inverseMoves = invertMoveArray(moves);
    state.applySequence(inverseMoves.join(' '));
    return state;
  }

  /** Apply scramble directly to solved cube. */
  static generateFromScramble(scramble: string): CubeState {
    const state = new CubeState();
    state.applySequence(scramble);
    return state;
  }

  /**
   * Create a clean state from raw state's permutation with co=0, eo=0.
   * Fixes permutation parity (required by Min2Phase) by swapping E-slice
   * edges (BL↔BR) when cp/ep parity mismatches.
   */
  static createCleanState(state: CubeState): CubeState {
    const cpArray = Array.from(state.cp);
    const epArray = Array.from(state.ep);

    const cpParity = getInversions(cpArray) % 2;
    const epParity = getInversions(epArray) % 2;
    if (cpParity !== epParity) {
      const tmp = epArray[10];
      epArray[10] = epArray[11];
      epArray[11] = tmp;
    }

    return new CubeState(cpArray, null, epArray, null);
  }

  // ── Facelet conversion ────────────────────────────────────────────────

  static toFaceletString(state: CubeState): string {
    return FaceletStringConverter.toFaceletString(state);
  }

  static faceletStringToDiagramColors(
    faceletString: string,
    style: VisualizationStyle = 'full-color',
  ): string[] {
    const result: string[] = new Array(54);
    for (let i = 0; i < 54; i++) {
      const face = faceletString[i];
      const color = FACE_TO_COLOR[face] ?? '#';
      if (style === 'yellow-gray') {
        result[i] = color === 'Y' ? 'Y' : '#';
      } else {
        result[i] = color;
      }
    }
    return result;
  }

  // ── Facelet rotation (matching MoveTransformer.remapScrambleString) ────

  /**
   * Compute the net rotation face permutation from algorithm moves.
   *
   * Counts whole-cube rotations (x, y, z, x', y', z', x2, y2, z2) and composes
   * them into a single inverse face map for remapping facelets.
   *
   * Un-rotates the facelet letters so the diagram matches the standard U/F
   * reference frame regardless of whole-cube rotations in the algorithm.
   *
   * @returns The inverse face map, or null if no net rotation.
   */
  static getNetRotationPermutation(moves: string[]): Record<string, string> | null {
    let net: Record<string, string> | null = null;

    for (const token of moves) {
      const rotMap = ROT_MAPS[token];

      if (rotMap) {
        if (net) {
          // Compose: rotMap ∘ net
          const composed: Record<string, string> = {};
          for (const [face, target] of Object.entries(net)) {
            composed[face] = rotMap[target] ?? target;
          }
          net = composed;
        } else {
          net = { ...rotMap };
        }
      }
    }

    return net;
  }

  /**
   * Remap facelet string characters through a face permutation.
   *
   * Same principle as MoveTransformer.remapScrambleString but operating
   * on individual facelet characters (U/R/F/D/L/B) instead of move tokens.
   *
   * @param faceletString 54-char Kociemba facelet string
   * @param perm Inverse face permutation: perm[faceChar] → displayChar
   */
  static remapFaceletString(
    faceletString: string,
    perm: Record<string, string>,
  ): string {
    return faceletString
      .split('')
      .map((ch) => perm[ch] ?? ch)
      .join('');
  }

  // ── Full visualization pipeline ────────────────────────────────────────

  /**
   * Full pipeline: algorithm → case state → facelet string → diagram colors.
   *
   * 1. Apply inverse algorithm to solved cube → raw state
   * 2. createCleanState(raw) → co=0, eo=0 state with parity fix
   * 3. toFaceletString(clean) → Kociemba facelet string
   * 4. Detect net y-rotation in algorithm and remap facelet letters
   *    (so diagram matches standard U/F reference frame)
   * 5. Map facelet letters → diagram color letters
   */
  static generateCaseVisualization(
    moves: string[],
    style: VisualizationStyle = 'full-color',
  ): {
    state: CubeState;
    faceletString: string;
    diagramColors: string[];
  } {
    const rawState = this.generateCaseState(moves);
    const cleanState = style === 'full-color'
      ? this.createCleanState(rawState)
      : rawState;
    let faceletString = this.toFaceletString(cleanState);

    // Remap facelet letters through inverse net rotation so the diagram
    // matches the standard U/F reference frame (like rotating scramble
    // notation to match cube orientation).
    const netPerm = this.getNetRotationPermutation(moves);
    if (netPerm) {
      faceletString = this.remapFaceletString(faceletString, netPerm);
    }

    const diagramColors = this.faceletStringToDiagramColors(faceletString, style);
    return { state: cleanState, faceletString, diagramColors };
  }

  /** Generate visualization from case metadata. */
  static generateFromCase(
    caseData: AlgorithmCase,
    algorithms: Algorithm[],
    style?: VisualizationStyle,
  ): {
    state: CubeState;
    faceletString: string;
    diagramColors: string[];
  } {
    const visStyle = style ?? SUBSET_VISUALIZATION[caseData.category ?? 'PLL']?.style ?? 'full-color';
    const defaultAlg = algorithms.find((a) => a.isDefault) ?? algorithms[0];
    if (!defaultAlg) {
      throw new Error(`No algorithm found for case ${caseData.caseNumber}`);
    }
    return this.generateCaseVisualization(defaultAlg.moves, visStyle);
  }

  // ── Verification ──────────────────────────────────────────────────────

  static verifyAlgorithmSolvesCase(caseState: CubeState, moves: string[]): boolean {
    const testState = caseState.clone();
    testState.applySequence(moves.join(' '));
    return testState.isSolved();
  }

  // ── AUF ───────────────────────────────────────────────────────────────

  static applyAuf(state: CubeState, auf: 0 | 1 | 2 | 3): CubeState {
    if (auf === 0) return state.clone();
    const result = state.clone();
    const moves = ['', 'U', 'U2', "U'"];
    result.applySequence(moves[auf]);
    return result;
  }
}
