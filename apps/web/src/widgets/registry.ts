"use client";

import type { WidgetDefinition, WidgetId, WidgetCategory, WidgetCategoryId } from "./types";
import { timesLogDefinition } from "./implementations/times-log/definition";
import { scramble2DDefinition } from "./implementations/scramble-2d/definition";
import { cubeButtonDefinition } from "./implementations/cube-button/definition";
import { timeDistributionDefinition } from "./implementations/time-distribution/definition";
import { pbProgressionDefinition } from "./implementations/pb-progression/definition";
import { solveTimelineDefinition } from "./implementations/solve-timeline/definition";
import { phaseBalanceDefinition } from "./implementations/phase-balance/definition";
import { metronomeDefinition } from "./implementations/metronome/definition";
import { notesDefinition } from "./implementations/notes/definition";
import { algorithmDbDefinition } from "./implementations/algorithm-db/definition";
import { layoutOrganizerDefinition } from "./implementations/layout-organizer/definition";

export type { WidgetCategory, WidgetCategoryId } from "./types";

/** Available widget categories for the explorer sidebar. */
export const WIDGET_CATEGORIES: WidgetCategory[] = [
  { id: "all", label: "All widgets" },
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
  timesLogDefinition,
  scramble2DDefinition,
  cubeButtonDefinition,
  timeDistributionDefinition,
  pbProgressionDefinition,
  solveTimelineDefinition,
  phaseBalanceDefinition,
  metronomeDefinition,
  notesDefinition,
  algorithmDbDefinition,
  layoutOrganizerDefinition,
];

let _getCustomWidgets: (() => WidgetDefinition[]) | null = null;

/** Set a getter for custom widgets (called by widgetStore after initialization). */
export function setCustomWidgetsGetter(getter: () => WidgetDefinition[]): void {
  _getCustomWidgets = getter;
}

/** All widgets (built-in + registered custom). */
export function getAllWidgets(): WidgetDefinition[] {
  const custom = _getCustomWidgets?.() ?? [];
  return [...BUILT_IN_WIDGETS, ...custom];
}

/** Lookup a widget definition by id (searches built-in + custom). */
export function getWidget(id: WidgetId): WidgetDefinition | undefined {
  return (
    BUILT_IN_WIDGETS.find((w) => w.id === id) ??
    _getCustomWidgets?.().find((w) => w.id === id)
  );
}
