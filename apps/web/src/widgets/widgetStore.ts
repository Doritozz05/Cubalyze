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
  /** Ordered list of docked widget IDs (first = leftmost in dock). */
  dockOrder: WidgetId[];
}

export interface WidgetStoreActions {
  toggleWidget: (id: WidgetId) => void;
  setMinimized: (id: WidgetId, minimized: boolean) => void;
  setPosition: (id: WidgetId, position: { x: number; y: number }) => void;
  setInstances: (instances: Record<WidgetId, WidgetInstanceState>) => void;
  /** Dock a widget (anchors it to the header). */
  setDockMode: (id: WidgetId, mode: WidgetInstanceState["dockMode"]) => void;
  /** Reorder docked widgets. */
  setDockOrder: (order: WidgetId[]) => void;
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
      dockMode: "floating",
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
      dockOrder: [],

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

      setDockMode: (id, mode) =>
        set((s) => {
          const instance = s.instances[id];
          if (!instance) return s;
          const wasDocked = instance.dockMode === "docked";
          const isDocked = mode === "docked";

          // Update dockOrder when docking/undocking
          let dockOrder = s.dockOrder;
          if (isDocked && !wasDocked) {
            // Add to dock order (append to end)
            dockOrder = [...dockOrder.filter((i) => i !== id), id];
          } else if (!isDocked && wasDocked) {
            // Remove from dock order
            dockOrder = dockOrder.filter((i) => i !== id);
          }

          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: { ...instance, dockMode: mode },
            },
          };
        }),

      setDockOrder: (order) => set({ dockOrder: order }),

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
                dockMode: "floating",
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
      version: 1,
      migrate: (persisted, version) => {
        // v0 → v1: Add dockMode + dockOrder to old persisted data
        if (version === 0) {
          const raw = persisted as Record<string, unknown>;
          const instances = (raw.instances ?? {}) as Record<string, Record<string, unknown>>;
          for (const id of Object.keys(instances)) {
            if (!instances[id].dockMode) {
              instances[id].dockMode = "floating";
            }
          }
          return {
            ...raw,
            instances,
            dockOrder: raw.dockOrder ?? [],
          } as Record<string, unknown>;
        }
        return persisted as Record<string, unknown>;
      },
      partialize: (state) => ({
        instances: state.instances,
        customWidgets: state.customWidgets,
        dockOrder: state.dockOrder,
      }),
    },
  ),
);

// ── React hook ───────────────────────────────────────────────────────────

export function useWidgetStore<U>(selector: (state: WidgetStore) => U): U {
  return useStore(widgetStore, selector);
}
