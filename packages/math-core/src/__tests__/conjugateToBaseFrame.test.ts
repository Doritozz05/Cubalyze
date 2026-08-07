import { describe, expect, it } from 'vitest';
import { CubeState } from '../CubeState';
import { conjugateToBaseFrame } from '../notation/conjugateToBaseFrame';
import { tokenize } from '../notation/moveNotation';
import { OrientationTable } from '../orientation/OrientationTable';
import { MoveTransformer } from '../orientation/MoveTransformer';
import type { CubeFace } from '@cubeforge/types';

// ─── Real validated data ────────────────────────────────────────────────────
// CubeRoot solve 2510 — the exact data that was previously verified to end
// solved by the (now removed) recognition test suite. Includes an inspection
// rotation (z y) and mid-solve rotations (x', y', y') inside the F2L phases.
const SCRAMBLE_2510 = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const CUBEROOT_2510_PHASES = [
  'z y', // Inspection
  "D2 L U R' U'", // Cross (W)
  "x' D' L' U L U' L' U L D", // F2L 1 (BL · Pj)
  "U2 y' L' U L U' L' U L U2 L' U L", // F2L 2 (FR · Jm)
  "U2 U L U' L'", // F2L 3 (BR · Jb)
  "y' R' U2 R U R' U' R", // F2L 4 (BR · Ci)
  "R' U' R' F R F' U R", // OLL
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'", // PLL
];

// ─── Deterministic synthetic solve ──────────────────────────────────────────
const SCRAMBLE = "R U R' F2 L' B D B2 U L F D' R U2 F' L2 B' R U";
const INSPECTION = 'x2 y';
const MID_ROT = 'y2';

function inverseTokens(tokens: string[]): string[] {
  return [...tokens].reverse().map((t) =>
    t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'",
  );
}

/** The solver-frame writing of the physical solution, with a mid-solve grip rotation. */
function buildSolverFrameStream(): string[] {
  const fixed = inverseTokens(tokenize(SCRAMBLE));
  const rotTokens: string[] = [...tokenize(INSPECTION)];
  const stream: string[] = [];
  for (let i = 0; i < fixed.length; i++) {
    if (i === 3) {
      stream.push(MID_ROT);
      rotTokens.push(MID_ROT);
    }
    let grip = OrientationTable.IDENTITY;
    for (const t of rotTokens) {
      // Same order as conjugateToBaseFrame: the newest rotation goes first.
      grip = OrientationTable.compose(OrientationTable.rotationEntryFor(t)!, grip);
    }
    const token = fixed[i];
    const direction = token.endsWith("'") ? -1 : token.endsWith('2') ? 2 : 1;
    const display = MoveTransformer.toDisplay(
      { face: token[0] as CubeFace, direction, cubeTimestamp: 0, hostTimestamp: 0 },
      { faceMap: grip.faceMap },
    );
    stream.push(MoveTransformer.moveToNotation(display.face, display.direction));
  }
  return stream;
}

describe('conjugateToBaseFrame', () => {
  it('conjugates the real CubeRoot 2510 solve to exactly solved (inspection + mid-solve rotations)', () => {
    const s = new CubeState();
    s.applySequence(SCRAMBLE_2510);

    const conjugated = conjugateToBaseFrame(
      tokenize(CUBEROOT_2510_PHASES.join(' ')),
    );
    expect(conjugated.some((t) => /^[xyz]/.test(t))).toBe(false); // rotations consumed
    s.applySequence(conjugated.join(' '));

    expect(s.isSolved()).toBe(true);
  });

  it('recovers the physical solution from a solver-frame stream with a mid-solve rotation', () => {
    const fixed = inverseTokens(tokenize(SCRAMBLE));
    const stream = [...tokenize(INSPECTION), ...buildSolverFrameStream()];

    const conjugated = conjugateToBaseFrame(stream);
    expect(conjugated).toEqual(fixed);
  });

  it('replays a synthetic solve with a mid-solve rotation to exactly solved', () => {
    const s = new CubeState();
    s.applySequence(SCRAMBLE);

    const stream = [...tokenize(INSPECTION), ...buildSolverFrameStream()];
    s.applySequence(conjugateToBaseFrame(stream).join(' '));

    expect(s.isSolved()).toBe(true);
  });

  it('rewrites each face through the running grip (hand-computed)', () => {
    // After y: faceMap = {F:'R', R:'B', L:'F', B:'L', U:'U', D:'D'}
    // Written R → physical B, written F' → physical R'.
    expect(conjugateToBaseFrame(['y', 'R', "F'"])).toEqual(['B', "R'"]);
    // A second rotation composes on the running grip (y then x):
    // grip = compose(x, y) = {U:'R',D:'L',F:'D',B:'U',L:'F',R:'B'}
    // → written R → physical B, written F → physical D.
    expect(conjugateToBaseFrame(['y', 'x', 'R', 'F'])).toEqual(['B', 'D']);
  });

  it('passes tokens through unchanged when there are no rotations', () => {
    expect(conjugateToBaseFrame(['R', "U'", 'M'])).toEqual(['R', "U'", 'M']);
  });
});
