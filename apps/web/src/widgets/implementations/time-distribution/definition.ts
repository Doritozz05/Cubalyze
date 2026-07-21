import { BarChart3 } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const timeDistributionDefinition: WidgetDefinition = {
  id: "time-distribution",
  name: "Time Distribution",
  description:
    "Histogram showing the distribution of your solve times. csTimer-style bins with mean and standard deviation. See your consistency at a glance.",
  icon: BarChart3,
  category: "timer",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 420, y: 120 },
  defaultMinimized: true,
  tags: ["distribution", "histogram", "stats", "consistency", "bar-chart"],
};
