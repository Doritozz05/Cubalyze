"use client";

import { useEffect } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { SessionMeta } from "@/hooks/usePersistentSession";

export interface OnboardingTourDeps {
  /** True while the profile identity is being ensured on first launch. */
  profileLoading: boolean;
  /** True while the session list is being loaded. */
  sessionLoading: boolean;
  /** Every session (used to detect returning users with data). */
  sessions: SessionMeta[];
  /** The local profile row (used to detect a returning/edited user). */
  profile: { displayName?: string; handle?: string } | null;
}

/**
 * First-load onboarding tour orchestration (extracted from App.tsx):
 * one-shot spotlight walkthrough (TDD-0020) that auto-starts on a clean
 * first launch only. Users with real data (solves or an edited profile)
 * never see it. Skill Tree and Training are intentionally not toured.
 */
export function useOnboardingTour(deps: OnboardingTourDeps) {
  const {
    status: tourStatus,
    currentStep: tourStep,
    start: tourStart,
    next: tourNext,
    back: tourBack,
    skip: tourSkip,
    complete: tourComplete,
  } = useOnboarding();

  const tourActive = tourStatus === "active";

  // Auto-start: gate on "idle" + both data sources loaded + eligibility guard.
  useEffect(() => {
    if (tourStatus !== "idle") return;
    if (deps.profileLoading || deps.sessionLoading) return;
    // Check solves across ALL sessions (a returning user with data in a
    // non-active session must not get the first-run tour either).
    const hasData =
      deps.sessions.some((s) => s.solveCount > 0) ||
      !!deps.profile?.displayName?.trim() ||
      !!deps.profile?.handle?.trim();
    if (hasData) {
      // Returning user whose flag was lost: persist done so we never re-check.
      void tourComplete();
      return;
    }
    // Delay so the timer paints before the tour fades in.
    const t = setTimeout(() => tourStart(), 600);
    return () => clearTimeout(t);
  }, [
    tourStatus,
    tourComplete,
    tourStart,
    deps.profileLoading,
    deps.sessionLoading,
    deps.sessions,
    deps.profile,
  ]);

  return {
    tourActive,
    tourStatus,
    tourStep,
    tourStart,
    tourNext,
    tourBack,
    tourSkip,
    tourComplete,
  };
}
