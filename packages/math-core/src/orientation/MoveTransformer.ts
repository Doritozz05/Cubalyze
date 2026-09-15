import type {
  CubeFace,
  CubeMoveEvent,
  CubeMoveDirection,
  DisplayMove,
  FacePermutation,
  OuterFace,
} from '@cubalyze/types';
import { OrientationTable, type OrientationEntry } from './OrientationTable';

/** True for the six outer faces (slice moves M/E/S never enter orientation maps). */
function isOuterFace(face: CubeFace): face is OuterFace {
  return face !== 'M' && face !== 'E' && face !== 'S';
}

/**
 * Pure functions for transforming between Raw Moves and Display Moves.
 *
 * A Display Move is a raw move with the face label remapped according to the
 * cube's current orientation. The direction (CW/CCW/180) is ALWAYS preserved
 * — a whole-cube rotation is a proper rotation (determinant +1), so it
 * preserves the rotation sense about the mapped axis.
 *
 * See: docs/02-architecture/Dynamic_Notation_Orientation_System.md §3.3–3.5
 */
export class MoveTransformer {
  /**
   * Build the inverse face map (original face → current position) for a given
   * orientation. This is the lookup used for raw→display transformation.
   *
   * If σ(position) = original (the orientation's faceMap), then
   * σ⁻¹(original) = position (the display face for a raw move on that face).
   */
  private static buildInverseMap(faceMap: FacePermutation): Record<OuterFace, OuterFace> {
    const inv: Partial<Record<OuterFace, OuterFace>> = {};
    const faces: OuterFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];
    for (const pos of faces) {
      inv[faceMap[pos]] = pos;
    }
    return inv as Record<OuterFace, OuterFace>;
  }

  /**
   * Transform a raw move (from Bluetooth) into a display move (for the UI).
   *
   * @param raw The raw CubeMoveEvent from BLE — NEVER modified.
   * @param orientation The cube's current orientation (from OrientationTracker).
   * @returns A new DisplayMove with the face remapped. Direction is preserved.
   */
  static toDisplay(
    raw: CubeMoveEvent,
    orientation: OrientationEntry | { faceMap: FacePermutation },
  ): DisplayMove {
    const invMap = MoveTransformer.buildInverseMap(orientation.faceMap);
    return {
      // Slice moves (M/E/S) have no face in the orientation map — pass through.
      face: isOuterFace(raw.face) ? invMap[raw.face] : raw.face,
      direction: raw.direction, // ALWAYS preserved
      cubeTimestamp: raw.cubeTimestamp,
      hostTimestamp: raw.hostTimestamp,
    };
  }

  /**
   * Transform a display move back into a raw move (for replay/manual input).
   *
   * @param display The DisplayMove (user-perspective notation).
   * @param orientation The cube's current orientation.
   * @returns A CubeMoveEvent with the face remapped back to raw notation.
   */
  static toRaw(
    display: DisplayMove,
    orientation: OrientationEntry | { faceMap: FacePermutation },
  ): CubeMoveEvent {
    // For display→raw: the display face is the position, and the raw face is
    // the original face currently at that position: faceMap[position] = original.
    return {
      face: isOuterFace(display.face)
        ? orientation.faceMap[display.face]
        : display.face,
      direction: display.direction, // ALWAYS preserved
      cubeTimestamp: display.cubeTimestamp,
      hostTimestamp: display.hostTimestamp,
    };
  }

  /**
   * Transform a sequence of raw moves into display moves.
   * Each move is independently remapped using the same orientation.
   */
  static toDisplaySequence(
    rawMoves: CubeMoveEvent[],
    orientation: OrientationEntry | { faceMap: FacePermutation },
  ): DisplayMove[] {
    const invMap = MoveTransformer.buildInverseMap(orientation.faceMap);
    return rawMoves.map((raw) => ({
      face: isOuterFace(raw.face) ? invMap[raw.face] : raw.face,
      direction: raw.direction,
      cubeTimestamp: raw.cubeTimestamp,
      hostTimestamp: raw.hostTimestamp,
    }));
  }

  /**
   * Convert a move to its notation string (e.g. "R'", "U2", "F").
   */
  static moveToNotation(face: CubeFace, direction: CubeMoveDirection): string {
    return face + (direction === -1 ? "'" : direction === 2 ? '2' : '');
  }

  /**
   * Convert a rotation axis+direction to its notation string (e.g. "y", "x'", "z2").
   * Used for whole-cube rotation events from the OrientationTracker.
   */
  static rotationToNotation(axis: 'x' | 'y' | 'z', direction: CubeMoveDirection): string {
    return axis + (direction === -1 ? "'" : direction === 2 ? '2' : '');
  }

  /**
   * Convert a raw CubeMoveEvent to a display notation string.
   */
  static toDisplayNotation(
    raw: CubeMoveEvent,
    orientation: OrientationEntry | { faceMap: FacePermutation },
  ): string {
    const display = MoveTransformer.toDisplay(raw, orientation);
    return MoveTransformer.moveToNotation(display.face, display.direction);
  }

  /**
   * Remap a scramble string (space-separated moves) for display in the
   * current orientation.
   *
   * The underlying scramble is NEVER modified — this only changes the
   * displayed notation. Each token is independently remapped.
   *
   * @param scramble A space-separated scramble string, e.g. "R U R' U'".
   * @param orientation The cube's current orientation.
   * @returns The remapped scramble string, e.g. "F U F' U'" (after y rotation).
   */
  static remapScrambleString(
    scramble: string,
    orientation: OrientationEntry | { faceMap: FacePermutation },
  ): string {
    const invMap = MoveTransformer.buildInverseMap(orientation.faceMap);
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);

    return tokens
      .map((token) => {
        if (token.length < 1) return token;

        const face = token[0] as CubeFace;
        if (!'URFDLB'.includes(face)) return token; // pass through unknown tokens

        const suffix = token.slice(1); // "'", "2", or ""
        // The guard above guarantees an outer face — narrow for the map.
        const displayFace = invMap[face as OuterFace];

        return displayFace + suffix; // direction suffix is preserved
      })
      .join(' ');
  }
}
