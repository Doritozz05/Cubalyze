"use client";

import { useCallback } from "react";
import { useWidgetStore } from "@/widgets/widgetStore";
import { FloatingTimesPanel } from "@/components/Stats/FloatingTimesPanel";
import { FloatingTimeDistribution } from "@/components/Stats/FloatingTimeDistribution";
import { FloatingPbProgression } from "@/components/Stats/FloatingPbProgression";
import { FloatingPhaseTimeline } from "@/components/Stats/FloatingPhaseTimeline";
import { FloatingCube2DPanel } from "@/components/Cube3D/FloatingCube2DPanel";
import { FloatingCubeButton } from "@/components/Cube3D/FloatingCubeButton";
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

/**
 * Renders all active widgets as floating, portaled panels.
 *
 * Reads the widget store to determine which widgets are visible, then
 * mounts the corresponding component with the appropriate props.
 *
 * This replaces the hardcoded floating panel wiring in App.tsx.
 */
export function WidgetHost({
  solves,
  onUpdate,
  onDelete,
  onClear,
  onAnalyze,
  onReplay,
  scramble,
  smartCubeConnected,
  cubePanelOpen,
  onOpenCube,
  lastAnalysis,
}: WidgetHostProps) {
  const instances = useWidgetStore(useCallback((s) => s.instances, []));

  return (
    <>
      {/* Solve Log (FloatingTimesPanel) */}
      {instances["times-log"]?.visible && (
        <FloatingTimesPanel
          solves={solves}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClear={onClear}
          onAnalyze={onAnalyze}
          onReplay={onReplay}
        />
      )}

      {/* Time Distribution (csTimer-style histogram) */}
      {instances["time-distribution"]?.visible && (
        <FloatingTimeDistribution solves={solves} />
      )}

      {/* PB Progression Timeline */}
      {instances["pb-progression"]?.visible && (
        <FloatingPbProgression solves={solves} />
      )}

      {/* Phase Timeline of the last solve */}
      {instances["solve-timeline"]?.visible && (
        <FloatingPhaseTimeline solves={solves} lastAnalysis={lastAnalysis} />
      )}

      {/* Scramble 2D Visualizer */}
      {instances["scramble-2d"]?.visible && (
        <FloatingCube2DPanel scramble={scramble} />
      )}

      {/* 3D Cube Launcher (only when Smart Cube connected and panel closed) */}
      {instances["cube-button"]?.visible && smartCubeConnected && !cubePanelOpen && (
        <FloatingCubeButton onClick={onOpenCube} />
      )}

      {/* Future widgets are added here as registry entries + host cases */}
    </>
  );
}
