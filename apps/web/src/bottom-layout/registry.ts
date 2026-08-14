import type { BottomLayoutDefinition } from "./types";

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
];

/** The template used when the preference is unset or points at an unknown id. */
export const DEFAULT_BOTTOM_LAYOUT_TEMPLATE = BOTTOM_LAYOUT_TEMPLATES[0];

/** Lookup a bottom layout template by id. */
export function getBottomLayoutTemplate(
  id: string | undefined,
): BottomLayoutDefinition | undefined {
  return BOTTOM_LAYOUT_TEMPLATES.find((t) => t.id === id);
}
