"use client";

import type { ComponentType } from "react";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import { FloatingTimesPanel } from "@/components/Stats/FloatingTimesPanel";
import { FloatingTimeDistribution } from "@/components/Stats/FloatingTimeDistribution";
import { FloatingPbProgression } from "@/components/Stats/FloatingPbProgression";
import { FloatingPhaseTimeline } from "@/components/Stats/FloatingPhaseTimeline";
import { FloatingCube2DPanel } from "@/components/Cube3D/FloatingCube2DPanel";
import { FloatingCubeButton } from "@/components/Cube3D/FloatingCubeButton";

// Previews — lifted from the original WidgetPreviews.tsx to preserve visual fidelity
import { TimesLogPreview } from "./previews/TimesLogPreview";
import { Scramble2DPreview } from "./previews/Scramble2DPreview";
import { Cube3DPreview } from "./previews/Cube3DPreview";
import { TimeDistributionPreview } from "./previews/TimeDistributionPreview";
import { PbProgressionPreview } from "./previews/PbProgressionPreview";
import { SolveTimelinePreview } from "./previews/SolveTimelinePreview";

/**
 * Registers all built-in widgets with the WidgetRegistry.
 * Called once on app startup (module-level side-effect).
 */
export function registerAllWidgets(): void {
  WidgetRegistry.register("times-log", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingTimesPanel as ComponentType<any>,
    preview: TimesLogPreview,
  });

  WidgetRegistry.register("time-distribution", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingTimeDistribution as ComponentType<any>,
    preview: TimeDistributionPreview,
  });

  WidgetRegistry.register("pb-progression", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingPbProgression as ComponentType<any>,
    preview: PbProgressionPreview,
  });

  WidgetRegistry.register("solve-timeline", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingPhaseTimeline as ComponentType<any>,
    preview: SolveTimelinePreview,
  });

  WidgetRegistry.register("scramble-2d", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingCube2DPanel as ComponentType<any>,
    preview: Scramble2DPreview,
  });

  WidgetRegistry.register("cube-button", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: FloatingCubeButton as ComponentType<any>,
    preview: Cube3DPreview,
  });
}
