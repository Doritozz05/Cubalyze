"use client";

import { SessionStats } from "@/components/Stats/SessionStats";
import type { Solve } from "@/types";
import {
  DEFAULT_BOTTOM_LAYOUT_TEMPLATE,
  getBottomLayoutTemplate,
} from "./registry";

export interface BottomLayoutProps {
  /** Selected template id (preference `bottomLayoutTemplate`). */
  templateId: string;
  solves: Solve[];
  className?: string;
  /** When provided, the layout becomes a shortcut to the full Stats view. */
  onExpand?: () => void;
  /** Filter solves to a specific puzzle type (e.g. '3x3x3', '2x2x2'). */
  puzzleFilter?: string;
}

/**
 * Renders the selected bottom layout template underneath the timer.
 *
 * The template is resolved from the registry; unknown ids fall back to the
 * default template. Today only `session-stats` is implemented — future
 * templates (2-column half/half, 3-column with a central scramble) add a case
 * here (or a generic column renderer driven by the template's `columns`).
 */
export function BottomLayout({
  templateId,
  solves,
  className,
  onExpand,
  puzzleFilter,
}: BottomLayoutProps) {
  const template =
    getBottomLayoutTemplate(templateId) ?? DEFAULT_BOTTOM_LAYOUT_TEMPLATE;

  switch (template.id) {
    case "session-stats":
      return (
        <SessionStats
          solves={solves}
          className={className}
          onExpand={onExpand}
          puzzleFilter={puzzleFilter}
        />
      );
    default:
      // Registered template without a renderer yet.
      return null;
  }
}
