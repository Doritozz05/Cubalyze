"use client";

import { widgetStore } from "./widgetStore";
import type { WidgetId } from "./types";

/** Maps old per-widget localStorage keys to their widget IDs. */
const OLD_STORAGE_KEYS: Record<string, WidgetId> = {
  "cubeforge:timesPanelPos": "times-log",
  "cubeforge:timeDistPanelPos": "time-distribution",
  "cubeforge:pbProgPanelPos": "pb-progression",
  "cubeforge:phaseTimelinePanelPos": "solve-timeline",
  "cubeforge:cube2dPanelPos": "scramble-2d",
  "cubeforge:cubeBtnPos": "cube-button",
};

const MIGRATION_FLAG = "cubeforge:widgetPosMigrated";

/**
 * One-time migration: reads old per-widget localStorage positions and
 * writes them into the widgetStore. Also cleans up old keys.
 *
 * Safe to call multiple times — it skips if already migrated.
 */
export function migrateWidgetPositions(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "done") return;

    const store = widgetStore.getState();
    const instances = { ...store.instances };
    let migrated = 0;

    for (const [oldKey, widgetId] of Object.entries(OLD_STORAGE_KEYS)) {
      try {
        const raw = localStorage.getItem(oldKey);
        if (raw) {
          const pos = JSON.parse(raw) as { x: number; y: number };
          if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            instances[widgetId] = {
              ...instances[widgetId],
              position: pos,
            };
            localStorage.removeItem(oldKey);
            migrated++;
          }
        }
      } catch {
        /* corrupt entry — skip */
      }
    }

    if (migrated > 0) {
      store.setInstances(instances);
    }
    localStorage.setItem(MIGRATION_FLAG, "done");
  } catch {
    /* localStorage unavailable — skip migration */
  }
}
