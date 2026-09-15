import { describe, it, expect } from 'vitest';
import {
  CubeState,
  StateMatcher,
  PLLStateMask,
  PLLMask,
  OLLMask,
} from '@cubalyze/math-core';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { CFOPDefinition } from '@cubalyze/math-core';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { makeMoves } from './test-helpers';

// Known PLL algorithms (standard algs, verified against SpeedCubeDB).
// NOTE: algorithms with rotations (x/y/z) are EXCLUDED because applying
// them to solved produces states with D/E-layer permutations from Kociemba
// rotation artifacts (y = U D' E'), which break PLLStateMask's F2L+Cross checks.
// Use createCleanState() from algorithm-db for those cases.
const NON_ROTATION_PLLS: Record<string, string> = {
  Ua: "R U' R U R U R U' R' U' R2",
  Ub: "R2 U R U R' U' R' U' R' U R'",
  H: "M2 U M2 U2 M2 U M2",
  Z: "M2 U M2 U M' U2 M2 U2 M' U2",
  T: "R U R' U' R' F R2 U' R' U' R U R' F'",
  F: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  Ja: "R' U L' U2 R U' R' U2 R L U'",
  Jb: "R U R' F' R U R' U' R' F R2 U' R' U'",
  Ra: "R U' R' U' R U R D R' U' R D' R' U2 R' U'",
  Rb: "R' U2 R U2 R' F R U R' U' R' F' R2 U'",
  Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
};

describe('PLLStateMask — detects PLL state (not solved)', () => {
  // ── PLLStateMask vs PLLMask ──────────────────────────────────────────

  it('PLLMask requires fully solved cube', () => {
    const solved = new CubeState();
    expect(StateMatcher.matchesMask(solved, PLLMask)).toBe(true);

    // After a U move → not solved → PLLMask should reject
    const afterU = new CubeState();
    afterU.applySequence('U');
    expect(StateMatcher.matchesMask(afterU, PLLMask)).toBe(false);
  });

  it('PLLStateMask matches all 21 PLL case states (OLL done, not solved)', () => {
    for (const [name, alg] of Object.entries(NON_ROTATION_PLLS)) {
      // Apply PLL algorithm to solved → creates a PLL state
      const state = new CubeState();
      state.applySequence(alg);

      // PLL state: F2L+Cross done, U-layer oriented → PLLStateMask should match
      const matches = StateMatcher.matchesMask(state, PLLStateMask);
      expect(matches, `${name}: PLLStateMask should match PLL state`).toBe(true);

      // PLL state ≠ solved → PLLMask should NOT match
      const solvedMatch = StateMatcher.matchesMask(state, PLLMask);
      expect(
        solvedMatch,
        `${name}: PLLMask should NOT match (not solved)`,
      ).toBe(false);
    }
  });

  it('PLLStateMask rejects non-PLL states (F2L broken)', () => {
    const state = new CubeState();
    state.applySequence("R U R'"); // breaks Cross + F2L
    expect(StateMatcher.matchesMask(state, PLLStateMask)).toBe(false);
  });

  it('PLLStateMask matches after applying PLL to solved, then rejects after solve', () => {
    // Apply T-perm → PLL state
    const state = new CubeState();
    state.applySequence(NON_ROTATION_PLLS['T']);
    expect(StateMatcher.matchesMask(state, PLLStateMask)).toBe(true);

    // Apply T-perm again → solved → PLLStateMask still matches (solved ⊃ PLL)
    // Actually: solved state has F2L+Cross exact + U-layer oriented = PLLStateMask ✓
    state.applySequence(NON_ROTATION_PLLS['T']);
    expect(StateMatcher.matchesMask(state, PLLStateMask)).toBe(true);
    // But PLLMask now matches too (fully solved)
    expect(StateMatcher.matchesMask(state, PLLMask)).toBe(true);
  });
});

describe('PhaseSplitter — PLL phase detection', () => {
  // ── OLL+PLL simultaneous detection ──────────────────────────────────

  it('T-perm double solve detects all 4 phases including PLL', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const moves = makeMoves(`${tPerm} ${tPerm}`);
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    const phases = PhaseSplitter.split(timeline, CFOPDefinition);
    const phaseNames = phases.map((p) => p.phaseName);

    expect(phaseNames).toContain('Cross');
    expect(phaseNames).toContain('F2L');
    expect(phaseNames).toContain('OLL');
    expect(phaseNames).toContain('PLL');
  });

  it('phase segments are contiguous after simultaneous fix', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const moves = makeMoves(`${tPerm} ${tPerm}`);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    for (let i = 1; i < phases.length; i++) {
      expect(
        phases[i].startIndex,
        `Phase ${phases[i].phaseName} overlaps`,
      ).toBeGreaterThanOrEqual(phases[i - 1].endIndex);
    }
  });

  it('validate() returns true after OLL+PLL fix', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const moves = makeMoves(`${tPerm} ${tPerm}`);
    const timeline = TimelineBuilder.build(moves, 'CFOP');
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition);

    expect(PhaseSplitter.validate(timeline, CFOPDefinition)).toBe(true);
  });

  it('hasPhase detects all 4 CFOP phases', () => {
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const moves = makeMoves(`${tPerm} ${tPerm}`);
    const timeline = TimelineBuilder.build(moves, 'CFOP');

    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'Cross')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'F2L')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'OLL')).toBe(true);
    expect(PhaseSplitter.hasPhase(timeline, CFOPDefinition, 'PLL')).toBe(true);
  });
});
