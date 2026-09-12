import { describe, expect, it } from 'vitest';
import { analyzeSolve } from '../pipeline/analyzeSolve';
import { analyzeSolveText } from '../reconstruction/analyzeSolveText';
import { TimelineBuilder } from '../timeline/TimelineBuilder';
import { PhaseSplitter } from '../phases/PhaseSplitter';
import { MetricsAggregator } from '../metrics/MetricsAggregator';
import {
  CFOPDefinition,
  conjugatePhaseStream,
  tokenize,
} from '@cubeforge/math-core';
import { makeSolveFromScramble, makeMoves } from './test-helpers';

/**
 * Unified pipeline parity — the "nothing can diverge" guarantee.
 *
 * The SAME solve expressed through the smart route (`analyzeSolve`) and the
 * text route (`analyzeSolveText`, flat solution so `preferredCrossIdx` is
 * disabled exactly like the smart route) MUST produce identical:
 *   - phase segmentation (indices, skipped flags)
 *   - detection report (crossType, crossColor, crossFace, skips, coherence,
 *     xcrossPairs)
 *   - F2L pairs (slot, colors, auf, completion, move count)
 *
 * Fase 6 extends the matrix to the two paths where a naive port could
 * diverge: whole-cube rotations (conjugation must fold them into the same
 * physical moves the smart cube emits) and xcross solves (a pair already
 * home when F2L starts must surface the same way in both routes).
 */
