import { describe, it, expect } from 'vitest';
import { ReplayEngine, type ReplayCallbacks } from '../replay/ReplayEngine';
import { CubeModel } from '../core/CubeModel';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { RotationEngine } from '../animation/RotationEngine';
import { OrientationTable } from '@cubalyze/math-core';
import { Quaternion } from 'three';
import type { CubeMoveEvent, OrientationTimeline } from '@cubalyze/types';

/**
 * TRANSPORT-RACE REGRESSION TESTS
 * ===============================
 *
 * Root-cause family proven here: the ReplayEngine's playback tick dispatches
 * `rotateLayers` fire-and-forget (never awaited), so when the user hits a
 * transport control (Restart / Step backward / progress-bar seek) while a
 * move is STILL ANIMATING in the renderer, the new operation's reset is
 * overwritten by the stale animation's completion — OR two overlapping
 * async step operations double-apply their inverse. Either way the cube's
 * logical state diverges from the counter (colors/positions scrambled).
 *
 * The fake "worker" below is a faithful emulation of the real Comlink
 * wiring: every callback is delivered through a setTimeout(0)-style queue
 * (postMessage latency), the renderer owns a REAL RotationEngine + root
 * SLERP advanced on its own interval (an independent clock from the main
 * thread's rAF), and `rotateLayers` resolves only when the pivot task snaps.
 *
 * These tests FAIL on the pre-fix engine (stale task wins after reset →
 * unsolved / double inverse → wrong state) and PASS on the fixed engine
 * (transport serialized + `flushAnimations` before every absolute reset).
 */

const SCRAMBLE = "U2 B' L2 R2 B D2 R2 B' U2 L U' F' D' R B2 D U R' F' U'";

/** Deterministic 10-move cycle with no rotation tokens. */
const CYCLE = ['R', 'U', 'F', 'L', 'B', 'D', 'R', 'U', 'F', 'L'] as const;

function toEvent(face: string, dir: 1 | -1 | 2 = 1): CubeMoveEvent {
  return { face: face as CubeMoveEvent['face'], direction: dir, cubeTimestamp: 0, hostTimestamp: 0 };
}

function makeMoves(n: number): CubeMoveEvent[] {
  return Array.from({ length: n }, (_, i) => toEvent(CYCLE[i % CYCLE.length]));
}

function isSolvedState(model: CubeModel): { solved: boolean; offenders: string[] } {
  const offenders: string[] = [];
  for (const c of model.getLogicalState()) {
    const home =
      c.gridX === c.initialGridX &&
      c.gridY === c.initialGridY &&
      c.gridZ === c.initialGridZ;
    const q = c.mesh.quaternion;
    const oriented =
      Math.abs(q.w) > 0.999 && Math.abs(q.x) < 0.01 &&
      Math.abs(q.y) < 0.01 && Math.abs(q.z) < 0.01;
    const isCenter =
      Math.abs(c.initialGridX) + Math.abs(c.initialGridY) + Math.abs(c.initialGridZ) === 1;
    if (!home || (!oriented && !isCenter)) {
      offenders.push(`${c.initialGridX},${c.initialGridY},${c.initialGridZ}`);
    }
  }
  return { solved: offenders.length === 0, offenders };
}

/** Semantic state equality (grid + orientation quaternion), for seek targets. */
function stateMismatches(a: CubeModel, b: CubeModel): string[] {
  const bad: string[] = [];
  const bs = b.getLogicalState();
  for (const ca of a.getLogicalState()) {
    const cb = bs.find(
      (x) =>
        x.initialGridX === ca.initialGridX &&
        x.initialGridY === ca.initialGridY &&
        x.initialGridZ === ca.initialGridZ,
    );
    if (!cb) { bad.push(`${ca.initialGridX},${ca.initialGridY},${ca.initialGridZ}:missing`); continue; }
    if (
      cb.gridX !== ca.gridX || cb.gridY !== ca.gridY || cb.gridZ !== ca.gridZ ||
      Math.abs(cb.mesh.quaternion.x - ca.mesh.quaternion.x) > 1e-6 ||
      Math.abs(cb.mesh.quaternion.y - ca.mesh.quaternion.y) > 1e-6 ||
      Math.abs(cb.mesh.quaternion.z - ca.mesh.quaternion.z) > 1e-6 ||
      Math.abs(cb.mesh.quaternion.w - ca.mesh.quaternion.w) > 1e-6
    ) {
      bad.push(`${ca.initialGridX},${ca.initialGridY},${ca.initialGridZ}`);
    }
  }
  return bad;
}

