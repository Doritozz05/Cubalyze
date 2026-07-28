import { GitCommitHorizontal } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const solveTimelineDefinition: WidgetDefinition = {
  id: "solve-timeline",
  name: "Solve timeline",
  description:
    "Phase breakdown + pauses of the last solve. Shows the same detailed timeline from Insights right on the timer view without navigating away.",
  icon: GitCommitHorizontal,
  category: "analysis",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 72, y: 120 },
  defaultMinimized: true,
  tags: ["timeline", "phases", "analysis", "pauses", "last-solve"],
};

