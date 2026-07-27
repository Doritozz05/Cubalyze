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
 * Reads the widget store to determine which widgets are visible, then
 * dynamically resolves and mounts each widget's component via WidgetRegistry.
 *
 * Each widget's `mapProps` function translates WidgetHostProps into the
 * specific props that widget needs — no switch-case required.
 *
 * **Dock mode**: Docked widgets appear as pills in the header WidgetDock.
 * When made visible (via dock pill click), they render here as normal
 * floating panels — positioned just below the header.
 */
function WidgetInstanceItem({ id, hostProps }: { id: string; hostProps: WidgetHostProps }) {
  const state = useWidgetStore((s) => s.instances[id]);
  if (!state?.visible || state.dockMode === "docked") return null;

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
