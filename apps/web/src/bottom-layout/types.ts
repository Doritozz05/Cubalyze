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
  | "mo3"
  | "best"
  | "worst"
  | "mean"
  | "deviation"
  | "count"
  | "sessionTime"
  | "tps"
  | "bpa"
  | "wpa"
  | "bestAo5"
  | "bestAo12";

/** Visual blocks a display slot can show. */
export type SlotDisplayId = "scramble-2d";

/** Where the template renders. */
export type SlotPlacement = "bottom" | "right";

/** Configurable content of one slot (persisted per template+slot). */
export type SlotContentConfig =
  | { kind: "stats"; stats: BottomLayoutStatId[] }
  | { kind: "display"; displays: SlotDisplayId[] };

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
