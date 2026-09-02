/**
 * Phase B2 — 3×3 golden path end-to-end.
 *
 * Validates a COMPLETE 3×3 solve over the Phase A foundation, using REAL
 * components at every step (no mocks except the Web Worker transport, which
 * Node lacks — the database worker runs in-process against the real
 * sqlite-wasm engine with its memory fallback):
 *
 *   1. Scramble  — registry (`getEvent('333')`) + the real Min2Phase
 *                  provider, verified by applying it to a solved cube.
 *   2. Timer     — TimerEngine driven with the event's RULES PROFILE (A5):
 *                  inspection 15.5s → +2, solve 10s → final 12s.
 *   3. Persist   — the solve lands in the real SQLite DB (sessions+solves
 *                  repositories, migrations 001–027 applied).
 *   4. Stats     — the shared statistics engine computes correct aggregates.
 *   5. Analysis  — the CFOP analysis pipeline splits the solve into phases.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import type { CubeMoveEvent, CubeFace, CubeMoveDirection } from "@cubeforge/types";
import "@/utils/scrambleProviders"; // self-registers the real 2×2/3×3 providers (same as the app entry)
import { getEvent, generateScramble, validateScramble } from "@cubeforge/events";
import { TimerEngine, TimerState, Penalty } from "@cubeforge/timer-engine";
import { computeStats } from "@cubeforge/statistics";
import { analyzeSolve } from "@cubeforge/analysis-engine";
import { SolvesRepository, SessionsRepository, type Session, type Solve } from "@cubeforge/database";

// ── Local helpers (same shape as the analysis-engine test helpers) ─────────

function inverseScramble(scramble: string): string {
  return scramble
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((move) => {
      if (move.endsWith("'")) return move[0];
      if (move.endsWith("2")) return move;
      return move + "'";
    })
    .join(" ");
}

function makeMoves(notation: string, baseTimestamp = 1000, gapMs = 100): CubeMoveEvent[] {
  return notation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token, i) => {
      const face = token[0] as CubeFace;
      let direction: CubeMoveDirection = 1;
      if (token.includes("'")) direction = -1;
      else if (token.includes("2")) direction = 2;
      return {
        face,
        direction,
        cubeTimestamp: baseTimestamp + i * gapMs,
        hostTimestamp: baseTimestamp + i * gapMs,
      };
    });
}

// ── Real DB worker (in-process, memory backend in Node) ─────────────────────

let exec: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;
let sessionsRepo: SessionsRepository;
let solvesRepo: SolvesRepository;

beforeAll(async () => {
  // Comlink.expose registers a message listener on `self` at import time —
  // Node has none, so provide an inert one and import the REAL worker module.
  vi.stubGlobal("addEventListener", vi.fn());
  const { DBWorker } = await import("../../../../packages/database/src/worker.ts");
  const ok = await DBWorker.init();
  expect(ok).toBe(true);
  exec = async (sql, bind) => DBWorker.execute(sql, bind);
  sessionsRepo = new SessionsRepository(exec);
  solvesRepo = new SolvesRepository(exec);
}, 60_000);

afterAll(async () => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("B2 — 3×3 golden path (real components)", () => {
  it("1. registry + provider produce a verified scramble", () => {
    const event = getEvent("333")!;
    expect(event.scrambleProvider).toBe("min2phase-random-state");

    const scramble = generateScramble(event);
    expect(scramble.length).toBeGreaterThan(0);
    expect(validateScramble(event, scramble), "scramble solves the cube").toBe(true);
  });

  it("2. the timer consumes the 3×3 rules profile (inspection +2, final time)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const event = getEvent("333")!;
    const engine = new TimerEngine({ useInspection: true, rules: event.rules });
    const stops: Array<{ timeMs: number; penalty: Penalty; finalTimeMs: number }> = [];
    engine.stop$.subscribe((d) => stops.push(d));

    engine.startInspection();
    expect(engine.getState()).toBe(TimerState.INSPECTION);

    // Hold completes after 15.5s inspection → +2 (SPEED_RULES, A5).
    vi.advanceTimersByTime(15_500);
    engine.handleDown();
    vi.advanceTimersByTime(300); // hold-to-start → READY, penalty computed
    expect(engine.getPenalty()).toBe(Penalty.PLUS_TWO);

    engine.handleUp(); // RUNNING
    vi.advanceTimersByTime(10_000);
    engine.handleDown(); // stop

    const last = stops[stops.length - 1];
    expect(last.penalty).toBe(Penalty.PLUS_TWO);
    expect(last.timeMs).toBe(10_000);
    expect(last.finalTimeMs).toBe(12_000); // 10s + 2s penalty
  });

  it("3–4. the solve persists in the real DB and stats are correct", async () => {
    const now = Date.now();
    const session: Session = {
      id: "golden-session",
      name: "Golden path",
      createdAt: now,
      updatedAt: now,
    };
    await sessionsRepo.insert(session);

    const scramble = generateScramble(getEvent("333")!);
    const solve: Solve = {
      id: "golden-solve",
      sessionId: session.id,
      timeMs: 10_000,
      timestamp: now,
      scramble,
      penalty: "+2",
      method: "CFOP",
      source: "manual",
      moves: makeMoves(inverseScramble(scramble)),
      note: "golden path",
      puzzleType: "333",
    };
    await solvesRepo.insert(solve);

    // Round-trip: read it back from the real engine.
    const rows = await solvesRepo.findAll(session.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("golden-solve");
    expect(rows[0].puzzleType).toBe("333");
    expect(rows[0].penalty).toBe("+2");

    // Session count reflects the solve.
    const counts = await solvesRepo.countBySession();
    expect(counts.get(session.id)).toBe(1);

    // D1: an OH solve persists with its own type '333oh' in the real DB
    // (same engine, same CHECK constraint — never collides with '333').
    const ohSession: Session = { ...session, id: "golden-oh-session", name: "OH" };
    await sessionsRepo.insert(ohSession);
    await solvesRepo.insert({ ...solve, id: "golden-oh-solve", sessionId: ohSession.id, puzzleType: "333oh" });
    const ohRows = await solvesRepo.findAll(ohSession.id);
    expect(ohRows).toHaveLength(1);
    expect(ohRows[0].puzzleType).toBe("333oh");

    // Stats: a session of 5 solves (this one + 4 more) → Ao5 exists.
    for (let i = 0; i < 4; i++) {
      await solvesRepo.insert({
        ...solve,
        id: `golden-solve-${i}`,
        timeMs: 9_000 + i * 500,
        penalty: "none",
        timestamp: now + i * 1000,
      });
    }
    const all = await solvesRepo.findAll(session.id);
    const stats = computeStats(
      all.map((s) => ({ time: s.timeMs, penalty: s.penalty as "none" | "+2" | "DNF" })),
    );
    expect(stats.total).toBe(5);
    expect(stats.ao5).not.toBeNull();
    // Golden solve final = 12_000, others 9000/9500/10000/10500 → mean 10_200.
    expect(stats.mean).toBe(10_200);
  });

  it("5. the CFOP analysis pipeline splits the golden solve", async () => {
    const event = getEvent("333")!;
    const scramble = generateScramble(event);
    const solveMoves = makeMoves(inverseScramble(scramble));

    const result = await analyzeSolve({
      moves: solveMoves,
      method: "CFOP",
      scramble,
      solveTimeMs: 10_000,
    });

    expect(result.timeline.entries.length).toBeGreaterThan(0);
    expect(result.timeline.phases.length).toBeGreaterThan(0);
    // CFOP detection starts with the Cross phase (the golden path asserts
    // the pipeline actually SPLITS, not the exact segmentation of an
    // undo-style solve — exhaustive phase-contiguity is covered by the
    // PhaseSplitter integration tests with crafted CFOP solves).
    expect(result.timeline.phases[0].startIndex).toBe(0);
    expect(result.timeline.phases[0].phaseName).toBe("Cross");
    for (const phase of result.timeline.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      expect(phase.moveCount).toBeGreaterThanOrEqual(0);
      expect(phase.phaseName).toBeTruthy();
    }
    expect(result.metrics).toBeDefined();
  });
});
