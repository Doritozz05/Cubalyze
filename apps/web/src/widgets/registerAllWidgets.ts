"use client";

import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import type { WidgetHostProps } from "@/widgets/WidgetHostProps";

// Components from implementations/
import { FloatingTimesPanel } from "@/widgets/implementations/times-log/FloatingTimesPanel";
import { FloatingTimeDistribution } from "@/widgets/implementations/time-distribution/FloatingTimeDistribution";
import { FloatingPbProgression } from "@/widgets/implementations/pb-progression/FloatingPbProgression";
import { FloatingPhaseTimeline } from "@/widgets/implementations/solve-timeline/FloatingPhaseTimeline";
import { FloatingCube2DPanel } from "@/widgets/implementations/scramble-2d/FloatingCube2DPanel";
import { FloatingCubeButton } from "@/widgets/implementations/cube-button/FloatingCubeButton";
import { FloatingMetronomePanel } from "@/widgets/implementations/metronome/FloatingMetronomePanel";
import { FloatingNotesPanel } from "@/widgets/implementations/notes/FloatingNotesPanel";
import { FloatingAlgorithmDbPanel } from "@/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel";

// Previews from implementations/
import { TimesLogPreview } from "@/widgets/implementations/times-log/TimesLogPreview";
import { TimeDistributionPreview } from "@/widgets/implementations/time-distribution/TimeDistributionPreview";
import { PbProgressionPreview } from "@/widgets/implementations/pb-progression/PbProgressionPreview";
import { SolveTimelinePreview } from "@/widgets/implementations/solve-timeline/SolveTimelinePreview";
import { Scramble2DPreview } from "@/widgets/implementations/scramble-2d/Scramble2DPreview";
import { Cube3DPreview } from "@/widgets/implementations/cube-button/Cube3DPreview";
import { MetronomePreview } from "@/widgets/implementations/metronome/MetronomePreview";
import { NotesPreview } from "@/widgets/implementations/notes/NotesPreview";
import { AlgorithmDbPreview } from "@/widgets/implementations/algorithm-db/AlgorithmDbPreview";

/**
 * Registers all built-in widgets with the WidgetRegistry.
 * Each widget declares its own `mapProps` — no switch-case in WidgetHost.
 * Called once on app startup (module-level side-effect).
 */
import { widgetStore } from "@/widgets/widgetStore";
import { setCustomWidgetsGetter } from "@/widgets/registry";

// Wire up custom widgets getter at module level (before any component renders)
setCustomWidgetsGetter(() => widgetStore.getState().customWidgets ?? []);

export function registerAllWidgets(): void {
  WidgetRegistry.register("times-log", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingTimesPanel as any,
    preview: TimesLogPreview,
    mapProps: ({ solves, onUpdate, onDelete, onClear, onAnalyze, onReplay, puzzle }: WidgetHostProps) => ({
      solves,
      onUpdate,
      onDelete,
      onClear,
      onAnalyze,
      onReplay,
      puzzle,
    }),
  });

  WidgetRegistry.register("time-distribution", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingTimeDistribution as any,
    preview: TimeDistributionPreview,
    mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
  });

  WidgetRegistry.register("pb-progression", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingPbProgression as any,
    preview: PbProgressionPreview,
    mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
  });

  WidgetRegistry.register("solve-timeline", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingPhaseTimeline as any,
    preview: SolveTimelinePreview,
    mapProps: ({ solves, lastAnalysis }: WidgetHostProps) => ({ solves, lastAnalysis }),
  });

  WidgetRegistry.register("scramble-2d", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingCube2DPanel as any,
    preview: Scramble2DPreview,
    mapProps: ({ scramble }: WidgetHostProps) => ({ scramble }),
  });

  WidgetRegistry.register("cube-button", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingCubeButton as any,
    preview: Cube3DPreview,
    mapProps: ({ onOpenCube, cubePanelOpen, smartCubeConnected }: WidgetHostProps) => ({
      onClick: onOpenCube,
      cubePanelOpen,
      smartCubeConnected,
    }),
  });

  WidgetRegistry.register("metronome", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingMetronomePanel as any,
    preview: MetronomePreview,
    mapProps: () => ({}),
  });

  WidgetRegistry.register("notes", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingNotesPanel as any,
    preview: NotesPreview,
    mapProps: ({ solves }: WidgetHostProps) => ({ solves }),
  });

  WidgetRegistry.register("algorithm-db", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingAlgorithmDbPanel as any,
    preview: AlgorithmDbPreview,
    mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
  });
}
