"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetId, WidgetInstanceState } from "./types";
import { BUILT_IN_WIDGETS } from "./registry";

// ── State shape ──────────────────────────────────────────────────────────

export interface WidgetStoreState {
  /** Per-widget runtime state keyed by widget id. */
  instances: Record<WidgetId, WidgetInstanceState>;
}

export interface WidgetStoreActions {
  /** Toggle a widget's visibility on/off. */
  toggleWidget: (id: WidgetId) => void;
  /** Set a widget's minimized state. */
  setMinimized: (id: WidgetId, minimized: boolean) => void;
  /** Update a widget's position (from drag). */
  setPosition: (id: WidgetId, position: { x: number; y: number }) => void;
  /** Batch-set all instances (e.g. hydration). */
  setInstances: (instances: Record<WidgetId, WidgetInstanceState>) => void;
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
    }),
    {
      name: "cubeforge:widgets",
      // Only persist the instances map
      partialize: (state) => ({ instances: state.instances }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as WidgetStoreState)?.instances ?? {};
        const defaults = buildDefaultInstances();
        return {
          ...currentState,
          instances: {
            ...defaults,
            ...persisted,
          },
        };
      },
    },
  ),
);

// ── React hook ───────────────────────────────────────────────────────────

export function useWidgetStore<U>(selector: (state: WidgetStore) => U): U {
  return useStore(widgetStore, selector);
}
