import type { LucideIcon } from "lucide-react";
import { Timer, BarChart3, Puzzle, Grid3x3, BookOpen, Target, Network, FileSearch } from "lucide-react";

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
export type ViewId =
  | "timer"
  | "insights"
  | "algorithms"
  | "training"
  | "skill-tree"
  | "profile"
  | "reconstructions";

/**
 * A nav item that maps to a stage view (ViewId) or triggers a dialog
 * (e.g. "widgets"). Items whose id is not a ViewId are handled as
 * actions in LeftSidebar rather than stage navigation.
 */
export interface NavItem {
  id: ViewId | "widgets";
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Nav rail sections. "Main" holds the live stage (timer + 3D cube);
 * "Insights" holds the unified stats + analysis dashboard that takes over
 * the stage (sidebar of solves + overview / per-solve analysis).
 * "Explore" holds discovery surfaces like the Widgets panel.
 *
 * Profile lives in the sidebar FOOTER (next to Settings) — its item shows
 * the user's avatar/CubeMark instead of a generic icon (see LeftSidebar).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { id: "timer", label: "Timer", icon: Timer },
    ],
  },
  {
    title: "Training",
    items: [
      { id: "training", label: "Training", icon: Target },
      { id: "algorithms", label: "Algorithms", icon: BookOpen },
      { id: "skill-tree", label: "Skills", icon: Network },
    ],
  },
  {
    title: "Progress",
    items: [
      { id: "insights", label: "Stats", icon: BarChart3 },
    ],
  },
  {
    title: "Explore",
    items: [
      { id: "reconstructions", label: "Reconstructions", icon: FileSearch },
      { id: "widgets", label: "Widgets", icon: Puzzle },
    ],
  },
];

// Re-exported so Layout consumers don't need a second lucide import just for
// the brand mark.
export { Grid3x3 };
