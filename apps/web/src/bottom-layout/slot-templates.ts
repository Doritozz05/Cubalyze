import type {
  BottomLayoutStatId,
  SlotContentConfig,
  SlotLayoutDefinition,
} from "./types";

/**
 * Slot templates: SHAPE only. Every slot accepts any content
 * (`stats` | `display`); the template only decides placement, slot count
 * and relative widths.
 */
export const SLOT_LAYOUT_TEMPLATES: SlotLayoutDefinition[] = [
  {
    id: "slot-solo",
    nameKey: "timer.slotSolo",
    descriptionKey: "timer.slotSoloHint",
    placement: "bottom",
    slots: [
      {
        id: "slot",
        label: "Slot",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
    ],
  },
  {
    id: "slot-split",
    nameKey: "timer.slotSplit",
    descriptionKey: "timer.slotSplitHint",
    placement: "bottom",
    weights: [1, 1],
    slots: [
      {
        id: "left",
        label: "Izquierda",
        defaultContent: { kind: "stats", stats: ["best", "worst", "mean", "deviation"] },
      },
      {
        id: "right",
        label: "Derecha",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-hero-left",
    nameKey: "timer.slotHeroLeft",
    descriptionKey: "timer.slotHeroLeftHint",
    placement: "bottom",
    weights: [2, 1],
    slots: [
      {
        id: "main",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
      {
        id: "side",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
    ],
  },
  {
    id: "slot-hero-right",
    nameKey: "timer.slotHeroRight",
    descriptionKey: "timer.slotHeroRightHint",
    placement: "bottom",
    weights: [1, 2],
    slots: [
      {
        id: "side",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "main",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-trio",
    nameKey: "timer.slotTrio",
    descriptionKey: "timer.slotTrioHint",
    placement: "bottom",
    weights: [1, 1, 1.25],
    slots: [
      {
        id: "left",
        label: "Izquierda",
        defaultContent: { kind: "stats", stats: ["mo3", "mean", "deviation"] },
      },
      {
        id: "center",
        label: "Centro",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "right",
        label: "Derecha",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-rail-right",
    nameKey: "timer.slotRailRight",
    descriptionKey: "timer.slotRailRightHint",
    placement: "right",
    slots: [
      {
        id: "top",
        label: "Arriba",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best"] },
      },
      {
        id: "middle",
        label: "Centro",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "bottom",
        label: "Abajo",
        defaultContent: { kind: "stats", stats: ["bestAo5", "bestAo12", "mo3"] },
      },
    ],
  },
  {
    id: "slot-hidden",
    nameKey: "timer.slotHidden",
    descriptionKey: "timer.slotHiddenHint",
    placement: "hidden",
    slots: [],
  },
];

export const DEFAULT_SLOT_TEMPLATE =
  SLOT_LAYOUT_TEMPLATES.find((t) => t.id === "slot-hero-left") ??
  SLOT_LAYOUT_TEMPLATES[0];

export function getSlotTemplate(id: string | undefined): SlotLayoutDefinition | undefined {
  return SLOT_LAYOUT_TEMPLATES.find((t) => t.id === id);
}

/** Storage key for a slot's content config: `<templateId>:<slotId>`. */
export function slotConfigKey(templateId: string, slotId: string): string {
  return `${templateId}:${slotId}`;
}

/**
 * Migrate a persisted slot config (unknown shape) to the current model.
 * Legacy kinds from the prototype phase map to their modern equivalent;
 * anything unrecognized falls back to the slot default — never a crash.
 */
export function migrateSlotConfig(
  raw: unknown,
  fallback: SlotContentConfig,
): SlotContentConfig {
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as { kind?: unknown; stats?: unknown; displays?: unknown };
  if (r.kind === "stats" && Array.isArray(r.stats)) {
    const valid: BottomLayoutStatId[] = (r.stats as unknown[]).filter(
      (s): s is BottomLayoutStatId => typeof s === "string",
    );
    return { kind: "stats", stats: valid };
  }
  if (r.kind === "display" && Array.isArray(r.displays)) {
    return {
      kind: "display",
      displays: (r.displays as unknown[]).includes("scramble-2d")
        ? ["scramble-2d"]
        : [],
    };
  }
  // Prototype kinds.
  if (r.kind === "projection") return { kind: "stats", stats: ["bpa", "wpa"] };
  if (r.kind === "session")
    return { kind: "stats", stats: ["count", "sessionTime", "tps"] };
  if (r.kind === "scramble" || r.kind === "scramble-2d")
    return { kind: "display", displays: ["scramble-2d"] };
  return fallback;
}

/** Resolve a slot's effective content (persisted override or default). */
export function resolveSlotContent(
  store: Record<string, unknown>,
  templateId: string,
  slotId: string,
  fallback: SlotContentConfig,
): SlotContentConfig {
  return migrateSlotConfig(store[slotConfigKey(templateId, slotId)], fallback);
}
