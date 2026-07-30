"use client";

import { widgetStore } from "@/widgets/widgetStore";
import { createHostAPI, type HostAPIDependencies } from "./HostAPI";
import type { WidgetPlugin } from "./types";
import type { WidgetId } from "@/widgets/types";

// ── Lifecycle Manager ────────────────────────────────────────────────────

/**
 * Tracks active widget plugins and their HostAPI instances.
 * When a widget transitions from inactive → any active status,
 * its plugin.activate() is called with a fresh HostAPI.
 * When transitioning to inactive, plugin.deactivate() is called.
 */
class WidgetLifecycleManager {
  private plugins = new Map<WidgetId, WidgetPlugin>();
  private activeApis = new Map<WidgetId, ReturnType<typeof createHostAPI>>();

  /**
   * Register a widget plugin so it can receive lifecycle events.
   */
  register(plugin: WidgetPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Activate a widget: create HostAPI and call plugin.activate().
   */
  activate(widgetId: WidgetId, deps: HostAPIDependencies): void {
    const plugin = this.plugins.get(widgetId);
    if (!plugin) return;

    // Deactivate first if already active (prevents double activation)
    this.deactivate(widgetId);

    const api = createHostAPI(deps);
    this.activeApis.set(widgetId, api);
    plugin.activate(api);
  }

  /**
   * Deactivate a widget: call plugin.deactivate() and clean up.
   */
  deactivate(widgetId: WidgetId): void {
    const plugin = this.plugins.get(widgetId);
    if (!plugin) return;

    plugin.deactivate();
    this.activeApis.delete(widgetId);
  }
}

/** Singleton lifecycle manager. */
export const widgetLifecycle = new WidgetLifecycleManager();

// ── Integration with widgetStore ─────────────────────────────────────────

/**
 * Subscribe to widget status changes and dispatch lifecycle events.
 * Returns an unsubscribe function.
 *
 * Activation: when status transitions from "inactive" → any active status.
 * Deactivation: when status transitions from any active status → "inactive".
 *
 * Uses a ref-based approach to avoid stale closures:
 * the `getDeps` callback is called on each activation to get fresh data.
 */
export function connectWidgetLifecycle(
  getDeps: () => HostAPIDependencies,
): () => void {
  // Track previous status to only react to actual changes
  const prevStatus: Record<WidgetId, string | undefined> = {};

  // Initialize from current store state
  const initialState = widgetStore.getState();
  for (const [id, instance] of Object.entries(initialState.instances)) {
    prevStatus[id] = instance?.status;
  }

  const unsubscribe = widgetStore.subscribe((state) => {
    for (const [id, instance] of Object.entries(state.instances)) {
      const wasInactive = (prevStatus[id] ?? "inactive") === "inactive";
      const isInactive = (instance?.status ?? "inactive") === "inactive";

      if (!isInactive && wasInactive) {
        // Status toggled from inactive → active
        widgetLifecycle.activate(id, getDeps());
      } else if (isInactive && !wasInactive) {
        // Status toggled from active → inactive
        widgetLifecycle.deactivate(id);
      }

      prevStatus[id] = instance?.status ?? "inactive";
    }
  });

  return unsubscribe;
}
