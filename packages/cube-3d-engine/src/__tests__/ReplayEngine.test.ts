import { describe, it, expect, vi } from 'vitest';
import { ReplayEngine } from '../replay/ReplayEngine';
import { OrientationTable } from '@cubeforge/math-core';
import type { CubeFace, CubeMoveDirection, CubeMoveEvent } from '@cubeforge/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FACES: CubeFace[] = ['R', 'U', 'F', 'L', 'B', 'D'];

/**
 * Build a synthetic move. hostTimestamp is deliberately DEGENERATE (bunched /
 * zero) — this simulates smart-cube skew and imported reconstructions where
 * per-move wall-clock times are unreliable or missing entirely.
 */
function bunchedMove(i: number): CubeMoveEvent {
  const dirs: CubeMoveDirection[] = [1, -1, 2];
  return {
    face: FACES[i % FACES.length],
    direction: dirs[i % dirs.length],
    cubeTimestamp: 0,
    hostTimestamp: 0,
  };
}

interface AppliedRot {
  axis: string;
  angle: number;
  durationMs: number;
}

function harness(moves: CubeMoveEvent[], totalMsOverride?: number) {
  const applied: AppliedRot[] = [];
  const engine = new ReplayEngine(
    moves,
    {
      resetCube: () => {},
      rotateLayers: (axis, _layers, angle, dur) => {
        applied.push({ axis: axis as string, angle, durationMs: dur ?? 0 });
      },
    },
    totalMsOverride,
  );
  return { engine, applied };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReplayEngine — move-driven timeline', () => {
  it('plays ALL 50 moves of a 3s record instead of cutting off after ~5', async () => {
    // 50 moves, all bunched at t=0, with the old timer-time (3000ms) as the
    // override — the exact scenario that used to stop the replay at ~5 moves.
    const moves = Array.from({ length: 50 }, (_, i) => bunchedMove(i));
    const { engine, applied } = harness(moves, 3000);

    // Timeline is move-driven: 50 moves × 500ms, never capped by 3000ms.
    expect(engine.moveCount).toBe(50);
    expect(engine.totalMs).toBe(50 * 500);
    expect(engine.totalMs).toBeGreaterThan(3000);

    // Step through every move — each one must be applied. After k steps the
    // engine sits on move k-1, whose slot starts at (k-1) * 500ms (move 0
    // lives at t=0).
    for (let i = 0; i < 50; i++) {
      await engine.stepForward();
      expect(applied).toHaveLength(i + 1);
      expect(engine.currentMoveIndex).toBe(i);
      expect(engine.positionMs).toBe(i * 500);
    }
    expect(engine.currentMoveIndex).toBe(49);
    expect(engine.state).toBe('paused');

    // One more step → replay completes (all moves consumed).
    await engine.stepForward();
    expect(engine.state).toBe('complete');
    expect(applied).toHaveLength(50);
  });

  it('ignores spread/bunched hostTimestamps — offsets come from move index', async () => {
    // Mix: some moves with huge gaps, others identical — playback must not
    // depend on any of it.
    const moves = Array.from({ length: 10 }, (_, i) => bunchedMove(i)).map(
      (m, i) => ({ ...m, hostTimestamp: i === 0 ? 0 : i * 100_000 }),
    );
    const { engine } = harness(moves);

    expect(engine.moveCount).toBe(10);
    expect(engine.totalMs).toBe(10 * 500);

    await engine.stepForward();
    await engine.stepForward();
    await engine.stepForward();
    // After 3 steps we're on move index 2 (slot starts at 2 * 500ms).
    expect(engine.positionMs).toBe(2 * 500);
    expect(engine.currentMoveIndex).toBe(2);
  });

  it('keeps totalMsOverride as a floor — it can extend but never cap the timeline', () => {
    const moves = Array.from({ length: 5 }, (_, i) => bunchedMove(i));

    // Override larger than move-driven duration → timeline extended.
    const extended = harness(moves, 10_000);
    expect(extended.engine.totalMs).toBe(10_000);

    // Override smaller → move-driven duration wins (all moves fit).
    const capped = harness(moves, 1_000);
    expect(capped.engine.totalMs).toBe(5 * 500);

    // No override → move-driven duration.
    const plain = harness(moves);
    expect(plain.engine.totalMs).toBe(5 * 500);
  });

  it('seek() to the end applies every move and completes', async () => {
    const moves = Array.from({ length: 40 }, (_, i) => bunchedMove(i));
    const { engine, applied } = harness(moves);

    await engine.seek(engine.totalMs);

    expect(applied).toHaveLength(40);
    expect(engine.currentMoveIndex).toBe(39);
    expect(engine.state).toBe('complete');
  });

  it('handles a single move without a degenerate zero-length timeline', () => {
    const { engine } = harness([bunchedMove(0)]);
    expect(engine.moveCount).toBe(1);
    expect(engine.totalMs).toBe(500);
  });

  it('never rotates the cube by the orientation timeline when none is supplied', async () => {
    // Reconstructions ship CONJUGATED replay moves (rotations already folded
    // into the moves), so ReplaySection deliberately passes NO timeline to the
    // engine — the cube must stay put while the moves play. If the engine ever
    // rotated by a phantom keyframe, the inspection rotation would play twice.
    const moves = [bunchedMove(0), bunchedMove(1), bunchedMove(2)];
    let orientationCalls = 0;
    const engine = new ReplayEngine(
      moves,
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: () => {
          orientationCalls++;
        },
      },
      undefined, // totalMs
      undefined, // orientationTimeline → contract: NO setOrientation calls
    );
    await engine.stepForward();
    await engine.stepForward();
    await engine.seek(engine.totalMs);
    expect(orientationCalls).toBe(0);
  });

  it('rotates to the solver perspective via the timeline when supplied', async () => {
    // Smart-cube solves: physical moves + an IMU timeline. The engine must
    // apply the keyframe at the right move so the cube follows the solver.
    const moves = [bunchedMove(0), bunchedMove(1)];
    const orientationCalls: number[] = [];
    const engine = new ReplayEngine(
      moves,
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (orientationIndex) => {
          orientationCalls.push(orientationIndex);
        },
      },
      undefined,
      [[0, 2]], // keyframe: move 0 → orientation 2
    );
    await engine.stepForward();
    expect(orientationCalls).toEqual([2]);
  });
});

