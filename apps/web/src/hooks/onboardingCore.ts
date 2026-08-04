/**
 * Pure onboarding state machine (TDD-0020). Headless and side-effect free so it
 * can be unit-tested without React or the database. The `useOnboarding` hook
 * wraps this core with a module-level singleton + persistence.
 *
 * Transitions:
 *   loading ──(flag read)──▶ idle | done
 *   idle ──start()──▶ active(0)
 *   active ──next()──▶ active(step+1) …──▶ done   (on the last step)
 *   active ──back()──▶ active(step-1)            (clamped at 0)
 *   done ──replay()──▶ active(0)                 (never persists)
 */

export type OnboardingStatus = "loading" | "idle" | "active" | "done";

/** 5 stops + final centered step. */
export const ONBOARDING_TOTAL_STEPS = 6;

export interface OnboardingState {
  status: OnboardingStatus;
  currentStep: number;
}

export function onboardingInitialState(completed: boolean): OnboardingState {
  return completed
    ? { status: "done", currentStep: 0 }
    : { status: "idle", currentStep: 0 };
}

export function onboardingStart(s: OnboardingState): OnboardingState {
  if (s.status !== "idle") return s;
  return { status: "active", currentStep: 0 };
}

export function onboardingIsLast(s: OnboardingState): boolean {
  return s.status === "active" && s.currentStep === ONBOARDING_TOTAL_STEPS - 1;
}

export function onboardingNext(s: OnboardingState): OnboardingState {
  if (s.status !== "active") return s;
  if (onboardingIsLast(s)) return { status: "done", currentStep: 0 };
  return { status: "active", currentStep: s.currentStep + 1 };
}

export function onboardingBack(s: OnboardingState): OnboardingState {
  if (s.status !== "active" || s.currentStep === 0) return s;
  return { status: "active", currentStep: s.currentStep - 1 };
}

export function onboardingReplay(s: OnboardingState): OnboardingState {
  if (s.status !== "done") return s;
  return { status: "active", currentStep: 0 };
}
