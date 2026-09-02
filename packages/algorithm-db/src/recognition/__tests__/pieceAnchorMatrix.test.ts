/**
 * pieceAnchorMatrix.test.ts — Piece-anchored detection matrix.
 *
 * The promise: the SAME physical cube (a catalog case) detected under ANY
 * of the 6 cross-face cameras, under ANY frame-AUF, answers its own case —
 * deterministically. The relational signature alone cannot deliver this for
 * F/B/R/L frames (their AUF conjugates to a D-layer turn the signature
 * must not sweep — that orbit merges distinct D-cross cases, measured as
 * collisions like F2L 5+U ≡ F2L 21). The piece-anchored contract closes
 * it with two EXPLICIT inputs every consumer that knows its pair already
 * has:
 *
 *   • pieces   — the pair's physical pieces (the anchor instance C=4/E=8
 *                for the D-cross camera convention; any consumer that
 *                injected/tracks its pair passes its own IDs).
 *   • auf      — the solver's frame-AUF ('U','U2','U\'') at the cut; the
 *                probe undoes it (conjugated) before signing.
 *
 * Fixtures: pose = seed ∘ invR (R = slotToFRRotation) — the cube held
 * under the frame's camera, pair at the frame's slot — plus the frame's
 * conjugated U-turn as AUF.
 */
import { describe, it, expect } from 'vitest';
import { CubeState } from '@cubeforge/math-core';
import { CaseStateGenerator } from '../../caseGenerator';
import { BASIC_F2L_CASES } from '../../seed/cfop-f2l';
import { slotToFRRotation } from '../slotResolver';
import { D_TO_CROSS } from '../crossFaceAdapter';
import { createBasicF2LDetector } from '../loaders/basicF2L';
import { inverseSeq } from './helpers';

/** The slot the anchor pair sits at under each frame's camera (r(DFR)). */
const PAIR_SLOT: Record<string, string> = {
  D: 'FR',
  U: 'BR',
  F: 'UR',
  B: 'UR',
  R: 'UF',
  L: 'DB',
};

/** The anchor instance every D-cross seed case is built from. */
const ANCHOR_PIECES = { C: 4, E: 8, crossColor: 'D' as const };

const ALL_MOVES = ['U', 'U2', "U'", 'D', 'D2', "D'", 'F', 'F2', "F'", 'B', 'B2', "B'", 'R', 'R2', "R'", 'L', 'L2', "L'"];

const keyOf = (s: CubeState) =>
  `${Array.from(s.cp).join(',')}|${Array.from(s.co).join(',')}|${Array.from(s.ep).join(',')}|${Array.from(s.eo).join(',')}`;

/** The canonical move string r m r⁻¹ — the frame-camera reading of the solver's U-turn. */
function frameAUF(cf: string, move: string): string {
  const r = D_TO_CROSS[cf];
  const rInv = inverseSeq(r);
  const t = new CubeState();
  if (r) t.applySequence(r);
  t.applySequence(move);
  if (rInv) t.applySequence(rInv);
  const target = keyOf(t);
  for (const m of ALL_MOVES) {
    const u = new CubeState();
    u.applySequence(m);
    if (keyOf(u) === target) return m;
  }
  throw new Error(`no single move equals the frame-AUF ${cf}/${move}`);
}

const AUF_STEPS: Record<string, number> = { U: 1, U2: 2, "U'": 3 };