// ─── Fake renderer (faithful Comlink-worker emulation) ─────────────────────

interface FakeWorker {
  model: CubeModel;
  rot: RotationEngine;
  callbacks: ReplayCallbacks;
  flushRotations: () => void;
  stop: () => void;
  /** Order in which layer rotations were APPLIED by the worker (mechanism proof). */
  applied: string[];
}

function makeFakeWorker(): FakeWorker {
  const model = new CubeModel(new CubeMeshFactory(), 3);
  const rot = new RotationEngine(model);

  let orientAnim: {
    start: Quaternion; target: Quaternion; startTime: number; dur: number; resolve: () => void;
  } | null = null;

  const workerStep = () => {
    rot.update(performance.now());
    if (orientAnim) {
      const t = (performance.now() - orientAnim.startTime) / orientAnim.dur;
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
  const loop = setInterval(workerStep, 6);

  /** Comlink-style async delivery — every call goes through the event loop. */
  const post = <T,>(fn: () => T | Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      setTimeout(() => { Promise.resolve(fn()).then(resolve, reject); }, 1);
    });

  const applied: string[] = [];

  const callbacks: ReplayCallbacks = {
    // resetCube is the CURRENT real engine's contract: it resets the model
    // but does NOT touch the rotation engine. A stale in-flight task can
    // therefore snap AFTER the reset and corrupt it.
    resetCube: () => post(() => { model.resetCube(); model.root.quaternion.identity(); }),
    rotateLayers: (axis, layers, angle, dur, elapsed) =>
      post(() => {
        applied.push(`${axis}${(layers as number[]).join('')}:${angle}:d${dur ?? 0}`);
        return rot.rotateLayers(axis as 'x' | 'y' | 'z', layers as number[], angle, dur ?? 0, elapsed ?? 0);
      }),
    setOrientation: (oi, dur) =>
      post(() => new Promise<void>((resolve) => {
        const entry = OrientationTable.ENTRIES[oi];
        const duration = dur ?? 0;
        if (!entry || duration <= 0) {
          model.root.quaternion.copy(entry.quaternion as unknown as Quaternion);
          resolve();
          return;
        }
        orientAnim = {
          start: model.root.quaternion.clone(),
          target: new Quaternion().copy(entry.quaternion as unknown as Quaternion),
          startTime: performance.now(),
          dur: duration,
          resolve,
        };
      })),
    // The fix contract: force-complete every in-flight animation so a
    // subsequent resetCube can never be overwritten. Called directly (not
    // optional) — this file pins the flushAll contract.
    flushAnimations: () => post(() => {
      rot.flushAll();
      if (orientAnim) {
        model.root.quaternion.copy(orientAnim.target);
        const r = orientAnim.resolve;
        orientAnim = null;
        r();
      }
    }),
  };

  return {
    model,
    rot,
    callbacks,
    flushRotations: () => rot.flushAll?.(),
    stop: () => clearInterval(loop),
    applied,
  };
}

/** Drive the main-thread rAF loop at ~60fps on the real clock. */
function driveMain(): () => void {
  const rafMap = new Map<number, FrameRequestCallback>();
  let seq = 0;
  const t = setInterval(() => {
    const entries = [...rafMap.entries()];
    rafMap.clear();
    for (const [, cb] of entries) cb(performance.now());
  }, 16);
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafMap.set(++seq, cb);
    return seq;
  };
  globalThis.cancelAnimationFrame = (id: number) => rafMap.delete(id);
  return () => clearInterval(t);
}

async function drain(w: FakeWorker, ms = 500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
  w.stop();
}

/**
 * Apply moves instantly on a fresh model. Mirrors what seek() fast-applies
 * (duration 0). update() is called per move — the reference engine has no
 * worker loop driving it, so without this the duration-0 task never snaps.
 */
