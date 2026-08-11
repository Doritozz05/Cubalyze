"use client";

import type { ParseKeys } from "i18next";
import type { WidgetCategoryId, WidgetId } from "./types";

/**
 * IDs of the built-in widgets. WidgetDefinition.name/description are data
 * (kept in English in the registry); the visible labels are translated here
 * via ParseKeys<"widgets"> so the explorer, dock and floating headers all
 * render the active locale (same pattern as skillTree CATEGORY_KEY).
 */
export const WIDGET_LABEL_KEY: Record<WidgetId, ParseKeys<"widgets">> = {
  "times-log": "def.timesLog",
  "scramble-2d": "def.scramble2d",
  "cube-button": "def.cubeButton",
  "time-distribution": "def.timeDistribution",
  "pb-progression": "def.pbProgression",
  "solve-timeline": "def.solveTimeline",
  "phase-balance": "def.phaseBalance",
  metronome: "def.metronome",
  notes: "def.notes",
  "algorithm-db": "def.algorithmDb",
  "layout-organizer": "def.layoutOrganizer",
};

export const WIDGET_DESC_KEY: Record<WidgetId, ParseKeys<"widgets">> = {
  "times-log": "def.timesLogDescription",
  "scramble-2d": "def.scramble2dDescription",
  "cube-button": "def.cubeButtonDescription",
  "time-distribution": "def.timeDistributionDescription",
  "pb-progression": "def.pbProgressionDescription",
  "solve-timeline": "def.solveTimelineDescription",
  "phase-balance": "def.phaseBalanceDescription",
  metronome: "def.metronomeDescription",
  notes: "def.notesDescription",
  "algorithm-db": "def.algorithmDbDescription",
  "layout-organizer": "def.layoutOrganizerDescription",
};

/** Category labels for the explorer sidebar + touch select ("All widgets"). */
export const CATEGORY_LABEL_KEY: Record<
  WidgetCategoryId,
  ParseKeys<"widgets">
> = {
  all: "category.all",
  visual: "category.visual",
  timer: "category.timer",
  analysis: "category.analysis",
  training: "category.training",
};

/** Short category tags shown on explorer cards ("All"). */
export const CATEGORY_TAG_KEY: Record<WidgetCategoryId, ParseKeys<"widgets">> =
  {
    all: "tag.all",
    visual: "tag.visual",
    timer: "tag.timer",
    analysis: "tag.analysis",
    training: "tag.training",
  };
