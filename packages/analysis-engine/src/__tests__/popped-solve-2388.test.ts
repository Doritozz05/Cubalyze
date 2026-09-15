import { describe, it, expect } from 'vitest';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { CubeState } from '@cubalyze/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';

const SOLVE_2388 = {
  setup: "R F2 R2 D L2 F2 L2 U B2 D R' B2 R D2 R2 F U R U",
  solution: [
    'y2 // Inspection',
    "D' R' D U2 R2 B L' B' // Y Cross",
    "U' R U R' F U F' // F2L 1 (BR)",
    "U2 U y' R' U' R U R' U' R // F2L 2 (BO)",
    "y' R U R' U' R U R' // F2L 3 (GR)",
    "y' R U R' U' R U R' // F2L 4 (GO)",
    "U Rw U Rw' R U R' U' Rw U' Rw' // OLL",
    "U M2 U' M U2 M' U' M2 // PLL Ub",
  ].join('\n'),
  method: 'CFOP' as const,
};

describe('2388 F2L exactness', () => {
  it('panel path (relaxedCross) reports the same pair cases', () => {
    const { reconstruction } = analyzeSolveText({
      setup: SOLVE_2388.setup,
      solution: SOLVE_2388.solution,
      method: 'CFOP',
      relaxedCross: true,
    });
    const seq = reconstruction.pairs.map(
      (p) => `${p.slot}:${p.detectedCase?.caseName ?? '?'}`,
    );
    console.log('panel path pairs:', seq.join(' | '));
    // Pairs 1/3/4 are the same Pb case: the corner is parked in a foreign
    // slot (BR's corner in DBL/DFR), and the relational signature reads the
    // color relationship (front stickers coincide → the pair does NOT
    // connect after the up move → Pb) regardless of where the pieces sit.
    // The user confirmed BR is Pb from the actual stickers.
    expect(seq.join(',')).toBe('BR:Pb,BL:Ki,FR:Pb,FL:Pb');
  });

  it('every F2L timeline state matches an independent raw replay modulo the grip', () => {
    const { timeline } = analyzeSolveText(SOLVE_2388);
    const entryTokens = timeline.entries.map((e) =>
      e.move.face + (e.move.direction === 2 ? '2' : e.move.direction === -1 ? "'" : ''),
    );

    // Independent replay: scramble, then the F2L entries (entries 0..36 are
    // the cross + 4 pairs; the OLL starts at 37 with wide moves — the F2L
    // section has NO wide moves, so the replay must be exact there).
    const f2lEnd = 36;
    const replay = new CubeState();
    replay.applySequence(SOLVE_2388.setup);
    let mismatches = 0;
    for (let i = 0; i <= f2lEnd; i++) {
      replay.applySequence(entryTokens[i]);
      const snap = timeline.solverFrameStates?.[i] ?? timeline.entries[i]?.state;
      const tl = TimelineBuilder.fromSnapshot(snap);
      // The timeline states carry the y2 grip: tl == replay ∘ y2.
      const expect = replay.clone();
      expect.applySequence('y2');
      const same =
        Array.from(expect.cp).join() === Array.from(tl.cp).join() &&
        Array.from(expect.ep).join() === Array.from(tl.ep).join();
      if (!same) {
        mismatches++;
        console.log(`MISMATCH at entry ${i} (${entryTokens[i]})`);
      }
    }
    console.log(`F2L entries 0..${f2lEnd}: ${mismatches} mismatches out of ${f2lEnd + 1}`);
    expect(mismatches).toBe(0);
  });
});
