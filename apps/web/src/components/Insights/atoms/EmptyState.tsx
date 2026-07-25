"use client";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Centered empty-state placeholder. Used when a list/panel has no data to
 * show (no solves, no analysis, filters drop everything).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <p className="text-sm text-ink-2">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
