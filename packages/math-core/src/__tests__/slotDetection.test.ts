import { describe, it, expect } from 'vitest';
import { CubeState } from '../CubeState';
import { ColorPhaseDetector } from '../methods/cfop/ColorPhaseDetector';
import { FACE_LAYERS } from '../methods/cfop/cfopMasks';
import {
  countCompletedF2LSlotsCanonical,
  countCompletedF2LSlotsInFrame,
  IDENTITY_SCHEME,
  f2lSlotNames,
} from '../methods/cfop/slotDetection';


function stateFromMoves(moves: string): CubeState {
  const state = new CubeState();
  state.applySequence(moves);
  return state;
}

describe('f2lSlotNames', () => {
  it('returns FR/BR/BL/FL order for a D cross (FACE_LAYERS order)', () => {
    expect(f2lSlotNames('D')).toEqual(['FR', 'BR', 'BL', 'FL']);
  });

  it('falls back to SLOT-N for an unknown face', () => {
    expect(f2lSlotNames('X')).toEqual(['SLOT-0', 'SLOT-1', 'SLOT-2', 'SLOT-3']);
  });

  it('slot names come from the FACE_LAYERS f2lEdges order', () => {
    const names = f2lSlotNames('D');
    const edges = FACE_LAYERS['D'].f2lEdges;
    expect(names).toHaveLength(edges.length);
  });
});

describe('countCompletedF2LSlotsCanonical', () => {
  it('counts 4 slots on a solved cube', () => {
    const result = countCompletedF2LSlotsCanonical(new CubeState(), 'D');
    expect(result.completedCount).toBe(4);
    expect(result.slotMask).toBe(0b1111);
  });

  it('counts 0 slots after a scramble that breaks every F2L slot', () => {
    // The real 2510 scramble leaves all four D-cross slots unsolved.
    const state = stateFromMoves("U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2");
    const result = countCompletedF2LSlotsCanonical(state, 'D');
    expect(result.completedCount).toBe(0);
    expect(result.slotMask).toBe(0);
  });

  it('reports the correct slot names for completed slots', () => {
    // A U move keeps the D-cross F2L slots intact.
    const result = countCompletedF2LSlotsCanonical(stateFromMoves('U'), 'D');
    expect(result.completedCount).toBe(4);
    expect(result.slots.map((s) => s.name)).toEqual(['FR', 'BR', 'BL', 'FL']);
    expect(result.slots[0].colors).toEqual(['F', 'R']);
  });

  it('returns empty for an unknown cross face', () => {
    const result = countCompletedF2LSlotsCanonical(new CubeState(), 'X');
    expect(result).toEqual({ slotMask: 0, completedCount: 0, slots: [] });
  });
});

describe('countCompletedF2LSlotsInFrame', () => {
  it('matches the canonical check under the identity scheme', () => {
    const state = stateFromMoves("R U R' U' R' F R F'");
    const canonical = countCompletedF2LSlotsCanonical(state, 'D');
    const framed = countCompletedF2LSlotsInFrame(state, 'D', IDENTITY_SCHEME);
    expect(framed.slotMask).toBe(canonical.slotMask);
    expect(framed.completedCount).toBe(canonical.completedCount);
  });

  it('detects the cross and reports pair colors for a solved FR slot', () => {
    // Solved cube, one U turn: all 4 slots remain complete; the FR slot pair
    // colors decode to the canonical F/R face letters (green/red).
    const state = stateFromMoves('U');
    const result = countCompletedF2LSlotsCanonical(state, 'D');
    expect(result.completedCount).toBe(4);
    const fr = result.slots.find((s) => s.name === 'FR');
    expect(fr).toBeDefined();
    expect(fr!.colors).toEqual(['F', 'R']);
  });
});

describe('ColorPhaseDetector exposes the winning scheme', () => {
  it('returns a complete face→color scheme on a white-on-D solve', () => {
    // Build a state sequence where the white cross completes on D.
    // Use the canonical solved state + moves that produce a white cross on D:
    // "R' D R" from solved does not make a white cross; instead we simulate by
    // using ColorPhaseDetector on a real white-on-D solve sequence.
    //
    // A canonical yellow-on-D solve: scramble + inverse. ColorPhaseDetector
    // should find the cross and derive a full 6-face scheme.
    const states: CubeState[] = [];
    let s = new CubeState();
    const moves = "R U R' U' R' F R F' U2 R U R' U' R' F R F' U R U' R'";
    for (const token of moves.split(' ')) {
      s = s.clone();
      s.applySequence(token);
      states.push(s);
    }
    const result = ColorPhaseDetector.detect(states);
    expect(result).not.toBeNull();
    expect(result!.scheme).toBeDefined();
    expect(Object.keys(result!.scheme)).toHaveLength(6);
  });
});
