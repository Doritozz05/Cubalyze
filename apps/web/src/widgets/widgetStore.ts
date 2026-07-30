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
  /** Bring a widget to the top of the z-stack (like clicking a window in a desktop OS). */
  focusWidget: (id: WidgetId) => void;
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
      dockMode: "docked",
    };
  }
  return map;
}

// ── Z-index counter (runtime only, never persisted) ─────────────────────
let _zCounter = 100;

// ── Store ────────────────────────────────────────────────────────────────

export const widgetStore = createStore<WidgetStore>()(
  persist(
    (set) => ({
      instances: buildDefaultInstances(),
      customWidgets: [],
      dockOrder: BUILT_IN_WIDGETS.map((w) => w.id),

      toggleWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          const willBeVisible = !inst?.visible;
          let dockOrder = s.dockOrder;
          if (willBeVisible && !dockOrder.includes(id)) {
            dockOrder = [...dockOrder, id];
          }
          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: {
                ...inst,
                visible: willBeVisible,
                dockMode: willBeVisible ? "docked" : (inst?.dockMode ?? "docked"),
              },
            },
          };
        }),

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

      focusWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          if (!inst) return s;
          _zCounter += 1;
          return {
            instances: {
              ...s.instances,
              [id]: { ...inst, zIndex: _zCounter },
            },
          };
        }),

      registerCustomWidget: (def) =>
        set((s) => {
          // Don't duplicate
          if (s.customWidgets.some((w) => w.id === def.id)) return s;
          return {
            customWidgets: [...s.customWidgets, def],
            dockOrder: [...s.dockOrder, def.id],
            instances: {
              ...s.instances,
              [def.id]: {
                visible: def.defaultActive,
                minimized: def.defaultMinimized,
                position: { ...def.defaultPosition },
                dockMode: "docked",
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
      version: 3,
      migrate: (persisted, oldVersion) => {
        const raw = (persisted ?? {}) as Record<string, unknown>;
        const instances = (raw.instances ?? {}) as Record<string, Record<string, unknown>>;
        const validIds = new Set(BUILT_IN_WIDGETS.map((w) => w.id as string));

        // Filter out obsolete/unregistered widget IDs from localStorage
        const cleanedInstances: Record<string, Record<string, unknown>> = {};
        for (const [id, value] of Object.entries(instances)) {
          const isBuiltIn = validIds.has(id);
          const isCustom = ((raw.customWidgets ?? []) as WidgetDefinition[]).some((w) => w.id === id);
          if (isBuiltIn || isCustom) {
            const def = BUILT_IN_WIDGETS.find((w) => w.id === id);
            // If migrating from version < 3, update default positions & dockMode
            const forceDefaultDock = oldVersion < 3;
            cleanedInstances[id] = {
              ...value,
              dockMode: forceDefaultDock ? "docked" : (value.dockMode ?? "docked"),
              position: forceDefaultDock && def ? { ...def.defaultPosition } : (value.position ?? def?.defaultPosition),
            };
          }
        }

        // Ensure all built-in widgets have instance state
        for (const w of BUILT_IN_WIDGETS) {
          if (!cleanedInstances[w.id]) {
            cleanedInstances[w.id] = {
              visible: w.defaultActive,
              minimized: w.defaultMinimized,
              position: { ...w.defaultPosition },
              dockMode: "docked",
            };
          }
        }

        const builtInOrder = BUILT_IN_WIDGETS.map((w) => w.id as string);
        const existingDockOrder = (raw.dockOrder ?? []) as string[];
        const combinedOrder = Array.from(new Set([...builtInOrder, ...existingDockOrder])).filter(
          (id) => cleanedInstances[id],
        );

        return {
          ...raw,
          instances: cleanedInstances,
          dockOrder: combinedOrder,
        } as Record<string, unknown>;
      },
      partialize: (state) => ({
        instances: Object.fromEntries(
          Object.entries(state.instances).map(([id, inst]) => [
            id,
            // Strip runtime-only fields before persisting
            (({ zIndex: _z, ...rest }) => rest)(inst),
          ]),
        ),
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
