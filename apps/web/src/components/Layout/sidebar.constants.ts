import type { LucideIcon } from "lucide-react";
import type { ParseKeys } from "i18next";
import { Timer, BarChart3, Puzzle, Grid3x3, BookOpen, Target, Network, Box, Package } from "lucide-react";
import { FaListOl } from "react-icons/fa";

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
  | "reconstructions"
  | "collection"
  | "cube";

/**
 * A nav item that maps to a stage view (ViewId) or triggers a dialog
 * (e.g. "widgets"). Items whose id is not a ViewId are handled as
 * actions in LeftSidebar rather than stage navigation.
 *
 * `labelKey` is an i18n key in the `nav` namespace — translate at render
 * time with `useTranslation("nav")`, never at module scope.
 */
export interface NavItem {
  id: ViewId | "widgets";
  labelKey: ParseKeys<"nav">;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  /** i18n key (nav namespace) for the group heading. */
  titleKey: ParseKeys<"nav">;
  items: NavItem[];
}

/**
 * Nav rail sections. "Main" holds the live stage (timer + 3D cube);
 * "Progress" holds the unified stats + analysis dashboard (Insights) that
 * takes over the stage (sidebar of solves + overview / per-solve analysis).
 * "Training" holds the practice surfaces (drills, algorithms, skill tree).
 * "Explore" holds discovery surfaces like the Widgets panel.
 *
 * Profile lives in the sidebar FOOTER (next to Settings) — its item shows
 * the user's avatar/CubeMark instead of a generic icon (see LeftSidebar).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "main",
    items: [
      { id: "timer", labelKey: "timer", icon: Timer },
      { id: "cube", labelKey: "virtual", icon: Box },
    ],
  },
  {
    titleKey: "progress",
    items: [
      { id: "insights", labelKey: "stats", icon: BarChart3 },
    ],
  },
  {
    titleKey: "training",
    items: [
      { id: "training", labelKey: "training", icon: Target },
      { id: "algorithms", labelKey: "algorithms", icon: BookOpen },
      { id: "skill-tree", labelKey: "skills", icon: Network },
    ],
  },
  {
    titleKey: "explore",
    items: [
      { id: "collection", labelKey: "locker", icon: Package },
      { id: "reconstructions", labelKey: "reconstructions", icon: FaListOl },
      { id: "widgets", labelKey: "widgets", icon: Puzzle },
    ],
  },
];

// Re-exported so Layout consumers don't need a second lucide import just for
// the brand mark.
export { Grid3x3 };
