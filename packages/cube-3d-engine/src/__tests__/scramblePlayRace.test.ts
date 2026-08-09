import { describe, it, expect } from 'vitest';
import { ReplayEngine, type ReplayCallbacks } from '../replay/ReplayEngine';
import { CubeModel } from '../core/CubeModel';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { RotationEngine } from '../animation/RotationEngine';
import {
  conjugatePhaseStream,
  OrientationTable,
  tokenize,
} from '@cubeforge/math-core';
import { Quaternion } from 'three';
import type { CubeMoveEvent, OrientationTimeline } from '@cubeforge/types';

/**
 * REGRESSION TESTS for the random "replay ends visually unsolved" bug.
 *
 * Root cause (proven by stress-testing the real wiring): play() called while
 * applyInitialScramble() is still dispatching its per-move rotateLayers
 * messages caused the SOLVE moves to be queued in the renderer's FIFO
 * BETWEEN the scramble moves — the worker then applied
 * [s₁, solve₁, s₂..s₂₀, solve₂..s₃₁], which is NOT a valid scramble → solve
 * sequence, so the cube ended UNRESOLVED while the UI counter still reported
 * "Move 31/31". Whether it reproduced depended on how fast the user hit play
 * relative to the scramble's roundtrips — hence "random" across reloads.
 *
 * Fix: ReplayEngine.play() now waits for the in-flight scramble
 * (`scramblePromise`) before it can queue ANY solve move, and re-checks the
 * state afterwards so a concurrent play() can never start a second tick.
 * Test 1 is the regression — it FAILS on the pre-fix engine (interleave →
 * unsolved) and PASSES on the fixed engine.
 */

const SCRAMBLE = "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'";
const PHASES = [
  'F R U\' D\' L U R U\' D',
  "y' L' U L",
  "y L' U L U' D' L' U L U' D",
  "U' L' U' L U L' U L",
  'U',
];

function displayRotationEntry(dt: string) {
  const norm =
    dt.length >= 3 && dt.endsWith("'") && dt[dt.length - 2] === '2'
      ? dt.slice(0, -1)
      : dt;
  return OrientationTable.rotationEntryFor(norm);
}

function normalize(): { replayTokens: string[]; timeline: OrientationTimeline } {
  const { perPhase } = conjugatePhaseStream(PHASES.map((p) => tokenize(p)));
  const replayTokens: string[] = [];
  const rawOrientTimeline: [number, number][] = [];
  let grip = OrientationTable.IDENTITY;
  let faceIdx = 0;
  PHASES.forEach((phase, phaseIdx) => {
    const display = tokenize(phase, { expandWide: false });
    for (const dt of display) {
      const rot = displayRotationEntry(dt);
      if (rot) { grip = OrientationTable.compose(rot, grip); rawOrientTimeline.push([faceIdx, grip.id]); continue; }
      faceIdx++;
    }
    const conj = perPhase[phaseIdx] ?? [];
    let ci = 0;
    for (const dt of display) {
      if (displayRotationEntry(dt)) continue;
      replayTokens.push(conj[ci] ?? dt);
      ci++;
    }
  });
  return { replayTokens, timeline: rawOrientTimeline };
}

function toEvent(token: string): CubeMoveEvent {
  return {
    face: token[0] as CubeMoveEvent['face'],
    direction: token.slice(1) === '2' ? 2 : token.slice(1) === "'" ? -1 : 1,
    cubeTimestamp: 0,
    hostTimestamp: 0,
  };
}

