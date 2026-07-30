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

// ── Widget Status ────────────────────────────────────────────────────────

/**
 * Single-source-of-truth for a widget's visibility/mode.
 *
 * - `"inactive"`  – widget is off. Not in dock, not floating.
 * - `"docked"`    – widget pill shown in the header dock bar.
 * - `"floating"`  – widget rendered as an expanded floating panel.
 * - `"minimized"` – widget rendered as a collapsed floating pill.
 *
 * Replaces the old { visible, dockMode, minimized } trio which allowed
 * contradictory states (e.g., visible=true + dockMode="docked" simultaneously
 * rendered nowhere, causing "ghost" widgets).
 */
export type WidgetStatus = "inactive" | "docked" | "floating" | "minimized";

/** Runtime state for an active widget instance. */
export interface WidgetInstanceState {
  status: WidgetStatus;
  position: { x: number; y: number };
  /**
   * Runtime z-index for focus management — NOT persisted.
   * Higher value = rendered on top. Updated by `focusWidget()`.
   */
  zIndex?: number;
  /**
   * Panel width in px (runtime only, NOT persisted).
   * Written by FloatingWidgetWrapper on mount so other widgets
   * can use accurate sizes for edge snapping.
   */
  panelWidth?: number;
}
