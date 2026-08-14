"use client";

import type { ReactNode } from "react";
import { SessionStats } from "@/components/Stats/SessionStats";
import type { Solve } from "@/types";
import { GenericBottomLayout } from "./GenericBottomLayout";
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
  /** Injected scramble element rendered by templates with a `scramble` cell. */
  scramble?: ReactNode;
  /** Injected 2D scramble net rendered by templates with a `scramble-2d` cell. */
  scramble2d?: ReactNode;
}

/**
 * Renders the selected bottom layout template underneath the timer.
 *
 * `session-stats` keeps its bespoke renderer (minimize, BPA/WPA pill, expand
 * shortcut). Every other template is rendered data-driven by
 * `GenericBottomLayout` from its column/cell descriptor.
 */
export function BottomLayout({
  templateId,
  solves,
  className,
  onExpand,
  puzzleFilter,
  scramble,
  scramble2d,
}: BottomLayoutProps) {
  const template =
    getBottomLayoutTemplate(templateId) ?? DEFAULT_BOTTOM_LAYOUT_TEMPLATE;

  if (template.id === "session-stats") {
    return (
      <SessionStats
        solves={solves}
        className={className}
        onExpand={onExpand}
        puzzleFilter={puzzleFilter}
      />
    );
  }

  return (
    <GenericBottomLayout
      template={template}
      solves={solves}
      puzzleFilter={puzzleFilter}
      scramble={scramble}
      scramble2d={scramble2d}
      className={className}
    />
  );
}
