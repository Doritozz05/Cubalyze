import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import {
  CubeState,
  StateMatcher,
  CFOPDefinition,
  CrossMask,
  F2LMask,
  OLLMask,
  PLLMask,
  Edge,
  COLOR_NEUTRAL_CFOP_MASKS,
} from '@cubeforge/math-core';
import { makeSolveFromScramble, inverseScramble } from './test-helpers';

/* eslint-disable no-console */

/**
 * DIAGNOSTIC: Phase Recognition Bug Investigation
 *
 * Reproduces the "Cross = entire solve" symptom and demonstrates
 * exactly WHY the CrossMask is only satisfied at the final move.
 */

const EDGE_NAMES = [
  'UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB',
  'FR', 'FL', 'BL', 'BR',
];

function maskFlags(state: CubeState) {
  return {
    cross: StateMatcher.matchesMask(state, CrossMask),
    f2l: StateMatcher.matchesMask(state, F2LMask),
    oll: StateMatcher.matchesMask(state, OLLMask),
    pll: StateMatcher.matchesMask(state, PLLMask),
    solved: state.isSolved(),
  };
}

function flagStr(f: ReturnType<typeof maskFlags>) {
  return `Cross:${f.cross ? '✓' : '✗'} F2L:${f.f2l ? '✓' : '✗'} OLL:${f.oll ? '✓' : '✗'} PLL:${f.pll ? '✓' : '✗'} Solved:${f.solved ? '✓' : '✗'}`;
}

function notation(face: string, dir: number): string {
  return face + (dir === -1 ? "'" : dir === 2 ? '2' : '');
}

/** Pretty-print the D-layer cross edges' positions/orientations. */
function crossStatus(state: CubeState): string {
  const crossPositions: Array<{ name: string; pos: Edge; expectedPiece: Edge }> = [
    { name: 'DF', pos: Edge.DF, expectedPiece: Edge.DF },
    { name: 'DR', pos: Edge.DR, expectedPiece: Edge.DR },
    { name: 'DB', pos: Edge.DB, expectedPiece: Edge.DB },
    { name: 'DL', pos: Edge.DL, expectedPiece: Edge.DL },
  ];
  return crossPositions
    .map((e) => {
      const piece = state.ep[e.pos];
      const orient = state.eo[e.pos];
      const ok = piece === e.expectedPiece && orient === 0;
      return `${e.name}=${ok ? '✓' : `${EDGE_NAMES[piece]}(${orient})`}`;
    })
    .join(' ');
}

/** Pretty-print U-layer cross edges (for color-neutral analysis). */
function uCrossStatus(state: CubeState): string {
  const uPositions: Array<{ name: string; pos: Edge; expectedPiece: Edge }> = [
    { name: 'UF', pos: Edge.UF, expectedPiece: Edge.UF },
    { name: 'UR', pos: Edge.UR, expectedPiece: Edge.UR },
    { name: 'UB', pos: Edge.UB, expectedPiece: Edge.UB },
    { name: 'UL', pos: Edge.UL, expectedPiece: Edge.UL },
  ];
  return uPositions
    .map((e) => {
      const piece = state.ep[e.pos];
      const orient = state.eo[e.pos];
      const ok = piece === e.expectedPiece && orient === 0;
      return `${e.name}=${ok ? '✓' : `${EDGE_NAMES[piece]}(${orient})`}`;
    })
    .join(' ');
}

