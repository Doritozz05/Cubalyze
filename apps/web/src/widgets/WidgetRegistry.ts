import type { ComponentType } from "react";
import type { WidgetId } from "./types";

// ── Types ────────────────────────────────────────────────────────────────

/** Props that WidgetHost passes to every widget component. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WidgetComponentProps {
  // Each widget receives its own specific props from WidgetHost.
  // The actual props are spread from the host, typed per widget.
}

/** A widget registration: the React component and its preview. */
export interface WidgetRegistration {
  /** The floating panel component (receives props from WidgetHost). */
  component: ComponentType<Record<string, unknown>>;
  /** Mini preview shown on WidgetCard. */
  preview: ComponentType;
}

// ── Registry ─────────────────────────────────────────────────────────────

const registry = new Map<WidgetId, WidgetRegistration>();

export const WidgetRegistry = {
  /**
   * Register a widget. Called from each widget's index.ts on module load.
   * If a widget with the same ID is already registered, it's overwritten
   * with a console warning in development.
   */
  register(id: WidgetId, registration: WidgetRegistration): void {
    if (registry.has(id) && import.meta.env.DEV) {
      console.warn(`[WidgetRegistry] Widget "${id}" already registered. Overwriting.`);
    }
    registry.set(id, registration);
  },

  /**
   * Get a widget's registration by ID.
   */
  get(id: WidgetId): WidgetRegistration | undefined {
    return registry.get(id);
  },

  /**
   * Check if a widget with the given ID is registered.
   */
  has(id: WidgetId): boolean {
    return registry.has(id);
  },

  /**
   * Returns all registered widget IDs.
   */
  ids(): WidgetId[] {
    return Array.from(registry.keys());
  },
};
