import { Box } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const cubeButtonDefinition: WidgetDefinition = {
  id: "cube-button",
  name: "3D cube",
  description:
    "Floating button to toggle the interactive 3D cube view. Only appears when a smart cube is connected.",
  icon: Box,
  category: "visual",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 24, y: 72 },
  defaultMinimized: false,
  tags: ["3d", "launcher", "button", "smart", "cube"],
};

