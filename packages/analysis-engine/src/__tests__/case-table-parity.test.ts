import { describe, expect, it } from 'vitest';
import { analyzeSolve } from '../pipeline/analyzeSolve';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { conjugatePhaseStream, tokenize } from '@cubalyze/math-core';
import { makeMoves } from './test-helpers';

/**
 * Case-table parity — the SHARED case detection guarantee.
 *
 * The reconstruction text route (`analyzeSolveText`) and the smart / virtual
 * route (`analyzeSolve`) must report the SAME F2L / OLL / PLL case table for
 * the same physical solve. Both routes now consume the shared detection:
 *   - Basic F2L cases → `segmentF2LPairs` (the winning solver-frame scheme
 *     sweep), surfaced on `cfop.f2lPairs[].detectedCase`.
 *   - OLL / PLL cases   → `detectLastLayerCase` (../cases/lastLayerCases),
 *     surfaced on `cfop.ollCase` / `cfop.pllCase`.
 *
 * Fixture: solve 2510 (real CubeRoot record, inspection `z y` + inline
 * x'/y'). Its four F2L pairs are known Basic F2L cases (Pj/Jm/Jb/Ci) and it
 * has written OLL/PLL. The smart route receives the conjugated physical face
 * moves — the exact stream the text route builds internally — so a divergence
 * in the shared case detection would surface here as a case mismatch.
 */
const SCRAMBLE = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2";
const GRIP = 'z y';
const PHASES = [
  "D2 L U R' U'", // Cross (W)
  "x' D' L' U L U' L' U L D", // F2L 1
  "U2 y' L' U L U' L' U L U2 L' U L", // F2L 2
  "U2 U L U' L'", // F2L 3
  "y' R' U2 R U R' U' R", // F2L 4
  "R' U' R' F R F' U R", // OLL
  "U' R U R' U' D R2 U' R U' R' U R' U R2 D'", // PLL
];

const FACE_MOVE_RE = /^[URFDLB][2']?$/;

/** Conjugate grip + phases into the physical cube-frame face moves. */
function physicalMovesFor(grip: string, phases: readonly string[]): string[] {
  const { perPhase } = conjugatePhaseStream([
    tokenize(grip),
    ...phases.map((p) => tokenize(p)),
  ]);
  return perPhase
    .slice(1)
    .flat()
    .filter((t) => FACE_MOVE_RE.test(t));
}

describe('Case table parity — smart route ≡ reconstruction text route', () => {
  const runSmart = async () =>
    analyzeSolve({
      moves: makeMoves(physicalMovesFor(GRIP, PHASES).join(' ')),
      method: 'CFOP',
      scramble: SCRAMBLE,
      solveTimeMs: 8000,
    });
  const runText = () =>
    analyzeSolveText({
      setup: SCRAMBLE,
      inspection: GRIP,
      solution: PHASES.join(' '),
      method: 'CFOP',
      totalTimeMs: 8000,
    });

  it('reports the exact same F2L pair cases as the reconstruction (Pj/Jm/Jb/Ci)', async () => {
    const [smart, text] = await Promise.all([runSmart(), runText()]);

    const smartNames = (smart.metrics.cfop?.f2lPairs ?? []).map(
      (p) => p.detectedCase?.caseName ?? null,
    );
    const textNames = text.reconstruction.pairs.map(
      (p) => p.detectedCase?.caseName ?? null,
    );

    // Identical between routes…
    expect(smartNames).toEqual(textNames);
    // …and identical to the known annotations (the shared case table is live,
    // not vacuously empty on the smart route).
    expect(smartNames).toEqual(['Pj', 'Jm', 'Jb', 'Ci']);
  });

  it('reports the same OLL/PLL cases (and AUF face) as the reconstruction', async () => {
    const [smart, text] = await Promise.all([runSmart(), runText()]);

    expect(smart.metrics.cfop?.ollCase?.caseName ?? null).toBe(
      text.reconstruction.oll?.detectedCase?.caseName ?? null,
    );
    expect(smart.metrics.cfop?.pllCase?.caseName ?? null).toBe(
      text.reconstruction.pll?.detectedCase?.caseName ?? null,
    );
    expect(smart.metrics.cfop?.ollCase?.aufFace ?? null).toBe(
      text.reconstruction.oll?.detectedCase?.aufFace ?? null,
    );
    expect(smart.metrics.cfop?.pllCase?.aufFace ?? null).toBe(
      text.reconstruction.pll?.detectedCase?.aufFace ?? null,
    );
  });
});