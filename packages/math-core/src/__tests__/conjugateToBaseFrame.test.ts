import { describe, expect, it } from 'vitest';
import { CubeState } from '../CubeState';
import { conjugateToBaseFrame, conjugatePhaseStream } from '../notation/conjugateToBaseFrame';
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
    expect(conjugateToBaseFrame(['y', 'R2'])).toEqual(['B2']);
    // A second rotation composes on the running grip (y then x):
    // grip = compose(x, y) = {U:'R',D:'L',F:'D',B:'U',L:'F',R:'B'}
    // → written R → physical B, written F → physical D.
    expect(conjugateToBaseFrame(['y', 'x', 'R', 'F'])).toEqual(['B', 'D']);
  });

  it('passes tokens through unchanged when there are no rotations', () => {
    expect(conjugateToBaseFrame(['R', "U'", 'M'])).toEqual(['R', "U'", 'M']);
  });
});

describe('conjugatePhaseStream', () => {
  // Real web record #2510 (Liam Walton) from the baked JSON — includes the
  // glued token "U'D" in PLL that a naive whitespace split mangles (losing
  // the D' and leaving the cube unsolved). Regression for the reconstruction
  // replay fix.
  const SCRAMBLE_WEB_2510 = "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2";
  const WEB_2510_PHASES = [
    'z y', // Inspection
    "D2 L U R' U'", // W Cross
    "x' D' L' U L U' L' U L D", // F2L 1
    "U2 y' L' U L U' L' U L U2 L' U L", // F2L 2
    "U2 U L U' L'", // F2L 3
    "y' R' U2 R U R' U' R", // F2L 4
    "R' U' R' F R F' U R", // OLL
    "U' R U R' U'D R2 U' R U' R' U R' U R2 D'", // PLL (glued U'D)
  ];

  it('conjugates the real web #2510 (with glued U\'D) and the cube ends solved', () => {
    const { perPhase, rotationCount } = conjugatePhaseStream(
      WEB_2510_PHASES.map((p) => tokenize(p)),
    );

    // Rotations z y x' y' y' are consumed and counted; the glued U'D is
    // split by tokenize into U' + D, so the face-move total is 67 − 5 = 62
    // (66 raw whitespace tokens, +1 from the glued split, −5 rotations).
    expect(rotationCount).toBe(5);
    expect(perPhase.map((t) => t.length)).toEqual([0, 5, 9, 12, 5, 7, 8, 16]);
    expect(perPhase.reduce((n, t) => n + t.length, 0)).toBe(62);

    const s = new CubeState();
    s.applySequence(SCRAMBLE_WEB_2510);
    s.applySequence(perPhase.flat().join(' '));
    expect(s.isSolved()).toBe(true);
  });

  it('threads the grip across phases (a mid-solve rotation affects later phases)', () => {
    // Same move before/after a y' — the later phase's face is remapped.
    const a = conjugatePhaseStream([tokenize('R'), tokenize('R')]);
    const b = conjugatePhaseStream([tokenize('R'), tokenize("y' R")]);
    expect(a.perPhase[1][0]).toBe('R');
    expect(b.perPhase[1][0]).toBe('F'); // after y': written R → physical F
    expect(b.rotationCount).toBe(1);
  });

  it('emits a synthetic orientation timeline from the grip (smartcube-compatible)', () => {
    const { perPhase, rotationCount, orientationTimeline } = conjugatePhaseStream([
      tokenize('z y'),
      tokenize("D2 L U R' U'"),
      tokenize("x' D' L' U L U' L' U L D"),
    ]);

    expect(rotationCount).toBe(3); // z y (inspection) + x' (mid-solve)
    // z y inspection: both rotations happen before move 0 → one keyframe @0.
    // x' mid-solve: happens after the 5 cross moves → keyframe @5.
    expect(orientationTimeline.length).toBe(2);
    expect(orientationTimeline[0][0]).toBe(0);
    expect(orientationTimeline[1][0]).toBe(5);
    // Orientation ids must be valid table indices (0-23) and differ.
    expect(orientationTimeline[0][1]).toBeGreaterThanOrEqual(0);
    expect(orientationTimeline[0][1]).toBeLessThan(24);
    expect(orientationTimeline[1][1]).toBeGreaterThanOrEqual(0);
    expect(orientationTimeline[1][1]).toBeLessThan(24);
    expect(orientationTimeline[0][1]).not.toBe(0); // inspection ≠ identity
    expect(orientationTimeline[1][1]).not.toBe(0);
    // Per-phase face moves are unchanged by the new output field (the cross
    // "D2 L U R' U'" written in the solver's frame conjugates to the
    // physical frame under the z y grip — same count, different letters).
    expect(perPhase[1].length).toBe(5);
    // F2L 1 raw "x' D' L' U L U' L' U L D": the x' is a rotation (not a
    // face move), so the phase contributes 9 conjugated face moves.
    expect(perPhase[2].length).toBe(9);
  });

  it('emits an empty orientation timeline when there are no rotations', () => {
    const { orientationTimeline } = conjugatePhaseStream([
      tokenize('R U R\''),
      tokenize("U' R' F"),
    ]);
    expect(orientationTimeline).toEqual([]);
  });

  it('leaves an inspection-only phase empty and counts its rotations', () => {
    const { perPhase, rotationCount } = conjugatePhaseStream([
      tokenize('z y'),
      tokenize("D2 L U R' U'"),
    ]);
    expect(perPhase[0]).toEqual([]);
    expect(rotationCount).toBe(2);
    expect(perPhase[1].length).toBe(5);
  });
});
