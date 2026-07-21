"use client";

import { useCallback } from "react";
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
export function WidgetHost(hostProps: WidgetHostProps) {
  const instances = useWidgetStore(useCallback((s) => s.instances, []));

  return (
    <>
      {Object.entries(instances).map(([id, state]) => {
        if (!state.visible) return null;
        // Docked widgets render in WidgetDock (header pills), not as floating panels
        if (state.dockMode === "docked") return null;

        const reg = WidgetRegistry.get(id);
        if (!reg) {
          if (import.meta.env.DEV) {
            console.warn(
              `[WidgetHost] Widget "${id}" is visible but not registered in WidgetRegistry`,
            );
          }
          return null;
        }

        const Component = reg.component;
        const widgetProps = reg.mapProps(hostProps);

        return <Component key={id} {...widgetProps} />;
      })}
    </>
  );
}
