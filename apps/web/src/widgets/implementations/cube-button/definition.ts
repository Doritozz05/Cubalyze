import { Cuboid } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const cubeButtonDefinition: WidgetDefinition = {
  id: "cube-button",
  name: "3D Cube",
  description:
    "Floating button to toggle the interactive 3D cube view. Only appears when a Smart Cube is connected.",
  icon: Cuboid,
  category: "visual",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 100, y: 100 },
  defaultMinimized: false,
  tags: ["3d", "launcher", "button", "smart", "cube"],
};
