import { describe, expect, it } from 'vitest';
import { PyraminxScrambleTracker } from '../pyraminxSessionCore';
import {
  applyPyraminxSequence,
  isPyraminxSolved,
  solvedPyraminx,
} from '@cubalyze/solver-engine/pyraminx';
import type { CubeMoveEvent } from '@cubalyze/types';

describe('Pyraminx Virtual Solve Capture & Replay Compatibility', () => {
  const SCRAMBLE = "U L' B R' u l'";

  it('collects Pyraminx WCA tokens in displayNotation during solve', () => {
    const tracker = new PyraminxScrambleTracker(SCRAMBLE);
    tracker.applyScrambleNow();
    expect(tracker.isScrambled).toBe(true);

    const inverse = SCRAMBLE.split(' ')
      .reverse()
      .map((tok) => (tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`));

    const collectedMoves: CubeMoveEvent[] = [];
    for (const token of inverse) {
      const res = tracker.applyMove(token);
      collectedMoves.push({
        face: 'U', // inert carrier
        direction: 1,
        displayNotation: token,
        cubeTimestamp: collectedMoves.length * 550,
        hostTimestamp: Date.now(),
      });
      if (res.kind === 'solve-complete') break;
    }

    expect(tracker.isSolved).toBe(true);
    expect(collectedMoves).toHaveLength(inverse.length);

    // Verify reconstruction can be reconstructed from displayNotation:
    const reconstruction = collectedMoves.map((m) => m.displayNotation).join(' ');
    expect(reconstruction).toBe(inverse.join(' '));

    // Verify applying scramble + reconstruction restores the solved state:
    const fullSequence = `${SCRAMBLE} ${reconstruction}`;
    const finalState = applyPyraminxSequence(solvedPyraminx(), fullSequence);
    expect(finalState).not.toBeNull();
    expect(isPyraminxSolved(finalState!)).toBe(true);
  });
});
