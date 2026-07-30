"use client";

import type { LucideIcon } from "lucide-react";

/** Unique widget identifier. */
export type WidgetId = string;

/** Categories for grouping widgets in the explorer sidebar. */
export type WidgetCategoryId = "all" | "visual" | "timer" | "analysis" | "training";

export interface WidgetCategory {
  id: WidgetCategoryId;
  label: string;
}

/** Metadata defining a widget in the registry. */
export interface WidgetDefinition {
  id: WidgetId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Short category tag shown on the card. */
  category: WidgetCategoryId;
  /** Who built this widget. */
  author: string;
  /** Semver. */
  version: string;
  /** Where this widget comes from. */
  source: "built-in" | "community" | "custom";
  /** Whether the widget is visible by default when first-ever loaded. */
  defaultActive: boolean;
  /** Default position for the floating panel (viewport-relative). */
  defaultPosition: { x: number; y: number };
  /** Default minimized state when activated. */
  defaultMinimized: boolean;
  /** Tags for search/filter. */
  tags: string[];
}

/** Widget docking mode. */
export type WidgetDockMode = "floating" | "docked";

/** Runtime state for an active widget instance. */
export interface WidgetInstanceState {
  visible: boolean;
  minimized: boolean;
  position: { x: number; y: number };
  /** Whether the widget is floating freely or anchored in the header dock. */
  dockMode: WidgetDockMode;
  /**
   * Runtime z-index for focus management — NOT persisted.
   * Higher value = rendered on top. Updated by `focusWidget()`.
   */
  zIndex?: number;
}
