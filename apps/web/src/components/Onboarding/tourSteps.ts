import type { ParseKeys } from "i18next";
import type { ViewId } from "@/components/Layout/sidebar.constants";

export interface TourStep {
  id: string;
  /** View to navigate to before measuring the target. */
  view: ViewId;
  /** Localized title (namespace `onboarding`). */
  titleKey: ParseKeys<"onboarding">;
  /** Localized body (namespace `onboarding`). */
  bodyKey: ParseKeys<"onboarding">;
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
    titleKey: "tour.timerTitle",
    bodyKey: "tour.timerBody",
    target: '[data-onboarding-target="timer"]',
  },
  {
    id: "stats",
    view: "insights",
    titleKey: "tour.statsTitle",
    bodyKey: "tour.statsBody",
    target: '[data-onboarding-target="insights"]',
  },
  {
    id: "algorithms",
    view: "algorithms",
    titleKey: "tour.algorithmsTitle",
    bodyKey: "tour.algorithmsBody",
    target: '[data-onboarding-target="algorithms"]',
  },
  {
    id: "profile",
    view: "profile",
    titleKey: "tour.profileTitle",
    bodyKey: "tour.profileBody",
    target: '[data-onboarding-target="profile"]',
  },
  {
    id: "widgets",
    view: "timer",
    titleKey: "tour.widgetsTitle",
    bodyKey: "tour.widgetsBody",
    target: '[data-onboarding-target="widgets-entry"]',
  },
  {
    id: "final",
    view: "timer",
    titleKey: "tour.finalTitle",
    bodyKey: "tour.finalBody",
  },
];
