import { describe, expect, it } from "vitest";

/**
 * Regression contract for the virtual cube's auto-arm on REPEATED
 * "Scramble now" presses.
 *
 * The session hook (useVirtualCubeSession) has no rendering harness in this
 * repo, so this test ports the exact pieces the bug depended on — the
 * auto-arm effect's edge detection and the adapter's reset$ signal — and
 * pins the batching model that broke it:
 *
 *   handleScrambleNow() runs ENTIRELY inside one synchronous click handler:
 *   resetSession() → adapter.pushReset() (validator re-seeds) → feed every
 *   scramble move (validator re-verifies). React 18 batches all of those
 *   renders, so on the SECOND press the auto-arm effect only ever observes
 *   isScrambled true → true — the intermediate false dip is never rendered.
 *   The edge detector (wasScrambledRef) therefore stays true, `justScrambled`
 *   stays false, and the engine is never re-armed: the first move after the
 *   second press finds the engine in IDLE instead of READY_FOR_MOVE, so the
 *   timer never starts.
 *
 *   The fix: the session also subscribes to adapter.reset$, which emits
 *   SYNCHRONOUSLY before the move feed, and clears the edge detector there —
 *   so every press re-arms exactly like the first. The physical timer never
 *   hit this because its scramble moves arrive over BLE with real async gaps
 *   between renders.
 */
type EngineState = "IDLE" | "READY_FOR_MOVE" | "RUNNING";

interface SessionSimOptions {
  /**
   * Mirrors the session's adapter.reset$ subscription (the fix). When
   * false, the sim reproduces the pre-fix hook — the edge detector is only
   * ever updated by the auto-arm effect (per rendered value).
   */
  resetArmsEdgeDetector?: boolean;
}

function createSessionSim(options: SessionSimOptions = {}) {
  const { resetArmsEdgeDetector = true } = options;

  // Validator state. `publishScrambled` is what a RENDERED update carries;
  // React batching means intermediate values inside one handler are dropped.
  let isScrambled = false;
  // The session's edge detector (wasScrambledRef).
  let wasScrambledRef = false;
  let engine: EngineState = "IDLE";

  // ── adapter.reset$ → session (verbatim port of the fix) ────────────────
  const onResetSignal = () => {
    if (resetArmsEdgeDetector) wasScrambledRef = false;
  };

  // ── the auto-arm effect body (verbatim port) ───────────────────────────
  const autoArmEffect = () => {
    const justScrambled = isScrambled && !wasScrambledRef;
    wasScrambledRef = isScrambled;
    if (!justScrambled) return;
    if (engine === "IDLE") engine = "READY_FOR_MOVE";
  };

  // ── handleScrambleNow, ONE synchronous handler ─────────────────────────
  const scrambleNow = () => {
    // resetSession() → engine back to IDLE.
    engine = "IDLE";
    // adapter.pushReset(): the validator re-seeds and would publish false…
    // (never rendered — see publish below).
    onResetSignal();
    // …then every scramble move is fed and the validator re-verifies:
    // the FINAL published value is true. React renders once, after the
    // handler, with only this value.
    publishScrambled(true);
  };

  // A rendered validator update: the auto-arm effect runs on it.
  const publishScrambled = (value: boolean) => {
    isScrambled = value;
    autoArmEffect();
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

    // 2nd press: the batched true→true render used to leave the engine
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

  it("pins the root cause: without the reset$ re-arm the edge detector misses every press after the first", () => {
    const sim = createSessionSim({ resetArmsEdgeDetector: false });

    sim.scrambleNow();
    expect(sim.engine).toBe("READY_FOR_MOVE");
    sim.move();
    expect(sim.engine).toBe("RUNNING");

    // Pre-fix: the intermediate isScrambled=false is batched away, so the
    // edge detector never sees a false→true transition and the engine is
    // left IDLE — the first move can never start the timer.
    sim.scrambleNow();
    expect(sim.engine).toBe("IDLE");
    sim.move();
    expect(sim.engine).toBe("IDLE");
  });
});
