import { describe, expect, it } from "vitest";
import {
  ONBOARDING_TOTAL_STEPS,
  onboardingBack,
  onboardingInitialState,
  onboardingIsLast,
  onboardingNext,
  onboardingReplay,
  onboardingStart,
} from "./onboardingCore";

describe("onboardingCore", () => {
  it("starts idle on first launch and done when the flag is persisted", () => {
    expect(onboardingInitialState(false)).toEqual({ status: "idle", currentStep: 0 });
    expect(onboardingInitialState(true)).toEqual({ status: "done", currentStep: 0 });
  });

  it("start moves idle → active(0) and is a no-op otherwise", () => {
    const idle = onboardingInitialState(false);
    expect(onboardingStart(idle)).toEqual({ status: "active", currentStep: 0 });

    const active = onboardingStart(idle);
    expect(onboardingStart(active)).toEqual(active);
    expect(onboardingStart(onboardingInitialState(true))).toEqual(
      onboardingInitialState(true),
    );
  });

  it("next walks through all steps and completes on the last one", () => {
    let s = onboardingStart(onboardingInitialState(false));
    let visited = 0;
    while (s.status === "active") {
      visited++;
      s = onboardingNext(s);
    }
    expect(visited).toBe(ONBOARDING_TOTAL_STEPS);
    expect(s).toEqual({ status: "done", currentStep: 0 });
  });

  it("isLast is true only on the final active step", () => {
    let s = onboardingStart(onboardingInitialState(false));
    expect(onboardingIsLast(s)).toBe(false);

    for (let i = 0; i < ONBOARDING_TOTAL_STEPS; i++) {
      expect(onboardingIsLast(s)).toBe(i === ONBOARDING_TOTAL_STEPS - 1);
      s = onboardingNext(s);
    }
    // Stepping from the last active step completes the tour.
    expect(s.status).toBe("done");
    expect(onboardingIsLast(s)).toBe(false);
  });

  it("back clamps at step 0 and is a no-op outside active", () => {
    const active = onboardingStart(onboardingInitialState(false));
    expect(onboardingBack(active)).toEqual(active); // already at 0
    expect(onboardingBack(onboardingInitialState(true))).toEqual(
      onboardingInitialState(true),
    );
  });

  it("back decrements within active", () => {
    const step2 = onboardingNext(onboardingNext(onboardingStart(onboardingInitialState(false))));
    expect(step2.currentStep).toBe(2);
    expect(onboardingBack(step2).currentStep).toBe(1);
  });

  it("replay returns a done state to active(0) and leaves other states alone", () => {
    let s = onboardingStart(onboardingInitialState(false));
    while (s.status === "active") s = onboardingNext(s);
    expect(s.status).toBe("done");

    const replayed = onboardingReplay(s);
    expect(replayed).toEqual({ status: "active", currentStep: 0 });

    const idle = onboardingInitialState(false);
    expect(onboardingReplay(idle)).toEqual(idle);
  });
});
