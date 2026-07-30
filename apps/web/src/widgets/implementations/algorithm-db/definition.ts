import { BookOpen } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const algorithmDbDefinition: WidgetDefinition = {
  id: "algorithm-db",
  name: "Algorithms",
  description:
    "Browse speedcubing algorithms by method and subset with 2D/3D visualizations, setup scrambles, and solution breakdown.",
  icon: BookOpen,
  category: "training",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 380, y: 72 },
  defaultMinimized: true,
  tags: ["algorithms", "cfop", "roux", "pll", "oll", "f2l", "visualization", "library"],
};
