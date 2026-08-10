import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import {
  FaceletStringConverter,
  cornerFacelet,
  cornerColor,
  edgeFacelet,
  edgeColor,
} from '../FaceletStringConverter';
import {
  applyFrameRotation,
  bestFrameRotationSequence,
  countCompletedF2LSlotsInFrame,
  countF2LSlotsInFrameAfterRotation,
  IDENTITY_SCHEME,
  type FrameRotation,
} from '../methods/cfop/slotDetection';
import { FACE_LETTERS } from '../methods/cfop/ColorPhaseDetector';
import { FACE_LAYERS } from '../methods/cfop/cfopMasks';

/**
 * INDEPENDENT oracle for countCompletedF2LSlotsInFrame: relabel the facelet
 * string by sticker color, then check each slot position's facelets show the
 * home colors IN ORDER. A position/sticker-based check — a different code
 * path from the permutation-array math in the counter.
 */
function oracleCount(
  cube: CubeState,
  crossFace: string,
  scheme: Record<string, string>,
): number {
  const f = FaceletStringConverter.toFaceletString(cube);
  const inverse: Record<string, string> = {};
  for (const l of FACE_LETTERS) inverse[scheme[l]] = l;
  const rel = Array.from(f, (ch) => inverse[ch] ?? ch);
  const faceData = FACE_LAYERS[crossFace];
  if (!faceData) return 0;
  let count = 0;
  for (let i = 0; i < 4; i++) {
    const edgePos = faceData.f2lEdges[i];
    const cornerPos = faceData.f2lCorners[i];
    let edgeOk = true;
    for (let j = 0; j < 2; j++) {
      if (rel[edgeFacelet[edgePos][j]] !== edgeColor[edgePos][j]) edgeOk = false;
    }
    let cornerOk = true;
    for (let j = 0; j < 3; j++) {
      if (rel[cornerFacelet[cornerPos][j]] !== cornerColor[cornerPos][j]) cornerOk = false;
    }
    if (edgeOk && cornerOk) count++;
  }
  return count;
}

const ROTATIONS: FrameRotation[] = [];
for (let d = 0; d < 4; d++) for (let e = 0; e < 4; e++) ROTATIONS.push({ d, e });

const SCHEMES: Record<string, Record<string, string>> = {
  identity: IDENTITY_SCHEME,
  yRot: { U: 'U', R: 'B', F: 'R', D: 'D', L: 'F', B: 'L' },
  y2Rot: { U: 'U', R: 'L', F: 'B', D: 'D', L: 'R', B: 'F' },
  whiteOnD: { U: 'D', D: 'U', F: 'F', B: 'B', R: 'R', L: 'L' },
};

function randomState(rng: () => number): CubeState {
  let s = new CubeState();
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
  const mods = ['', "'", '2'];
  const n = 8 + Math.floor(rng() * 25);
  for (let i = 0; i < n; i++) {
    s = s.clone();
    s.applySequence(`${faces[Math.floor(rng() * 6)]}${mods[Math.floor(rng() * 3)]}`);
  }
  return s;
}

