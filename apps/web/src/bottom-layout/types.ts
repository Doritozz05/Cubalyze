/**
 * Bottom layout descriptor model.
 *
 * A "bottom layout" is the strip rendered underneath the timer. Templates are
 * declared as data (not imperative JSX) so the settings UI can list them and
 * the timer can render whichever one is selected. Mirrors the widget registry
 * pattern (`apps/web/src/widgets`).
 *
 * A template is a horizontal arrangement of columns; each column is a vertical
 * stack of cells. This supports:
 *   - 1 column (e.g. the session-stats strip: 4 stat cells in a row),
 *   - 2 columns (half/half),
 *   - 3 columns (e.g. stats | scramble | averages).
 */

/** Stats a stat cell can display. */
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
  | "bestAo5"
  | "bestAo12";

/** Content a cell can hold. */
export type BottomLayoutCell =
  | { kind: "stat"; stat: BottomLayoutStatId }
  | { kind: "scramble" }
  | { kind: "scramble-2d" }
  | { kind: "timer" };

/** A vertical stack of cells that occupies one horizontal slot. */
export interface BottomLayoutColumn {
  cells: BottomLayoutCell[];
}

/** Declarative definition of a bottom layout template. */
export interface BottomLayoutDefinition {
  /** Unique template id (kebab-case). */
  id: string;
  /** i18n key (settings namespace) for the human-readable name. */
  nameKey: string;
  /** i18n key (settings namespace) for the human-readable description. */
  descriptionKey: string;
  /** Horizontal column arrangement. */
  columns: BottomLayoutColumn[];
  /** Optional relative widths per column; defaults to equal widths. */
  weights?: number[];
}
