import type { ComponentType } from "react";
import type { WidgetId } from "./types";
import type { WidgetHostProps } from "@/widgets/WidgetHostProps";

// ── Types ────────────────────────────────────────────────────────────────

/** A widget registration: the React component, its preview, and prop mapper. */
export interface WidgetRegistration {
  /** The floating panel component (receives mapped props from WidgetHost). */
  component: ComponentType<Record<string, unknown>>;
  /** Mini preview shown on WidgetCard. */
  preview: ComponentType;
  /** Maps WidgetHostProps → props for this specific widget. Eliminates the old switch-case. */
  mapProps: (hostProps: WidgetHostProps) => Record<string, unknown>;
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
