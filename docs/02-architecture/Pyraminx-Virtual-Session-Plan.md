# Pyraminx Virtual Session — Architecture Plan (Phased)

> Goal: bring the virtual Pyraminx to the same standard as the 3×3/2×2 —
> solved detection in any orientation, view-aware keyboard input, clean
> scramble verification, and a persistence path ready for phase analysis.
>
> Status: APPROVED PLAN — implement phase by phase, in order. Do not start
> a phase until the previous phase's exit criteria are green.

---

## Design principle: frame discipline (governs every phase)

The logical `PyraminxState` mirror lives in **exactly one frame: canonical**.
Every input path must enter it conjugated.

| Input path | Frame today | Frame after | Mechanism |
|---|---|---|---|
| Piece drag | canonical (via `pickSticker`) | canonical (unchanged) | none |
| Keyboard | canonical (bug: ignores view) | **canonical** | conjugate token by grip at input |
| Scramble tokens (button) | canonical | canonical | `applyScrambleNow` |
| Solved detection | orientation 0 only | any of 12 A₄ states | safety net |

Conjugation happens **at input** (keyboard handler), so the tracker, the
recorded `CubeMoveEvent[]`, the save pipeline, and `PyraminxReplayEngine`
all stay canonical and untouched.

Facts established during code review:

- `isPyraminxSolved()` (PyraminxSolver.ts:99) only accepts the all-zero
  state → rotated solves never stop the timer.
- `pyraminxKeybinds.ts` maps keys to fixed tokens (J/F→U/U', I/K→R/R',
  D/E→L/L', W/O→B/B') → after a view rotation, keys act on the wrong vertex.
- The UI exposes only 6 poses: `rotatePuzzleY` (±120°, 3 poses) ×
  `rotatePuzzleX` (180° C2 tilt, 2 poses). Full A₄ has 12; implement all 12,
  map the 6 UI poses explicitly.
- Vertex relabeling also permutes tips and corners (indexed by opposite
  face) — solved signatures must include relabeled `tips`.
- `usePyraminxVirtualSession` already implements the full timer state
  machine (IDLE → READY_FOR_MOVE → RUNNING → STOPPED), smart start/stop,
  COOLDOWN defer, and the `scrambleResetEpoch` re-arm. Phase 4 must NOT
  rewrite it — only narrow deltas.

---

## Phase 0 — Baseline (no code changes)

Steps:

1. Run and record current results:
   - `pnpm --filter @cubalyze/solver-engine test`
   - `pnpm --filter @cubalyze/cube-3d-engine test`
   - `pnpm --filter web test`
   - `pnpm --filter web typecheck`
2. Confirm the two bugs manually in the running app (rotated solve does not
   stop timer; rotated keyboard sends wrong vertex) — capture as the
   before/after acceptance evidence.

Exit criteria: all suites green before any change; baseline recorded.

---

## Phase 1 — Solved-state mathematics (solver-engine, pure, zero risk)

Files:

- `packages/solver-engine/src/PyraminxSolver.ts`
- `packages/solver-engine/src/__tests__/PyraminxSolver.test.ts`
- export from `packages/solver-engine/src/index.ts` and `src/pyraminx.ts`

Steps (TDD):

1. Add failing tests first (see test matrix below).
2. Implement `relabelPyraminxState(state, g)` — apply an even vertex
   relabeling g ∈ A₄ to a packed state:
   - edges: slot `{g(u),g(v)}` receives the piece from `{u,v}` (solver edge
     indexing 0=LR, 1=UL, 2=LB, 3=UR, 4=RB, 5=UB);
   - corners/tips: slot `g(i)` receives piece `i` (indexed by opposite face,
     U=0, L=1, R=2, B=3);
   - flip/twist transforms: derive per-g by calibration probes (apply the
     relabeling to a single-flipped-edge state and a single-twisted-corner
     state, record where the defect lands), then hard-code the signatures.
3. Implement `computePyraminxSolvedStates(): PyraminxState[]` — images of the
   identity under the 12 relabelings; export as lazy constant
   `PYRAMINX_SOLVED_STATES`.
4. Implement `isPyraminxSolvedAnyOrientation(state)` — membership against the
   12 signatures (plain integer compares, precomputed once).
5. Keep `isPyraminxSolved` untouched (backward compat, orientation 0).

Test matrix:

1. The 12 signatures are distinct, all reachable (`isPyraminxReachable`).
2. Each signature is detected by `isPyraminxSolvedAnyOrientation`; identity
   is signature #0.
3. Negative probes in every orientation (12 × 4 = 48 cases): single flipped
   edge, single twisted corner, single twisted tip, single edge transposition
   → all `false`.
4. Relabeling round-trip: `relabel(g, relabel(g⁻¹, s)) === s` for all g.
5. Closure: signatures closed under composition with the 6 UI-pose
   relabelings.

Exit criteria: new tests green; all Phase 0 suites still green.

---

## Phase 2 — Grip table + keyboard conjugation (cube-3d-engine)

Files:

- `packages/cube-3d-engine/src/pyraminx/PyraminxGeometry.ts` (pure tables)
- `packages/cube-3d-engine/src/pyraminx/PyraminxEngine.ts`
- `packages/cube-3d-engine/src/pyraminx/__tests__/` (engine tests)

