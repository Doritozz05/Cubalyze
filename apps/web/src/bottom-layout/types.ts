/**
 * Bottom layout slot model.
 *
 * A template defines SHAPE only: placement (bottom strip | right rail |
 * hidden), slot count and relative widths. CONTENT is free per slot and
 * lives in `SlotContentConfig` (persisted per template+slot):
 *
 * - `stats`: any combination of `BottomLayoutStatId` (averages, records,
 *   session numbers and BPA/WPA projections are all plain stats).
 * - `display`: visual blocks (`scramble-2d`, future charts).
 *
 * No per-slot allow-lists, no bespoke renderers, no floating pills.
 */

/** Stats a stats slot can display. BPA/WPA are plain stats, no toggles. */
export type BottomLayoutStatId =
  | "ao5"
  | "ao12"
  | "ao50"
  | "ao100"
  | "ao500"
  | "ao1000"
  | "mo3"
  | "best"
  | "worst"
  | "mean"
  | "median"
  | "deviation"
  | "iqr"
  | "dnfRate"
  | "count"
  | "sessionTime"
  | "tps"
  | "bpa"
  | "wpa"
  | "bestAo5"
  | "bestAo12"
  | "subX";

/** Visual blocks a display slot can show. */
export type SlotDisplayId =
  | "scramble-2d"
  | "scramble-3d"
  | "sparkline"
  | "histogram"
  | "tps-curve"
  | "phase-distribution"
  | "activity-heatmap"
  | "image";

/** Tools a tools slot can run. */
export type SlotToolId = "cross-solver";

/** Custom image configuration for image display. */
export interface SlotImageConfig {
  url: string;
  fit?: "cover" | "contain" | "fill";
  opacity?: number;
  /** Screen-reader description of the image (empty = decorative fallback). */
  alt?: string;
}

/** Cube faces available for cross solving. */
export type CrossFace = "D" | "U" | "F" | "B" | "L" | "R";

/** Where the template renders. */
export type SlotPlacement = "bottom" | "right";

/** Configurable content of one slot (persisted per template+slot). */
export type SlotContentConfig =
  | { kind: "stats"; stats: BottomLayoutStatId[]; subXThreshold?: number }
  | { kind: "display"; displays: SlotDisplayId[]; imageConfig?: SlotImageConfig }
  | { kind: "tools"; tool: SlotToolId; crossFace?: CrossFace };

/** One named slot inside a slot template. */
export interface SlotDef {
  /** Stable id within the template (e.g. "left", "center"). */
  id: string;
  /** i18n key (timer namespace) for the slot label (e.g. "slotLabelLeft"). */
  labelKey: string;
  /** Optional fallback label if translation is missing. */
  label?: string;
  /** Default content when the user never customized the slot. */
  defaultContent: SlotContentConfig;
}

/** A slot-based layout template: shape only (1–3 slots). */
export interface SlotLayoutDefinition {
  /** Unique template id (`slot-*`). */
  id: string;
  /** i18n key (timer namespace) for the human-readable name. */
  nameKey: string;
  /** i18n key (timer namespace) for the human-readable description. */
  descriptionKey: string;
  /** Where this template renders. */
  placement: SlotPlacement;
  /** 1–3 slots. Weights map 1:1 to slots for bottom placement. */
  slots: SlotDef[];
  /** Optional relative widths per slot (bottom only); defaults to equal. */
  weights?: number[];
}
