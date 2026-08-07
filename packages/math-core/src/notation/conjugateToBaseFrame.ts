/**
 * conjugateToBaseFrame.ts — Rewrite solver-frame moves to cube-fixed moves.
 *
 * Text reconstructions (CubeRoot / Quest / reco.nz) write moves from the
 * SOLVER's point of view. After an inspection rotation (e.g. `x2 y'`), a
 * written `R` means "turn the face currently at the R position", which is a
 * different cube face depending on the rotations that came before it. A
 * replay engine that applies the scramble then plain face turns therefore
 * needs those moves in the cube-fixed frame, or the cube never ends solved.
 *
 * The fix is conjugation: walk the token list, keep a running "grip" (the
 * accumulated whole-cube rotation), and rewrite each face turn to the cube
 * face that currently occupies its position. This reuses the project's
 * verified orientation math — `OrientationTable` (rotation maps verified
 * against CubeState, plus composition) and `MoveTransformer.toRaw` (the
 * single-move display→raw remap used by the dynamic notation system) — so no
 * rotation data is duplicated here.
 *
 * Rotations are consumed as grip updates and do NOT appear in the output;
 * slice / wide / unknown tokens pass through unchanged (callers should
 * expand wide moves with `expandWideMoves` first).
 */
import type { CubeFace, CubeMoveDirection } from '@cubeforge/types';
import { OrientationTable, type OrientationEntry } from '../orientation/OrientationTable';
import { MoveTransformer } from '../orientation/MoveTransformer';

const FACE_LETTERS = 'URFDLB';

/**
 * Conjugate a token list into the cube-fixed frame.
 *
 * @param tokens Moves + rotations as written by the solver (e.g. tokenized
 *               reconstruction text). Rotations may appear anywhere — at the
 *               start (inspection) or mid-solve.
 * @returns The conjugated face-turn tokens (rotations removed), ready to
 *          apply after the scramble on a fixed cube.
 */
export function conjugateToBaseFrame(tokens: readonly string[]): string[] {
  let grip: OrientationEntry = OrientationTable.IDENTITY;
  const out: string[] = [];

  for (const token of tokens) {
    const rotation = OrientationTable.rotationEntryFor(token);
    if (rotation) {
      // NOTE: the new rotation goes FIRST. Empirically verified against
      // CubeState: after physically rotating by `z` then `y`, the correct
      // grip is compose(y, z), not compose(z, y) (compose(a, b) applies
      // `a` first). Round-trip tests cannot catch this — only real solves
      // with genuine inspection rotations do.
      grip = OrientationTable.compose(rotation, grip);
      continue;
    }

    const face = token[0];
    if (!FACE_LETTERS.includes(face)) {
      // Slice / wide / unknown tokens have no face remap — pass through.
      out.push(token);
      continue;
    }

    const suffix = token.slice(1);
    const direction: CubeMoveDirection = suffix === "'" ? -1 : suffix === '2' ? 2 : 1;
    const raw = MoveTransformer.toRaw(
      { face: face as CubeFace, direction, cubeTimestamp: 0, hostTimestamp: 0 },
      { faceMap: grip.faceMap },
    );
    out.push(MoveTransformer.moveToNotation(raw.face, raw.direction));
  }

  return out;
}