async function applyReference(moves: CubeMoveEvent[]): Promise<CubeModel> {
  const ref = new CubeModel(new CubeMeshFactory(), 3);
  const refRot = new RotationEngine(ref);
  const MAP: Record<string, { axis: 'x' | 'y' | 'z'; lv: number; s: 1 | -1 }> = {
    R: { axis: 'x', lv: 1, s: -1 }, U: { axis: 'y', lv: 1, s: -1 },
    F: { axis: 'z', lv: 1, s: -1 }, L: { axis: 'x', lv: -1, s: 1 },
    B: { axis: 'z', lv: -1, s: 1 }, D: { axis: 'y', lv: -1, s: 1 },
  };
  for (const m of moves) {
    const map = MAP[m.face];
    const p = refRot.rotateLayers(map.axis, [map.lv], m.direction * map.s * 90, 0);
    refRot.update(performance.now());
    await p;
  }
  return ref;
}

function buildEngine(
  moves: CubeMoveEvent[],
  w: FakeWorker,
  opts: { speed?: number; timeline?: OrientationTimeline; totalMs?: number } = {},
): ReplayEngine {
  const engine = new ReplayEngine(moves, w.callbacks, opts.totalMs, opts.timeline);
  engine.moveAnimationDurationMs = 350;
  engine.moveSpacingMs = 500;
  engine.orientationAnimationDurationMs = 280;
  engine.preRollEnabled = false;
  if (opts.speed) engine.setSpeed(opts.speed);
  return engine;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('transport race: reset/seek during in-flight rotation (stale-task overwrite)', () => {
  it('RESTART (pause + seek 0) while move 0 is still animating → cube ends SOLVED', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(4), w, { speed: 2 });
    const stopRaf = driveMain();

    const playing = engine.play();
    await playing;
    // Move 0 was dispatched (175ms animation at 2x) and is STILL turning.
    await new Promise((r) => setTimeout(r, 100));
    expect(w.rot.isAnimating()).toBe(true);

    // User hits Restart while the renderer is mid-turn (the UI does
    // pause() first — the seek must NOT resume playback).
    engine.pause();
    await engine.seek(0);
    expect(engine.state).toBe('paused');

    await drain(w);
    stopRaf();

    // The stale move-0 task must NOT re-apply itself on top of the reset.
    const { solved, offenders } = isSolvedState(w.model);
    expect(offenders.slice(0, 5)).toEqual([]);
    expect(solved).toBe(true);
    expect(engine.currentMoveIndex).toBe(-1);
  }, 20000);

  it('SEEK mid-playback (pause + seek) → cube equals the exact target state', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(6), w, { speed: 2 });
    const stopRaf = driveMain();

    const playing = engine.play();
    await playing;
    await new Promise((r) => setTimeout(r, 100));
    expect(w.rot.isAnimating()).toBe(true);

    // Pause, then seek to 2000ms → moves with offset ≤ 2000: 0..4
    // (offsets 0,500,1000,1500,2000 — offset 2000 is NOT > 2000).
    engine.pause();
    await engine.seek(2000);
    expect(engine.state).toBe('paused');

    await drain(w);
    stopRaf();

    const ref = await applyReference(makeMoves(6).slice(0, 5));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]);
    expect(engine.currentMoveIndex).toBe(4);
  }, 20000);

  it('REPLAY AGAIN (complete → play) restarts cleanly (no stale animation corruption)', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(8), w, { speed: 2 });
    const stopRaf = driveMain();

    const done = new Promise<void>((r) => (engine.onComplete = () => r()));
    await engine.play();
    await done;

    // Immediately replay from the beginning (play() seeks 0 internally).
    await engine.play();
    // Let the restarted playback dispatch a couple of moves, then pause.
    await new Promise((r) => setTimeout(r, 120));
    engine.pause();
    await drain(w);
    stopRaf();

    // The cube must equal a CLEAN replay from 0 up to the paused move — a
    // stale in-flight task from the previous run would corrupt it.
    const expected = engine.currentMoveIndex + 1;
    const ref = await applyReference(makeMoves(8).slice(0, expected));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]);
    // And nothing may be NaN (black/disappearing stickers).
    for (const c of w.model.getLogicalState()) {
      const q = c.mesh.quaternion;
      expect(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)).toBe(true);
    }
  }, 20000);
});

