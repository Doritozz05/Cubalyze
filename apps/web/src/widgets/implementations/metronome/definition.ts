import { Activity } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const metronomeDefinition: WidgetDefinition = {
  id: "metronome",
  name: "TPS metronome",
  description:
    "High-precision audio metronome with TPS (Turns Per Second) conversion for fluidity & pacing practice.",
  icon: Activity,
  category: "timer",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 920, y: 72 },
  defaultMinimized: true,
  tags: ["metronome", "tps", "rhythm", "audio", "timer", "pacing", "fluidity"],
};

