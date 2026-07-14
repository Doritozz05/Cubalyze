import { CubeState } from "../CubeState";
import { PhaseMask } from "./IMethodDefinition";

export class StateMatcher {
  /**
   * Evaluates if a given CubeState fully satisfies the requirements of a PhaseMask.
   * 
   * A mask requires specific pieces to be in specific positions (ep, cp)
   * or to have specific orientations (eo, co).
   * 
   * Note on CubeState architecture:
   * state.ep[position] = piece_id
   * state.eo[position] = orientation
   * 
   * If a rule specifies `id: Edge.DF`, we are looking for the piece DF.
   * To check if it's in a specific position (e.g. `requiredEp: Edge.DF`),
   * we must verify that `state.ep[requiredEp] === id`.
   * If `requiredEp` is undefined, we just find where the piece is, and check its orientation.
   * 
   * However, checking OLL means we don't care about WHICH piece is there,
   * we just care that the position has `eo === 0`.
   * Wait, the rule is defined as "Piece ID".
   * For OLL, it's easier to say "The piece currently at URF must have co=0".
   * This requires a slight shift in how we define rules, or we can add a `positionMask` concept.
   * Let's support both. If `id` is provided, we track the piece.
   */
  public static matchesMask(state: CubeState, mask: PhaseMask): boolean {
    // Check Edges
    if (mask.edges) {
      for (const rule of mask.edges) {
        if (rule.requiredEp !== undefined) {
          if (state.ep[rule.requiredEp] !== rule.id) return false;
          if (rule.requiredEo !== undefined && state.eo[rule.requiredEp] !== rule.requiredEo) return false;
        } else {
          if (rule.requiredEo !== undefined) {
            let foundPos = -1;
            for (let i = 0; i < 12; i++) {
              if (state.ep[i] === rule.id) { foundPos = i; break; }
            }
            if (foundPos === -1 || state.eo[foundPos] !== rule.requiredEo) return false;
          }
        }
      }
    }

    // Check Corners
    if (mask.corners) {
      for (const rule of mask.corners) {
        if (rule.requiredCp !== undefined) {
          if (state.cp[rule.requiredCp] !== rule.id) return false;
          if (rule.requiredCo !== undefined && state.co[rule.requiredCp] !== rule.requiredCo) return false;
        } else {
          if (rule.requiredCo !== undefined) {
            let foundPos = -1;
            for (let i = 0; i < 8; i++) {
              if (state.cp[i] === rule.id) { foundPos = i; break; }
            }
            if (foundPos === -1 || state.co[foundPos] !== rule.requiredCo) return false;
          }
        }
      }
    }

    // Check Edge Positions
    if (mask.edgePositions) {
      for (const rule of mask.edgePositions) {
        if (rule.requiredEo !== undefined && state.eo[rule.pos] !== rule.requiredEo) return false;
      }
    }

    // Check Corner Positions
    if (mask.cornerPositions) {
      for (const rule of mask.cornerPositions) {
        if (rule.requiredCo !== undefined && state.co[rule.pos] !== rule.requiredCo) return false;
      }
    }

    return true;
  }
}
