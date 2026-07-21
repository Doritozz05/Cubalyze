"use client";

import { useCallback } from "react";
import { useWidgetStore } from "@/widgets/widgetStore";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

// ── Props ────────────────────────────────────────────────────────────────

export interface WidgetHostProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onAnalyze: (solve: Solve) => void;
  onReplay: (solve: Solve) => void;
  scramble: string;
  smartCubeConnected: boolean;
  cubePanelOpen: boolean;
  onOpenCube: () => void;
  /** Pending analysis from the just-completed live solve (not yet persisted). */
  lastAnalysis?: SolveMetrics | null;
}

// ── Props map: each widget receives only the props it needs ──────────────

function buildWidgetProps(widgetId: string, hostProps: WidgetHostProps): Record<string, unknown> {
  const {
    solves, onUpdate, onDelete, onClear, onAnalyze, onReplay,
    scramble, smartCubeConnected, cubePanelOpen, onOpenCube, lastAnalysis,
  } = hostProps;

  switch (widgetId) {
    case "times-log":
      return { solves, onUpdate, onDelete, onClear, onAnalyze, onReplay };
    case "time-distribution":
      return { solves };
    case "pb-progression":
      return { solves };
    case "solve-timeline":
      return { solves, lastAnalysis };
    case "scramble-2d":
      return { scramble };
    case "cube-button":
      return { onClick: onOpenCube, smartCubeConnected, cubePanelOpen };
    default:
      return hostProps as unknown as Record<string, unknown>;
  }
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Renders all active widgets as floating, portaled panels.
 *
 * Reads the widget store to determine which widgets are visible, then
 * dynamically resolves and mounts each widget's component via WidgetRegistry.
 *
 * New widgets are automatically rendered — no switch-case needed.
 */
export function WidgetHost(hostProps: WidgetHostProps) {
  const instances = useWidgetStore(useCallback((s) => s.instances, []));

  return (
    <>
      {Object.entries(instances).map(([id, state]) => {
        if (!state.visible) return null;

        const reg = WidgetRegistry.get(id);
        if (!reg) {
          if (import.meta.env.DEV) {
            console.warn(`[WidgetHost] Widget "${id}" is visible but not registered in WidgetRegistry`);
          }
          return null;
        }

        const Component = reg.component;
        const widgetProps = buildWidgetProps(id, hostProps);

        return <Component key={id} {...widgetProps} />;
      })}
    </>
  );
}