describe('transport race: overlapping step operations (double-inverse)', () => {
  it('RAPID double Step-backward during playback → single undo, cube SOLVED', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(10), w, { speed: 2 });
    const stopRaf = driveMain();

    const playing = engine.play();
    await playing;
    // Move 0 is animating in the renderer (nextIndex already 1).
    await new Promise((r) => setTimeout(r, 80));
    expect(w.rot.isAnimating()).toBe(true);

    // Two overlapping ⏮ clicks — the second must NOT read stale nextIndex.
    const p1 = engine.stepBackward();
    await new Promise((r) => setTimeout(r, 5));
    const p2 = engine.stepBackward();
    await Promise.all([p1, p2]);

    await drain(w);
    stopRaf();

    const { solved, offenders } = isSolvedState(w.model);
    expect(offenders.slice(0, 5)).toEqual([]);
    expect(solved).toBe(true);
    expect(engine.currentMoveIndex).toBe(-1);
  }, 20000);

  it('RAPID Step-backward then Step-forward → serialized, cube equals move-0 state', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(10), w, { speed: 2 });
    const stopRaf = driveMain();

    await engine.play();
    await new Promise((r) => setTimeout(r, 80));

    const b = engine.stepBackward();
    await new Promise((r) => setTimeout(r, 5));
    const f = engine.stepForward();
    await Promise.all([b, f]);

    await drain(w);
    stopRaf();

    // Serialized: stepBackward undoes move 0 (→ solved), then stepForward
    // re-applies it → net = move 0 applied exactly once (no double-apply).
    expect(engine.currentMoveIndex).toBe(0);
    const ref = await applyReference(makeMoves(10).slice(0, 1));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]);
  }, 20000);
});

describe('transport race: NaN guards (black / disappearing stickers)', () => {
  it('RotationEngine ignores a NaN angle instead of corrupting cubie quaternions', async () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const rot = new RotationEngine(model);

    await rot.rotateLayers('x', [1], Number.NaN, 100);
    rot.update(performance.now());

    expect(rot.isAnimating()).toBe(false);
    for (const c of model.getLogicalState()) {
      const q = c.mesh.quaternion;
      expect(Number.isFinite(q.x)).toBe(true);
      expect(Number.isFinite(q.y)).toBe(true);
      expect(Number.isFinite(q.z)).toBe(true);
      expect(Number.isFinite(q.w)).toBe(true);
    }
  });

  it('ReplayEngine sanitizes a NaN move direction — the cube never sees NaN', async () => {
    const w = makeFakeWorker();
    const moves = [toEvent('R', 1), { ...toEvent('U', 1), direction: Number.NaN as unknown as 1 | -1 | 2 }, toEvent('F', 1)];
    const engine = buildEngine(moves, w);
    const stopRaf = driveMain();

    await engine.stepForward();
    await engine.stepForward();
    await drain(w, 200);
    stopRaf();

    for (const c of w.model.getLogicalState()) {
      const q = c.mesh.quaternion;
      expect(Number.isFinite(q.x)).toBe(true);
      expect(Number.isFinite(q.y)).toBe(true);
      expect(Number.isFinite(q.z)).toBe(true);
      expect(Number.isFinite(q.w)).toBe(true);
    }
  });
});

