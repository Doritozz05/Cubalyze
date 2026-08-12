"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clock,
  User,
  RectangleHorizontal,
} from "lucide-react";
import type { WidgetId } from "@/widgets/types";
import { getAllWidgets, getWidget } from "@/widgets/registry";

// ── Dock item types ────────────────────────────────────────────────────

export type DockItemKind = "widget" | "clock" | "profile" | "spacer";

export interface DockItemDef {
  /** Unique identifier (e.g. "times-log", "clock", "spacer"). */
  id: string;
  kind: DockItemKind;
  /** Lucide icon for the pill. */
  icon: LucideIcon;
  /** i18n label key (used in the dock explorer cards). */
  labelKey: string;
  /** If kind === "widget", the WidgetId. */
  widgetId?: WidgetId;
  /** Whether this item can be added multiple times (only spacers). */
  repeatable?: boolean;
}

// ── System pieces ──────────────────────────────────────────────────────

const SYSTEM_ITEMS: DockItemDef[] = [
  {
    id: "clock",
    kind: "clock",
    icon: Clock,
    labelKey: "dock.clock",
  },
  {
    id: "profile",
    kind: "profile",
    icon: User,
    labelKey: "dock.profile",
  },
  {
    id: "spacer",
    kind: "spacer",
    icon: RectangleHorizontal,
    labelKey: "dock.spacer",
    repeatable: true,
  },
];

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Returns every dockable item (system pieces + widgets from the registry).
 * Widget items use the widget's own icon and are keyed by their WidgetId.
 */
export function getAllDockItems(): DockItemDef[] {
  const widgets: DockItemDef[] = getAllWidgets().map((w) => ({
    id: w.id,
    kind: "widget" as const,
    icon: w.icon,
    labelKey: `widgets:${w.id}`, // will be resolved via the widget i18n namespace
    widgetId: w.id as WidgetId,
  }));
  return [...SYSTEM_ITEMS, ...widgets];
}

/** Look up a single dock item definition by id. */
export function getDockItem(id: string): DockItemDef | undefined {
  if (id === "clock" || id === "profile" || id === "spacer")
    return SYSTEM_ITEMS.find((s) => s.id === id);
  // Try widget registry
  const w = getWidget(id as WidgetId);
  if (w) {
    return {
      id: w.id,
      kind: "widget",
      icon: w.icon,
      labelKey: `widgets:${w.id}`,
      widgetId: w.id as WidgetId,
    };
  }
  return undefined;
}
