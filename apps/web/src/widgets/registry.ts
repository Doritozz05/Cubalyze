"use client";

import {
  ListOrdered,
  BarChart3,
  Box,
  Cuboid,
  type LucideIcon,
} from "lucide-react";
import type { WidgetDefinition, WidgetId, WidgetCategory, WidgetCategoryId } from "./types";

/** Available widget categories for the explorer sidebar. */
export const WIDGET_CATEGORIES: WidgetCategory[] = [
  { id: "all", label: "All Widgets" },
  { id: "visualizers", label: "Visualizers" },
  { id: "timer", label: "Timer" },
  { id: "analysis", label: "Analysis" },
  { id: "training", label: "Training" },
];

/** Maps category IDs to human labels (for card tags). */
export const CATEGORY_LABEL: Record<WidgetCategoryId, string> = {
  all: "All",
  visualizers: "Visualizers",
  timer: "Timer",
  analysis: "Analysis",
  training: "Training",
};

/**
 * ── BUILT-IN WIDGET REGISTRY ─────────────────────────────────────────────
 *
 * Each entry describes a widget available in the Explorer. The `id` must
 * match a case in the WidgetHost render switch so the host knows which
 * component to mount when the widget is active.
 *
 * To add a new built-in widget:
 *   1. Define it here with a unique `id`.
 *   2. Add a case to the WidgetHost switch.
 *   3. (Optional) Create a preview component in WidgetPreviews.
 */
export const BUILT_IN_WIDGETS: WidgetDefinition[] = [
  {
    id: "times-log",
    name: "Solve Log",
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
    icon: Box,
    category: "visualizers",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 72, y: 520 },
    defaultMinimized: true,
    tags: ["scramble", "2d", "net", "visualizer", "cube"],
  },
  {
    id: "cube-3d",
    name: "3D Cube View",
    description: "Interactive 3D Rubik's cube rendered with Three.js/WebGL. Orbit controls, multiple skins, real-time facelet updates.",
    icon: Cuboid,
    category: "visualizers",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: false,
    defaultPosition: { x: 9999, y: 9999 }, // opened via FloatingCubeButton
    defaultMinimized: false,
    tags: ["3d", "cube", "webgl", "three", "render"],
  },
  {
    id: "cube-button",
    name: "3D Cube Launcher",
    description: "Floating button to toggle the 3D cube view. Only appears when a Smart Cube is connected.",
    icon: Cuboid,
    category: "visualizers",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 100, y: 100 },
    defaultMinimized: false,
    tags: ["3d", "launcher", "button", "smart", "cube"],
  },
  {
    id: "session-stats",
    name: "Session Stats",
    description: "Compact Ao5, Ao12, Best, and Mean displayed in a flat row. Click to expand into the full Insights dashboard.",
    icon: BarChart3,
    category: "analysis",
    author: "cubeforge",
    version: "1.0.0",
    source: "built-in",
    defaultActive: true,
    defaultPosition: { x: 72, y: 320 },
    defaultMinimized: false,
    tags: ["stats", "average", "session", "analysis"],
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
