import type { LucideIcon } from "lucide-react";
import { Timer, BarChart3, Activity, Grid3x3 } from "lucide-react";

export const COLLAPSED_WIDTH = 56;
export const EXPANDED_WIDTH = 208;
export const HOVER_DELAY = 150;
export const UNHOVER_DELAY = 300;

export const SIDEBAR_MOTION = {
  container: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  label: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  brand: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  indicator: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  panel: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
} as const;

/**
 * Spring used for the active-pill layout animation.
 * Mirrors `SettingsSidebar` so the rail and the settings nav feel identical.
 */
export const ACTIVE_PILL_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 30,
};

/** Views the main stage can show. Driven by the LeftSidebar nav. */
export type ViewId = "timer" | "stats" | "analysis";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Nav rail sections. "Main" holds the live stage (timer + 3D cube);
 * "Insights" holds the post-solve content that takes over the stage.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { id: "timer", label: "Timer", icon: Timer },
    ],
  },
  {
    title: "Insights",
    items: [
      { id: "stats", label: "Stats", icon: BarChart3 },
      { id: "analysis", label: "Analysis", icon: Activity },
    ],
  },
];

// Re-exported so Layout consumers don't need a second lucide import just for
// the brand mark.
export { Grid3x3 };
