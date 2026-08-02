"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetId, WidgetInstanceState, WidgetStatus } from "./types";
import { BUILT_IN_WIDGETS, getWidget } from "./registry";

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
  /** Reset a widget's position back to its definition default (self-heal). */
  resetWidgetPosition: (id: WidgetId) => void;
  /** Set the widget's panel width for accurate snap calculations. */
  setSize: (id: WidgetId, panelWidth: number) => void;
  setInstances: (instances: Record<WidgetId, WidgetInstanceState>) => void;
  /** Reorder docked widgets. */
  setDockOrder: (order: WidgetId[]) => void;
  /** Dock a widget at a specific insertion index (-1 = append to end). */
  dockAt: (id: WidgetId, index: number) => void;
  /** Bring a widget to the top of the z-stack (like clicking a window in a desktop OS). */
  focusWidget: (id: WidgetId) => void;
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

function statusFromPreviousLayout(
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
// Exported so touch UI (e.g. the explorer card toggle) can reuse the rule.
export const NO_DOCK_WIDGETS = new Set(["cube-button"]);

function clampStatus(id: WidgetId, status: WidgetStatus): WidgetStatus {
  if (NO_DOCK_WIDGETS.has(id) && (status === "floating" || status === "minimized")) {
    return "docked";
  }
  return status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWidgetStatus(value: unknown): value is WidgetStatus {
  return value === "inactive"
    || value === "docked"
    || value === "floating"
    || value === "minimized";
}

function safePosition(
  value: unknown,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!isRecord(value)) return { ...fallback };
  const x = value.x;
  const y = value.y;
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y } as { x: number; y: number }
    : { ...fallback };
}
// Widgets must live in a fixed band BELOW the app chrome so they can never
// overlap panels/overlays: LeftSidebar is z-50, Dialogs/Sheets/Settings are
// z-50, header is z-20. The 25-49 band keeps widgets above the header but
// always beneath every z-50 surface.
//
// Ordering between widgets is handled by renormalizing the whole band on
// focus (see focusWidget): the most recently dragged widget is always on
// top, but no widget can ever climb above Z_MAX.
const Z_MIN = 25;
const Z_MAX = 49;

/**
 * Pure persistence migration used by Zustand and regression tests.
 *
 * Existing layouts keep their relative dock order; newly-added built-ins are
 * appended so adding a widget never silently rearranges a user's workspace.
 */
export function migratePersistedWidgetState(
  persisted: unknown,
  oldVersion: number,
): Record<string, unknown> {
  const raw = (persisted ?? {}) as Record<string, unknown>;
  const rawInstances = (raw.instances ?? {}) as Record<string, Record<string, unknown>>;
  const validIds = new Set(BUILT_IN_WIDGETS.map((w) => w.id as string));
  const cleanedInstances: Record<string, Record<string, unknown>> = {};

  for (const [id, rawValue] of Object.entries(rawInstances)) {
    if (!validIds.has(id)) continue;

    const value = isRecord(rawValue) ? rawValue : {};
    const def = BUILT_IN_WIDGETS.find((w) => w.id === id);
    const fallbackPosition = def?.defaultPosition ?? { x: 100, y: 100 };

    // Migrate previous layouts to the current status-based format.
    if (oldVersion < 4) {
      const visible = value.visible === true;
      const dockMode = typeof value.dockMode === "string" ? value.dockMode : "docked";
      const minimized = value.minimized === true;
      const status = statusFromPreviousLayout(visible, dockMode, minimized);
      cleanedInstances[id] = {
        status: clampStatus(id as WidgetId, status),
        position: safePosition(value.position, fallbackPosition),
      };
    } else {
      const status = isWidgetStatus(value.status)
        ? value.status
        : def?.defaultActive ? "docked" : "inactive";
      cleanedInstances[id] = {
        status: clampStatus(id as WidgetId, status),
        position: safePosition(value.position, fallbackPosition),
      };
    }
  }

  // New built-ins must be present even when the persisted instance map
  // predates them.
  for (const w of BUILT_IN_WIDGETS) {
    if (!cleanedInstances[w.id]) {
      cleanedInstances[w.id] = {
        status: w.defaultActive ? "docked" : "inactive",
        position: { ...w.defaultPosition },
      };
    }
  }

  const existingDockOrder = Array.isArray(raw.dockOrder)
    ? (raw.dockOrder as string[])
    : [];
  const builtInOrder = BUILT_IN_WIDGETS.map((w) => w.id as string);
  const combinedOrder = Array.from(
    new Set([...existingDockOrder, ...builtInOrder]),
  ).filter((id) => cleanedInstances[id]);

  // Drop the obsolete `customWidgets` key (URL-import removed for local-first
  // security) so it never leaks back into persisted state.
  const { customWidgets: _staleCustomWidgets, ...rest } = raw;
  return {
    ...rest,
    instances: cleanedInstances,
    dockOrder: combinedOrder,
    customLayouts: (raw.customLayouts as CustomLayout[]) ?? [],
  };
}

// ── Store ────────────────────────────────────────────────────────────────

