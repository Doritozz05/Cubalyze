import { describe, expect, it } from "vitest";

/**
 * Regression contract for the virtual cube's auto-arm on REPEATED
 * "Scramble now" presses.
 *
 * The session hook (useVirtualCubeSession) has no rendering harness in this
 * repo, so this test ports the exact pieces the bug depended on — the
 * auto-arm effect (edge detection + engine arm) and the adapter's reset$
 * signal — and pins the React batching model that broke it:
 *
 *   handleScrambleNow() runs ENTIRELY inside one synchronous click handler:
 *   resetSession() → adapter.pushReset() (validator re-seeds) → feed every
 *   scramble move (validator re-verifies). React 18 batches all of those
 *   renders into a SINGLE commit, so on the SECOND press the auto-arm effect
 *   observes isScrambled true → true: its only dependency is that VALUE,
 *   which did not change, so **the effect never re-runs** — the edge
 *   detector is never consulted and the engine is never re-armed. The first
 *   move after the second press finds the engine in IDLE instead of
 *   READY_FOR_MOVE, so the timer never starts.
 *
 *   The fix: the session also subscribes to adapter.reset$, which emits
 *   SYNCHRONOUSLY before the move feed. The handler clears the edge detector
 *   AND bumps a `scrambleResetEpoch` state that the auto-arm effect lists as
 *   a dependency — forcing it to re-run after every press, exactly as if the
 *   validator had visibly dipped to false. The physical timer never hit this
 *   because its scramble moves arrive over BLE with real async gaps between
 *   renders.
 */
type EngineState = "IDLE" | "READY_FOR_MOVE" | "RUNNING";

interface SessionSimOptions {
  /**
   * Whether adapter.reset$ bumps the epoch the auto-arm effect depends on
   * (the fix). When false, the sim reproduces the pre-fix hook — the effect
   * only ever re-runs when the isScrambled VALUE changes.
   */
  resetBumpsEpoch?: boolean;
}

function createSessionSim(options: SessionSimOptions = {}) {
  const { resetBumpsEpoch = true } = options;

  // Validator state. `isScrambled` is what a RENDERED commit carries;
  // React batching drops intermediate values inside one handler.
  let isScrambled = false;
  let prevIsScrambled = false;
  // The session's edge detector (wasScrambledRef) and the fix's epoch.
  let wasScrambledRef = false;
  let epoch = 0;
  let prevEpoch = 0;
  let engine: EngineState = "IDLE";

  // ── adapter.reset$ → session (verbatim port of the fix) ────────────────
  const onResetSignal = () => {
    wasScrambledRef = false;
    if (resetBumpsEpoch) epoch += 1;
  };

  // ── the auto-arm effect body (verbatim port) ───────────────────────────
  const runAutoArmEffect = () => {
    const justScrambled = isScrambled && !wasScrambledRef;
    wasScrambledRef = isScrambled;
    if (!justScrambled) return;
    if (engine === "IDLE") engine = "READY_FOR_MOVE";
  };

  // ── handleScrambleNow, ONE synchronous handler ─────────────────────────
  const scrambleNow = () => {
    // resetSession() → engine back to IDLE.
    engine = "IDLE";
    // adapter.pushReset(): the validator re-seeds (would publish false —
    // never rendered), and the session's reset$ handler runs synchronously.
    onResetSignal();
    // …then every scramble move is fed and the validator re-verifies:
    // the FINAL published value is true. React commits once, after the
    // handler, with only this value.
    publishScrambled(true);
  };

  // A committed render of the validator update: the auto-arm effect runs
  // ONLY if one of its dependencies changed (React bails out otherwise —
  // this is the crux of the bug).
  const publishScrambled = (value: boolean) => {
    isScrambled = value;
    const depsChanged = isScrambled !== prevIsScrambled || epoch !== prevEpoch;
    prevIsScrambled = isScrambled;
    prevEpoch = epoch;
    if (depsChanged) runAutoArmEffect();
  };

  // A user turn after the scramble is verified.
  const move = () => {
    if (engine === "READY_FOR_MOVE") engine = "RUNNING";
  };

  return { scrambleNow, move, get engine() { return engine; } };
}

describe("virtual cube auto-arm on repeated scramble-now", () => {
  it("re-arms on the SECOND and THIRD scramble-now presses (regression)", () => {
    const sim = createSessionSim();

    // 1st press: verified → armed → move starts the timer.
    sim.scrambleNow();
    expect(sim.engine).toBe("READY_FOR_MOVE");
    sim.move();
    expect(sim.engine).toBe("RUNNING");

    // 2nd press: previously the batched true→true commit left the engine
    // IDLE forever — the reported bug.
    sim.scrambleNow();
    expect(sim.engine).toBe("READY_FOR_MOVE");
    sim.move();
    expect(sim.engine).toBe("RUNNING");

    // 3rd press behaves like the 1st.
    sim.scrambleNow();
    expect(sim.engine).toBe("READY_FOR_MOVE");
    sim.move();
    expect(sim.engine).toBe("RUNNING");
  });

  it("pins the root cause: clearing the ref alone is not enough — the effect must re-run", () => {
    // Reproduces the FIRST attempted fix (reset$ clears the edge detector
    // but does NOT bump the effect's dependency): the validator re-verifies,
    // yet the batched true→true commit never re-invokes the effect, so the
    // engine is never re-armed.
    const sim = createSessionSim({ resetBumpsEpoch: false });

    sim.scrambleNow();
    expect(sim.engine).toBe("READY_FOR_MOVE");
    sim.move();
    expect(sim.engine).toBe("RUNNING");

    // The scramble IS re-verified (READY in the UI) but the engine stays
    // IDLE — the first move can never start the timer.
    sim.scrambleNow();
    expect(sim.engine).toBe("IDLE");
    sim.move();
    expect(sim.engine).toBe("IDLE");
  });
});
