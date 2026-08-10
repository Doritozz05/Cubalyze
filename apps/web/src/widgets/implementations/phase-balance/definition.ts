import { Scale } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const phaseBalanceDefinition: WidgetDefinition = {
  id: "phase-balance",
  name: "Phase balance",
  description:
    "Compare your real CFOP phase distribution with your own recent average, using only comparable solves from the hardened analysis pipeline.",
  icon: Scale,
  category: "analysis",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 420, y: 300 },
  tags: ["phase", "balance", "cfop", "cross", "f2l", "oll", "pll", "analysis"],
};
