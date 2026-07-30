"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetId, WidgetInstanceState, WidgetDefinition, WidgetStatus } from "./types";
import { BUILT_IN_WIDGETS } from "./registry";

// ── Custom Layout ────────────────────────────────────────────────────────

export interface CustomLayout {
  id: string;
  name: string;
  /** Snapshot of positions keyed by widget id. */
  positions: Record<WidgetId, { x: number; y: number }>;
  /** Number of floating widgets when this layout was saved. */
  widgetCount: number;
}

// ── State shape ──────────────────────────────────────────────────────────

export interface WidgetStoreState {
  /** Per-widget runtime state keyed by widget id. */
  instances: Record<WidgetId, WidgetInstanceState>;
  /** Custom widget definitions registered by the user (persisted). */
  customWidgets: WidgetDefinition[];
  /** Ordered list of docked widget IDs (first = leftmost in dock). */
  dockOrder: WidgetId[];
  /** Saved custom layouts. */
  customLayouts: CustomLayout[];
}

export interface WidgetStoreActions {
  toggleWidget: (id: WidgetId) => void;
  /** Set a widget's status directly. Use this instead of the old setDockMode + setMinimized. */
  setStatus: (id: WidgetId, status: WidgetStatus) => void;
  setPosition: (id: WidgetId, position: { x: number; y: number }) => void;
  /** Set the widget's panel width for accurate snap calculations. */
  setSize: (id: WidgetId, panelWidth: number) => void;
  setInstances: (instances: Record<WidgetId, WidgetInstanceState>) => void;
  /** Reorder docked widgets. */
  setDockOrder: (order: WidgetId[]) => void;
  /** Bring a widget to the top of the z-stack (like clicking a window in a desktop OS). */
  focusWidget: (id: WidgetId) => void;
  /** Register a custom widget. Adds to registry + creates instance state. */
  registerCustomWidget: (def: WidgetDefinition) => void;
  /** Remove a custom widget. */
  removeCustomWidget: (id: WidgetId) => void;
  /** Save current floating widget positions as a named layout. */
  saveCustomLayout: (name: string) => void;
  /** Delete a custom layout by id. */
  deleteCustomLayout: (layoutId: string) => void;
}

export type WidgetStore = WidgetStoreState & WidgetStoreActions;

// ── Helpers ──────────────────────────────────────────────────────────────

function buildDefaultInstances(): Record<WidgetId, WidgetInstanceState> {
  const map: Record<WidgetId, WidgetInstanceState> = {};
  for (const w of BUILT_IN_WIDGETS) {
    map[w.id] = {
      status: w.defaultActive ? "docked" : "inactive",
      position: { ...w.defaultPosition },
    };
  }
  return map;
}

function statusFromLegacy(
  visible: boolean,
  dockMode: string | undefined,
  minimized: boolean,
): WidgetStatus {
  if (!visible) return "inactive";
  if (dockMode === "floating") return minimized ? "minimized" : "floating";
  return "docked";
}

// Widgets that are NOT part of the dock system. They use their own
// rendering (e.g., cube-button is a standalone circular launcher).
const NO_DOCK_WIDGETS = new Set(["cube-button"]);

function clampStatus(id: WidgetId, status: WidgetStatus): WidgetStatus {
  if (NO_DOCK_WIDGETS.has(id) && (status === "floating" || status === "minimized")) {
    return "docked";
  }
  return status;
}
// Must stay below LeftSidebar (z-50) and Dialog overlays (z-50).
// Header is z-20, so widgets live in the 21-49 band.
const Z_MIN = 25;
const Z_MAX = 49;
let _zCounter = Z_MIN;

// ── Store ────────────────────────────────────────────────────────────────

