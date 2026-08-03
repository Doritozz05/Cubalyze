/**
 * @cubeforge/training — Session Engine unit tests
 *
 * Tests all valid transitions, invalid transitions, and edge cases
 * for the TrainingSessionEngine state machine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TrainingSessionEngine } from "../session-engine";
import type { TrainingSessionState, TrainingSessionConfig } from "../../types";

// ─── Test helpers ─────────────────────────────────────────────────────────

function makeConfig(
  overrides: Partial<TrainingSessionConfig> = {},
): TrainingSessionConfig {
  return {
    preset: {
      exerciseId: "algorithm-execution-drill",
      methodId: "CFOP",
      subsetId: "oll",
    },
    ...overrides,
  };
}

function startSession(
  engine: TrainingSessionEngine,
  config?: TrainingSessionConfig,
): TrainingSessionState {
  engine.dispatch({ type: "START_SESSION", config: config ?? makeConfig() });
  return engine.getState();
}

// ─── Initial State ────────────────────────────────────────────────────────

describe("Initial state", () => {
  it("starts in idle phase with empty config and no attempts", () => {
    const engine = new TrainingSessionEngine();
    const state = engine.getState();

    expect(state.phase).toBe("idle");
    expect(state.config.preset.exerciseId).toBe("");
    expect(state.attempts).toHaveLength(0);
    expect(state.attemptIndex).toBe(0);
    expect(state.currentTimeMs).toBe(0);
    expect(state.stoppedTimeMs).toBe(0);
    expect(state.smartCubeConnected).toBe(false);
  });
});

// ─── START_SESSION ────────────────────────────────────────────────────────

describe("START_SESSION", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
  });

  it("transitions from idle to setup with config", () => {
    const config = makeConfig({ maxAttempts: 10, timeLimitMs: 30000 });
    engine.dispatch({ type: "START_SESSION", config });

    const state = engine.getState();
    expect(state.phase).toBe("setup");
    expect(state.config.preset.exerciseId).toBe("algorithm-execution-drill");
    expect(state.config.preset.methodId).toBe("CFOP");
    expect(state.config.maxAttempts).toBe(10);
    expect(state.config.timeLimitMs).toBe(30000);
    expect(state.attempts).toHaveLength(0);
    expect(state.attemptIndex).toBe(0);
  });

  it("resets attempt counter and attempts when starting new session", () => {
    const engine2 = new TrainingSessionEngine();
    const config = makeConfig();

    // Do a full cycle first
    engine2.dispatch({ type: "START_SESSION", config });
    engine2.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R U R'", caseId: "oll-1" });
    engine2.dispatch({ type: "ARM" });
    engine2.dispatch({ type: "START_SOLVING" });
    engine2.dispatch({ type: "STOP", timeMs: 1500 });
    engine2.dispatch({
      type: "VERDICT",
      verdict: "correct",
      playMode: "manual",
      expectedMoves: ["R", "U", "R'"],
    });

    expect(engine2.getState().attempts).toHaveLength(1);

    // Start new session — should reset everything
    engine2.dispatch({ type: "START_SESSION", config });
    const fresh = engine2.getState();
    expect(fresh.phase).toBe("setup");
    expect(fresh.attempts).toHaveLength(0);
    expect(fresh.attemptIndex).toBe(0);
  });
});

// ─── SCRAMBLE_GENERATED ───────────────────────────────────────────────────

describe("SCRAMBLE_GENERATED", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
  });

  it("registers scramble and caseId when in setup", () => {
    engine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "F R U R' U' F'",
      caseId: "oll-33",
    });

    const state = engine.getState();
    expect(state.phase).toBe("setup"); // stays in setup
  });

  it("is ignored from idle state", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "F R U R' U' F'",
      caseId: "oll-33",
    });
    expect(idleEngine.getState().phase).toBe("idle");
  });

  it("is ignored from armed state", () => {
    engine.dispatch({ type: "ARM" });
    engine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "R U R'",
      caseId: "oll-2",
    });
    expect(engine.getState().phase).toBe("armed");
  });

  it("is ignored from solving state", () => {
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "R U R'",
      caseId: "oll-2",
    });
    expect(engine.getState().phase).toBe("solving");
  });
});

// ─── ARM ──────────────────────────────────────────────────────────────────

describe("ARM", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
  });

  it("transitions from setup to armed", () => {
    engine.dispatch({ type: "ARM" });
    expect(engine.getState().phase).toBe("armed");
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "ARM" });
    expect(idleEngine.getState().phase).toBe("idle");
  });

  it("is ignored from armed (already armed)", () => {
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "ARM" });
    expect(engine.getState().phase).toBe("armed");
  });

  it("is ignored from solving", () => {
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "ARM" });
    expect(engine.getState().phase).toBe("solving");
  });

  it("is ignored from verdict", () => {
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1000 });
    engine.dispatch({ type: "ARM" });
    expect(engine.getState().phase).toBe("verdict");
  });
});

// ─── START_SOLVING ────────────────────────────────────────────────────────

describe("START_SOLVING", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "ARM" });
  });

  it("transitions from armed to solving, resets time", () => {
    engine.dispatch({ type: "START_SOLVING" });
    const state = engine.getState();
    expect(state.phase).toBe("solving");
    expect(state.currentTimeMs).toBe(0);
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "START_SOLVING" });
    expect(idleEngine.getState().phase).toBe("idle");
  });

  it("is ignored from setup (not armed yet)", () => {
    const setupEngine = new TrainingSessionEngine();
    startSession(setupEngine);
    setupEngine.dispatch({ type: "START_SOLVING" });
    expect(setupEngine.getState().phase).toBe("setup");
  });

  it("is ignored from verdict", () => {
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 2000 });
    engine.dispatch({ type: "START_SOLVING" });
    expect(engine.getState().phase).toBe("verdict");
  });
});

// ─── TICK ─────────────────────────────────────────────────────────────────

describe("TICK", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
  });

  it("updates currentTimeMs while solving", () => {
    engine.dispatch({ type: "TICK", timeMs: 500 });
    expect(engine.getState().currentTimeMs).toBe(500);

    engine.dispatch({ type: "TICK", timeMs: 1200 });
    expect(engine.getState().currentTimeMs).toBe(1200);
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "TICK", timeMs: 500 });
    expect(idleEngine.getState().currentTimeMs).toBe(0);
  });

  it("is ignored from setup", () => {
    const setupEngine = new TrainingSessionEngine();
    startSession(setupEngine);
    setupEngine.dispatch({ type: "TICK", timeMs: 500 });
    expect(setupEngine.getState().currentTimeMs).toBe(0);
  });

  it("is ignored from verdict", () => {
    engine.dispatch({ type: "STOP", timeMs: 1500 });
    engine.dispatch({ type: "TICK", timeMs: 999 });
    expect(engine.getState().currentTimeMs).toBe(1500);
  });
});

// ─── STOP ─────────────────────────────────────────────────────────────────

describe("STOP", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "TICK", timeMs: 1234 });
  });

  it("transitions from solving to verdict, captures stoppedTimeMs", () => {
    engine.dispatch({ type: "STOP", timeMs: 1500 });
    const state = engine.getState();
    expect(state.phase).toBe("verdict");
    expect(state.stoppedTimeMs).toBe(1500);
    expect(state.currentTimeMs).toBe(1500);
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "STOP", timeMs: 500 });
    expect(idleEngine.getState().phase).toBe("idle");
    expect(idleEngine.getState().stoppedTimeMs).toBe(0);
  });

  it("is ignored from setup (never armed)", () => {
    const setupEngine = new TrainingSessionEngine();
    startSession(setupEngine);
    setupEngine.dispatch({ type: "STOP", timeMs: 500 });
    expect(setupEngine.getState().phase).toBe("setup");
  });

  it("is ignored from verdict (already stopped)", () => {
    engine.dispatch({ type: "STOP", timeMs: 1000 });
    engine.dispatch({ type: "STOP", timeMs: 9999 });
    expect(engine.getState().stoppedTimeMs).toBe(1000); // unchanged
  });
});

// ─── VERDICT ──────────────────────────────────────────────────────────────

describe("VERDICT", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "R U R'",
      caseId: "oll-1",
    });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1500 });
  });

  it("registers attempt with correct verdict and increments index", () => {
    engine.dispatch({
      type: "VERDICT",
      verdict: "correct",
      playMode: "manual",
      expectedMoves: ["R", "U", "R'"],
    });

    const state = engine.getState();
    expect(state.attempts).toHaveLength(1);
    expect(state.attemptIndex).toBe(1);

    const attempt = state.attempts[0];
    expect(attempt.verdict).toBe("correct");
    expect(attempt.playMode).toBe("manual");
    expect(attempt.timeMs).toBe(1500);
    expect(attempt.caseId).toBe("oll-1");
    expect(attempt.scramble).toBe("R U R'");
    expect(attempt.expectedMoves).toEqual(["R", "U", "R'"]);
    expect(attempt.exerciseId).toBe("algorithm-execution-drill");
    expect(attempt.timestamp).toBeGreaterThan(0);
    expect(attempt.id).toMatch(/^attempt-/);
  });

  it("accumulates multiple attempts in order", () => {
    // First attempt
    engine.dispatch({
      type: "VERDICT",
      verdict: "correct",
      playMode: "manual",
    });
    engine.dispatch({ type: "NEXT_ATTEMPT" });

    // Second attempt cycle
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "F U F'", caseId: "oll-2" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 2000 });
    engine.dispatch({
      type: "VERDICT",
      verdict: "incorrect",
      playMode: "smart-cube",
    });

    const state = engine.getState();
    expect(state.attempts).toHaveLength(2);
    expect(state.attemptIndex).toBe(2);
    // Most recent first
    expect(state.attempts[0].verdict).toBe("incorrect");
    expect(state.attempts[1].verdict).toBe("correct");
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    expect(idleEngine.getState().attempts).toHaveLength(0);
  });

  it("is ignored from setup", () => {
    const setupEngine = new TrainingSessionEngine();
    startSession(setupEngine);
    setupEngine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    expect(setupEngine.getState().attempts).toHaveLength(0);
  });

  it("is ignored from solving", () => {
    const solvingEngine = new TrainingSessionEngine();
    startSession(solvingEngine);
    solvingEngine.dispatch({ type: "ARM" });
    solvingEngine.dispatch({ type: "START_SOLVING" });
    solvingEngine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    expect(solvingEngine.getState().phase).toBe("solving");
  });

  it("handles all verdict types", () => {
    const verdicts = ["correct", "incorrect", "skipped", "dnf"] as const;

    for (const verdict of verdicts) {
      const e = new TrainingSessionEngine();
      startSession(e);
      e.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "U", caseId: "test" });
      e.dispatch({ type: "ARM" });
      e.dispatch({ type: "START_SOLVING" });
      e.dispatch({ type: "STOP", timeMs: 1000 });
      e.dispatch({ type: "VERDICT", verdict, playMode: "smart-cube" });
      expect(e.getState().attempts[0].verdict).toBe(verdict);
    }
  });
});

// ─── NEXT_ATTEMPT ─────────────────────────────────────────────────────────

describe("NEXT_ATTEMPT", () => {
  let engine: TrainingSessionEngine;

  beforeEach(() => {
    engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R U R'", caseId: "oll-1" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1500 });
    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
  });

  it("transitions from verdict to setup, resets stoppedTimeMs", () => {
    engine.dispatch({ type: "NEXT_ATTEMPT" });
    const state = engine.getState();
    expect(state.phase).toBe("setup");
    expect(state.stoppedTimeMs).toBe(0);
    expect(state.attempts).toHaveLength(1); // attempts preserved
  });

  it("is ignored from idle", () => {
    const idleEngine = new TrainingSessionEngine();
    idleEngine.dispatch({ type: "NEXT_ATTEMPT" });
    expect(idleEngine.getState().phase).toBe("idle");
  });

  it("is ignored from solving", () => {
    const solvingEngine = new TrainingSessionEngine();
    startSession(solvingEngine);
    solvingEngine.dispatch({ type: "ARM" });
    solvingEngine.dispatch({ type: "START_SOLVING" });
    solvingEngine.dispatch({ type: "NEXT_ATTEMPT" });
    expect(solvingEngine.getState().phase).toBe("solving");
  });
});

// ─── END_SESSION ──────────────────────────────────────────────────────────

describe("END_SESSION", () => {
  it("transitions from verdict to idle", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R U R'", caseId: "oll-1" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1500 });
    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    engine.dispatch({ type: "END_SESSION" });

    expect(engine.getState().phase).toBe("idle");
  });

  it("is ignored from idle (already idle)", () => {
    const engine = new TrainingSessionEngine();
    engine.dispatch({ type: "END_SESSION" });
    expect(engine.getState().phase).toBe("idle");
  });

  it("preserves attempts across END_SESSION", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R", caseId: "x" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 500 });
    engine.dispatch({ type: "VERDICT", verdict: "skipped", playMode: "manual" });
    engine.dispatch({ type: "END_SESSION" });

    expect(engine.getState().attempts).toHaveLength(1);
  });
});

// ─── SMART_CUBE_CONNECTED ─────────────────────────────────────────────────

describe("SMART_CUBE_CONNECTED", () => {
  it("updates connected state from idle", () => {
    const engine = new TrainingSessionEngine();
    engine.dispatch({ type: "SMART_CUBE_CONNECTED", connected: true });
    expect(engine.getState().smartCubeConnected).toBe(true);

    engine.dispatch({ type: "SMART_CUBE_CONNECTED", connected: false });
    expect(engine.getState().smartCubeConnected).toBe(false);
  });

  it("works from any phase without changing phase", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SMART_CUBE_CONNECTED", connected: true });
    expect(engine.getState().phase).toBe("setup");
    expect(engine.getState().smartCubeConnected).toBe(true);
  });
});

// ─── Reset ────────────────────────────────────────────────────────────────

describe("reset()", () => {
  it("resets to initial idle state with empty everything", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R", caseId: "x" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1000 });
    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });

    engine.reset();

    const state = engine.getState();
    expect(state.phase).toBe("idle");
    expect(state.attempts).toHaveLength(0);
    expect(state.attemptIndex).toBe(0);
    expect(state.currentTimeMs).toBe(0);
    expect(state.stoppedTimeMs).toBe(0);
    expect(state.smartCubeConnected).toBe(false);
  });
});

// ─── Subscribe ────────────────────────────────────────────────────────────

describe("subscribe()", () => {
  it("calls listener on state change", () => {
    const engine = new TrainingSessionEngine();
    const calls: TrainingSessionState[] = [];

    const unsubscribe = engine.subscribe((state) => calls.push(state));
    engine.dispatch({ type: "START_SESSION", config: makeConfig() });

    expect(calls).toHaveLength(1);
    expect(calls[0].phase).toBe("setup");

    unsubscribe();
  });

  it("returns unsubscribe function that stops notifications", () => {
    const engine = new TrainingSessionEngine();
    const calls: TrainingSessionState[] = [];

    const unsubscribe = engine.subscribe((state) => calls.push(state));
    engine.dispatch({ type: "START_SESSION", config: makeConfig() });
    expect(calls).toHaveLength(1);

    unsubscribe();
    engine.dispatch({ type: "ARM" });
    expect(calls).toHaveLength(1); // no new calls
  });

  it("calls multiple listeners", () => {
    const engine = new TrainingSessionEngine();
    let a = 0;
    let b = 0;

    const unsubA = engine.subscribe(() => a++);
    const unsubB = engine.subscribe(() => b++);

    engine.dispatch({ type: "START_SESSION", config: makeConfig() });
    expect(a).toBe(1);
    expect(b).toBe(1);

    unsubA();
    unsubB();
  });

  it("notifies on reset", () => {
    const engine = new TrainingSessionEngine();
    let notified = false;
    engine.subscribe(() => (notified = true));
    engine.reset();
    expect(notified).toBe(true);
  });
});

// ─── Full session lifecycle ───────────────────────────────────────────────

describe("Full session lifecycle", () => {
  it("completes a full cycle: idle → setup → armed → solving → verdict → setup", () => {
    const engine = new TrainingSessionEngine();
    const config = makeConfig();

    // Start
    engine.dispatch({ type: "START_SESSION", config });
    expect(engine.getState().phase).toBe("setup");

    // Generate scramble
    engine.dispatch({
      type: "SCRAMBLE_GENERATED",
      scramble: "F R U R' U' F'",
      caseId: "oll-33",
    });
    expect(engine.getState().phase).toBe("setup");

    // Arm
    engine.dispatch({ type: "ARM" });
    expect(engine.getState().phase).toBe("armed");

    // Start solving
    engine.dispatch({ type: "START_SOLVING" });
    expect(engine.getState().phase).toBe("solving");

    // Tick
    engine.dispatch({ type: "TICK", timeMs: 500 });
    expect(engine.getState().currentTimeMs).toBe(500);

    // Stop
    engine.dispatch({ type: "STOP", timeMs: 1800 });
    expect(engine.getState().phase).toBe("verdict");
    expect(engine.getState().stoppedTimeMs).toBe(1800);

    // Verdict
    engine.dispatch({
      type: "VERDICT",
      verdict: "correct",
      playMode: "manual",
      expectedMoves: ["F", "R", "U", "R'", "U'", "F'"],
    });
    expect(engine.getState().attempts).toHaveLength(1);

    // Next attempt — back to setup
    engine.dispatch({ type: "NEXT_ATTEMPT" });
    expect(engine.getState().phase).toBe("setup");

    // Second cycle
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "U R U' R'", caseId: "oll-2" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1200 });
    engine.dispatch({ type: "VERDICT", verdict: "incorrect", playMode: "smart-cube" });
    expect(engine.getState().attempts).toHaveLength(2);

    // End session
    engine.dispatch({ type: "END_SESSION" });
    expect(engine.getState().phase).toBe("idle");
  });

  it("ignores a second VERDICT on the same attempt (double-click never double-counts)", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "F R U R' U' F'", caseId: "oll-33" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1500 });

    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    // A double-click fires a 2nd verdict while still on the same attempt.
    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "manual" });
    engine.dispatch({ type: "VERDICT", verdict: "incorrect", playMode: "manual" });

    expect(engine.getState().attempts).toHaveLength(1);
    expect(engine.getState().attempts[0].verdict).toBe("correct");
    expect(engine.getState().attemptIndex).toBe(1);

    // A fresh attempt resets idempotency — VERDICT is accepted again.
    engine.dispatch({ type: "NEXT_ATTEMPT" });
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "U R U' R'", caseId: "oll-2" });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1200 });
    engine.dispatch({ type: "VERDICT", verdict: "incorrect", playMode: "smart-cube" });
    expect(engine.getState().attempts).toHaveLength(2);
  });
});

// ─── Smart cube play mode ─────────────────────────────────────────────────

describe("Smart cube play mode", () => {
  it("records playMode as 'smart-cube' when set", () => {
    const engine = new TrainingSessionEngine();
    startSession(engine);
    engine.dispatch({ type: "SCRAMBLE_GENERATED", scramble: "R U R'", caseId: "oll-1" });
    engine.dispatch({ type: "SMART_CUBE_CONNECTED", connected: true });
    engine.dispatch({ type: "ARM" });
    engine.dispatch({ type: "START_SOLVING" });
    engine.dispatch({ type: "STOP", timeMs: 1500 });
    engine.dispatch({ type: "VERDICT", verdict: "correct", playMode: "smart-cube" });

    expect(engine.getState().attempts[0].playMode).toBe("smart-cube");
    expect(engine.getState().smartCubeConnected).toBe(true);
  });
});
