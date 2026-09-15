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
  author: "Cubalyze",
  version: "1.0.0",
  source: "built-in",
  // Off by default: the floating 3D cube launcher is a power-user extra,
  // not part of the clean first-run workspace.
  defaultActive: false,
  defaultPosition: { ...CUBE_BUTTON_SENTINEL },
  tags: ["3d", "launcher", "button", "smart", "cube"],
};
