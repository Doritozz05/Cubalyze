/** The six faces of a standard cube in Singmaster notation */
type CubeFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';

/**
 * Maps hardware face → visual face for each Y-axis rotation offset.
 *
 * The GAN hardware reports moves in its own fixed reference frame.
 * When the user rotates the cube, the hardware's "R" may correspond
 * to a different visual face. This table resolves that mapping.
 *
 * IMPORTANT: This is the INVERSE of what you might expect.
 * When offset=1 (cube rotated 90° CW around Y), the user's "R face"
 * is now where the hardware calls "F". So when hardware reports "R",
 * the user sees the B face (because the cube was rotated).
 *
 * offset 0: no rotation (standard orientation)
 * offset 1: 90° CW around Y (hardware R→visual B, hardware F→visual R)
 * offset 2: 180° around Y (hardware R→visual L, hardware F→visual B)
 * offset 3: 270° CW around Y (hardware R→visual F, hardware F→visual L)
 */
const DISPLAY_MAP: Record<number, Record<CubeFace, CubeFace>> = {
  0: { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' },
  1: { U: 'U', R: 'B', F: 'R', D: 'D', L: 'F', B: 'L' },
  2: { U: 'U', R: 'L', F: 'B', D: 'D', L: 'R', B: 'F' },
  3: { U: 'U', R: 'F', F: 'L', D: 'D', L: 'B', B: 'R' },
};

/**
 * Index of each face's center in a 54-char Kociemba facelet string.
 * Layout: U1..9 (0-8), R1..9 (9-17), F1..9 (18-26), D1..9 (27-35), L1..9 (36-44), B1..9 (45-53)
 * Center is always the middle sticker of each face (index 4 within the face).
 */
const CENTER_INDICES: Record<CubeFace, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

/**
 * Resolves the orientation of a smart cube relative to the user's visual frame.
 *
 * The GAN hardware reports moves in a fixed reference frame (URFDLB).
 * When the user physically rotates the cube, the hardware's frame no longer
 * matches the visual frame. OrientationState uses the facelet string to detect
 * this misalignment and provides a display offset.
 *
 * IMPORTANT: This offset is ONLY for display purposes. The move interpretation
 * pipeline (FACE_ROTATION_MAP) must NEVER use this offset. The hardware's
 * "R" is always a rotation of the hardware's R layer, regardless of how the
 * user holds the cube.
 */
export class OrientationState {
  private offset: number = 0;

  /**
   * Detects cube orientation from a 54-char Kociemba facelet string.
   *
   * Strategy: look at which face letter appears at the U center position.
   * In solved state, facelets[4] = 'U'. If it's 'R', the cube was rotated
   * 90° CW around Y, meaning what the hardware calls "R" is now visually "F".
   *
   * Only Y-axis rotations are detected (the most common reorientation).
   * For rotations around other axes, the user can manually set the offset.
   */
  public calibrateFromFacelets(facelets: string): void {
    if (facelets.length !== 54) return;

    const uCenter = facelets[CENTER_INDICES.U];

    // Map which face is at U center to the Y-rotation offset.
    // Y-axis rotation cycles: U→U, R→F→L→B→R (side faces cycle)
    // So if U center shows R → offset 1, F → offset 2, L → offset 3, B → offset 4→treated as special
    // D at U center = rotation around non-Y axis → keep current offset
    switch (uCenter) {
      case 'U': this.offset = 0; break;
      case 'R': this.offset = 1; break;
      case 'F': this.offset = 2; break;
      case 'L': this.offset = 3; break;
      // B at U center = offset would be 4 (not a standard Y rotation), keep current
      // D at U center = rotation around X/Z axis, keep current
      default: break;
    }
  }

  /**
   * Maps a hardware face to the visual face for display.
   *
   * Example: if offset=1 and hardware reports 'R', display shows 'B'.
   *
   * @param face The face label from the hardware (e.g. 'R')
   * @returns The face label the user sees (e.g. 'B')
   */
  public mapFaceForDisplay(face: CubeFace): CubeFace {
    return DISPLAY_MAP[this.offset][face];
  }

  public getOffset(): number {
    return this.offset;
  }

  public setOffset(offset: number): void {
    this.offset = ((offset % 4) + 4) % 4;
  }
}
