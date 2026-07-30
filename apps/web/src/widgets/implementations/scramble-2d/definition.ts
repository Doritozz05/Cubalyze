import { Grid3x3 } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const scramble2DDefinition: WidgetDefinition = {
  id: "scramble-2d",
  name: "Scramble visualizer",
  description:
    "2D cube net showing the current scramble state. csTimer-style layout with WCA-standard colors.",
  icon: Grid3x3,
  category: "visual",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 24, y: 440 },
  defaultMinimized: true,
  tags: ["scramble", "2d", "net", "visualizer", "cube"],
};
