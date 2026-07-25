"use client";

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: string;
  /** Small uppercase label shown to the right of the title. */
  eyebrow?: string;
  /** Optional action node (button, link) pushed to the far right. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Section header row: bold title left, uppercase eyebrow right, optional
 * action beyond that. Provides the visual rhythm shared by all analysis
 * and overview sections.
 */
export function SectionHeader({
  title,
  eyebrow,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <h3 className="text-[0.85rem] font-medium text-ink">{title}</h3>
      <div className="flex items-center gap-2">
        {eyebrow ? (
          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
            {eyebrow}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}
