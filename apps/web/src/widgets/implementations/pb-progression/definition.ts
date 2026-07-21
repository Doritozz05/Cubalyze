import { Trophy } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const pbProgressionDefinition: WidgetDefinition = {
  id: "pb-progression",
  name: "PB Progression",
  description:
    "Personal Best timeline showing every PB milestone. Track your improvement journey from first solve to current best.",
  icon: Trophy,
  category: "timer",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 420, y: 380 },
  defaultMinimized: true,
  tags: ["pb", "personal-best", "progression", "timeline", "milestones"],
};