export const widgetStore = createStore<WidgetStore>()(
  persist(
    (set, get) => ({
      instances: buildDefaultInstances(),
      customWidgets: [],
      dockOrder: BUILT_IN_WIDGETS.map((w) => w.id),
      customLayouts: [],

      // ── Toggle: inactive ↔ docked ───────────────────────────────────
      toggleWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          const willBeActive = inst?.status === "inactive";
          let dockOrder = s.dockOrder;
          if (willBeActive && !dockOrder.includes(id)) {
            dockOrder = [...dockOrder, id];
          }
          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: {
                ...inst,
                status: willBeActive ? "docked" : "inactive",
              },
            },
          };
        }),

      // ── Set status directly ─────────────────────────────────────────
      setStatus: (id, status) =>
        set((s) => {
          const instance = s.instances[id];
          if (!instance) return s;

          // Clamp: no-dock widgets can never be floating/minimized
          const clamped = clampStatus(id, status);

          const wasDocked = instance.status === "docked";
          const willBeDocked = clamped === "docked";

          let dockOrder = s.dockOrder;
          if (willBeDocked && !wasDocked) {
            dockOrder = [...dockOrder.filter((i) => i !== id), id];
          } else if (!willBeDocked && wasDocked) {
            // When leaving docked state (to floating/minimized), keep in dockOrder
            // so the pill can reappear if status goes back to docked
          }

          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: { ...instance, status: clamped },
            },
          };
        }),

      setPosition: (id, position) =>
        set((s) => ({
          instances: {
            ...s.instances,
            [id]: { ...s.instances[id], position },
          },
        })),

      setSize: (id, panelWidth) =>
        set((s) => ({
          instances: {
            ...s.instances,
            [id]: { ...s.instances[id], panelWidth },
          },
        })),

      setInstances: (instances) =>
        set({
          instances: Object.fromEntries(
            Object.entries(instances).map(([id, inst]) => [
              id,
              inst ? { ...inst, status: clampStatus(id, inst.status) } : inst,
            ]),
          ),
        }),

      setDockOrder: (order) => set({ dockOrder: order }),

      focusWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          if (!inst) return s;
          _zCounter += 1;
          // Cap at Z_MAX to prevent widgets from appearing above modals/sidebar
          const z = Math.min(_zCounter, Z_MAX);
          return {
            instances: {
              ...s.instances,
              [id]: { ...inst, zIndex: z },
            },
          };
        }),

      registerCustomWidget: (def) =>
        set((s) => {
          if (s.customWidgets.some((w) => w.id === def.id)) return s;
          return {
            customWidgets: [...s.customWidgets, def],
            dockOrder: [...s.dockOrder, def.id],
            instances: {
              ...s.instances,
              [def.id]: {
                status: def.defaultActive ? "docked" : "inactive",
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
            dockOrder: s.dockOrder.filter((i) => i !== id),
            instances: rest,
          };
        }),

      // ── Custom layouts ──────────────────────────────────────────────
      saveCustomLayout: (name) => {
        const state = get();
        const floatingEntries = Object.entries(state.instances)
          .filter(([, inst]) => inst?.status === "floating" || inst?.status === "minimized")
          .filter(([id]) => id !== "layout-organizer");

        if (floatingEntries.length === 0) return;

        const positions: Record<WidgetId, { x: number; y: number }> = {};
        for (const [id, inst] of floatingEntries) {
          positions[id] = { ...inst.position };
        }

        const layout: CustomLayout = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim() || `Layout ${state.customLayouts.length + 1}`,
          positions,
          widgetCount: floatingEntries.length,
        };

        set({ customLayouts: [...state.customLayouts, layout] });
      },

      deleteCustomLayout: (layoutId) =>
        set((s) => ({
          customLayouts: s.customLayouts.filter((l) => l.id !== layoutId),
        })),
    }),
    {
      name: "cubeforge:widgets",
      version: 4,
      migrate: (persisted, oldVersion) => {
        const raw = (persisted ?? {}) as Record<string, unknown>;
        const rawInstances = (raw.instances ?? {}) as Record<string, Record<string, unknown>>;
        const validIds = new Set(BUILT_IN_WIDGETS.map((w) => w.id as string));

        const cleanedInstances: Record<string, Record<string, unknown>> = {};

        for (const [id, value] of Object.entries(rawInstances)) {
          const isBuiltIn = validIds.has(id);
          const isCustom = ((raw.customWidgets ?? []) as WidgetDefinition[]).some(
            (w) => w.id === id,
          );
          if (!isBuiltIn && !isCustom) continue;

          // Migrate from v3 (visible + dockMode + minimized) → v4 (status)
          if (oldVersion < 4) {
            const visible = (value.visible as boolean) ?? false;
            const dockMode = (value.dockMode as string) ?? "docked";
            const minimized = (value.minimized as boolean) ?? false;
            const status = statusFromLegacy(visible, dockMode, minimized);

            // Clamp no-dock widgets
            const clamped = clampStatus(id as WidgetId, status as WidgetStatus);

            // Ensure position is valid — use definition default if missing
            const def = BUILT_IN_WIDGETS.find((w) => w.id === id);
            const position =
              value.position &&
              typeof (value.position as Record<string, unknown>).x === "number" &&
              typeof (value.position as Record<string, unknown>).y === "number"
                ? value.position
                : def
                  ? { ...def.defaultPosition }
                  : { x: 100, y: 100 };

            cleanedInstances[id] = {
              status: clamped,
              position,
            };
          } else {
            // v4+ — ensure status exists
            const def = BUILT_IN_WIDGETS.find((w) => w.id === id);
            cleanedInstances[id] = {
              status: (value.status as string) ?? (def?.defaultActive ? "docked" : "inactive"),
              position:
                value.position ??
                (def ? { ...def.defaultPosition } : { x: 100, y: 100 }),
            };
          }
        }

        // Ensure all built-in widgets have instance state
        for (const w of BUILT_IN_WIDGETS) {
          if (!cleanedInstances[w.id]) {
            cleanedInstances[w.id] = {
              status: w.defaultActive ? "docked" : "inactive",
              position: { ...w.defaultPosition },
            };
          }
        }

        const builtInOrder = BUILT_IN_WIDGETS.map((w) => w.id as string);
        const existingDockOrder = (raw.dockOrder ?? []) as string[];
        const combinedOrder = Array.from(
          new Set([...builtInOrder, ...existingDockOrder]),
        ).filter((id) => cleanedInstances[id]);

        // Migrate customLayouts if present
        const customLayouts = (raw.customLayouts as CustomLayout[]) ?? [];

        return {
          ...raw,
          instances: cleanedInstances,
          dockOrder: combinedOrder,
          customLayouts,
        } as Record<string, unknown>;
      },
      partialize: (state) => ({
        instances: Object.fromEntries(
          Object.entries(state.instances).map(([id, inst]) => [
            id,
            // Strip runtime-only fields before persisting
            (({ zIndex: _z, panelWidth: _pw, ...rest }) => rest)(inst),
          ]),
        ),
        customWidgets: state.customWidgets,
        dockOrder: state.dockOrder,
        customLayouts: state.customLayouts,
      }),
    },
  ),
);

// ── React hook ───────────────────────────────────────────────────────────

export function useWidgetStore<U>(selector: (state: WidgetStore) => U): U {
  return useStore(widgetStore, selector);
}