/** Real worker emulation: FIFO queue processed on a timer, animated rotations. */
function makeWorker() {
  const model = new CubeModel(new CubeMeshFactory(), 3);
  const rot = new RotationEngine(model);
  const queue: { fn: () => void; due: number }[] = [];
  const appliedOrder: string[] = [];
  let orientAnim: { start: import('three').Quaternion; target: import('three').Quaternion; startTime: number; dur: number; resolve: () => void } | null = null;

  const step = () => {
    while (queue.length > 0 && queue[0].due <= Date.now()) {
      const m = queue.shift()!;
      m.fn();
    }
    rot.update(Date.now());
    if (orientAnim) {
      const t = (Date.now() - orientAnim.startTime) / orientAnim.dur;
      if (t >= 1) {
        model.root.quaternion.copy(orientAnim.target);
        const r = orientAnim.resolve;
        orientAnim = null;
        r();
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        model.root.quaternion.slerpQuaternions(orientAnim.start, orientAnim.target, eased);
      }
    }
  };
  const timer = setInterval(step, 5);

  const callbacks: ReplayCallbacks = {
    resetCube: () =>
      new Promise<void>((resolve) => {
        queue.push({ fn: () => { model.resetCube(); model.root.quaternion.identity(); resolve(); }, due: Date.now() + 3 });
      }),
    rotateLayers: (axis, layers, angle, dur, elapsed) =>
      new Promise<void>((resolve) => {
        queue.push({
          fn: () => {
            appliedOrder.push(`${axis}${layers.join('')}:${angle}:d${dur ?? 0}`);
            rot.rotateLayers(axis as 'x' | 'y' | 'z', layers as number[], angle, dur ?? 0, elapsed ?? 0);
            rot.update(Date.now());
            resolve();
          },
          due: Date.now() + 3,
        });
      }),
    setOrientation: (oi, dur) =>
      new Promise<void>((resolve) => {
        queue.push({
          fn: () => {
            const entry = OrientationTable.ENTRIES[oi];
            const duration = dur ?? 0;
            if (!entry || duration <= 0) {
              model.root.quaternion.copy(entry.quaternion as unknown as import('three').Quaternion);
              resolve();
              return;
            }
            orientAnim = {
              start: model.root.quaternion.clone(),
              target: new Quaternion().copy(entry.quaternion as unknown as Quaternion),
              startTime: Date.now(),
              dur: duration,
              resolve,
            };
          },
          due: Date.now() + 3,
        });
      }),
  };

  return { model, rot, callbacks, appliedOrder, queue, timer };
}

function solved(model: CubeModel): boolean {
  return model.getLogicalState().every(
    (c) => c.gridX === c.initialGridX && c.gridY === c.initialGridY && c.gridZ === c.initialGridZ,
  );
}

/** Build an engine wired to a fresh worker. Fast timings + 6x speed keep the
 *  suite quick: the full 31-move replay completes in <1s of wall time. */
function build() {
  const { replayTokens, timeline } = normalize();
  const w = makeWorker();
  const engine = new ReplayEngine([], w.callbacks, undefined, timeline);
  engine.moveSpacingMs = 150;
  engine.moveAnimationDurationMs = 80;
  engine.orientationAnimationDurationMs = 50;
  engine.preRollEnabled = true;
  // setMoves() after setting moveSpacingMs so the timeline uses the fast slot.
  engine.setMoves(replayTokens.map(toEvent));
  engine.setSpeed(6);
  return { engine, w, replayTokens };
}

/** Run the main-thread rAF loop until the engine completes. */
function driveMain(engine: ReplayEngine, done: () => void): () => void {
  const rafMap = new Map<number, FrameRequestCallback>();
  let seq = 0;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { rafMap.set(++seq, cb); return seq; };
  globalThis.cancelAnimationFrame = (id: number) => { rafMap.delete(id); };
  engine.onComplete = done;
  const t = setInterval(() => {
    const cbs = [...rafMap.values()];
    rafMap.clear();
    for (const cb of cbs) cb(performance.now());
  }, 10);
  return () => clearInterval(t);
}

/** Drain the worker queue + finish in-flight animations. */
async function drain(w: ReturnType<typeof makeWorker>): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
  clearInterval((w as unknown as { timer: ReturnType<typeof setInterval> }).timer);
}

/** Assert the worker applied the whole scramble (d0) before any solve move
 *  (positive duration) and that the cube is solved. */
