import { describe, it, expect } from 'vitest';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import {
  CubeState,
  StateMatcher,
  CFOPDefinition,
  COLOR_NEUTRAL_CFOP_MASKS,
  FaceletStringConverter,
} from '@cubeforge/math-core';
import { makeSolveFromScramble } from './test-helpers';

/* eslint-disable no-console */

/**
 * DIAGNOSTIC — "CFOP all 0.00" bug (root cause: H2, now fixed).
 *
 * Context: commit 74a64e2 ("Enable color-neutral CFOP and fix solve time")
 * added COLOR_NEUTRAL_CFOP_MASKS (6 faces) and wired PhaseSplitter with
 * { colorNeutral: true }. The OLD bug ("Cross = entire solve", from the
 * Phase_Detection_Investigation_Report.md) is therefore fixed in code.
 *
 * Users STILL saw "Cross Eff 0.00, F2L Pairs 0, OLL/PLL 0.00" — i.e.
 * NO phases detected at all (timeline.phases = []), or occasionally only
 * a Cross detected very late. This was a DIFFERENT, worse bug.
 *
 * Root cause (CONFIRMED via [CFOP-DEBUG] logs): H2 — the first solve move was
 * swallowed by swallowNextCubeMoveRef after auto-arm, offsetting the
 * reconstructed cube state by one move so NO phase mask ever matched.
 * FIX: removed swallowNextCubeMoveRef from apps/web/src/hooks/useSolveSession.ts.
 * These tests now serve as REGRESSION guards, documenting the mechanisms:
 *   H1 — scramble passed to analysis differs from scramble actually on the cube
 *   H2 — the first solve move is swallowed (CONFIRMED REAL CAUSE, now fixed)
 *   H3 — detectCrossFace greedily locks on the wrong face (documented risk)
 *
 * NOTE: These tests use inverse-scramble solves (not real CFOP), so the
 * exact phase counts are not meaningful — what matters is that the
 * reconstruction goes WRONG (isSolved() = false) and phases collapse.
 */

const sfx = (d: number) => (d === -1 ? "'" : d === 2 ? '2' : '');
const moveStr = (m: { face: string; direction: number }) => `${m.face}${sfx(m.direction)}`;

