import type { BottomLayoutCell, BottomLayoutDefinition } from "./types";

/**
 * Built-in bottom layout templates.
 *
 * Only templates with a rendered implementation belong here. To add one:
 *   1. Declare it here with a unique `id` and its column layout.
 *   2. Add a case in `BottomLayout.tsx` that renders the columns.
 *   3. Add the `nameKey`/`descriptionKey` strings to the i18n locales.
 *
 * The first entry is the default template.
 */
export const BOTTOM_LAYOUT_TEMPLATES: BottomLayoutDefinition[] = [
  {
    id: "session-stats",
    // Keys are relative to the `settings` i18n namespace (the template
    // picker lives in Settings → Timer).
    nameKey: "timer.bottomLayoutTemplateSessionStats",
    descriptionKey: "timer.bottomLayoutTemplateSessionStatsHint",
    columns: [
      {
        cells: [
          { kind: "stat", stat: "ao5" },
          { kind: "stat", stat: "ao12" },
          { kind: "stat", stat: "best" },
          { kind: "stat", stat: "mean" },
        ],
      },
    ],
  },
  {
    id: "three-column",
    nameKey: "timer.bottomLayoutTemplateThreeColumn",
    descriptionKey: "timer.bottomLayoutTemplateThreeColumnHint",
    weights: [1, 2, 1],
    columns: [
      {
        cells: [
          { kind: "stat", stat: "deviation" },
          { kind: "stat", stat: "mean" },
          { kind: "stat", stat: "best" },
          { kind: "stat", stat: "count" },
        ],
      },
      {
        cells: [{ kind: "scramble" }],
      },
      {
        cells: [
          { kind: "stat", stat: "ao5" },
          { kind: "stat", stat: "ao12" },
          { kind: "stat", stat: "ao50" },
          { kind: "stat", stat: "ao100" },
        ],
      },
    ],
  },
  {
    id: "three-column-2d",
    nameKey: "timer.bottomLayoutTemplateThreeColumn2d",
    descriptionKey: "timer.bottomLayoutTemplateThreeColumn2dHint",
    weights: [1, 2, 1],
    columns: [
      {
        cells: [
          { kind: "stat", stat: "deviation" },
          { kind: "stat", stat: "mean" },
          { kind: "stat", stat: "best" },
          { kind: "stat", stat: "count" },
        ],
      },
      {
        cells: [{ kind: "scramble-2d" }],
      },
      {
        cells: [
          { kind: "stat", stat: "ao5" },
          { kind: "stat", stat: "ao12" },
          { kind: "stat", stat: "ao50" },
          { kind: "stat", stat: "ao100" },
        ],
      },
    ],
  },
];

/** The template used when the preference is unset or points at an unknown id. */
export const DEFAULT_BOTTOM_LAYOUT_TEMPLATE = BOTTOM_LAYOUT_TEMPLATES[0];

/** Lookup a bottom layout template by id. */
export function getBottomLayoutTemplate(
  id: string | undefined,
): BottomLayoutDefinition | undefined {
  return BOTTOM_LAYOUT_TEMPLATES.find((t) => t.id === id);
}

/** True when any column of the template holds a cell of the given kind. */
export function templateHasCell(
  template: BottomLayoutDefinition,
  kind: BottomLayoutCell["kind"],
): boolean {
  return template.columns.some((col) => col.cells.some((cell) => cell.kind === kind));
}