export const widgetStore = createStore<WidgetStore>()(
  persist(
    (set, get) => ({
      instances: buildDefaultInstances(),
      dockOrder: BUILT_IN_WIDGETS.map((w) => w.id),
      customLayouts: [],

      // ── Toggle: inactive ↔ docked ───────────────────────────────────
      toggleWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          const willBeActive = inst?.status === "inactive";
          const dockOrder =
            willBeActive && !s.dockOrder.includes(id)
              ? [...s.dockOrder, id]
              : s.dockOrder;
          // Deterministic self-heal: re-activating a widget resets its
          // position to the definition default. This guarantees a widget
          // toggled ON again can never reappear off-screen / invisible due
          // to a corrupted persisted position.
          const def = getWidget(id);
          const position = willBeActive && def
            ? { ...def.defaultPosition }
            : inst?.position;
          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: {
                ...inst,
                status: willBeActive ? "docked" : "inactive",
                position,
                // Leaving the floating state — drop the runtime z-index so it
                // starts at the band floor again next time it floats.
                zIndex: undefined,
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

          // When transitioning into docked (e.g. floating → docked), move the
          // widget to the end of the dock order. Otherwise keep dockOrder intact
          // (including the case where it leaves docked → floating/minimized:
          // we keep it in dockOrder so the pill can reappear if it docks again).
          const dockOrder =
            willBeDocked && !wasDocked
              ? [...s.dockOrder.filter((i) => i !== id), id]
              : s.dockOrder;

          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: {
                ...instance,
                status: clamped,
                // Only floating/minimized widgets hold a z-index; clear it
                // when leaving that state so a re-floated widget doesn't
                // reappear on top with a stale value.
                zIndex:
                  clamped === "floating" || clamped === "minimized"
                    ? instance.zIndex
                    : undefined,
              },
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

      resetWidgetPosition: (id) =>
        set((s) => {
          const inst = s.instances[id];
          if (!inst) return s;
          const def = getWidget(id);
          return {
            instances: {
              ...s.instances,
              [id]: {
                ...inst,
                position: def
                  ? { ...def.defaultPosition }
                  : { x: 100, y: 100 },
              },
            },
          };
        }),

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

      // ── Dock at specific index ────────────────────────────────────
      dockAt: (id, index) =>
        set((s) => {
          const instance = s.instances[id];
          if (!instance) return s;
          const clamped = clampStatus(id, "docked");
          // `splice` and `push` mutate the array in-place, so `const` is fine:
          // we never reassign the binding itself. (ESLint's `prefer-const` only
          // detects reassignment via `=`, `+=`, etc., not mutations.)
          const dockOrder = [...s.dockOrder.filter((i) => i !== id)];
          if (index >= 0 && index < dockOrder.length) {
            dockOrder.splice(index, 0, id);
          } else {
            dockOrder.push(id);
          }
          return {
            dockOrder,
            instances: {
              ...s.instances,
              [id]: { ...instance, status: clamped, zIndex: undefined },
            },
          };
        }),

      // ── Focus: bring to top of the z-stack ───────────────────────
      focusWidget: (id) =>
        set((s) => {
          const inst = s.instances[id];
          if (!inst) return s;

          // Current bottom→top order of floating/minimized widgets, derived
          // from their stored z-index (unfocused widgets default to the band
          // floor). Sorting is stable, so ties keep a deterministic order.
          const order = Object.entries(s.instances)
            .filter(
              ([, w]) => w?.status === "floating" || w?.status === "minimized",
            )
            .sort(([, a], [, b]) => (a?.zIndex ?? Z_MIN) - (b?.zIndex ?? Z_MIN))
            .map(([wid]) => wid);

          // Move the focused widget to the top of the stack.
          const stack = [...order.filter((wid) => wid !== id), id];

          // Renormalize the whole stack across the fixed band so the most
          // recently dragged widget is always on top, re-dragging brings it
          // back to top, and no widget can ever climb above Z_MAX (panels,
          // dialogs and the sidebar live at z-50). This also fixes the old
          // counter approach, where every widget saturated at Z_MAX and the
          // drag order was lost.
          const span = Math.max(Z_MAX - Z_MIN, 1);
          const instances = { ...s.instances };
          stack.forEach((wid, i) => {
            const z =
              stack.length <= 1
                ? Z_MIN
                : Math.round(Z_MIN + (i * span) / (stack.length - 1));
            instances[wid] = { ...instances[wid], zIndex: z };
          });

          return { instances };
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
      // v6: custom widgets (URL-import) removed — migrate drops orphaned
      // instances so existing users get them cleaned on next load.
      version: 6,
      migrate: (persisted, oldVersion) =>
        migratePersistedWidgetState(persisted, oldVersion),
      partialize: (state) => ({
        instances: Object.fromEntries(
          Object.entries(state.instances).map(([id, inst]) => [
            id,
            // Strip runtime-only fields before persisting
            (({ zIndex: _z, panelWidth: _pw, ...rest }) => rest)(inst),
          ]),
        ),
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
