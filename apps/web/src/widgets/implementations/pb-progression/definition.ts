import { TrendingDown } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const pbProgressionDefinition: WidgetDefinition = {
  id: "pb-progression",
  name: "PB progression",
  description:
    "Personal Best timeline showing every PB milestone. Track your improvement journey from first solve to current best.",
  icon: TrendingDown,
  category: "timer",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 880, y: 440 },
  tags: ["pb", "personal-best", "progression", "timeline", "milestones"],
};
