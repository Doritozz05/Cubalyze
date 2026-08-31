/**
 * PyraminxReplayEngine — transport tests.
 *
 * The transport (play / pause / seek / step / speed + callbacks) is tested
 * against a FAKE driver that records the applied tokens — no WebGL, fully
 * deterministic. The real driver (createPyraminxReplayDriver → PyraminxEngine)
 * is thin and covered by the PyraminxEngine suite + the visual-fidelity
 * integration in PyraminxModel.test.ts.
 *
 * Timeline convention (mirrors the cube ReplayEngine): position 0 = the
 * scrambled state; move i plays at offset (i+1) * moveSpacingMs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PyraminxReplayEngine,
  invertPyraminxToken,
  type PyraminxReplayDriver,
} from '../PyraminxReplayEngine';

(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (
  cb: FrameRequestCallback,
) => setTimeout(() => cb(performance.now()), 4) as unknown as number;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame ??= (
  id: number,
) => clearTimeout(id);

/** Records every applied token with its mode (instant/animated) + duration. */
function makeFakeDriver(): {
  driver: PyraminxReplayDriver;
  state: {
    applied: { token: string; instant: boolean; durationMs: number }[];
    resets: number;
    flushes: number;
  };
} {
  const state = {
    applied: [] as { token: string; instant: boolean; durationMs: number }[],
    resets: 0,
    flushes: 0,
  };
  const driver: PyraminxReplayDriver = {
    reset: () => {
      state.resets++;
    },
    flushAll: () => {
      state.flushes++;
    },
    applyTokenInstant: (token) => {
      state.applied.push({ token, instant: true, durationMs: 0 });
    },
    applyTokenAnimated: async (token, durationMs) => {
      state.applied.push({ token, instant: false, durationMs });
    },
  };
  return { driver, state };
}

const SCRAMBLE = "U L' B";
const MOVES = ["R", "U'", "L", "B'", "u", "l'"];

function buildEngine(): {
  engine: PyraminxReplayEngine;
  fake: ReturnType<typeof makeFakeDriver>;
} {
  const fake = makeFakeDriver();
  const engine = new PyraminxReplayEngine(
    MOVES,
    MOVES.length * 500,
    fake.driver,
  );
  engine.moveSpacingMs = 100;
  engine.moveAnimationDurationMs = 20;
  return { engine, fake };
}

const engines: PyraminxReplayEngine[] = [];
function tracked(engine: PyraminxReplayEngine): PyraminxReplayEngine {
  engines.push(engine);
  return engine;
}

afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
  vi.restoreAllMocks();
});

describe('invertPyraminxToken', () => {
  it('primes a plain token and unprimes a primed one', () => {
    expect(invertPyraminxToken('U')).toBe("U'");
    expect(invertPyraminxToken("U'")).toBe('U');
    expect(invertPyraminxToken('l')).toBe("l'");
    expect(invertPyraminxToken("l'")).toBe('l');
  });
});

describe('applyInitialScramble', () => {
  it('resets, applies the scramble tokens instantly and reports position 0', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    const positions: [number, number][] = [];
    engine.onPosition = (ms, idx) => positions.push([ms, idx]);

    await engine.applyInitialScramble(SCRAMBLE);

    expect(fake.state.resets).toBe(1);
    expect(fake.state.applied.map((a) => a.token)).toEqual(SCRAMBLE.split(' '));
    expect(fake.state.applied.every((a) => a.instant)).toBe(true);
    expect(engine.currentMoveIndex).toBe(-1);
    expect(positions).toEqual([[0, -1]]);
  });

  it('ignores an invalid scramble string without touching the puzzle', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble('NOT A SCRAMBLE');
    expect(fake.state.applied).toEqual([]);
  });
});

