import { describe, it, expect } from 'vitest';
import { ReplayEngine } from '../replay/ReplayEngine';
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
});