describe('DIAGNOSTIC — "CFOP all 0.00" (root cause: H2, now fixed)', () => {
  // ─────────────────────────────────────────────────────────────────────
  // CONTROL: correct scramble + all moves present → reconstruction is
  // correct (final isSolved = true) and phases are detected.
  // Proves the pipeline works when inputs match reality.
  // ─────────────────────────────────────────────────────────────────────
  it('CONTROL: correct inputs → final isSolved=true, ≥1 phase', () => {
    const scramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

    const finalState = TimelineBuilder.fromSnapshot(
      timeline.entries[timeline.entries.length - 1].state,
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('CONTROL: correct scramble + all moves');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`scramble: ${scramble}`);
    console.log(`moves   : ${solveMoves.length}`);
    console.log(`first   : ${moveStr(solveMoves[0])} @ ${solveMoves[0].hostTimestamp}ms`);
    console.log(`last    : ${moveStr(solveMoves[solveMoves.length - 1])} @ ${solveMoves[solveMoves.length - 1].hostTimestamp}ms`);
    console.log(`final isSolved: ${finalState.isSolved()}`);
    console.log(`phases  : ${timeline.phases.length} → [${timeline.phases.map((p) => `${p.phaseName}(${p.moveCount}m,${p.durationMs}ms)`).join(', ')}]`);

    expect(finalState.isSolved()).toBe(true);
    expect(timeline.phases.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // H1: scramble passed to analysis ≠ scramble actually applied to cube.
  // The reconstructed state diverges from reality from move 1 → no cross
  // mask (of any of the 6 faces) matches → phases = [] → "all CFOP 0.00".
  // ─────────────────────────────────────────────────────────────────────
  it('H1: wrong scramble → final isSolved=false, PLL never matches (mechanism behind "all 0.00")', () => {
    const realScramble = "R U R' U' R' F R F'";
    const wrongScramble = "F R U R' U' F'"; // a DIFFERENT scramble
    const { solveMoves } = makeSolveFromScramble(realScramble);

    // BUG SIMULATION: pass the WRONG scramble to the timeline builder.
    // This is what happens if the persisted/displayed scramble doesn't
    // match what the cube actually had at solve start.
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, wrongScramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

    const finalState = TimelineBuilder.fromSnapshot(
      timeline.entries[timeline.entries.length - 1].state,
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('H1: WRONG scramble passed to analysis');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`real scramble   : ${realScramble}`);
    console.log(`WRONG scramble  : ${wrongScramble}`);
    console.log(`moves (inv real): ${solveMoves.length}`);
    console.log(`final isSolved  : ${finalState.isSolved()}  ← false ⇒ PLL never matches`);
    console.log(`phases detected : ${timeline.phases.length}`);
    for (const p of timeline.phases) {
      console.log(`  • ${p.phaseName}: moves ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount}m, ${p.durationMs}ms)`);
    }
    console.log(`→ phases degraded to ${timeline.phases.length} (full solve would be 4).`);
    console.log(`  With longer solves / larger scramble mismatch this typically collapses to 0 = the "all 0.00" symptom.`);

    // The reconstruction is WRONG → final state is NOT solved.
    expect(finalState.isSolved()).toBe(false);
    // PLL = full-solve mask. If not solved, PLL never matches, so at most
    // 3 phases. (This short 8-move demo degrades to 2; longer real solves
    // with 100+ moves and a fully-wrong scramble typically yield 0.)
    expect(timeline.phases.length).toBeLessThan(4);
  });

  // ─────────────────────────────────────────────────────────────────────
  // H2: the first solve move is swallowed (swallowNextCubeMoveRef).
  // The reconstruction is offset by one move → final state ≠ solved.
  // Depending on the scramble, a non-user cross face may still match at
  // the final move → "only Cross, late" (symptom B).
  // ─────────────────────────────────────────────────────────────────────
  it('H2 (CONFIRMED ROOT CAUSE, fixed in useSolveSession.ts): first move swallowed → final isSolved=false, phases collapse', () => {
    const scramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // BUG SIMULATION: drop the first move. This is EXACTLY what the now-removed
    // swallowNextCubeMoveRef did in auto-arm mode — it dropped the first solve
    // move after engine.arm(), offsetting the reconstruction by one move.
    // The fix (useSolveSession.ts) lets the READY_FOR_MOVE branch capture
    // that move instead. This test guards the analysis-pipeline consequence.
    const droppedFirst = solveMoves.slice(1);

    const timeline = TimelineBuilder.build(droppedFirst, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

    const finalState = TimelineBuilder.fromSnapshot(
      timeline.entries[timeline.entries.length - 1].state,
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('H2: first solve move SWALLOWED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`scramble      : ${scramble}`);
    console.log(`original moves: ${solveMoves.length} → after swallow: ${droppedFirst.length}`);
    console.log(`dropped move  : ${moveStr(solveMoves[0])} (the first solve move)`);
    console.log(`final isSolved: ${finalState.isSolved()}  ← false ⇒ reconstruction offset`);
    console.log(`phases detected: ${timeline.phases.length}`);
    for (const p of timeline.phases) {
      console.log(`  • ${p.phaseName}: moves ${p.startIndex + 1}-${p.endIndex + 1} (${p.moveCount}m, ${p.durationMs}ms)`);
    }
    if (timeline.phases.length === 1 && timeline.phases[0].phaseName === 'Cross') {
      console.log(`→ only Cross detected (timing varies by scramble — late in the user's reported case).`);
      console.log(`  This matches symptom B ("sometimes only the cross appears"), though timing is input-dependent.`);
    } else {
      console.log(`→ phases degraded to ${timeline.phases.length}; with different scrambles the single-Cross case also arises.`);
    }

    expect(finalState.isSolved()).toBe(false);
    expect(timeline.phases.length).toBeLessThan(4);
  });

  // ─────────────────────────────────────────────────────────────────────
  // H3: detectCrossFace greedily locks on the FIRST matching face.
  // COLOR_NEUTRAL_CFOP_MASKS order is [D, U, F, B, R, L]. If a non-user
  // cross face matches first, F2L/OLL/PLL for that face may never complete
  // → only Cross detected. This documents the greedy-lock risk.
  // ─────────────────────────────────────────────────────────────────────
  it('H3: greedy cross lock — documents detectCrossFace order risk', () => {
    // A scramble of only U moves preserves the D-cross, so detectCrossFace
    // (D is first in the list) locks on D at move 1. The solve (inverse)
    // also only uses U moves, so all D-face phases complete quickly.
    // This is the benign case. The RISK is when a non-user face matches
    // first but the user's F2L is on a different face — that needs a
    // mid-solve state hard to build from a pure scramble.
    const scramble = "U U' U2 U U'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('H3: greedy cross lock (detectCrossFace order = D,U,F,B,R,L)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`scramble: ${scramble} (only U → D-cross preserved)`);
    console.log(`phases  : ${timeline.phases.length} → [${timeline.phases.map((p) => p.phaseName).join(', ')}]`);
    console.log('NOTE: detectCrossFace returns the FIRST face whose cross mask');
    console.log('matches. If a non-user face matches before the user\'s face,');
    console.log('F2L/OLL/PLL for the locked face may never complete → only Cross.');

    expect(timeline.phases.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────────────
  // DIAGNOSTIC PRINCIPLE: comparing reconstructed vs "real" facelets.
  // During investigation, temporary [CFOP-DEBUG] logs compared the
  // reconstructed final facelets with the real cube's STOP facelets to
  // confirm the reconstruction was wrong (H2). That comparison principle
  // is captured here as a regression guard — if the strings differ, the
  // reconstruction is wrong (H1/H2/H4).
  // ─────────────────────────────────────────────────────────────────────
  it('DIAGNOSTIC PRINCIPLE: facelet comparison catches reconstruction errors', () => {
    const scramble = "R U R' U' R' F R F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // Correct reconstruction
    const correctState = new CubeState();
    correctState.applySequence(scramble);
    for (const m of solveMoves) correctState.applySequence(moveStr(m));
    const correctFacelets = FaceletStringConverter.toFaceletString(correctState);

    // Wrong reconstruction (H1: wrong scramble)
    const wrongState = new CubeState();
    wrongState.applySequence("F R U R' U' F'");
    for (const m of solveMoves) wrongState.applySequence(moveStr(m));
    const wrongFacelets = FaceletStringConverter.toFaceletString(wrongState);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('DIAGNOSTIC PRINCIPLE: reconstructed vs real facelets');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`correct final facelets : ${correctFacelets}`);
    console.log(`wrong   final facelets : ${wrongFacelets}`);
    console.log(`match?                 : ${correctFacelets === wrongFacelets}`);
    console.log('During investigation, [CFOP-DEBUG] logs compared the');
    console.log('reconstructed final facelets with the real cube\'s STOP facelets');
    console.log('to confirm the reconstruction was wrong (H2). If they differ →');
    console.log('the reconstruction is wrong → H1 (scramble), H2 (swallow), or');
    console.log('H4 (move order from adapter).');

    expect(correctFacelets).not.toBe(wrongFacelets);
    expect(correctState.isSolved()).toBe(true);
    expect(wrongState.isSolved()).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CROSS-PER-FACE SCAN: for a correct solve, the user's cross face
  // matches early. For an H1 solve (wrong scramble), typically NO face
  // matches until the end (or never). During investigation this scan was
  // logged by the temporary [CFOP-DEBUG] logs to identify H2.
  // ─────────────────────────────────────────────────────────────────────
  it('CROSS-PER-FACE: first cross match per face — correct vs H1', () => {
    const realScramble = "R U R' U' R' F R F'";
    const wrongScramble = "F R U R' U' F'";
    const { solveMoves } = makeSolveFromScramble(realScramble);

    function firstCrossPerFace(scr: string): Record<string, number> {
      const tl = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scr);
      const result: Record<string, number> = {};
      for (const fm of COLOR_NEUTRAL_CFOP_MASKS) {
        const mask = fm.masks[0];
        let first = -1;
        for (let i = 0; i < tl.entries.length; i++) {
          const st = TimelineBuilder.fromSnapshot(tl.entries[i].state);
          if (StateMatcher.matchesMask(st, mask)) { first = i; break; }
        }
        result[fm.face] = first;
      }
      return result;
    }

    const correct = firstCrossPerFace(realScramble);
    const wrong = firstCrossPerFace(wrongScramble);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('CROSS-PER-FACE: first cross match per face');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Correct scramble:');
    for (const [face, idx] of Object.entries(correct)) {
      console.log(`  face ${face}: ${idx >= 0 ? `move ${idx + 1}/${solveMoves.length}` : 'NEVER'}`);
    }
    console.log('WRONG scramble (H1):');
    for (const [face, idx] of Object.entries(wrong)) {
      console.log(`  face ${face}: ${idx >= 0 ? `move ${idx + 1}/${solveMoves.length}` : 'NEVER'}`);
    }
    console.log('If all faces say NEVER (or only match at the last move), the');
    console.log('reconstruction is wrong — this was the signal that confirmed H2.');

    const correctAnyEarly = Object.values(correct).some(
      (v) => v >= 0 && v < solveMoves.length,
    );
    expect(correctAnyEarly).toBe(true);
  });
});