const FACE_MOVE_RE = /^[URFDLB][2']?$/;

/**
 * Conjugate a written solve (inspection grip + phases, rotations inline)
 * into the physical cube-frame moves a smart cube would emit — the exact
 * same stream `analyzeSolveText` builds internally, so both routes receive
 * identical timelines. Returns only face moves (rotations are consumed).
 */
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

type SmartResult = Awaited<ReturnType<typeof analyzeSolve>>;
type TextResult = ReturnType<typeof analyzeSolveText>;

/**
 * Real record reconz-11413 — a pair is already home when F2L starts (the
 * "xcross" segment). Shared by the xcross parity test and the xcross
 * invariant test so the fixture can never drift between them.
 */
const XCROSS_11413 = {
  scramble: "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'",
  phases: [
    "F R U' D' L U R U' D",       // xcross
    "y' L' U L",                  // 2nd pair
    "y L' U L U' D' L' U L U' D", // 3rd pair
    "U' L' U' L U L' U L",        // 4th pair/WVLS
    "U",                          // AUF
  ],
} as const;

/**
 * Assert full parity between the two routes.
 *
 * When `compareMoves` is false (rotated solves) the raw notation the solver
 * wrote differs from the physical cube-frame moves BY DESIGN (the text route
 * keeps the solver's frame for display, the smart route emits cube-frame
 * moves) — only the detection structure must agree: slot, colors,
 * completion and move COUNT. `auf` is frame-dependent too: the text route
 * reads leading U moves from the SOLVER's raw notation, the smart route from
 * the physical entries (after y' a written U is physically a D), so it is
 * excluded from the strict comparison for rotated solves — the same
 * pre-unification behavior (buildPairs vs entriesToTokens), not a port
 * regression.
 */
function expectParity(
  smart: SmartResult,
  text: TextResult,
  opts: { compareMoves?: boolean } = {},
) {
  const { compareMoves = true } = opts;

  // Phases: identical boundaries + skip flags.
  const smartPhases = smart.timeline.phases.map((p) => ({
    name: p.phaseName,
    start: p.startIndex,
    end: p.endIndex,
    completion: p.completionIndex,
    skipped: p.skipped,
  }));
  const textPhases = text.timeline.phases.map((p) => ({
    name: p.phaseName,
    start: p.startIndex,
    end: p.endIndex,
    completion: p.completionIndex,
    skipped: p.skipped,
  }));
  expect(textPhases).toEqual(smartPhases);

  // Detection report: everything that drives the UI and comparability.
  const reportOf = (r?: {
    crossType?: string;
    crossColor?: string;
    crossFace?: string;
    skips?: string[];
    finalStateSolved?: boolean;
    complete?: boolean;
    xcrossPairs?: { slot?: string; colors?: string[] }[];
  }) => ({
    crossType: r?.crossType ?? null,
    crossColor: r?.crossColor ?? null,
    crossFace: r?.crossFace ?? null,
    skips: [...(r?.skips ?? [])].sort(),
    finalStateSolved: r?.finalStateSolved ?? false,
    complete: r?.complete ?? false,
    xcrossPairs: (r?.xcrossPairs ?? []).map((p) => ({
      slot: p.slot,
      colors: p.colors,
    })),
  });
  expect(reportOf(text.timeline.detectionReport)).toEqual(
    reportOf(smart.timeline.detectionReport),
  );

  // F2L pairs: same slots, colors, auf, completion, counts AND
  // the same move arrays (text route: raw notation via displayTokens;
  // smart route: entry-derived via entriesToTokens — identical for
  // face-only solves, which is every smart-cube solve).
  const smartPairs = (smart.metrics.cfop?.f2lPairs ?? []).map((p) => ({
    slot: p.slotId,
    colors: p.colors ?? null,
    auf: [...(p.auf ?? [])],
    completion: p.completionIndex ?? -1,
    moves: p.moves,
    movesNotation: p.movesNotation ?? null,
  }));
  const textPairs = text.reconstruction.pairs.map((p) => ({
    slot: p.slot,
    colors: p.colors,
    auf: [...p.auf],
    completion: p.completionIndex,
    moves: p.moves.length,
    movesNotation: p.moves,
  }));
  if (compareMoves) {
    expect(textPairs).toEqual(smartPairs);
  } else {
    // Rotated solves: the solver's frame notation (moves AND auf) and the
    // cube-frame moves differ on purpose — only the detection structure
    // must agree.
    const stripFrameDependent = <
      T extends { movesNotation: unknown; auf: unknown },
    >(
      pairs: T[],
    ) => pairs.map(({ movesNotation: _m, auf: _a, ...rest }) => rest);
    expect(stripFrameDependent(textPairs)).toEqual(
      stripFrameDependent(smartPairs),
    );
  }

  // Coherence must agree.
  expect(text.reconstruction.finalSolved).toBe(
    smart.metrics.detectionReport?.finalStateSolved ?? false,
  );
}

/**
 * Every test in this file runs the WHOLE analysis pipeline twice (smart route
 * and text route) and compares them. On a laptop one such test takes 0.4-0.7 s,
 * but turbo runs all 27 package suites in parallel on a shared runner and the
 * same test has been observed past the default 5 s limit — a failing check for
 * a test that is merely starved of CPU (`CI` run 2026-09-12, `Lint, Test, and
 * Build`). The pipeline is correct and fast; the default timeout is the thing
 * that does not fit, so the file gets an explicit budget instead of passing a
 * number to each test.
 */
const PIPELINE_TIMEOUT_MS = 30_000;

describe('Unified pipeline — smart route ≡ text route', { timeout: PIPELINE_TIMEOUT_MS }, () => {
  const SCRAMBLES = [
    "R U R' U' R' F R2 U' R' U' R U R' F'", // T-perm solve
    "U' L' U L U F U' F'",                   // 8-move
    "R U R' U' R' F R F'",                   // 8-move Sune-ish
    "R U R' U'",                             // 4-move
    "F R U R' U' F'",                        // 6-move (FRUR'U'F')
    "R U R' U R U2 R'",                      // 7-move Sune
    "R U' R' U' F U F'",                     // 7-move (pair + OLL)
    "R2 F2 R2",                              // 3-move corner shuffle
  ];

  for (const scramble of SCRAMBLES) {
    it(`parity: ${scramble}`, async () => {
      const { solveMoves, notation } = makeSolveFromScramble(scramble);
      const solveTimeMs = 8000;

      // ── Smart route: moves + scramble through the shared core ──────────
      const smart = await analyzeSolve({
        moves: solveMoves,
        method: 'CFOP',
        scramble,
        solveTimeMs,
      });

      // ── Text route: same solve as flat text through the text API ───────
      const text = analyzeSolveText({
        setup: scramble,
        solution: notation,
        method: 'CFOP',
        totalTimeMs: solveTimeMs,
      });

      expectParity(smart, text);
    });
  }

  // ── Fase 6: rotations ────────────────────────────────────────────────────
  // Real CubeRoot record 2510: inspection grip "z y" + inline x'/y' during
  // F2L, all face moves after conjugation. The written text keeps the
  // solver's frame (rotations inline); the smart route receives the
  // conjugated physical moves. If the conjugation ever folded a rotation
  // differently than the physical stream, the phase/report/pair structure
  // would diverge here.
  it('parity with whole-cube rotations folded into the frame (CubeRoot 2510)', async () => {
    const scramble = "U B U2 L U2 R2 F' U' R D2 F' D' B2 U D2 R2 B2 R2";
    const grip = 'z y';
    const phases = [
      "D2 L U R' U'",                            // W Cross
      "x' D' L' U L U' L' U L D",                // F2L 1
      "U2 y' L' U L U' L' U L U2 L' U L",        // F2L 2
      "U2 U L U' L'",                            // F2L 3
      "y' R' U2 R U R' U' R",                    // F2L 4
      "R' U' R' F R F' U R",                     // OLL
      "U' R U R' U'D R2 U' R U' R' U R' U R2 D'", // PLL Gd
    ];
    const solveTimeMs = 8000;

    const physical = physicalMovesFor(grip, phases);
    // Fixture sanity: the conjugated solve really solves the scramble and
    // every rotation was consumed (no X/Y/Z leaked into the face stream).
    expect(physical.length).toBeGreaterThan(0);
    expect(physical.every((t) => FACE_MOVE_RE.test(t))).toBe(true);

    const smart = await analyzeSolve({
      moves: makeMoves(physical.join(' ')),
      method: 'CFOP',
      scramble,
      solveTimeMs,
    });
    const text = analyzeSolveText({
      setup: scramble,
      solution: [grip, ...phases].join(' '),
      method: 'CFOP',
      totalTimeMs: solveTimeMs,
    });

    // The record is a genuine solve: both routes must agree it finishes
    // solved, and the written rotations must be surfaced (not misread as
    // moves) in the reconstruction.
    expect(text.reconstruction.finalSolved).toBe(true);
    expect(smart.metrics.detectionReport?.finalStateSolved).toBe(true);
    expect(text.reconstruction.rotations.length).toBeGreaterThan(0);

    // Structure parity (notation differs by design in rotated solves).
    expectParity(smart, text, { compareMoves: false });

    // ── Pin the known frame-dependent `auf` divergence (plan §4.8) ──────
    // `expectParity` strips `auf` for rotated solves because the two routes
    // read it from different frames: the text route takes leading U moves
    // from the SOLVER's raw notation, the smart route from the PHYSICAL
    // entries — after this solve's x'/z rotations, written U's land on
    // non-U physical faces, so the auf genuinely differs BY DESIGN. Don't
    // just hide it: assert both sides stay internally consistent (auf is
    // always the leading tokens of the pair's own moves) and that the
    // divergence is real (the text route has U-leading pairs the smart
    // route's physical frame does not).
    for (const p of text.reconstruction.pairs) {
      expect(p.auf.every((t) => t[0] === 'U')).toBe(true);
      expect(p.moves.slice(0, p.auf.length)).toEqual(p.auf);
    }
    for (const p of smart.metrics.cfop?.f2lPairs ?? []) {
      const auf = p.auf ?? [];
      expect((p.movesNotation ?? []).slice(0, auf.length)).toEqual(auf);
    }
    expect(text.reconstruction.pairs.some((p) => p.auf.length > 0)).toBe(true);
    // The divergence is real: the two frames disagree on at least one pair's
    // auf (a written U lands on a non-U physical face after this solve's
    // x'/z rotations), which is exactly the pre-unification behavior this
    // test documents.
    const smartAuf = (smart.metrics.cfop?.f2lPairs ?? []).map((p) => [
      ...(p.auf ?? []),
    ]);
    const textAuf = text.reconstruction.pairs.map((p) => [...p.auf]);
    expect(textAuf.some((a, i) => a.join() !== (smartAuf[i] ?? []).join())).toBe(
      true,
    );
  });

  // ── Fase 6: xcross (pair home at F2L start) ─────────────────────────────
  // Real record reconz-11413: a pair is already home when F2L starts (the
  // "xcross" segment). The pair must surface via report.xcrossPairs in BOTH
  // routes — never as a duplicated F2L pair (see the invariant test below).
  it('parity on an xcross solve with a pair home at F2L start (reconz-11413)', async () => {
    const { scramble, phases } = XCROSS_11413;
    const solveTimeMs = 8000;

    const smart = await analyzeSolve({
      moves: makeMoves(physicalMovesFor('', phases).join(' ')),
      method: 'CFOP',
      scramble,
      solveTimeMs,
    });
    const text = analyzeSolveText({
      setup: scramble,
      solution: phases.join(' '),
      method: 'CFOP',
      totalTimeMs: solveTimeMs,
    });

    // Both routes detect the SAME xcross with the pair made inside the
    // cross — reported through the detection report.
    expect(text.timeline.detectionReport?.crossType).toBe('xcross');
    expect(smart.timeline.detectionReport?.crossType).toBe('xcross');
    expect(text.timeline.detectionReport?.xcrossPairs).toHaveLength(1);
    expect(smart.timeline.detectionReport?.xcrossPairs).toHaveLength(1);

    // Full structural parity (the solve rotates y'/y inline, so notation is
    // frame-dependent — structure must still agree exactly).
    expectParity(smart, text, { compareMoves: false });
  });

  it('xcross pairs surface via report.xcrossPairs and their trailing moves land in the first F2L pair', async () => {
    // Slots already home when F2L starts (the XCross pairs) are excluded
    // from the F2L scan in `segmentF2LPairs` by construction (unsolvedMask)
    // and reported through `report.xcrossPairs`/`crossType` instead. This
    // pins that behavior down in BOTH routes: the pair made inside the
    // cross is never double-counted as a duplicate F2L pair.
    const { scramble, phases } = XCROSS_11413;

    const smart = await analyzeSolve({
      moves: makeMoves(physicalMovesFor('', phases).join(' ')),
      method: 'CFOP',
      scramble,
      solveTimeMs: 8000,
    });
    const text = analyzeSolveText({
      setup: scramble,
      solution: phases.join(' '),
      method: 'CFOP',
      totalTimeMs: 8000,
    });

    // The xcross pair is reported through the detection report in BOTH
    // routes, with the SAME slot and colors.
    expect(smart.timeline.detectionReport?.xcrossPairs).toHaveLength(1);
    expect(text.timeline.detectionReport?.xcrossPairs).toHaveLength(1);
    expect(smart.timeline.detectionReport?.xcrossPairs).toEqual(
      text.timeline.detectionReport?.xcrossPairs,
    );
    expect(smart.timeline.detectionReport?.crossType).toBe('xcross');
    expect(text.timeline.detectionReport?.crossType).toBe('xcross');

    // F2L never fabricates more than 4 pairs and never lists a slot twice.
    const smartSlots = smart.metrics.cfop?.f2lPairs.map((p) => p.slotId) ?? [];
    const textSlots = text.reconstruction.pairs.map((p) => p.slot);
    expect(smartSlots.length).toBeLessThanOrEqual(4);
    expect(textSlots.length).toBeLessThanOrEqual(4);
    expect(new Set(smartSlots).size).toBe(smartSlots.length);
    expect(new Set(textSlots).size).toBe(textSlots.length);

    // PIN the documented behavior: the xcross slot also appears as the
    // FIRST F2L pair (in BOTH routes). The state detector places the cross
    // completion where the cross mask finishes (early in the written
    // segment), while the written xcross segment's TRAILING moves (the pair
    // placement at its end) fall inside the F2L span, so `segmentF2LPairs`
    // attributes them to the first pair. `report.xcrossPairs` is the CROSS
    // label; `f2lPairs` attributes the leftover moves — the xcross slot is
    // NOT double-counted, it just owns those trailing moves. (Pre-existing
    // behavior, validated by PhaseSplitter.xcross.test.ts for the same
    // record.)
    const xpSlot = smart.timeline.detectionReport?.xcrossPairs?.[0]?.slot;
    expect(xpSlot).toBeDefined();
    expect(smartSlots[0]).toBe(xpSlot);
    expect(textSlots[0]).toBe(xpSlot);

    // Route parity is also enforced here (not only in the dedicated xcross
    // parity test) so this invariant is self-contained.
    expectParity(smart, text, { compareMoves: false });
  });

  it('analyzeSolve reproduces the manual smart-cube pipeline exactly', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);

    // Manual steps — exactly what useSolveSession.runAnalysis does today.
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    timeline.solveTimeMs = 8000;
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });
    const manual = await MetricsAggregator.computeAll(timeline, scramble);

    const shared = await analyzeSolve({
      moves: solveMoves,
      method: 'CFOP',
      scramble,
      solveTimeMs: 8000,
    });

    expect(shared.metrics.totalMoves).toBe(manual.totalMoves);
    expect(shared.metrics.phases.map((p) => p.phaseName)).toEqual(
      manual.phases.map((p) => p.phaseName),
    );
    expect(shared.metrics.detectionReport?.crossType).toBe(
      manual.detectionReport?.crossType,
    );
    expect(shared.metrics.cfop?.f2lPairs.map((p) => p.slotId)).toEqual(
      manual.cfop?.f2lPairs.map((p) => p.slotId),
    );
  });

  it('analyzeSolve handles Roux through the same pipeline', async () => {
    const scramble = "U' L' U L U F U' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const result = await analyzeSolve({
      moves: solveMoves,
      method: 'Roux',
      scramble,
      solveTimeMs: 6000,
    });
    expect(result.metrics.roux).toBeDefined();
    expect(result.metrics.cfop).toBeUndefined();
  });

  it('segmentF2LPairs is deterministic and capped at 4 pairs', async () => {
    const scramble = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const { solveMoves } = makeSolveFromScramble(scramble);
    const timeline = TimelineBuilder.build(solveMoves, 'CFOP', undefined, scramble);
    PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true });

    const { segmentF2LPairs } = await import('../pipeline/segmentF2LPairs');
    const a = segmentF2LPairs(timeline);
    const b = segmentF2LPairs(timeline);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(4);
  });

  it('empty moves produce an empty-but-valid analyzeSolve result', async () => {
    const result = await analyzeSolve({ moves: [], method: 'CFOP', scramble: 'R U' });
    expect(result.metrics.totalMoves).toBe(0);
    expect(result.metrics.phases).toEqual([]);
    expect(result.timeline.entries).toEqual([]);
  });
});