describe('transport race: RotationEngine.flushAll contract', () => {
  it('flushAll force-completes in-flight tasks so a following reset is never overwritten', async () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const rot = new RotationEngine(model);

    // Start a 350ms U move, then immediately flush before it would snap.
    const p = rot.rotateLayers('y', [1], -90, 350);
    rot.update(performance.now());
    expect(rot.isAnimating()).toBe(true);

    rot.flushAll();
    await p;
    expect(rot.isAnimating()).toBe(false);

    // The move was committed (9 U-layer cubies still findable — no corruption).
    expect(model.getCubiesByFace('y', 1)).toHaveLength(9);

    // Reset after flush → fully solved, no stale task left to re-apply.
    model.resetCube();
    expect(isSolvedState(model).solved).toBe(true);
  });

  it('flushAll before applyFacelets leaves the model at the synced state (live smartcube path)', async () => {
    const model = new CubeModel(new CubeMeshFactory(), 3);
    const rot = new RotationEngine(model);

    // A 350ms U move is still turning when the smart cube's facelet sync
    // arrives — the sync must flush it first, then apply the absolute state.
    const p = rot.rotateLayers('y', [1], -90, 350);
    rot.update(performance.now());
    expect(rot.isAnimating()).toBe(true);

    // What Cube3DEngine.syncFacelets does now: flushAll() then applyFacelets.
    rot.flushAll();
    await p;
    model.applyFacelets('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');

    expect(rot.isAnimating()).toBe(false);
    const { solved, offenders } = isSolvedState(model);
    expect(offenders).toEqual([]);
    expect(solved).toBe(true);
  });

  it('flushAll + scramble replay ends at exactly the scrambled state (position 0)', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(4), w, { speed: 2 });
    const stopRaf = driveMain();

    await engine.applyInitialScramble(SCRAMBLE);
    const playing = engine.play();
    await playing;
    await new Promise((r) => setTimeout(r, 100));
    // Restart during playback — must flush the in-flight solve move first
    // (the UI pauses before seeking). Position 0 = scramble applied ONCE
    // (the replay starts scrambled → ends solved), never double-applied.
    engine.pause();
    await engine.seek(0);
    await drain(w);
    stopRaf();

    const scrambleEvents = SCRAMBLE.trim().split(/\s+/).map((t) => ({
      face: t[0] as CubeMoveEvent['face'],
      direction: (t[1] === '2' ? 2 : t[1] === "'" ? -1 : 1) as 1 | -1 | 2,
      cubeTimestamp: 0,
      hostTimestamp: 0,
    }));
    const ref = await applyReference(scrambleEvents);
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]);
    expect(engine.currentMoveIndex).toBe(-1);
  }, 20000);
});

// ─── Deferred-move race: pause / step while a mid-solve grip chain turns ─────
//
// REGRESSION TESTS for the user-reported "replay ends with the cube unsolved
// after using the transport controls" bug family:
//
//   "Si en la replay reinicias / adelantas / atrasas, casi siempre va bien,
//    pero a veces la replay acaba y el cubo no está resuelto — está roto.
//    Si reinicias y le das al play, se resuelve correctamente."
//
// Root cause: when a move's slot carries an orientation keyframe (a mid-solve
// whole-cube grip), the tick DEFERS the layer move until the grip chain
// finishes (rotate → wait → move) but advances nextIndex past it immediately.
// If the user pauses mid-chain, the chain aborts after its current step and
// the deferred move is left pending while nextIndex is already past it:
//
//   • resume-play fires the deferred move AFTER the later moves the virtual
//     clock already reached → out-of-order rotations → WRONG end state;
//   • step-forward skips the deferred move entirely → the replay "completes"
//     with a missing move → UNSOLVED cube;
//   • step-backward applies the deferred move's INVERSE over a move that was
//     never applied → double corruption.
//
// Restart (pause + seek 0) resets and fast-reapplies from a clean slate —
// which is exactly why "reiniciar + play" always fixes the cube again.

const TIMELINE_CHAIN_AT_MOVE_2: OrientationTimeline = (() => {
  const z = OrientationTable.rotationEntryFor('z')!;
  const y = OrientationTable.rotationEntryFor('y')!;
  const x = OrientationTable.rotationEntryFor('x')!;
  const zy = OrientationTable.compose(z, y);
  const zyx = OrientationTable.compose(zy, x);
  const zyxy = OrientationTable.compose(zyx, y);
  return [
    [2, z.id],
    [2, zy.id],
    [2, zyx.id],
    [2, zyxy.id],
  ];
})();

async function waitUntil(cond: () => boolean, timeoutMs: number, stepMs = 5): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil timed out');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

