"use client";

import {
  Puzzle,
  History,
  Plus,
  Clock,
  User,
  Battery,
  RectangleHorizontal,
  LayoutGrid,
  SeparatorVertical,
  Activity,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ParseKeys } from "i18next";

// ── Area definition ────────────────────────────────────────────────────

/** Typed keys of the "dock" i18n namespace (flattened). */
export type DockKey = ParseKeys<"dock">;

export interface DockAreaDef {
  /** Unique identifier for this area. */
  id: string;
  /** Icon for the area (shown in edit mode and explorer). */
  icon: LucideIcon;
  /** i18n label key (resolved from "dock" namespace). */
  labelKey: DockKey;
  /** i18n description key (shown in DockExplorer cards). */
  descKey: DockKey;
  /** Category for the explorer sidebar. */
  category: "core" | "system" | "layout";
  /** Whether this area can be removed in edit mode. */
  removable?: boolean;
  /** Whether multiple instances of this area can exist (spacer, separator). */
  repeatable?: boolean;
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
  { id: "battery", icon: Battery, labelKey: "battery", descKey: "desc.battery", category: "system" },
  { id: "session-stats", icon: Activity, labelKey: "sessionStats", descKey: "desc.sessionStats", category: "system" },
  { id: "session-chart", icon: TrendingUp, labelKey: "sessionChart", descKey: "desc.sessionChart", category: "system" },
  { id: "spacer", icon: RectangleHorizontal, labelKey: "spacer", descKey: "desc.spacer", category: "layout", repeatable: true },
  { id: "separator", icon: SeparatorVertical, labelKey: "separator", descKey: "desc.separator", category: "layout", repeatable: true },
];

/** Default order of areas in the dock. */
export const DEFAULT_DOCK_AREA_ORDER = [
  "widgets",
  "separator-0",
  "spacer-0",
  "session",
  "puzzle",
];

/**
 * Strip the per-instance suffix from a repeatable area id so it can be
 * looked up in DOCK_AREAS ("spacer-2" → "spacer"). Non-repeatable ids pass
 * through unchanged.
 */
export function areaBaseId(id: string): string {
  return id.replace(/-\d+$/, "");
}

/** Look up a dock area definition by id. */
export function getDockArea(id: string): DockAreaDef | undefined {
  return DOCK_AREAS.find((a) => a.id === id);
}
