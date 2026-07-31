"use client";

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
  const status = useWidgetStore((s) => s.instances[id]?.status);
  if (EXCLUDED_FROM_HOST.has(id)) return null;
  if (status !== "floating" && status !== "minimized") return null;

  const reg = WidgetRegistry.get(id);
  if (!reg) return null;

  const Component = reg.component;
  const widgetProps = reg.mapProps(hostProps);

  return <Component key={id} {...widgetProps} />;
}

export function WidgetHost(hostProps: WidgetHostProps) {
  const widgetIds = useWidgetStore(
    useShallow((s) => Object.keys(s.instances)),
  );

  return (
    <>
      {widgetIds.map((id) => (
        <WidgetInstanceItem key={id} id={id} hostProps={hostProps} />
      ))}
    </>
  );
}
