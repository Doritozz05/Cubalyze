import { ListOrdered } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const timesLogDefinition: WidgetDefinition = {
  id: "times-log",
  name: "Times",
  description:
    "Floating solve history with penalties, analysis, and quick actions. Minimizable to a compact pill.",
  icon: ListOrdered,
  category: "timer",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 24, y: 72 },
  tags: ["solves", "history", "times", "log", "list"],
};
