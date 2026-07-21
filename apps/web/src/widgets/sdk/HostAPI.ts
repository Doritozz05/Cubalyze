"use client";

import type { Solve } from "@/types";
import type { WidgetHostAPI } from "./types";

// ── Dependencies ─────────────────────────────────────────────────────────

export interface HostAPIDependencies {
  solves: readonly Solve[];
  method: string;
  theme: "light" | "dark" | "system";
  onNavigate: (view: "timer" | "insights") => void;
}

// ── Implementation ───────────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void;

/**
 * Concrete implementation of WidgetHostAPI.
 * Each widget instance gets its own HostAPI so event subscriptions
 * are scoped per widget and auto-cleaned on deactivation.
 */
export function createHostAPI(deps: HostAPIDependencies): WidgetHostAPI {
  const listeners = new Map<string, Set<EventHandler>>();

  const on = (event: string, handler: EventHandler): (() => void) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
    return () => {
      listeners.get(event)?.delete(handler);
    };
  };

  const api = {
    solves: deps.solves,

    preferences: {
      method: deps.method,
      theme: deps.theme,
    },

    // Use type assertion to satisfy the overloaded signatures
    on: on as WidgetHostAPI["on"],

    log(level: "info" | "warn" | "error", message: string): void {
      const prefix = "[Widget]";
      switch (level) {
        case "info":
          console.info(prefix, message);
          break;
        case "warn":
          console.warn(prefix, message);
          break;
        case "error":
          console.error(prefix, message);
          break;
      }
    },

    navigateTo(view: "timer" | "insights"): void {
      deps.onNavigate(view);
    },
  } as WidgetHostAPI;

  return api;

  return api;
}
