import { Notebook } from "lucide-react";
import type { WidgetDefinition } from "@/widgets/types";

export const notesDefinition: WidgetDefinition = {
  id: "notes",
  name: "Notes",
  description:
    "Quick scratchpad, training goals checklist, and speedcubing notes manager for your practice sessions.",
  icon: Notebook,
  category: "training",
  author: "cubeforge",
  version: "1.0.0",
  source: "built-in",
  defaultActive: false,
  defaultPosition: { x: 880, y: 440 },
  tags: ["notes", "scratchpad", "todos", "goals", "session", "training", "journal"],
};