function expectOrderedAndSolved(w: ReturnType<typeof makeWorker>, expectedMoves: number): void {
  const applied = (w as unknown as { appliedOrder: string[] }).appliedOrder;
  expect(applied.length).toBe(20 + expectedMoves);
  expect(applied.slice(0, 20).every((m) => m.includes(':d0'))).toBe(true);
  expect(applied.slice(20).every((m) => m.includes(':d0'))).toBe(false);
  expect(solved(w.model)).toBe(true);
}

describe('scramble/play message-queue race (root cause regression)', () => {
  it('REGRESSION: play() while the scramble is still dispatching no longer interleaves → cube SOLVED', async () => {
    const { engine, w } = build();
    // Start the scramble WITHOUT awaiting it — exactly what ReplaySection
    // does: the engine ref is set and the play button is enabled while
    // applyInitialScramble still round-trips through the renderer.
    const scrambleP = engine.applyInitialScramble(SCRAMBLE);

    // Let a scramble message be dispatched, then the user hits play.
    await new Promise((r) => setTimeout(r, 1));
    const complete = new Promise<void>((resolve) => {
      driveMain(engine, resolve);
    });
    await engine.play();
    await complete;
    await scrambleP;
    await drain(w);

    // On the PRE-FIX engine the solve moves were queued BETWEEN the scramble
    // moves → the cube ended UNSOLVED (the reported random bug). The gate in
    // play() keeps the worker FIFO as [20×scramble][31×solve] → SOLVED.
    expectOrderedAndSolved(w, 31);
  }, 15000);

  it('CONTROL: awaiting the scramble before play keeps the queue ordered → cube SOLVED', async () => {
    const { engine, w } = build();
    const complete = new Promise<void>((resolve) => {
      driveMain(engine, resolve);
    });
    await engine.applyInitialScramble(SCRAMBLE);
    await engine.play();
    await complete;
    await drain(w);

    expectOrderedAndSolved(w, 31);
  }, 15000);

  it('GUARD: rapid double play() during scramble runs exactly one tick loop → cube SOLVED', async () => {
    const { engine, w } = build();
    const scrambleP = engine.applyInitialScramble(SCRAMBLE);
    await new Promise((r) => setTimeout(r, 1));

    // Two concurrent play() calls while the scramble is still dispatching —
    // both hit the gate; the loser must bail at the post-gate re-check so
    // only ONE tick loop runs (no duplicated/overlapping solve moves).
    const complete = new Promise<void>((resolve) => {
      driveMain(engine, resolve);
    });
    await Promise.all([engine.play(), engine.play()]);
    await complete;
    await scrambleP;
    await drain(w);

    expectOrderedAndSolved(w, 31);
  }, 15000);

  it('GUARD: restart (seek 0) while the scramble is still dispatching is serialized → cube SOLVED', async () => {
    const { engine, w } = build();
    const scrambleP = engine.applyInitialScramble(SCRAMBLE);
    await new Promise((r) => setTimeout(r, 1));

    // User hits Restart mid-scramble — the button is enabled during the
    // scramble apply (replayState is still 'idle'). seek(0) re-applies the
    // scramble itself; without the gate its loop would interleave with the
    // in-flight dispatch (scramble applied twice, interleaved) and the cube
    // would end unsolved after the solve moves.
    await engine.seek(0);
    await scrambleP;

    const complete = new Promise<void>((resolve) => {
      driveMain(engine, resolve);
    });
    await engine.play();
    await complete;
    await drain(w);

    const applied = (w as unknown as { appliedOrder: string[] }).appliedOrder;
    // 20 from the initial dispatch + 20 re-applied by seek(0) + 31 solves.
    expect(applied.length).toBe(71);
    expect(applied.filter((m) => m.includes(':d0'))).toHaveLength(40);
    // All solve moves come after every scramble application.
    expect(applied.slice(40).every((m) => !m.includes(':d0'))).toBe(true);
    expect(solved(w.model)).toBe(true);
  }, 15000);
});
