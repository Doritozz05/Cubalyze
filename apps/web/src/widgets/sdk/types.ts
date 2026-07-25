"use client";

import type { ComponentType } from "react";
import type { WidgetId, WidgetDefinition } from "@/widgets/types";
import type { Solve } from "@/types";

// ── Host API ─────────────────────────────────────────────────────────────

/**
 * Public API surface exposed to every widget.
 * This is the ONLY way widgets interact with the host app.
 * Never pass raw Zustand stores or internal state directly.
 */
export interface WidgetHostAPI {
  /** Read-only access to all solves in the current session. */
  readonly solves: readonly Solve[];

  /** Subscribe to host events. Returns an unsubscribe function. */
  on(event: "solve:completed", handler: (solve: Solve) => void): () => void;
  on(event: "session:changed", handler: () => void): () => void;
  on(event: "scramble:new", handler: (scramble: string) => void): () => void;

  /** Log a message through the host's logger. */
  log(level: "info" | "warn" | "error", message: string): void;

  /** Read-only access to user preferences. */
  readonly preferences: {
    readonly method: string;
    readonly theme: "light" | "dark" | "system";
  };

  /** Navigate to a specific app view. */
  navigateTo(view: "timer" | "insights"): void;
}

// ── Plugin Interface ─────────────────────────────────────────────────────

/**
 * Every widget (built-in, community, or custom) must export an object
 * satisfying this interface. Modeled after VS Code's extension activation
 * pattern and Figma's widget API.
 */
export interface WidgetPlugin {
  /** Unique ID matching WidgetDefinition.id. */
  readonly id: WidgetId;

  /** Metadata — mirrors WidgetDefinition from the registry. */
  readonly definition: WidgetDefinition;

  /** Called once when the widget is first activated (toggled ON). */
  activate(api: WidgetHostAPI): void;

  /** Called when the widget is deactivated (toggled OFF). */
  deactivate(): void;

  /** React component for the floating panel body content. */
  readonly component: ComponentType<WidgetPluginProps>;

  /** Optional: mini preview shown on WidgetCard. */
  readonly preview?: ComponentType;
}

/**
 * Props passed to a widget's component at render time.
 * Each widget receives the host API + current panel state.
 */
export interface WidgetPluginProps {
  /** The host API surface for interacting with the app. */
  api: WidgetHostAPI;

  /** Whether the panel is currently minimized. */
  minimized: boolean;

  /** Toggle minimize/expand state. */
  onToggleMinimize: () => void;
}
