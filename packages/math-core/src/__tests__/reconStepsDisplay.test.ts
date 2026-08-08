import { describe, expect, it } from 'vitest';
import { conjugatePhaseStream } from '../notation/conjugateToBaseFrame';
import { tokenize } from '../notation/moveNotation';

const FACE_MOVE_RE = /^[URFDLB][2']?$/;

// Regression for the user-reported display bug (2026-08-08): the Steps table
// showed CONJUGATED face moves ("R' B U B' …") instead of the raw notation.
// Contract: display = direct parse of the raw phase (wide moves + rotations as
// written); replay = conjugated outer-face moves only (slices dropped — the
// 3D engine cannot animate them).
//
// The user's exact record (reconz-12564) as baked in the chunks.
const PHASES = [
  { label: 'inspection', moves: "x'" },
  { label: 'xxxcross', moves: "r' U F U' r U' r' U2 r' U r" },
  { label: '4th pair', moves: "R U2' R2' U' R U R U2' R'" },
  { label: 'ZBLL', moves: "U' F' r U R' U' r' F R" },
];

function normalize(phases: { label: string; moves: string }[]) {
  const { perPhase, rotationCount } = conjugatePhaseStream(phases.map((p) => tokenize(p.moves)));
  return phases.map((p, i) => {
    const display = tokenize(p.moves, { expandWide: false });
    const replay = perPhase[i].filter((t) => FACE_MOVE_RE.test(t));
    return {
      label: p.label,
      display: display.join(' '),
      displayCount: display.length,
      replay: replay.join(' '),
      replayCount: replay.length,
    };
  });
}

describe('recon steps display vs replay (reconz-12564)', () => {
  it('Steps table now shows the raw notation (direct parse), replay keeps conjugated faces', () => {
    const out = normalize(PHASES);
    expect(out).toEqual([
      { label: 'inspection', display: "x'", displayCount: 1, replay: '', replayCount: 0 },
      {
        label: 'xxxcross',
        display: "r' U F U' r U' r' U2 r' U r",
        displayCount: 11,
        replay: "R' B U B' R B' R' B2 R' B R",
        replayCount: 11,
      },
      {
        label: '4th pair',
        display: "R U2' R2' U' R U R U2' R'",
        displayCount: 9,
        replay: 'R B2 R2 B\' R B R B2 R\'',
        replayCount: 9,
      },
      {
        label: 'ZBLL',
        display: "U' F' r U R' U' r' F R",
        displayCount: 9,
        replay: "B' U' R B R' B' R' U R",
        replayCount: 9,
      },
    ]);
  });
});
