"use client";

import {
  Puzzle,
  History,
  Plus,
  Clock,
  User,
  RectangleHorizontal,
  LayoutGrid,
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
  /** Category for the explorer sidebar. */
  category: "core" | "widget" | "system" | "layout";
}

// ── Built-in areas ─────────────────────────────────────────────────────

/**
 * All areas that can exist in the dock bar.
 * - "core" areas are the default header controls (widgets, manual-solve, session, puzzle)
 * - "system" areas are new additions (clock, profile)
 * - "layout" areas are structural (spacer)
 */
export const DOCK_AREAS: DockAreaDef[] = [
  { id: "widgets", icon: LayoutGrid, labelKey: "dock.widgetsArea", category: "core" },
  { id: "manual-solve", icon: Plus, labelKey: "dock.manualSolve", category: "core" },
  { id: "session", icon: History, labelKey: "dock.sessionArea", category: "core" },
  { id: "puzzle", icon: Puzzle, labelKey: "dock.puzzleArea", category: "core" },
  { id: "clock", icon: Clock, labelKey: "dock.clock", category: "system" },
  { id: "profile", icon: User, labelKey: "dock.profile", category: "system" },
  { id: "spacer", icon: RectangleHorizontal, labelKey: "dock.spacer", category: "layout" },
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