describe('ReplayEngine — inspection pre-roll (solver-frame grip)', () => {
  // Deterministic rAF: the tick loop schedules frames we never let fire, so
  // play() applies exactly the moves whose slot has passed and then parks.
  const stubRaf = () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  };

  it('grips the inspection orientation BEFORE move 0 and blocks moves until the grip finishes', async () => {
    stubRaf();
    try {
      const calls: string[] = [];
      let releaseGrip: (() => void) | null = null;
      const gripDone = new Promise<void>((r) => (releaseGrip = r));
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1)],
        {
          resetCube: () => { calls.push('reset'); },
          rotateLayers: () => { calls.push('rotate'); },
          setOrientation: (oi, dur) => {
            calls.push(`orient:${oi}:${dur}`);
            return gripDone; // unresolved — the grip is still turning
          },
        },
        undefined,
        [[0, 2]], // keyframe at move 0 → inspection grip = orientation 2
      );

      const playing = engine.play(); // suspends on the grip
      // play() runs through the transport serialization queue (an extra
      // microtask), so flush pending microtasks before observing the grip.
      await new Promise((r) => setTimeout(r, 0));
      // While the grip is in flight NO move may have been applied.
      expect(calls.filter((c) => c.startsWith('rotate'))).toHaveLength(0);
      expect(calls).toContain(`orient:2:${engine.preRollDurationMs}`);

      releaseGrip!();
      await playing;
      // Only after the grip completed does move 0 apply — and the grip's
      // orientation is NOT re-fired by the tick (marked as applied).
      expect(calls.filter((c) => c.startsWith('rotate'))).toHaveLength(1);
      expect(calls.filter((c) => c.startsWith('orient'))).toEqual([
        `orient:2:${engine.preRollDurationMs}`,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('no pre-roll grip when the timeline starts with identity', async () => {
    stubRaf();
    try {
      const calls: { oi: number; dur: number }[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
        },
        undefined,
        [[0, 0]], // identity keyframe → nothing to grip before move 0
      );
      await engine.play();
      // Only the tick's identity snap at move 0 (orientation duration) — no
      // 600ms inspection pre-roll.
      expect(calls).toEqual([{ oi: 0, dur: engine.orientationAnimationDurationMs }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips the pre-roll when preRollEnabled is false (smart-cube held orientation)', async () => {
    stubRaf();
    try {
      const calls: { oi: number; dur: number }[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
        },
        undefined,
        [[0, 2]],
      );
      engine.preRollEnabled = false;
      await engine.play();
      // No 600ms inspection pre-roll. The HELD grip is snapped at position 0
      // (duration 0) — the tick must NOT re-animate it as a phantom rotation.
      expect(calls).toEqual([{ oi: 2, dur: 0 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('snaps to the held starting grip at position 0 for smart-cube solves (seek + play)', async () => {
    stubRaf();
    try {
      const calls: { oi: number; dur: number }[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
        },
        undefined,
        [[0, 2], [1, 7]],
      );
      engine.preRollEnabled = false;

      await engine.seek(0);
      // Position 0: instant snap to the held grip — no phantom animation.
      expect(calls).toEqual([{ oi: 2, dur: 0 }]);

      calls.length = 0;
      await engine.play();
      // The grip is already applied — move 0 must not re-animate it (only the
      // stubbed-rAF move rotations would run, which never fire).
      expect(calls).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('animates REAL mid-solve rotations after the initial grip snap (smart-cube)', async () => {
    // Held grip after inspection: y. Mid-solve: ONE real rotation (z) — the
    // composed grip afterwards is y∘z, a single-axis step from y, so it
    // animates as ONE turn (never a diagonal).
    const gripY = OrientationTable.rotationEntryFor('y')!;
    const afterZ = OrientationTable.compose(gripY, OrientationTable.rotationEntryFor('z')!);
    const calls: { oi: number; dur: number }[] = [];
    const engine = new ReplayEngine(
      [bunchedMove(0), bunchedMove(1), bunchedMove(2)],
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
      },
      undefined,
      [[0, gripY.id], [2, afterZ.id]],
    );
    engine.preRollEnabled = false;

    // Step to move 0: snap to the held grip, never animate it.
    await engine.stepForward();
    expect(calls).toEqual([{ oi: gripY.id, dur: 0 }]);

    // Move 1: same grip — nothing new.
    calls.length = 0;
    await engine.stepForward();
    expect(calls).toEqual([]);

    // Move 2: a REAL rotation (z) → animated as ONE single-axis turn.
    await engine.stepForward();
    expect(calls).toEqual([{ oi: afterZ.id, dur: engine.orientationAnimationDurationMs }]);
  });

  it('step-back to position 0 snaps to the held grip (smart-cube), not a phantom animation', async () => {
    const gripY = OrientationTable.rotationEntryFor('y')!;
    const afterZ = OrientationTable.compose(gripY, OrientationTable.rotationEntryFor('z')!);
    const calls: { oi: number; dur: number }[] = [];
    const engine = new ReplayEngine(
      [bunchedMove(0), bunchedMove(1)],
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
      },
      undefined,
      [[0, gripY.id], [1, afterZ.id]],
    );
    engine.preRollEnabled = false;

    await engine.stepForward(); // move 0 → snap grip y
    await engine.stepForward(); // move 1 → animate the z rotation
    expect(calls).toEqual([
      { oi: gripY.id, dur: 0 },
      { oi: afterZ.id, dur: engine.orientationAnimationDurationMs },
    ]);

    calls.length = 0;
    await engine.stepBackward(); // back to position 0 → snap back to the held grip
    expect(calls).toEqual([{ oi: gripY.id, dur: 0 }]);
  });

  it('decomposes a collapsed multi-step grip change into sequential single-axis rotations (smart-cube)', async () => {
    // The user rotated y THEN z between two moves — the compact timeline only
    // kept the collapsed jump (identity → y∘z). The engine must animate the
    // two single-axis turns one after another, never a diagonal SLERP.
    const gripY = OrientationTable.rotationEntryFor('y')!;
    const afterZ = OrientationTable.compose(gripY, OrientationTable.rotationEntryFor('z')!);
    const calls: { oi: number; dur: number }[] = [];
    const engine = new ReplayEngine(
      [bunchedMove(0), bunchedMove(1)],
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
      },
      undefined,
      [[0, 0], [1, afterZ.id]],
    );
    engine.preRollEnabled = false;

    await engine.stepForward(); // move 0 → identity grip (nothing to animate)
    calls.length = 0;
    await engine.stepForward(); // move 1 → TWO single-axis turns, ONE AFTER ANOTHER
    // (Several valid 2-step decompositions exist for y∘z — e.g. [x', y] or
    // [y, z] — so only the step count, durations and final grip are asserted.)
    expect(calls).toHaveLength(2);
    expect(calls[0].dur).toBe(engine.orientationAnimationDurationMs);
    expect(calls[1]).toEqual({ oi: afterZ.id, dur: engine.orientationAnimationDurationMs });
  });

  it('re-snaps the held grip after stop() + play() (smart-cube, no phantom animation)', async () => {
    stubRaf();
    try {
      const calls: { oi: number; dur: number }[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
        },
        undefined,
        [[0, 2], [1, 7]],
      );
      engine.preRollEnabled = false;

      await engine.play();
      expect(calls).toContainEqual({ oi: 2, dur: 0 });

      calls.length = 0;
      engine.stop(); // resets lastAppliedOrientation
      await engine.play();
      // The grip is re-snapped (absolute) — never re-animated.
      expect(calls).toEqual([{ oi: 2, dur: 0 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('seek to 0 while playing snaps the held grip and the resumed tick does not re-animate it', async () => {
    stubRaf();
    try {
      const calls: { oi: number; dur: number }[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi, dur) => { calls.push({ oi, dur: dur ?? 0 }); },
        },
        undefined,
        [[0, 2], [1, 7]],
      );
      engine.preRollEnabled = false;

      await engine.play(); // snap grip 2 at position 0, move 0 applies
      calls.length = 0;

      // Rewind to 0 while playback is active (wasPlaying path): reset + snap,
      // then the resumed tick re-applies move 0 WITHOUT re-animating the grip.
      await engine.seek(0);
      expect(calls).toEqual([{ oi: 2, dur: 0 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('replays the grip after a restart (seek to 0), not on resume mid-timeline', async () => {
    stubRaf();
    try {
      const orientCalls: number[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1), bunchedMove(2)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi) => { orientCalls.push(oi); },
        },
        undefined,
        [[0, 2]],
      );

      await engine.play(); // grip once, then move 0 applies
      expect(orientCalls).toEqual([2]);


      // Resume from mid-timeline: no re-grip.
      engine.pause();
      const before = orientCalls.length;
      await engine.play();
      expect(orientCalls).toHaveLength(before);

      // Restart (seek 0) → the inspection grip plays again.
      await engine.seek(0);
      await engine.play();
      expect(orientCalls).toEqual([2, 2]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('mid-solve orientation keyframes animate with the orientation duration', async () => {
    const durations: number[] = [];
    const engine = new ReplayEngine(
      [bunchedMove(0), bunchedMove(1), bunchedMove(2)],
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (_oi, dur) => { durations.push(dur ?? 0); },
      },
      undefined,
      [[0, 2], [2, 5]],
    );
    await engine.stepForward(); // move 0 → grip 2
    expect(durations).toEqual([engine.orientationAnimationDurationMs]);
    await engine.stepForward(); // move 1 → same grip, no new keyframe
    expect(durations).toHaveLength(1);
    await engine.stepForward(); // move 2 → grip 5
    expect(durations).toEqual([
      engine.orientationAnimationDurationMs,
      engine.orientationAnimationDurationMs,
    ]);
  });

  it('inspection with TWO rotations animates them ONE AFTER ANOTHER (z, then y2 — no diagonal swing)', async () => {
    stubRaf();
    try {
      const orientCalls: number[] = [];
      let releaseStep1: (() => void) | null = null;
      // Step 1 is async-gated; step 2 must NOT fire until step 1 completes.
      const step1 = new Promise<void>((r) => (releaseStep1 = r));
      let call = 0;
      const engine = new ReplayEngine(
        [bunchedMove(0), bunchedMove(1)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (oi) => {
            call++;
            orientCalls.push(oi);
            // Only the FIRST rotation is gated — the second would be illegal
            // before it resolves.
            return call === 1 ? step1 : undefined;
          },
        },
        undefined,
        [[0, 5], [0, 9]], // inspection "z y2" → two keyframes at event 0
      );

      const playing = engine.play();
      // play() runs through the transport serialization queue (an extra
      // microtask), so flush pending microtasks before observing step 1.
      await new Promise((r) => setTimeout(r, 0));
      // Step 1 started, step 2 must NOT have: rotations are sequential.
      expect(orientCalls).toEqual([5]);

      releaseStep1!();
      await playing;
      // Both steps ran in order, each with the per-rotation pre-roll duration.
      expect(orientCalls).toEqual([5, 9]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('mid-solve consecutive rotations chain ONE AFTER ANOTHER (not one composed SLERP)', async () => {
    const orientCalls: number[] = [];
    const engine = new ReplayEngine(
      [bunchedMove(0), bunchedMove(1), bunchedMove(2), bunchedMove(3)],
      {
        resetCube: () => {},
        rotateLayers: () => {},
        setOrientation: (oi) => { orientCalls.push(oi); },
      },
      undefined,
      [[0, 2], [3, 5], [3, 8]], // two rotations between moves 2 and 3
    );
    await engine.stepForward(); // move 0 → grip 2
    await engine.stepForward(); // move 1 → same grip
    await engine.stepForward(); // move 2 → same grip
    await engine.stepForward(); // move 3 → rotations 5 then 8, in order
    expect(orientCalls).toEqual([2, 5, 8]);
  });
});

describe('ReplayEngine — speed scaling of animation durations', () => {
  const stubRaf = () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  };

  it('scales move rotation animation duration inversely by speed (0.25x -> 4x duration)', async () => {
    stubRaf();
    try {
      const durations: number[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0)],
        {
          resetCube: () => {},
          rotateLayers: (_axis, _layers, _angle, dur) => { durations.push(dur); },
        },
      );
      engine.preRollEnabled = false;
      engine.setSpeed(0.25);
      await engine.play();
      // Base duration is 350ms, at 0.25x speed it should be 350 / 0.25 = 1400ms.
      expect(durations).toEqual([1400]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('scales pre-roll inspection grip duration inversely by speed (0.25x -> 4x duration)', async () => {
    stubRaf();
    try {
      const gripDurations: number[] = [];
      const engine = new ReplayEngine(
        [bunchedMove(0)],
        {
          resetCube: () => {},
          rotateLayers: () => {},
          setOrientation: (_oi, dur) => { gripDurations.push(dur ?? 0); },
        },
        undefined,
        [[0, 2]],
      );
      engine.setSpeed(0.25);
      await engine.play();
      // Pre-roll base duration is 600ms, at 0.25x speed it should be 600 / 0.25 = 2400ms.
      expect(gripDurations[0]).toBe(2400);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