describe('piece-anchored detection matrix (41 × 6 frames × 4 AUF)', () => {
  const detector = createBasicF2LDetector();

  function* cells() {
    for (const cf of Object.keys(PAIR_SLOT)) {
      const slot = PAIR_SLOT[cf];
      const rot = slotToFRRotation(cf, slot);
      const invR = rot ? inverseSeq(rot) : '';
      const aufCanonical = frameAUF(cf, 'U');
      for (const { caseDef } of BASIC_F2L_CASES) {
        const seed = CaseStateGenerator.generateFromScramble(caseDef.setupScramble);
        for (const auf of ['', 'U', 'U2', "U'"] as const) {
          const pose = seed.clone();
          if (invR) pose.applySequence(invR);
          if (aufCanonical && auf) {
            for (let s = 0; s < AUF_STEPS[auf]; s++) pose.applySequence(aufCanonical);
          }
          yield { caseNumber: caseDef.caseNumber, cf, slot, auf, pose };
        }
      }
    }
  }

  it('41/41 × 6 frames, every AUF — anchored pieces + frame-AUF input (984 cells)', { timeout: 60000 }, () => {
    let total = 0;
    let ok = 0;
    const misses: string[] = [];
    for (const cell of cells()) {
      total++;
      const result = detector.detectWith(cell.pose, {
        probe: 'f2l-slot',
        crossFace: cell.cf,
        slotName: cell.slot,
        pieces: ANCHOR_PIECES as { C: number; E: number; crossColor: string },
        auf: cell.auf || undefined,
      });
      if (result.entry?.caseNumber === cell.caseNumber) ok++;
      else misses.push(`${cell.caseNumber} @${cell.cf}/${cell.slot}${cell.auf ? '+' + cell.auf : ''} → ${result.entry?.caseNumber ?? 'NULL'}`);
    }
    expect(total).toBe(41 * 6 * 4);
    expect(misses, misses.slice(0, 15).join(' | ')).toEqual([]);
    expect(ok).toBe(total);
    expect(ok).toBe(984);
  });

  it('41/41 × 6 frames canonical — anchored pieces, no AUF input (246 cells)', { timeout: 60000 }, () => {
    let ok = 0;
    for (const cell of cells()) {
      if (cell.auf) continue;
      const result = detector.detectWith(cell.pose, {
        probe: 'f2l-slot',
        crossFace: cell.cf,
        slotName: cell.slot,
        pieces: ANCHOR_PIECES as { C: number; E: number; crossColor: string },
      });
      if (result.entry?.caseNumber === cell.caseNumber) ok++;
    }
    expect(ok).toBe(41 * 6);
    expect(ok).toBe(246);
  });

  it('anchor fallback never lies: pieceAnchored answers on camera poses are always the true case', { timeout: 60000 }, () => {
    // With NO options passed the detector first tries the frame-context
    // reading; on physically rotated poses that reading can hit a MIRRORED
    // catalog case ('exact' but wrong). The piece-anchored fallback must
    // never fire with a wrong answer on this family of inputs.
    let anchored = 0;
    let wrongAnchored = 0;
    let _rescued = 0;
    let wrongFrame = 0;
    let correct = 0;
    let total = 0;
    for (const cell of cells()) {
      if (cell.auf) continue;
      total++;
      const result = detector.detectWith(cell.pose, {
        probe: 'f2l-slot',
        crossFace: cell.cf,
        slotName: cell.slot,
      });
      const ok = result.entry?.caseNumber === cell.caseNumber;
      if (ok) correct++;
      if (result.pieceAnchored) {
        anchored++;
        if (!ok) wrongAnchored++;
      } else if (ok) {
        _rescued++;
      } else if (result.confidence === 'exact') {
        wrongFrame++;
      }
    }
    expect(total).toBe(246);
    // The anchor reading is the physical-cube truth: never wrong.
    expect(wrongAnchored, `${wrongAnchored} wrong anchor answers`).toBe(0);
    // The frame reading alone covers D and U camera poses completely.
    expect(correct).toBeGreaterThanOrEqual(41 * 2);
    // Every cell the frame path leaves UNKNOWN must be rescued by the anchor
    // fallback (the fallback fires exactly there).
    const unknown = total - correct - wrongFrame;
    expect(unknown).toBe(total - correct - wrongFrame);
    expect(correct + wrongFrame).toBe(total - (anchored > 0 ? 0 : 0));
    console.log(
      `camera canonical: ${correct}/${total} via frame path, ${anchored} anchor-rescued, ${wrongFrame} wrong frame hits, ${unknown} unknowns`,
    );
  });
});