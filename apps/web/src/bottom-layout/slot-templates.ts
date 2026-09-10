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
    id: "slot-hero-left",
    nameKey: "slotHeroLeft",
    descriptionKey: "slotHeroLeftHint",
    placement: "bottom",
    weights: [2, 1],
    slots: [
      {
        id: "main",
        labelKey: "slotLabelMain",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
      {
        id: "side",
        labelKey: "slotLabelSide",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
    ],
  },
  {
    id: "slot-split",
    nameKey: "slotSplit",
    descriptionKey: "slotSplitHint",
    placement: "bottom",
    weights: [1, 1],
    slots: [
      {
        id: "left",
        labelKey: "slotLabelLeft",
        label: "Izquierda",
        defaultContent: { kind: "stats", stats: ["best", "worst", "mean", "deviation"] },
      },
      {
        id: "right",
        labelKey: "slotLabelRight",
        label: "Derecha",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-trio",
    nameKey: "slotTrio",
    descriptionKey: "slotTrioHint",
    placement: "bottom",
    weights: [1, 1, 1],
    slots: [
      {
        id: "left",
        labelKey: "slotLabelLeft",
        label: "Izquierda",
        defaultContent: { kind: "stats", stats: ["mo3", "mean", "deviation"] },
      },
      {
        id: "center",
        labelKey: "slotLabelCenter",
        label: "Centro",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "right",
        labelKey: "slotLabelRight",
        label: "Derecha",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-solo",
    nameKey: "slotSolo",
    descriptionKey: "slotSoloHint",
    placement: "bottom",
    slots: [
      {
        id: "slot",
        labelKey: "slotLabelSlot",
        label: "Slot",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
    ],
  },
  {
    id: "slot-hero-right",
    nameKey: "slotHeroRight",
    descriptionKey: "slotHeroRightHint",
    placement: "bottom",
    weights: [1, 2],
    slots: [
      {
        id: "side",
        labelKey: "slotLabelSide",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "main",
        labelKey: "slotLabelMain",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
    ],
  },
  {
    id: "slot-quad",
    nameKey: "slotQuad",
    descriptionKey: "slotQuadHint",
    placement: "bottom",
    weights: [1, 1, 1, 1],
    slots: [
      {
        id: "col1",
        labelKey: "slotLabelCol1",
        label: "Columna 1",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12"] },
      },
      {
        id: "col2",
        labelKey: "slotLabelCol2",
        label: "Columna 2",
        defaultContent: { kind: "stats", stats: ["best", "worst"] },
      },
      {
        id: "col3",
        labelKey: "slotLabelCol3",
        label: "Columna 3",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "col4",
        labelKey: "slotLabelCol4",
        label: "Columna 4",
        defaultContent: { kind: "stats", stats: ["bpa", "wpa"] },
      },
    ],
  },
  {
    id: "slot-wings",
    nameKey: "slotWings",
    descriptionKey: "slotWingsHint",
    placement: "bottom",
    weights: [1, 2, 1],
    slots: [
      {
        id: "leftWing",
        labelKey: "slotLabelLeft",
        label: "Izquierda",
        defaultContent: { kind: "stats", stats: ["mo3", "mean"] },
      },
      {
        id: "centerHero",
        labelKey: "slotLabelCenter",
        label: "Centro",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100"] },
      },
      {
        id: "rightWing",
        labelKey: "slotLabelRight",
        label: "Derecha",
        defaultContent: { kind: "stats", stats: ["bpa", "wpa", "sessionTime"] },
      },
    ],
  },
  {
    id: "slot-hero-pair",
    nameKey: "slotHeroPair",
    descriptionKey: "slotHeroPairHint",
    placement: "bottom",
    weights: [2, 1, 1],
    slots: [
      {
        id: "hero",
        labelKey: "slotLabelMain",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
      {
        id: "session",
        labelKey: "slotLabelSession",
        label: "Sesión",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "proj",
        labelKey: "slotLabelProjection",
        label: "Proyección",
        defaultContent: { kind: "stats", stats: ["bpa", "wpa"] },
      },
    ],
  },
  {
    id: "slot-focus-duo",
    nameKey: "slotFocusDuo",
    descriptionKey: "slotFocusDuoHint",
    placement: "bottom",
    weights: [3, 1],
    slots: [
      {
        id: "wide",
        labelKey: "slotLabelMain",
        label: "Panorámica",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50", "ao100", "best", "mean"] },
      },
      {
        id: "side",
        labelKey: "slotLabelSide",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
    ],
  },
  {
    id: "slot-rail-split",
    nameKey: "slotRailSplit",
    descriptionKey: "slotRailSplitHint",
    placement: "right",
    weights: [1, 1],
    slots: [
      {
        id: "top",
        labelKey: "slotLabelTop",
        label: "Arriba",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
      {
        id: "bottom",
        labelKey: "slotLabelBottom",
        label: "Abajo",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps", "deviation"] },
      },
    ],
  },
  {
    id: "slot-rail-hero",
    nameKey: "slotRailHero",
    descriptionKey: "slotRailHeroHint",
    placement: "right",
    weights: [2, 1],
    slots: [
      {
        id: "main",
        labelKey: "slotLabelMain",
        label: "Principal",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best", "mean"] },
      },
      {
        id: "side",
        labelKey: "slotLabelSide",
        label: "Lateral",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
    ],
  },
  {
    id: "slot-rail-right",
    nameKey: "slotRailRight",
    descriptionKey: "slotRailRightHint",
    placement: "right",
    weights: [1, 1, 1],
    slots: [
      {
        id: "top",
        labelKey: "slotLabelTop",
        label: "Arriba",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "best"] },
      },
      {
        id: "middle",
        labelKey: "slotLabelMiddle",
        label: "Centro",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "bottom",
        labelKey: "slotLabelBottom",
        label: "Abajo",
        defaultContent: { kind: "stats", stats: ["bestAo5", "bestAo12", "mo3"] },
      },
    ],
  },
  {
    id: "slot-rail-quad",
    nameKey: "slotRailQuad",
    descriptionKey: "slotRailQuadHint",
    placement: "right",
    weights: [1, 1, 1, 1],
    slots: [
      {
        id: "averages",
        labelKey: "slotLabelAverages",
        label: "Medias",
        defaultContent: { kind: "stats", stats: ["ao5", "ao12", "ao50"] },
      },
      {
        id: "records",
        labelKey: "slotLabelRecords",
        label: "Récords",
        defaultContent: { kind: "stats", stats: ["best", "bestAo5", "bestAo12"] },
      },
      {
        id: "session",
        labelKey: "slotLabelSession",
        label: "Sesión",
        defaultContent: { kind: "stats", stats: ["count", "sessionTime", "tps"] },
      },
      {
        id: "projection",
        labelKey: "slotLabelProjection",
        label: "Proyección",
        defaultContent: { kind: "stats", stats: ["bpa", "wpa", "mean"] },
      },
    ],
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
