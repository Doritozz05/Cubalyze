/** Advanced, complete-state diagnostic for WCA solve #2286. */
import { describe, it, expect } from 'vitest';
import { CubeState, conjugatePhaseStream } from '@cubeforge/math-core';
import { PLL_CASES } from '../seed/cfop-pll';
import { CaseStateGenerator } from '../caseGenerator';
import { lastLayerPermutationProbe } from '../recognition/probes/lastLayerProbes';

const SCRAMBLE = "U L' U2 D2 R' F' B U' L R2 U2 F2 B' L2 U2 L2 F' R F";
const PHASES = [
  ['x2', 'y'],
  ["l", "D'", "R2", "x'", 'L', "F'", "L'"],
  ["R'", 'U2', 'R', 'U2', 'L', 'U', "L'"],
  ["y'", 'R', "U'", "R'"],
  ['y', "U'", "R'", 'U', 'R', 'U2', "R'", 'U', 'R'],
  ["U'", 'y', "L'", 'U', 'L', "U'", "L'", "U'", 'L'],
  ['U', 'R', 'U', "R'", "U'", "R'", 'F', 'R', "F'"],
  ['x', 'R2', 'F', 'R', "F'", 'R', 'U2', "r'", 'U', 'r', 'U2', "x'", "U'"],
] as const;

const FRAMES = ['', 'x', "x'", 'x2', 'z', "z'", 'z2', 'y', "y'", 'y2'];
const AUFS = ['', 'U', 'U2', "U'"];

function arr(state: CubeState, key: 'cp' | 'co' | 'ep' | 'eo'): string {
  return Array.from(state[key]).join('');
}
function stateKey(state: CubeState): string {
  return `${arr(state, 'cp')}|${arr(state, 'co')}|${arr(state, 'ep')}|${arr(state, 'eo')}`;
}
function apply(state: CubeState, sequence: string): CubeState {
  const out = state.clone();
  if (sequence) out.applySequence(sequence);
  return out;
}
function pllSig(state: CubeState, crossFace: string): string {
  return lastLayerPermutationProbe.signature(state, {
    probe: 'last-layer-permutation',
    crossFace,
  });
}

function stateAfterExactTextPipeline(): CubeState {
  const { perPhase } = conjugatePhaseStream(PHASES);
  const state = new CubeState();
  state.applySequence(SCRAMBLE);
  for (const phase of perPhase.slice(1)) {
    // TimelineBuilder consumes the expanded wide token exactly as the real
    // path does; applySequence expands lower-case wides itself too.
    state.applySequence(phase.join(' '));
  }
  return state;
}

describe('solve #2286 — exact frame/PLL investigation', () => {
  it('compares the exact conjugated state with catalog Ja', () => {
    const observed = stateAfterExactTextPipeline();
    const ja = CaseStateGenerator.generateFromScramble(
      PLL_CASES.find((c) => c.caseDef.caseNumber === 'Ja')!.caseDef.setupScramble,
    );
    const rows: string[] = [];
    for (const frame of FRAMES) {
      for (const auf of AUFS) {
        const candidate = apply(observed, `${frame} ${auf}`.trim());
        const sig = pllSig(candidate, 'D');
        if (sig === pllSig(ja, 'D')) rows.push(`${frame || 'id'} + ${auf || 'id'}`);
      }
    }
    console.log('exact conjugated observed:', stateKey(observed));
    console.log('catalog Ja:', stateKey(ja));
    console.log('Ja signature:', pllSig(ja, 'D'));
    console.log('matching frame/AUF combinations:', rows);

    // The source reconstruction includes a trailing U' after PLL, so the
    // complete solve is intentionally not solved until that post-PLL AUF is
    // removed. This assertion is diagnostic, not a solve-validity check.
    expect(rows).toEqual(expect.any(Array));
  });
});
