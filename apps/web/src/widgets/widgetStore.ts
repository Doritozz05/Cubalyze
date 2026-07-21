"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetId, WidgetInstanceState, WidgetDefinition } from "./types";
import { BUILT_IN_WIDGETS } from "./registry";

// ── State shape ──────────────────────────────────────────────────────────

export interface WidgetStoreState {
  /** Per-widget runtime state keyed by widget id. */
  instances: Record<WidgetId, WidgetInstanceState>;
  /** Custom widget definitions registered by the user (persisted). */
  customWidgets: WidgetDefinition[];
}

export interface WidgetStoreActions {
  toggleWidget: (id: WidgetId) => void;
  setMinimized: (id: WidgetId, minimized: boolean) => void;
  setPosition: (id: WidgetId, position: { x: number; y: number }) => void;
  setInstances: (instances: Record<WidgetId, WidgetInstanceState>) => void;
  /** Register a custom widget. Adds to registry + creates instance state. */
  registerCustomWidget: (def: WidgetDefinition) => void;
  /** Remove a custom widget. */
  removeCustomWidget: (id: WidgetId) => void;
}

export type WidgetStore = WidgetStoreState & WidgetStoreActions;

// ── Helpers ──────────────────────────────────────────────────────────────

function buildDefaultInstances(): Record<WidgetId, WidgetInstanceState> {
  const map: Record<WidgetId, WidgetInstanceState> = {};
  for (const w of BUILT_IN_WIDGETS) {
    map[w.id] = {
      visible: w.defaultActive,
      minimized: w.defaultMinimized,
      position: { ...w.defaultPosition },
    };
  }
  return map;
}

// ── Store ────────────────────────────────────────────────────────────────

export const widgetStore = createStore<WidgetStore>()(
  persist(
    (set) => ({
      instances: buildDefaultInstances(),
      customWidgets: [],

      toggleWidget: (id) =>
        set((s) => ({
          instances: {
            ...s.instances,
            [id]: {
              ...s.instances[id],
              visible: !s.instances[id]?.visible,
            },
          },
        })),

      setMinimized: (id, minimized) =>
        set((s) => ({
          instances: {
            ...s.instances,
            [id]: { ...s.instances[id], minimized },
          },
        })),

      setPosition: (id, position) =>
        set((s) => ({
          instances: {
            ...s.instances,
            [id]: { ...s.instances[id], position },
          },
        })),

      setInstances: (instances) => set({ instances }),

      registerCustomWidget: (def) =>
        set((s) => {
          // Don't duplicate
          if (s.customWidgets.some((w) => w.id === def.id)) return s;
          return {
            customWidgets: [...s.customWidgets, def],
            instances: {
              ...s.instances,
              [def.id]: {
                visible: def.defaultActive,
                minimized: def.defaultMinimized,
                position: { ...def.defaultPosition },
              },
            },
          };
        }),

      removeCustomWidget: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.instances;
          return {
            customWidgets: s.customWidgets.filter((w) => w.id !== id),
            instances: rest,
          };
        }),
    }),
    {
      name: "cubeforge:widgets",
      partialize: (state) => ({
        instances: state.instances,
        customWidgets: state.customWidgets,
      }),
    },
  ),
);

// ── React hook ───────────────────────────────────────────────────────────

export function useWidgetStore<U>(selector: (state: WidgetStore) => U): U {
  return useStore(widgetStore, selector);
}
