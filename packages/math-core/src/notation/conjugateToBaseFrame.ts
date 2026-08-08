/**
 * conjugateToBaseFrame.ts — Rewrite solver-frame moves to cube-fixed moves.
 *
 * Text reconstructions (CubeRoot / reco.nz) write moves from the
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
 * Rotations are consumed as grip updates and do NOT appear in the output.
 * Slice moves (M/E/S) are ALSO conjugated through the grip (axis + sense
 * map onto a possibly different physical slice); only wide / unknown tokens
 * pass through unchanged.
 *
 * **MUST be called AFTER `expandWideMoves`**: solver-frame wide moves (r, u,
 * …) are only correct when conjugated after expansion to their face turn;
 * unconjugated wides would be applied in the wrong frame.
 */
import type {
  CubeFace,
  CubeMoveDirection,
  FacePermutation,
  OuterFace,
} from '@cubeforge/types';
import { OrientationTable, type OrientationEntry } from '../orientation/OrientationTable';
import { MoveTransformer } from '../orientation/MoveTransformer';

const FACE_LETTERS = 'URFDLB';
const SLICE_MOVE_RE = /^[MES][2']?$/;

/** The solver-side face a slice move turns "CW from" (M→L, E→D, S→F). */
const SLICE_FROM_SIDE: Record<'M' | 'E' | 'S', OuterFace> = {
  M: 'L',
  E: 'D',
  S: 'F',
};

/**
 * Physical slice + inversion flag for a turn that is CW viewed from each
 * face, following the project conventions (verified against MoveExpander):
 *   r = R M'  → CW from R is M'      l = L M  → CW from L is M
 *   u = U E'  → CW from U is E'      d = D E  → CW from D is E
 *   f = F S   → CW from F is S       b = B S' → CW from B is S'
 */
const CW_FROM_FACE: Record<OuterFace, [slice: 'M' | 'E' | 'S', invert: boolean]> = {
  R: ['M', true],
  L: ['M', false],
  U: ['E', true],
  D: ['E', false],
  F: ['S', false],
  B: ['S', true],
};

function isSliceMove(token: string): boolean {
  return SLICE_MOVE_RE.test(token);
}

/**
 * Conjugate a slice move (M/E/S) through the grip's face map.
 *
 * A whole-cube rotation maps the slice's body axis AND its turn sense onto a
 * (possibly different) physical slice with the direction preserved (proper
 * rotation). E.g. under an `x'` grip the solver's `F'`-wide slice becomes a
 * physical `u'` — so pass-through would silently apply the wrong slice.
 */
function conjugateSlice(token: string, faceMap: FacePermutation): string {
  const base = token[0] as 'M' | 'E' | 'S';
  const suffix = token.slice(1);
  // The physical face now at the solver's "from" side decides the slice.
  const fromFace = faceMap[SLICE_FROM_SIDE[base]];
  const [slice, invert] = CW_FROM_FACE[fromFace];
  if (suffix === '2') return `${slice}2`; // 180° is its own inverse
  let prime = suffix === "'";
  if (invert) prime = !prime;
  return slice + (prime ? "'" : '');
}

/** One pass over a token list with a running grip. */
function conjugateWithGrip(
  tokens: readonly string[],
  grip: OrientationEntry,
): {
  out: string[];
  grip: OrientationEntry;
  rotations: number;
  /** Grip changes with the face-move index (relative to this pass) where the
   *  new grip first applies — a rotation between moves i and i+1 changes the
   *  grip for move i+1. */
  gripChanges: { atMove: number; grip: OrientationEntry }[];
} {
  const out: string[] = [];
  let rotations = 0;
  let faceMoveCount = 0;
  const gripChanges: { atMove: number; grip: OrientationEntry }[] = [];

  for (const token of tokens) {
    const rotation = OrientationTable.rotationEntryFor(token);
    if (rotation) {
      // NOTE: the new rotation goes FIRST. Empirically verified against
      // CubeState: after physically rotating by `z` then `y`, the correct
      // grip is compose(y, z), not compose(z, y) (compose(a, b) applies
      // `a` first). Round-trip tests cannot catch this — only real solves
      // with genuine inspection rotations do.
      grip = OrientationTable.compose(rotation, grip);
      rotations++;
      // The rotation happens before the NEXT face move, so the new grip
      // applies to the move at the current face-move count.
      gripChanges.push({ atMove: faceMoveCount, grip });
      continue;
    }

    const isFace = FACE_LETTERS.includes(token[0]);
    if (isFace) faceMoveCount++;

    const face = token[0];
    if (!FACE_LETTERS.includes(face)) {
      if (isSliceMove(token)) {
        // Slice moves DO get conjugated (axis + sense map through the grip);
        // only wide / unknown tokens pass through unchanged (wide moves must
        // be pre-expanded to face+slice before conjugation).
        out.push(conjugateSlice(token, grip.faceMap));
      } else {
        out.push(token);
      }
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

  return { out, grip, rotations, gripChanges };
}

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
  return conjugateWithGrip(tokens, OrientationTable.IDENTITY).out;
}

/**
 * Conjugate a reconstruction's token stream phase-by-phase.
 *
 * The running grip is threaded ACROSS phases (a rotation inside F2L 2 also
 * affects every later phase), and each phase keeps only its own conjugated
 * tokens so phase boundaries survive. Rotations are counted, not output.
 *
 * Also emits a SYNTHETIC orientation timeline (same shape as the smartcube's
 * `compactOrientationTimeline`): each `[moveIndex, orientationIndex]` keyframe
 * means "when move `moveIndex` runs, the cube is in orientation
 * `orientationIndex` (0-23, index into OrientationTable.ENTRIES)". A rotation
 * consumed between face moves emits a keyframe at the NEXT face-move index,
 * and the inspection rotations emit at move 0 — so the 3D replay can rotate
 * the cube to the solver's perspective exactly like the smartcube path.
 *
 * @param phases Token lists per phase, in solve order (e.g. the result of
 *               tokenizing each `//`-separated segment of a reconstruction).
 * @returns Per-phase conjugated face tokens, the total rotation count, and
 *          the synthetic orientation timeline (empty when no rotations).
 */
export function conjugatePhaseStream(
  phases: readonly (readonly string[])[],
): {
  perPhase: string[][];
  rotationCount: number;
  orientationTimeline: [number, number][];
} {
  let grip: OrientationEntry = OrientationTable.IDENTITY;
  let rotationCount = 0;
  let faceMoveCount = 0;
  const perPhase: string[][] = [];
  const orientationTimeline: [number, number][] = [];

  for (const phase of phases) {
    const { out, grip: nextGrip, rotations, gripChanges } =
      conjugateWithGrip(phase, grip);
    grip = nextGrip;
    rotationCount += rotations;
    // A grip change applies from the NEXT face move (or move 0 for the
    // inspection). Compress like compactOrientationTimeline: multiple
    // rotations before the same move collapse to ONE keyframe (the last
    // grip wins — `z y` is a single orientation), and identical
    // consecutive orientations emit nothing.
    for (const change of gripChanges) {
      const atMove = faceMoveCount + change.atMove;
      const last = orientationTimeline[orientationTimeline.length - 1];
      if (last && last[0] === atMove) {
        last[1] = change.grip.id; // later rotation before the same move wins
      } else if (last && last[1] === change.grip.id) {
        continue; // no orientation change
      } else {
        orientationTimeline.push([atMove, change.grip.id]);
      }
    }
    faceMoveCount += out.filter((t) => !isSliceToken(t)).length;
    perPhase.push(out);
  }

  return { perPhase, rotationCount, orientationTimeline };
}

/** Whether a token is a face turn (not a slice/wide/unknown). */
function isSliceToken(token: string): boolean {
  return !/^[URFDLB][2']?$/.test(token);
}
