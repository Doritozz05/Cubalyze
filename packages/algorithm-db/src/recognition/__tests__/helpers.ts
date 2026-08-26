import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../../caseGenerator';
import { pairSignature } from '../pairSignature';
import { slotToFRRotation, resolveSlotPieces } from '../slotResolver';

/** Inverse of a rotation sequence ('y' ↔ "y'", 'x' ↔ "x'", 'z' ↔ "z'"). */
export function inverseSeq(seq: string): string {
  if (!seq) return '';
  return seq
    .split(' ')
    .reverse()
    .map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'"))
    .join(' ');
}

/** Apply a move/rotation sequence to a fresh clone. */
export function applySeq(s: CubeState, seq: string): CubeState {
  const t = s.clone();
  if (seq) t.applySequence(seq);
  return t;
}

/**
 * Build a GENUINE D-cross solver state for a catalog case with its pair
 * at `slotName` (FR/BR/BL/FL): the conjugated setup
 *
 *   solved ∘ r ∘ setup ∘ r⁻¹   (r = slotToFRRotation)
 *
 * — the state a real solver holds with the case at that slot. The slot's
 * own pieces (FACE_LAYERS) sit in the pair config, exactly like a real
 * solve (the 2388 scenario: the BR pair's pieces are wherever the solve
 * left them — parked corner included — and the detector resolves them BY
 * COLOR, not by position).
 *
 * This construction is faithful for every case × slot (no relabel, no
 * orientation repair, no mirror hacks): it only ever produces reachable
 * states, and the detector's relational signature recognizes them
 * (validated: all 41 cases × 4 slots round-trip exactly).
 */
export function solverStateForCase(
  setupScramble: string,
  crossFace: 'D',
  slotName: string,
): CubeState {
  const r = slotToFRRotation(crossFace, slotName);
  if (r === null) throw new Error(`no rotation for ${crossFace}/${slotName}`);
  const inv = inverseSeq(r);
  return applySeq(applySeq(applySeq(new CubeState(), r), setupScramble), inv);
}

export { CaseStateGenerator, slotToFRRotation, resolveSlotPieces, pairSignature };
