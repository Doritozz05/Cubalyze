/**
 * rotationGroup.ts — The 24-element rotation group of the cube.
 *
 * A "frame" is an element of the whole-cube rotation group, expressed as a
 * sequence of x/y/z tokens. The solver's grip is such a frame. This module
 * provides:
 *
 *   - generateRotations(): the full group (24 sequences, identity first)
 *   - applyRotation(): apply a rotation sequence to a state (returns a clone)
 *   - findRotationOfSolved(): detect whether a state is a rotation of solved,
 *     and which rotation
 *   - findCrossOnDFrames(): all frames in which a given set of cross edges
 *     sits on the D layer oriented (eo === 0)
 *   - facePermutationOf(): the face-permutation induced by a rotation
 *     (used for frame-relative slot naming)
 *
 * All functions are pure and stateless; the rotation group is pre-computed
 * once at module load.
 */
import { CubeState } from '@cubeforge/math-core';

const ROTATION_TOKENS = ['x', 'y', 'z'] as const;

/** Exact state signature (cp|ep|co|eo) — used to compare states. */
export function stateSignature(state: CubeState): string {
  return (
    `${Array.from(state.cp).join(',')}|${Array.from(state.ep).join(',')}|` +
    `${Array.from(state.co).join(',')}|${Array.from(state.eo).join(',')}`
  );
}

/** Inverse of a single move/rotation token (handles ', 2, plain). */
export function invertToken(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.endsWith('2')) return token;
  return token + "'";
}

/** Inverse of a space-separated move/rotation sequence. */
export function invertSequence(sequence: string): string {
  const tokens = sequence.trim().split(/\s+/).filter(Boolean);
  return tokens.slice().reverse().map(invertToken).join(' ');
}

/**
 * Generate the 24 rotation sequences by BFS from the solved-state signature.
 * The identity (empty sequence) is always first.
 */
function generateRotations(): string[] {
  const seen = new Set<string>([stateSignature(new CubeState())]);
  const queue: { seq: string; key: string }[] = [
    { seq: '', key: stateSignature(new CubeState()) },
  ];
  const out: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    out.push(current.seq);
    for (const m of ROTATION_TOKENS) {
      const seq = (current.seq + ' ' + m).trim();
      const c = new CubeState();
      if (seq) c.applySequence(seq);
      const key = stateSignature(c);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ seq, key });
      }
    }
  }
  return out;
}

/** The full rotation group (24 elements, identity first). */
export const ROTATION_GROUP: readonly string[] = generateRotations();

/** Apply a rotation sequence to a state and return the clone. */
export function applyRotation(state: CubeState, rotation: string): CubeState {
  const result = state.clone();
  if (rotation) result.applySequence(rotation);
  return result;
}

/**
 * Find the rotation r such that r · state === solved. Returns null when the
 * state is not a rotation of solved (i.e. genuinely scrambled).
 */
export function findRotationOfSolved(state: CubeState): string | null {
  const key = stateSignature(state);
  for (const r of ROTATION_GROUP) {
    const rotated = applyRotation(new CubeState(), r);
    if (stateSignature(rotated) === key) return r;
  }
  return null;
}

/**
 * True when `state` is a rotation of an arbitrary reference cube (used for
 * the coherence check after a color remap, where the reference is the
 * recolored solved cube).
 */
export function isRotationOfReference(state: CubeState, reference: CubeState): boolean {
  const key = stateSignature(state);
  for (const r of ROTATION_GROUP) {
    const rotated = applyRotation(reference, r);
    if (stateSignature(rotated) === key) return true;
  }
  return false;
}

/** True when `state` is a rotation of the solved cube. */
export function isRotationOfSolved(state: CubeState): boolean {
  return findRotationOfSolved(state) !== null;
}

/**
 * All rotations r such that r · state has EXACTLY the pieces `crossEdges`
 * (as a set) sitting in the D positions (4-7), all with eo === 0.
 *
 * Returns up to 4 sequences (the AUF/anchoring variants of the same frame).
 * Returns [] when no frame exists — the caller treats this as "the cross is
 * not solved in any frame" (dirty setup, X-cross still in progress, ...).
 */
export function findCrossOnDFrames(
  state: CubeState,
  crossEdges: readonly number[],
): string[] {
  if (crossEdges.length !== 4) return [];
  const crossSet = new Set(crossEdges);
  const frames: string[] = [];
  for (const r of ROTATION_GROUP) {
    const rotated = applyRotation(state, r);
    let ok = true;
    for (let pos = 4; pos < 8; pos++) {
      if (!crossSet.has(rotated.ep[pos]) || rotated.eo[pos] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) frames.push(r);
  }
  return frames;
}

/**
 * Face maps for the 9 elementary rotations: map[originalFace] = position the
 * face occupies after the rotation. Composition is done in sequence order.
 */
const ROTATION_FACE_MAPS: Record<string, Record<string, string>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
  "x'": { U: 'B', B: 'D', D: 'F', F: 'U', R: 'R', L: 'L' },
  x2: { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
  y: { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' },
  "y'": { U: 'U', D: 'D', F: 'L', L: 'B', B: 'R', R: 'F' },
  y2: { U: 'U', D: 'D', F: 'B', B: 'F', R: 'L', L: 'R' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U', F: 'F', B: 'B' },
  "z'": { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
  z2: { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' },
};

const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/**
 * The face permutation induced by a rotation sequence:
 *   perm[position] = the ORIGINAL face letter currently at that spatial
 *   position after applying the rotation to the solved cube.
 *
 * This is the inverse of the ROTATION_FACE_MAPS composition (those maps say
 * where an original face went; we need which original face is at each
 * position). Used for frame-relative slot naming.
 */
export function facePermutationOf(rotation: string): Record<string, string> {
  let forward: Record<string, string> = {
    U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B',
  };
  for (const token of rotation.trim().split(/\s+/).filter(Boolean)) {
    const step = ROTATION_FACE_MAPS[token];
    if (!step) continue;
    const next: Record<string, string> = {};
    for (const f of FACE_LETTERS) next[f] = step[forward[f]];
    forward = next;
  }
  const inverse: Record<string, string> = {};
  for (const f of FACE_LETTERS) inverse[forward[f]] = f;
  return inverse;
}
