import { Box } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

/** Sentinel position: cube-button computes its real position dynamically. */
export const CUBE_BUTTON_SENTINEL = { x: -99999, y: -99999 } as const;

export const cubeButtonDefinition: WidgetDefinition = {
  id: "cube-button",
  name: "3D cube",
  description:
    "Floating button to toggle the interactive 3D cube view. Drag to reposition.",
  icon: Box,
  category: "visual",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { ...CUBE_BUTTON_SENTINEL },
  tags: ["3d", "launcher", "button", "smart", "cube"],
};