describe('seek', () => {
  it('applies exactly the moves whose slot boundaries have passed', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;

    // Every seek RE-APPLIES the scramble (reset + scramble is how the engine
    // reaches an exact state), then the moves whose boundary has passed
    // (move i starts at (i+1)·spacing — the same inclusive-boundary rule as
    // the cube ReplayEngine). Move 0 starts at 100ms; move 1 at 200ms.
    await engine.seek(199);
    const applied = fake.state.applied.map((a) => a.token);
    expect(applied.slice(0, SCRAMBLE.split(' ').length)).toEqual(SCRAMBLE.split(' '));
    expect(applied.slice(SCRAMBLE.split(' ').length)).toEqual(['R']);
    expect(fake.state.applied.filter((a) => !a.instant)).toEqual([]);
    expect(engine.currentMoveIndex).toBe(0);
    expect(engine.positionMs).toBe(199); // reports the clamped target

    // At exactly 200ms the second move has started → both applied.
    fake.state.applied.length = 0;
    await engine.seek(200);
    const applied2 = fake.state.applied.map((a) => a.token);
    expect(applied2.slice(SCRAMBLE.split(' ').length)).toEqual(['R', "U'"]);
    expect(engine.currentMoveIndex).toBe(1);

    // Seek back to the start: reset + scramble, no moves.
    fake.state.applied.length = 0;
    await engine.seek(0);
    expect(fake.state.applied.map((a) => a.token)).toEqual(SCRAMBLE.split(' '));
    expect(engine.currentMoveIndex).toBe(-1);
  });

  it('completes when seeking past the last move', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;

    const states: string[] = [];
    engine.onStateChange = (s) => states.push(s);
    let completed = false;
    engine.onComplete = () => {
      completed = true;
    };

    await engine.seek(10_000);
    expect(engine.currentMoveIndex).toBe(MOVES.length - 1);
    expect(completed).toBe(true);
    expect(states).toContain('complete');
  });
});

describe('stepForward / stepBackward', () => {
  it('stepForward applies the next move animated and reports it', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;

    const moves: number[] = [];
    const positions: [number, number][] = [];
    engine.onMove = (idx) => moves.push(idx);
    engine.onPosition = (ms, idx) => positions.push([ms, idx]);

    await engine.stepForward();
    expect(fake.state.applied).toEqual([{ token: 'R', instant: false, durationMs: 20 }]);
    expect(moves).toEqual([0]);
    expect(positions).toEqual([[100, 0]]);
    expect(engine.currentMoveIndex).toBe(0);
  });

  it('stepBackward undoes the last move with its INVERSE token (no reset flash)', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    await engine.seek(299); // 2 moves applied: R, U' (move i starts at (i+1)*100)
    fake.state.applied.length = 0;

    await engine.stepBackward();
    expect(fake.state.applied.map((a) => a.token)).toEqual(['U']); // inverse of U'
    expect(fake.state.resets).toBe(2); // initial scramble reset + seek's reset — no reset on undo
    expect(engine.currentMoveIndex).toBe(0);
  });

  it('stepBackward at the start is a no-op', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;
    await engine.stepBackward();
    expect(fake.state.applied).toEqual([]);
  });
});

describe('play / pause', () => {
  it('plays every move through the tick loop and completes', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;

    const applied: string[] = [];
    const states: string[] = [];
    engine.onMove = (idx) => applied.push(MOVES[idx]);
    engine.onStateChange = (s) => states.push(s);
    let completed = false;
    engine.onComplete = () => {
      completed = true;
    };

    // Compact timeline so the whole solve plays in a few ticks.
    engine.moveSpacingMs = 10;
    engine.moveAnimationDurationMs = 1;

    await engine.play();
    await new Promise((r) => setTimeout(r, 300));
    expect(applied).toEqual(MOVES);
    expect(completed).toBe(true);
    expect(engine.state).toBe('complete');
    expect(engine.currentMoveIndex).toBe(MOVES.length - 1);
    expect(states).toContain('playing');
    expect(states).toContain('complete');
    // The only flush is the one from applyInitialScramble — play itself never
    // force-flushes in-flight turns.
    expect(fake.state.flushes).toBe(1);
  });

  it('pause freezes the transport', async () => {
    const { engine, fake } = buildEngine();
    tracked(engine);
    await engine.applyInitialScramble(SCRAMBLE);
    fake.state.applied.length = 0;

    engine.moveSpacingMs = 50; // 20 moves/sec — the first boundary passes quickly
    const applied: string[] = [];
    engine.onMove = (idx) => applied.push(MOVES[idx]);

    const playPromise = engine.play();
    await new Promise((r) => setTimeout(r, 120));
    engine.pause();
    await playPromise;

    const appliedAtPause = applied.length;
    expect(appliedAtPause).toBeGreaterThanOrEqual(1);
    expect(engine.state).toBe('paused');
    await new Promise((r) => setTimeout(r, 200));
    expect(applied.length).toBe(appliedAtPause); // no moves after pause
  });
});