describe('countCompletedF2LSlotsInFrame (direct, no facelet conversion)', () => {
  it('matches the independent facelet oracle on random states × rotations × schemes', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let trial = 0; trial < 60; trial++) {
      const s = randomState(rng);
      for (const scheme of Object.values(SCHEMES)) {
        for (const rot of ROTATIONS) {
          const cube = applyFrameRotation(s, rot);
          expect(countCompletedF2LSlotsInFrame(cube, 'D', scheme).completedCount).toBe(
            oracleCount(cube, 'D', scheme),
          );
        }
      }
    }
  });

  it('matches the facelet oracle on F/B/R/L cross faces too', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let trial = 0; trial < 15; trial++) {
      const s = randomState(rng);
      for (const crossFace of ['F', 'B', 'R', 'L', 'U'] as const) {
        for (const rot of ROTATIONS) {
          const cube = applyFrameRotation(s, rot);
          expect(countCompletedF2LSlotsInFrame(cube, crossFace, IDENTITY_SCHEME).completedCount).toBe(
            oracleCount(cube, crossFace, IDENTITY_SCHEME),
          );
        }
      }
    }
  });

  it('is stricter than the old fromFaceletString path on ambiguous schemes', () => {
    // whiteOnD (U↔D) makes the UBR and DRB corners share a relabeled color
    // set {D,B,R}. A physically twisted UBR piece at DRB used to read as
    // "home" because fromFaceletString identifies pieces by color SET only
    // (it derives orientation from a single facelet). The direct check reads
    // all three stickers in order → correctly "not home".
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let s = new CubeState();
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
    const mods = ['', "'", '2'];
    const n = 8 + Math.floor(rng() * 25);
    for (let i = 0; i < n; i++) {
      s = s.clone();
      s.applySequence(`${faces[Math.floor(rng() * 6)]}${mods[Math.floor(rng() * 3)]}`);
    }
    const cube = applyFrameRotation(s, { d: 2, e: 2 });
    expect(countCompletedF2LSlotsInFrame(cube, 'D', SCHEMES.whiteOnD).completedCount).toBe(
      oracleCount(cube, 'D', SCHEMES.whiteOnD),
    );
    expect(countCompletedF2LSlotsInFrame(cube, 'D', SCHEMES.whiteOnD).completedCount).toBe(0);
  });
});

describe('countF2LSlotsInFrameAfterRotation (preimage, no allocation)', () => {
  it('equals the materialized path on random states × rotations × schemes', () => {
    let seed = 99;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let trial = 0; trial < 40; trial++) {
      const s = randomState(rng);
      for (const scheme of Object.values(SCHEMES)) {
        for (const rot of ROTATIONS) {
          const materialized = countCompletedF2LSlotsInFrame(
            applyFrameRotation(s, rot),
            'D',
            scheme,
          ).completedCount;
          expect(countF2LSlotsInFrameAfterRotation(s, rot, 'D', scheme)).toBe(materialized);
        }
      }
    }
  });
});

describe('bestFrameRotationSequence (Viterbi DP over the span)', () => {
  it('reads a persistent block rotation from the state (real d-regrip)', () => {
    // A solved cube whose D+E block was rotated by {1,1}: only the undo
    // rotation {3,3} shows the 4 slots home, and it wins for the whole span.
    const solved = new CubeState();
    const rotated = applyFrameRotation(solved, { d: 1, e: 1 });
    const states = [rotated, rotated, rotated, rotated, rotated];
    const frames = bestFrameRotationSequence(states, 0, 4, 'D', IDENTITY_SCHEME);
    expect(frames.map((f) => `${f.d}/${f.e}`)).toEqual(['3/3', '3/3', '3/3', '3/3', '3/3']);
  });

  it('switches exactly once when the rotation is compensated mid-span', () => {
    // reconz-9068 pattern: the cross's wide u' leaves D/E rotated, and a
    // later d' COMPENSATES it back to identity. The DP must read the
    // compensated frame from the state instead of accumulating tokens.
    const solved = new CubeState();
    const rotated = applyFrameRotation(solved, { d: 1, e: 1 });
    const states = [rotated, rotated, rotated, solved, solved, solved, solved];
    const frames = bestFrameRotationSequence(states, 0, 6, 'D', IDENTITY_SCHEME);
    expect(frames.map((f) => `${f.d}/${f.e}`)).toEqual([
      '3/3',
      '3/3',
      '3/3',
      '0/0',
      '0/0',
      '0/0',
      '0/0',
    ]);
  });

  it('prefers the identity frame when nothing is rotated', () => {
    const solved = new CubeState();
    const states = [solved, solved, solved, solved];
    const frames = bestFrameRotationSequence(states, 0, 3, 'D', IDENTITY_SCHEME);
    expect(frames.map((f) => `${f.d}/${f.e}`)).toEqual(['0/0', '0/0', '0/0', '0/0']);
  });

  it('clamps out-of-range spans and returns empty for an empty span', () => {
    expect(bestFrameRotationSequence([new CubeState()], 5, 3, 'D', IDENTITY_SCHEME)).toEqual([]);
    expect(bestFrameRotationSequence([], 0, 0, 'D', IDENTITY_SCHEME)).toEqual([]);
  });
});
