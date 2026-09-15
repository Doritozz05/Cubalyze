import { BarChart3 } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const timeDistributionDefinition: WidgetDefinition = {
  id: "time-distribution",
  name: "Time distribution",
  description:
    "Histogram showing the distribution of your solve times. csTimer-style bins with mean and standard deviation. See your consistency at a glance.",
  icon: BarChart3,
  category: "timer",
  author: "Cubalyze",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 880, y: 72 },
  tags: ["distribution", "histogram", "stats", "consistency", "bar-chart"],
};