describe('deferred-move race: pause mid grip-chain (unsolved at end)', () => {
  it('REGRESSION: pause mid-chain → play → deferred move must NOT fire after later moves → cube SOLVED', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(6), w, { speed: 2, timeline: TIMELINE_CHAIN_AT_MOVE_2 });
    const stopRaf = driveMain();

    const done = new Promise<void>((r) => (engine.onComplete = () => r()));
    await engine.play();

    // Move 2 (F) is deferred behind its 4-step grip chain (~560ms real at 2x).
    // Wait until the virtual clock passed move 3's slot (offset 1500) while
    // the chain is still animating (position 1500 arrives ~250ms before the
    // chain ends), then pause to abort the chain mid-turn.
    await waitUntil(() => engine.positionMs >= 1500 && engine.currentMoveIndex === 2, 4000);
    engine.pause();
    await new Promise((r) => setTimeout(r, 400)); // chain settles (aborted)

    // Resume: the tick sees pos ≥ offset(3) first, so move 3 (L) is
    // dispatched BEFORE the stranded deferred move 2 (F) fires → out of order.
    await engine.play();
    await done;
    await drain(w);
    stopRaf();

    // Mechanism: move 2 = F → 'z1:-90'; move 3 = L → 'x-1:90'. Move 2 must
    // be applied BEFORE move 3 (it was due first).
    const applied = w.applied;
    const idxMove2 = applied.findIndex((m) => m.startsWith('z1:-90'));
    const idxMove3 = applied.findIndex((m) => m.startsWith('x-1:90'));
    expect(idxMove2).toBeGreaterThan(-1);
    expect(idxMove3).toBeGreaterThan(-1);
    expect(idxMove2).toBeLessThan(idxMove3); // ← FAILS pre-fix (3 before 2)

    // Consequence: the cube must end SOLVED.
    const ref = await applyReference(makeMoves(6));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]); // ← FAILS pre-fix
  }, 20000);

  it('REGRESSION: pause mid-chain → step-forward to the end → replay completes with a missing move (unsolved)', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(6), w, { speed: 2, timeline: TIMELINE_CHAIN_AT_MOVE_2 });
    const stopRaf = driveMain();

    await engine.play();
    // Move 2 deferred, grip chain still animating.
    await waitUntil(() => engine.currentMoveIndex === 2, 4000);
    engine.pause(); // aborts the chain → move 2 stranded, nextIndex already 3
    await new Promise((r) => setTimeout(r, 400));

    // Step through the whole rest of the solve. The deferred move 2 must not
    // be skipped — pre-fix it never fires, so the replay "completes" with
    // moves 0,1,3,4,5 applied → UNSOLVED cube (counter says Move 6/6).
    for (let i = 0; i < 8 && engine.state !== 'complete'; i++) {
      await engine.stepForward();
    }
    await drain(w);
    stopRaf();

    expect(engine.state).toBe('complete');
    // The cube must equal a FULL, in-order application of the 6 moves — the
    // missing move 2 makes it diverge (the counter says "complete" anyway).
    const ref = await applyReference(makeMoves(6));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]); // ← FAILS pre-fix (move 2 missing)
  }, 20000);

  it('REGRESSION: pause mid-chain → step-backward must undo a move that WAS applied, not the deferred one', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(6), w, { speed: 2, timeline: TIMELINE_CHAIN_AT_MOVE_2 });
    const stopRaf = driveMain();

    await engine.play();
    await waitUntil(() => engine.currentMoveIndex === 2, 4000);
    engine.pause();
    await new Promise((r) => setTimeout(r, 400));

    // Move 2 was never applied (deferred + aborted) — stepping backward must
    // undo move 1, NOT apply move 2's inverse on top of nothing.
    await engine.stepBackward();
    await drain(w);
    stopRaf();

    expect(engine.currentMoveIndex).toBe(1);
    // After the undo the cube must equal moves 0..1 applied — pre-fix the
    // inverse of the NEVER-applied move 2 landed on top of 0,1 (corruption).
    const ref = await applyReference(makeMoves(6).slice(0, 2));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]); // ← FAILS pre-fix (INV(2) applied)
  }, 20000);

  it('CONTROL: same timeline, plain play to the end → cube SOLVED (timeline itself is fine)', async () => {
    const w = makeFakeWorker();
    const engine = buildEngine(makeMoves(6), w, { speed: 2, timeline: TIMELINE_CHAIN_AT_MOVE_2 });
    const stopRaf = driveMain();

    const done = new Promise<void>((r) => (engine.onComplete = () => r()));
    await engine.play();
    await done;
    await drain(w);
    stopRaf();

    expect(engine.state).toBe('complete');
    // Plain playback must produce the exact in-order end state — proves the
    // timeline/grip mechanics themselves are sound (no pause involved).
    const ref = await applyReference(makeMoves(6));
    const mismatches = stateMismatches(ref, w.model);
    expect(mismatches).toEqual([]);
  }, 20000);
});
