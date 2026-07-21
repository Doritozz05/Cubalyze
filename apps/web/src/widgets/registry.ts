"use client";

import {
  ListOrdered,
  Grid3x3,
  Cuboid,
  type LucideIcon,
} from "lucide-react";
import type { WidgetDefinition, WidgetId, WidgetCategory, WidgetCategoryId } from "./types";

/** Available widget categories for the explorer sidebar. */
export const WIDGET_CATEGORIES: WidgetCategory[] = [
  { id: "all", label: "All Widgets" },
  { id: "visual", label: "Visual" },
  { id: "timer", label: "Timer" },
  { id: "analysis", label: "Analysis" },
  { id: "training", label: "Training" },
];

/** Maps category IDs to human labels (for card tags). */
export const CATEGORY_LABEL: Record<WidgetCategoryId, string> = {
  all: "All",
  visual: "Visual",
  timer: "Timer",
  analysis: "Analysis",
  training: "Training",
};

/**
 * ── BUILT-IN WIDGET REGISTRY ─────────────────────────────────────────────
 *
 * Each entry describes a widget available in the Explorer. Widgets are
 * floating, portaled panels the user can toggle on/off from the Explore >
 * Widgets nav.
 *
 * Only true floating-panel widgets belong here. For example, the 3D cube
 * panel itself is NOT a widget — it's a sidebar in MainLayout. The floating
 * button that *opens* it IS a widget (cube-button).
 *
 * To add a new built-in widget:
 *   1. Define it here with a unique `id`.
 *   2. Add a case to the WidgetHost switch.
 *   3. (Optional) Create a preview component in WidgetPreviews.
 */
export const BUILT_IN_WIDGETS: WidgetDefinition[] = [
  {
    id: "times-log",
    name: "Times",
    description: "Floating solve history with penalties, analysis, and quick actions. Minimizable to a compact pill.",
    icon: ListOrdered,
    category: "timer",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 72, y: 120 },
    defaultMinimized: true,
    tags: ["solves", "history", "times", "log", "list"],
  },
  {
    id: "scramble-2d",
    name: "Scramble Visualizer",
    description: "2D cube net showing the current scramble state. csTimer-style layout with WCA-standard colors.",
    icon: Grid3x3,
    category: "visual",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 72, y: 520 },
    defaultMinimized: true,
    tags: ["scramble", "2d", "net", "visualizer", "cube"],
  },
  {
    id: "cube-button",
    name: "3D Cube",
    description: "Floating button to toggle the interactive 3D cube view. Only appears when a Smart Cube is connected.",
    icon: Cuboid,
    category: "visual",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 100, y: 100 },
    defaultMinimized: false,
    tags: ["3d", "launcher", "button", "smart", "cube"],
  },
];

/** All widgets (built-in + future community). */
export function getAllWidgets(): WidgetDefinition[] {
  return [...BUILT_IN_WIDGETS];
}

/** Lookup a widget definition by id. */
export function getWidget(id: WidgetId): WidgetDefinition | undefined {
  return BUILT_IN_WIDGETS.find((w) => w.id === id);
}
