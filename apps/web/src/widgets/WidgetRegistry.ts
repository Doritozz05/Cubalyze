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

/** A registration that has not been loaded yet (lazy widgets). */
interface PendingWidgetRegistration {
  loader: () => Promise<WidgetRegistration>;
  promise?: Promise<WidgetRegistration | undefined>;
}

type RegistryEntry = WidgetRegistration | PendingWidgetRegistration;

// ── Registry ─────────────────────────────────────────────────────────────

const registry = new Map<WidgetId, RegistryEntry>();

/**
 * External-store subscribers (React useSyncExternalStore pattern): notified
 * every time a lazy registration resolves, so UI can re-render WITHOUT the
 * setState-in-promise pattern that trips React 19 StrictMode's "Do not call
 * Hooks inside useEffect" check for useSyncExternalStore consumers.
 */
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export const WidgetRegistry = {
  /**
   * Register a widget eagerly. Called from each widget's index.ts on module load.
   * If a widget with the same ID is already registered, it's overwritten
   * with a console warning in development.
   */
  register(id: WidgetId, registration: WidgetRegistration): void {
    registry.set(id, registration);
    notifyListeners();
  },

  /**
   * Register a widget lazily: the component, preview and mapProps are loaded
   * via `loader()` the first time the widget is actually needed (explorer
   * preview or a floating panel). This keeps heavy widget dependencies
   * (e.g. the 3D engine pulled in by the algorithm-db panel) out of the
   * initial bundle. Call {@link ensure} before reading with {@link get}.
   */
  registerLazy(id: WidgetId, loader: () => Promise<WidgetRegistration>): void {
    registry.set(id, { loader });
  },

  /**
   * Resolve a lazy registration (no-op for eager ones). Safe to call
   * multiple times — the loader runs once and the result is cached.
   *
   * NEVER rejects: on load failure it logs the error, keeps the pending
   * entry (so a later call retries the loader) and resolves `undefined`.
   * Callers treat `undefined` as "not available" and render their fallback.
   */
  ensure(id: WidgetId): Promise<WidgetRegistration | undefined> {
    const entry = registry.get(id);
    if (!entry) return Promise.resolve(undefined);
    if ("component" in entry) return Promise.resolve(entry);
    if (!entry.promise) {
      entry.promise = entry
        .loader()
        .then((registration) => {
          registry.set(id, registration);
          notifyListeners();
          return registration;
        })
        .catch((error) => {
          // Keep the pending entry so a later ensure() can retry, and resolve
          // undefined instead of rejecting (callers render their fallback).
          console.error(`[WidgetRegistry] failed to load widget "${id}":`, error);
          entry.promise = undefined;
          return undefined;
        });
    }
    return entry.promise;
  },

  /**
   * Get a widget's registration by ID. Returns undefined for lazy widgets
   * that have not been resolved yet — call {@link ensure} first.
   */
  get(id: WidgetId): WidgetRegistration | undefined {
    const entry = registry.get(id);
    if (entry && "component" in entry) return entry;
    return undefined;
  },

  /**
   * Subscribe to registration changes (external-store pattern). The callback
   * fires whenever a lazy registration resolves. Returns an unsubscribe fn.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
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