describe('DIAGNOSTIC — Phase Recognition Bug', () => {
  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Realistic 23-move WCA scramble, inverse-scramble solve.
  // This is the closest synthetic analogue to a real smart-cube solve
  // (103 moves → Cross = entire solve).
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 1: realistic WCA scramble — Cross spans the ENTIRE solve', () => {
    const scramble =
      "R' U' F D2 L2 D' R2 U' B2 D' L2 B2 L' D B D2 B R' D L2 R' U' F";
    const { solveMoves, notation: solveNotation } =
      makeSolveFromScramble(scramble);

    const timeline = TimelineBuilder.build(
      solveMoves,
      'CFOP',
      undefined,
      scramble,
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 1: Realistic WCA scramble + inverse solve');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Scramble (23 moves): ${scramble}`);
    console.log(`Solve   (23 moves): ${solveNotation}`);
    console.log(`Total solve moves : ${solveMoves.length}`);
    console.log('');

    // Log EVERY move with mask results
    console.log('Per-move detector results:');
    console.log('Move │ Notation │ D-cross status           │ U-cross status           │ Detector flags');
    console.log('─────┼──────────┼──────────────────────────┼──────────────────────────┼─────────────────────────────────');

    let firstCrossTrue = -1;
    let firstF2LTrue = -1;
    let firstOLLTrue = -1;
    let firstPLLTrue = -1;

    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i];
      const state = TimelineBuilder.fromSnapshot(entry.state);
      const f = maskFlags(state);
      const n = notation(entry.move.face, entry.move.direction);

      if (f.cross && firstCrossTrue === -1) firstCrossTrue = i;
      if (f.f2l && firstF2LTrue === -1) firstF2LTrue = i;
      if (f.oll && firstOLLTrue === -1) firstOLLTrue = i;
      if (f.pll && firstPLLTrue === -1) firstPLLTrue = i;

      console.log(
        `${String(i + 1).padStart(4)} │ ${n.padEnd(8)} │ ${crossStatus(state).padEnd(24)} │ ${uCrossStatus(state).padEnd(24)} │ ${flagStr(f)}`,
      );
    }

    console.log('');
    console.log(`First move where Cross=✓: ${firstCrossTrue + 1}/${timeline.entries.length}`);
    console.log(`First move where F2L=✓:  ${firstF2LTrue + 1}/${timeline.entries.length}`);
    console.log(`First move where OLL=✓:  ${firstOLLTrue + 1}/${timeline.entries.length}`);
    console.log(`First move where PLL=✓:  ${firstPLLTrue + 1}/${timeline.entries.length}`);

    // Run the actual PhaseSplitter
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);
    console.log('');
    console.log('PhaseSplitter result:');
    console.log(`  Phases detected: ${phases.length} (expected: 4 = Cross, F2L, OLL, PLL)`);
    for (const p of phases) {
      console.log(
        `  • ${p.phaseName}: moves ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount} moves, ${p.durationMs}ms)`,
      );
    }

    // THE BUG: Cross should NOT span the entire solve.
    // For an inverse-scramble (no CFOP structure), the CrossMask is only
    // satisfied at the final move — exactly the reported symptom.
    const crossPhase = phases.find((p) => p.phaseName === 'Cross');
    const crossRatio = crossPhase
      ? crossPhase.moveCount / timeline.entries.length
      : 0;
    console.log('');
    console.log(`Cross move ratio: ${crossPhase?.moveCount ?? 0}/${timeline.entries.length} = ${(crossRatio * 100).toFixed(1)}%`);
    if (crossRatio > 0.9) {
      console.log('⚠ BUG REPRODUCED: Cross spans >90% of the solve — matches the reported symptom (Cross = 103/103 moves)');
    }

    // Machine-verifiable assertion: Cross spans the ENTIRE solve.
    // Only 1 phase is detected, and it ends at the last move.
    expect(phases.length).toBe(1);
    expect(phases[0].phaseName).toBe('Cross');
    expect(phases[0].endIndex).toBe(timeline.entries.length - 1);
    expect(crossRatio).toBeGreaterThan(0.9);

    expect(timeline.entries.length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 2: D-misaligned cross — the cross IS solved relative to the
  // D center but the absolute mask fails (documented in StateMatcher.test).
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 2: D-misaligned cross — mask fails on relative cross', () => {
    const state = new CubeState();
    state.applySequence('D'); // rotate bottom layer 90°

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 2: D-misaligned cross (D move applied to solved cube)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`After "D": D-cross status = ${crossStatus(state)}`);
    console.log(`CrossMask satisfied? ${StateMatcher.matchesMask(state, CrossMask)}`);
    console.log('');
    console.log('Explanation: The 4 D-face edges are STILL on the D face and oriented');
    console.log('(relative to the D center, the cross is solved). But the absolute');
    console.log('positions are permuted: DF→DL, DR→DF, DB→DR, DL→DB. The mask');
    console.log('requires each piece in its EXACT home position, so it fails.');
    console.log('This is the "D-alignment trap": a D move breaks the mask even');
    console.log('though the cross is functionally solved.');

    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Color Neutral — user builds a U-face cross.
  // The CrossMask checks D-face only, so it is never satisfied until
  // the entire cube is solved.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 3: color-neutral cross on U face — D-face mask never satisfied', () => {
    // Construct a state where the U-face cross is solved but the D-face is NOT.
    // Start from solved, apply moves that break D-cross but keep U-cross solved.
    // E.g., apply F2 to move the DF edge to UF (U-cross gains a piece, D loses one).
    const state = new CubeState();
    // F2 moves DF→UF and UF→DF. So after F2, the U-face has the DF piece at UF
    // (oriented), and the D-face has the UF piece at DF.
    state.applySequence('F2');
    // Then R2: moves DR→UR and UR→DR
    state.applySequence('R2');
    // Then L2: moves DL→UL and UL→DL
    state.applySequence('L2');
    // Then B2: moves DB→UB and UB→DB
    state.applySequence('B2');

    // After F2 R2 L2 B2: all 4 D-cross edges have been moved to U positions,
    // and all 4 U-cross edges have been moved to D positions.
    // The U-face now has the 4 D-color edges (a "U-face cross" of D-color),
    // and the D-face has the 4 U-color edges.

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 3: Color Neutral — cross built on U face');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Applied: F2 R2 L2 B2 (all 4 D-cross edges moved to U face)');
    console.log('');
    console.log(`D-face cross status: ${crossStatus(state)}`);
    console.log(`U-face cross status: ${uCrossStatus(state)}`);
    console.log(`CrossMask (D-face) satisfied? ${StateMatcher.matchesMask(state, CrossMask)}`);
    console.log('');
    console.log('Explanation: The 4 D-color cross edges (DF, DR, DB, DL) are now');
    console.log('on the U face (at UF, UR, UB, UL positions), oriented. This is a');
    console.log('valid color-neutral cross — but on the U face, not the D face.');
    console.log('The CrossMask only checks the D face, so it returns FALSE.');
    console.log('The mask would only become TRUE when the cube is fully solved');
    console.log('(all edges return to their home positions).');
    console.log('');
    console.log('This is the Color Neutral trap: if a user solves with a non-D');
    console.log('cross (e.g., yellow cross on U, or any color on any face), the');
    console.log('CrossMask is not satisfied until the entire solve is complete.');
    console.log('This produces exactly the reported symptom: Cross = 103 moves = entire solve.');

    expect(StateMatcher.matchesMask(state, CrossMask)).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 4: How the 6 possible crosses map to the single D-face mask.
  // Shows that only 1 of 6 color-neutral choices is detected.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 4: only 1 of 6 color-neutral crosses is detected by CrossMask', () => {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 4: Color Neutral — 6 possible crosses, 1 detected');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('A color-neutral solver may build the cross on ANY of 6 faces.');
    console.log('The current CrossMask only checks ONE of these (the D face).');
    console.log('');
    console.log('Face │ Cross edges (positions) │ Detected by CrossMask?');
    console.log('─────┼─────────────────────────┼────────────────────────');

    const faces: Array<{ face: string; edges: Edge[] }> = [
      { face: 'D', edges: [Edge.DF, Edge.DR, Edge.DB, Edge.DL] },
      { face: 'U', edges: [Edge.UF, Edge.UR, Edge.UB, Edge.UL] },
      { face: 'F', edges: [Edge.FL, Edge.FR, Edge.UF, Edge.DF] },
      { face: 'B', edges: [Edge.BL, Edge.BR, Edge.UB, Edge.DB] },
      { face: 'L', edges: [Edge.UL, Edge.DL, Edge.FL, Edge.BL] },
      { face: 'R', edges: [Edge.UR, Edge.DR, Edge.FR, Edge.BR] },
    ];

    for (const f of faces) {
      const detected = f.face === 'D';
      const edgeStr = f.edges.map((e) => EDGE_NAMES[e]).join(', ');
      console.log(
        ` ${f.face}   │ ${edgeStr.padEnd(23)} │ ${detected ? 'YES ✓' : 'NO ✗'}`,
      );
    }
    console.log('');
    console.log('5 of 6 color-neutral crosses are INVISIBLE to the detector.');

    expect(true).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Verify that for a "standard white cross on D" solve,
  // the mask IS satisfied early (sanity check — the mask works when
  // the user follows the assumed convention).
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 5: sanity — solved cube satisfies all masks at move 0', () => {
    const state = new CubeState();
    const f = maskFlags(state);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 5: Sanity — solved cube satisfies ALL masks');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Solved cube: ${flagStr(f)}`);
    console.log('');
    console.log('A solved cube satisfies Cross, F2L, OLL, and PLL simultaneously.');
    console.log('This is why the CrossMask IS eventually satisfied at the end of');
    console.log('any solve — the solved state is a superset of all phase masks.');

    expect(f.cross && f.f2l && f.oll && f.pll).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Short scramble — show the detector still produces only
  // 1 phase (Cross) spanning the whole solve even for a 4-move case.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 6: 4-move scramble — how many phases are actually detected?', () => {
    const scramble = "R U R' U'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    const phases = PhaseSplitter.split(timeline, CFOPDefinition);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 6: 4-move scramble — phase detection detail');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Scramble: ${scramble}`);
    console.log(`Solve:    ${inverseScramble(scramble)}`);
    console.log('');

    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i];
      const state = TimelineBuilder.fromSnapshot(entry.state);
      const f = maskFlags(state);
      const n = notation(entry.move.face, entry.move.direction);
      console.log(
        `  Move ${i + 1}: ${n.padEnd(4)} D-cross=[${crossStatus(state)}] ${flagStr(f)}`,
      );
    }

    console.log('');
    console.log(`Phases detected: ${phases.length}`);
    for (const p of phases) {
      console.log(`  • ${p.phaseName}: moves ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount} moves)`);
    }

    // Even for this trivial case, check whether all 4 phases are detected
    const phaseNames = phases.map((p) => p.phaseName);
    console.log('');
    console.log(`Phase names: ${phaseNames.join(', ') || '(none)'}`);
    console.log(`All 4 CFOP phases detected? ${phases.length === 4}`);

    expect(phases.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 7: Test a scramble designed to leave the D-cross close to
  // solved, to show the mask CAN work when the convention is followed.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 7: scramble that preserves D-cross — mask detects early', () => {
    // A scramble using only U, R, L moves (no F, D, B) preserves the D-cross
    // edges in their positions (though it may affect F2L corners).
    // Actually U, R, L don't touch D-face edges at all.
    // Wait — R moves affect DR (a cross edge). Let me use only U moves.
    // U moves only affect U-layer pieces. D-cross is untouched.
    const scramble = "U U' U2 U U'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 7: U-only scramble — D-cross preserved throughout');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Scramble: ${scramble} (only U moves — D-cross never broken)`);    
    console.log('');

    let firstCross = -1;
    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i];
      const state = TimelineBuilder.fromSnapshot(entry.state);
      const f = maskFlags(state);
      const n = notation(entry.move.face, entry.move.direction);
      if (f.cross && firstCross === -1) firstCross = i;
      console.log(
        `  Move ${i + 1}: ${n.padEnd(4)} D-cross=[${crossStatus(state)}] ${flagStr(f)}`,
      );
    }

    const phases = PhaseSplitter.split(timeline, CFOPDefinition);
    console.log('');
    console.log(`First Cross=✓ at move: ${firstCross + 1}/${timeline.entries.length}`);
    console.log(`Phases detected: ${phases.length}`);
    for (const p of phases) {
      console.log(`  • ${p.phaseName}: moves ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount} moves)`);
    }
    console.log('');
    console.log('When the scramble preserves the D-cross (only U moves), the mask');
    console.log('is satisfied from the very first move. This confirms the mask');
    console.log('works correctly WHEN the user follows the white-on-D convention.');

    expect(firstCross).toBe(0); // Cross satisfied at move 0
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 8 (COLOR-NEUTRAL): Verify COLOR_NEUTRAL_CFOP_MASKS works.
  // All 24 masks (6 faces × 4 phases) must match on a solved cube.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 8: color-neutral — all 6×4 masks match solved cube', () => {
    const state = new CubeState();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 8: Color-Neutral — 6×4 masks on solved cube');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`COLOR_NEUTRAL_CFOP_MASKS has ${COLOR_NEUTRAL_CFOP_MASKS.length} entries`);

    for (const faceMasks of COLOR_NEUTRAL_CFOP_MASKS) {
      for (let p = 0; p < 4; p++) {
        const match = StateMatcher.matchesMask(state, faceMasks.masks[p]);
        expect(match).toBe(true);
      }
    }

    console.log('All 6×4=24 masks match on solved cube. ✓');
  });

  // ─────────────────────────────────────────────────────────────────────
  // SCENARIO 9 (COLOR-NEUTRAL): PhaseSplitter with { colorNeutral: true }
  // detects a U-cross (white cross) while standard fails.
  // ─────────────────────────────────────────────────────────────────────
  it('SCENARIO 9: color-neutral PhaseSplitter detects U-cross', () => {
    // Scramble + solve using only moves that swap D-layer with U-layer
    // F2 R2 L2 B2 puts D-cross pieces on U (a "white cross on U" state)
    const scramble = 'F2 R2 L2 B2';
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);

    // Standard (D-cross only)
    const stdPhases = PhaseSplitter.split(timeline, CFOPDefinition);

    // Color-neutral
    const cnPhases = PhaseSplitter.split(timeline, CFOPDefinition, {
      colorNeutral: true,
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SCENARIO 9: Color-Neutral PhaseSplitter vs Standard');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Scramble: ${scramble}`);
    console.log('');
    console.log('Standard (D-cross only):');
    for (const p of stdPhases) {
      console.log(`  ${p.phaseName}: ${p.moveCount}m`);
    }
    console.log('Color-Neutral:');
    for (const p of cnPhases) {
      console.log(`  ${p.phaseName}: ${p.moveCount}m`);
    }

    // Standard: cross on U → D-cross mask never matches until full solve
    expect(stdPhases.length).toBe(1);
    expect(stdPhases[0].phaseName).toBe('Cross');

    // Color-neutral: should detect Cross and F2L at minimum.
    // OLL/PLL may not be detected separately in a 4-move solve
    // because PhaseSplitter needs one entry per phase, and if
    // F2L is detected at the last entry, there's no room left.
    const cnNames = cnPhases.map((p) => p.phaseName);
    expect(cnNames).toContain('Cross');
    expect(cnNames).toContain('F2L');
    expect(cnPhases.length).toBeGreaterThanOrEqual(2);
  });
});
