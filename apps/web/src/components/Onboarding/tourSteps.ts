import type { ViewId } from "@/components/Layout/sidebar.constants";

export interface TourStep {
  id: string;
  /** View to navigate to before measuring the target. */
  view: ViewId;
  title: string;
  body: string;
  /** CSS selector of the highlighted element. Absent only on the final step. */
  target?: string;
}

/**
 * First-load spotlight tour (TDD-0020). Exactly 6 steps: 5 stops + a final
 * centered card. Skill Tree and Training are intentionally excluded.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "timer",
    view: "timer",
    title: "Your timer",
    body: "Hold space (or tap & hold on touch) and release to start — the 15s WCA inspection is built in. Every solve gets instant phase analysis.",
    target: '[data-onboarding-target="timer"]',
  },
  {
    id: "stats",
    view: "insights",
    title: "Your stats",
    body: "Session overview, phase splits, PB progression and 3D replay of any solve live here.",
    target: '[data-onboarding-target="insights"]',
  },
  {
    id: "algorithms",
    view: "practice",
    title: "Algorithms",
    body: "Browse cases by method — CFOP, Roux, ZZ… Send any case to the trainer with one click.",
    target: '[data-onboarding-target="practice"]',
  },
  {
    id: "profile",
    view: "profile",
    title: "Your identity",
    body: "Your CubeMark is generated from your anonymous ID. Set your name, handle and avatar here.",
    target: '[data-onboarding-target="profile"]',
  },
  {
    id: "widgets",
    view: "timer",
    title: "Widgets",
    body: "Floating tools — times log, scramble visualizer, metronome. Open the explorer and build your own layout.",
    target: '[data-onboarding-target="widgets-entry"]',
  },
  {
    id: "final",
    view: "timer",
    title: "You're all set",
    body: "Make your first solve, or explore Settings for shortcuts, theme and smart cube.",
  },
];