Steps (TDD):

1. Generate the 12 canonical pose quaternions as the A₄ orbit of
   `PYRAMINX_CANONICAL_QUAT` (pure code in PyraminxGeometry, testable
   without WebGL).
2. Add `PyraminxEngine.getGripIndex(): 0..11` — snap `puzzleQuat` against the
   12 poses using the max-|dot| pattern (mirror math-core's
   `OrientationTable.snap`).
3. Add pure conjugation tables `conjugatePyraminxToken(token, grip)` in
   PyraminxGeometry; engine exposes `conjugateKeyToken(token)` delegating to
   them.
4. Map the 6 UI poses (`rotatePuzzleY` ×3, `rotatePuzzleX` C2 ×2) onto the 12
   grip indices explicitly; document the mapping in a table comment.
5. Fix the stale "109.47° tilt" comment in `usePyraminxTurnControls.ts`
   (engine performs a 180° C2 tilt).
6. Do NOT add `getVertexUnderView` — `pickSticker` already covers drags.

Tests:

- Each of the 6 UI rotations lands on the expected grip index.
- For each grip, conjugating the key token of the on-screen top vertex
  yields canonical `U` (and equivalents for the other three screen
  positions).
- Conjugation is involutive: `conjugate(conjugate(t, g), g⁻¹) === t`.

Exit criteria: engine tests green; solver-engine untouched.

---

## Phase 3 — Session core: solved detection (apps/web, narrow delta)

Files:

- `apps/web/src/hooks/pyraminxSessionCore.ts` (one-line switch at the solve
  check, ~line 129)
- `apps/web/src/hooks/__tests__/pyraminxSessionCore.test.ts`

Steps:

1. Import and use `isPyraminxSolvedAnyOrientation` for the solve-phase check.
2. Do NOT touch scramble verification — it stays canonical; conjugation
   happens before `applyMove` is called (Phase 4/5 wiring).

Tests (add to existing suite — existing tests are the regression guard):

- Solve toward each of the 12 orientations → `solve-complete`:
  apply the scramble, then a relabeling-conjugated solve sequence.
- A single twisted tip in a rotated pose → NOT solved (no false stop).
- Manual token-by-token scramble → `isScrambled: true` (existing tests keep
  passing).
- Mistake counter unchanged under conjugated input (no spurious
  `needsReset` after view rotation).

Exit criteria: session tests green, including all prior tests.

---

## Phase 4 — View wiring (apps/web)

Files:

- `apps/web/src/views/Cube/PyraminxVirtualView.tsx`
- `apps/web/src/hooks/usePyraminxVirtualSession.ts` (only if a hook-level
  flag proves necessary — prefer view-level wiring)

Steps:

1. Keyboard handler: `performMove(engine.conjugateKeyToken(pyraminxKeyToToken(code)))`.
   Read grip per keypress — never cache it mid-solve.
2. Scramble Now visual sync: after the logical instant-apply, replay the
   token sequence through the 3D engine at `instant` turn speed so visual
   and logical state agree (verify current gap; `reset()` alone is not
   enough).
3. Confirm the full cycle: IDLE → scramble (manual or button) →
   READY_FOR_MOVE (0.00 green) → first turn starts timer → solved in any
   orientation stops timer → fanfare/history via existing
   `onVirtualSolveComplete` path.

Verification (manual checklist):

- Scramble button: 3D animates, timer shows 0.00 green.
- First turn starts the clock immediately.
- Rotate the view (Y and tilt), solve using keys for the on-screen vertices:
  timer stops on the final turn; solve appears in history/stats; replay
  opens correctly.
- Hand-performed scramble after rotating the view: validator advances
  without spurious mistakes or `needsReset`.

Exit criteria: typecheck + web tests green; manual checklist passes.

---

## Phase 5 — Persistence & analysis dispatcher (apps/web + analysis-engine)

Files:

- `apps/web/src/hooks/useSolveCompletion.ts`

Steps:

1. Formalize the per-`puzzleType` dispatcher:
   - `'333'` → existing `PhaseSplitter` path (unchanged);
   - `'pyram'` → pass-through: store raw moves + timestamps, analysis
     correctly skipped today;
   - extension point reserved for `'minx'` and a future
     `PyraminxPhaseSplitter` (V-First / L4E / Oka) in `analysis-engine`.
2. Ensure stored tokens are canonical-frame (guaranteed by Phase 2/3 wiring —
   this is what keeps `PyraminxReplayEngine` working with zero changes).

Tests:

- Save a pyram solve → record contains `puzzleType: "pyram"`, raw moves,
  timestamps; replay renders it.

Exit criteria: web tests green; end-to-end solve → history → replay works.

---

## Rollout order & risks

Order: Phase 1 → 2 → 3 → 4 → 5. Each phase ships green independently;
Phase 1 and 2 are pure-library changes with zero UI risk.

Risks and mitigations:

- Flip/twist calibration of the 12 relabelings is the only subtle math —
  use the probe technique plus the Phase 1 closure test.
- Mid-solve view rotations — grip must be read per keypress (Phase 4 rule).
- Scramble-verification regressions — existing session tests are the guard;
  run the full suite at every phase boundary.
