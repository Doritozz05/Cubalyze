"use client";

import {
  Puzzle,
  History,
  Plus,
  Clock,
  User,
  RectangleHorizontal,
  LayoutGrid,
  Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Area definition ────────────────────────────────────────────────────

export interface DockAreaDef {
  /** Unique identifier for this area. */
  id: string;
  /** Icon for the area (shown in edit mode and explorer). */
  icon: LucideIcon;
  /** i18n label key (resolved from "dock" namespace). */
  labelKey: string;
  /** i18n description key (shown in DockExplorer cards). */
  descKey?: string;
  /** Category for the explorer sidebar. */
  category: "core" | "system" | "layout";
  /** Whether this area can be removed in edit mode. */
  removable?: boolean;
}

// ── Built-in areas ─────────────────────────────────────────────────────

/**
 * All areas that can exist in the dock bar.
 * - "core" areas are the default header controls (widgets, manual-solve, session, puzzle)
 * - "system" areas are new additions (clock, profile)
 * - "layout" areas are structural (spacer, separator)
 */
export const DOCK_AREAS: DockAreaDef[] = [
  { id: "widgets", icon: LayoutGrid, labelKey: "widgetsArea", descKey: "desc.widgetsArea", category: "core", removable: false },
  { id: "manual-solve", icon: Plus, labelKey: "manualSolve", descKey: "desc.manualSolve", category: "core" },
  { id: "session", icon: History, labelKey: "sessionArea", descKey: "desc.sessionArea", category: "core" },
  { id: "puzzle", icon: Puzzle, labelKey: "puzzleArea", descKey: "desc.puzzleArea", category: "core" },
  { id: "clock", icon: Clock, labelKey: "clock", descKey: "desc.clock", category: "system" },
  { id: "profile", icon: User, labelKey: "profile", descKey: "desc.profile", category: "system" },
  { id: "spacer", icon: RectangleHorizontal, labelKey: "spacer", descKey: "desc.spacer", category: "layout" },
  { id: "separator", icon: Minus, labelKey: "separator", descKey: "desc.separator", category: "layout" },
];

/** Default order of areas in the dock. */
export const DEFAULT_DOCK_AREA_ORDER = [
  "widgets",
  "manual-solve",
  "session",
  "puzzle",
];

/** Look up a dock area definition by id. */
export function getDockArea(id: string): DockAreaDef | undefined {
  return DOCK_AREAS.find((a) => a.id === id);
}
