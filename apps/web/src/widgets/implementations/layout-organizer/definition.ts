import { LayoutGrid } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const layoutOrganizerDefinition: WidgetDefinition = {
  id: "layout-organizer",
  name: "Layouts",
  description:
    "Instantly arrange all your floating widgets into a professional layout. Generates dynamic presets based on your active widgets and screen size.",
  icon: LayoutGrid,
  category: "visual",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: true,
  defaultPosition: { x: 80, y: 100 },
  tags: ["layout", "organize", "arrange", "position", "grid", "workspace"],
};
