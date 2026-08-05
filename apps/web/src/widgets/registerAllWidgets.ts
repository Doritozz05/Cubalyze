"use client";

import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import type { WidgetHostProps } from "@/widgets/WidgetHostProps";

/**
 * Registers all built-in widgets with the WidgetRegistry.
 *
 * Registration is LAZY: each widget's component, preview and prop mapper are
 * loaded via dynamic import() the first time the widget is actually needed
 * (the explorer's preview card or a floating panel). This keeps heavy widget
 * dependencies — e.g. the 3D engine pulled in by the algorithm-db panel or
 * the country-flag icons used by the notes panel — OUT of the initial bundle.
 *
 * Called once on app startup (module-level side-effect).
 */
export function registerAllWidgets(): void {
  WidgetRegistry.registerLazy("times-log", () =>
    import("@/widgets/implementations/times-log").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingTimesPanel as any,
      preview: m.TimesLogPreview,
      mapProps: ({ solves, onUpdate, onDelete, onClear, onAnalyze, onReplay, puzzle }: WidgetHostProps) => ({
        solves,
        onUpdate,
        onDelete,
        onClear,
        onAnalyze,
        onReplay,
        puzzle,
      }),
    })),
  );

  WidgetRegistry.registerLazy("time-distribution", () =>
    import("@/widgets/implementations/time-distribution").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingTimeDistribution as any,
      preview: m.TimeDistributionPreview,
      mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
    })),
  );

  WidgetRegistry.registerLazy("pb-progression", () =>
    import("@/widgets/implementations/pb-progression").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingPbProgression as any,
      preview: m.PbProgressionPreview,
      mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
    })),
  );

  WidgetRegistry.registerLazy("phase-balance", () =>
    import("@/widgets/implementations/phase-balance").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingPhaseBalance as any,
      preview: m.PhaseBalancePreview,
      mapProps: ({ solves, lastAnalysis }: WidgetHostProps) => ({ solves, lastAnalysis }),
    })),
  );

  WidgetRegistry.registerLazy("solve-timeline", () =>
    import("@/widgets/implementations/solve-timeline").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingPhaseTimeline as any,
      preview: m.SolveTimelinePreview,
      mapProps: ({ solves, lastAnalysis }: WidgetHostProps) => ({ solves, lastAnalysis }),
    })),
  );

  WidgetRegistry.registerLazy("scramble-2d", () =>
    import("@/widgets/implementations/scramble-2d").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingCube2DPanel as any,
      preview: m.Scramble2DPreview,
      mapProps: ({ scramble }: WidgetHostProps) => ({ scramble }),
    })),
  );

  WidgetRegistry.registerLazy("cube-button", () =>
    import("@/widgets/implementations/cube-button").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingCubeButton as any,
      preview: m.Cube3DPreview,
      mapProps: ({ onOpenCube, cubePanelOpen, smartCubeConnected }: WidgetHostProps) => ({
        onClick: onOpenCube,
        cubePanelOpen,
        smartCubeConnected,
      }),
    })),
  );

  WidgetRegistry.registerLazy("metronome", () =>
    import("@/widgets/implementations/metronome").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingMetronomePanel as any,
      preview: m.MetronomePreview,
      mapProps: () => ({}),
    })),
  );

  WidgetRegistry.registerLazy("notes", () =>
    Promise.all([
      import("@/widgets/implementations/notes/FloatingNotesPanel"),
      import("@/widgets/implementations/notes/NotesPreview"),
    ]).then(([panel, preview]) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: panel.FloatingNotesPanel as any,
      preview: preview.NotesPreview,
      mapProps: ({ solves }: WidgetHostProps) => ({ solves }),
    })),
  );

  WidgetRegistry.registerLazy("algorithm-db", () =>
    import("@/widgets/implementations/algorithm-db").then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: m.FloatingAlgorithmDbPanel as any,
      preview: m.AlgorithmDbPreview,
      mapProps: ({ solves, puzzle }: WidgetHostProps) => ({ solves, puzzle }),
    })),
  );

  WidgetRegistry.registerLazy("layout-organizer", () =>
    Promise.all([
      import("@/widgets/implementations/layout-organizer/FloatingLayoutOrganizer"),
      import("@/widgets/implementations/layout-organizer/LayoutOrganizerPreview"),
    ]).then(([panel, preview]) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: panel.FloatingLayoutOrganizer as any,
      preview: preview.LayoutOrganizerPreview,
      mapProps: () => ({}),
    })),
  );
}
