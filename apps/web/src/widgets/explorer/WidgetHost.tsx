"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWidgetStore } from "@/widgets/widgetStore";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import type { WidgetHostProps } from "@/widgets/WidgetHostProps";

export type { WidgetHostProps };

// ── Component ────────────────────────────────────────────────────────────

/**
 * Renders all active widgets as floating, portaled panels.
 *
 * Reads the widget store to determine which widgets are active, then
 * dynamically resolves and mounts each widget's component via WidgetRegistry.
 *
 * Each widget's `mapProps` function translates WidgetHostProps into the
 * specific props that widget needs — no switch-case required.
 *
 * Renders widgets whose status is `"floating"` or `"minimized"`.
 * Docked/inactive widgets are handled by WidgetDock or not shown at all.
 */
/** Widgets that are never rendered by WidgetHost (handled elsewhere). */
const EXCLUDED_FROM_HOST = new Set(["cube-button"]);

function WidgetInstanceItem({ id, hostProps }: { id: string; hostProps: WidgetHostProps }) {
  // Observe the registry as an external store: when the lazy chunk resolves
  // the registry notifies subscribers and React re-renders with the resolved
  // registration — no setState-in-.then() (immune to React 19 StrictMode).
  const reg = useSyncExternalStore(
    (onChange) => WidgetRegistry.subscribe(onChange),
    () => WidgetRegistry.get(id),
  );

  // Kick off the chunk download (fire-and-forget; the subscription above
  // drives the re-render). Only floating/minimized widgets are mounted, so
  // docked/inactive widgets never load their chunk at startup.
  useEffect(() => {
    WidgetRegistry.ensure(id);
  }, [id]);

  if (!reg) return null; // unregistered or failed to load — stays hidden

  // Defensive runtime guard: only functions are renderable components. Log a
  // warning so a broken registration is visible instead of silently hidden.
  const Component = reg.component;
  if (typeof Component !== "function") {
    console.warn(`[WidgetRegistry] widget "${id}" resolved a non-function component`, Component);
    return null;
  }

  const widgetProps = reg.mapProps(hostProps);
  return <Component key={id} {...widgetProps} />;
}

export function WidgetHost(hostProps: WidgetHostProps) {
  // Only mount widgets that are actually visible as floating panels —
  // docked/inactive (and excluded) widgets never load their lazy chunk.
  const activeWidgetIds = useWidgetStore(
    useShallow((s) =>
      Object.entries(s.instances)
        .filter(
          ([id, inst]) =>
            !EXCLUDED_FROM_HOST.has(id) &&
            (inst?.status === "floating" || inst?.status === "minimized"),
        )
        .map(([id]) => id),
    ),
  );

  return (
    <>
      {activeWidgetIds.map((id) => (
        <WidgetInstanceItem key={id} id={id} hostProps={hostProps} />
      ))}
    </>
  );
}
