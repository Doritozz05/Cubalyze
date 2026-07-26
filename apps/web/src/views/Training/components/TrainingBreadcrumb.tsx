"use client";

import { ArrowLeft } from "lucide-react";

/**
 * A breadcrumb segment in the training navigation chain.
 */
export interface BreadcrumbSegment {
  label: string;
  /** Whether this is the final (current) segment, shown in bold */
  isCurrent?: boolean;
}

export interface TrainingBreadcrumbProps {
  onBack: () => void;
  /** Breadcrumb path segments, from method to current view */
  segments: BreadcrumbSegment[];
  /** Custom label for the back button. Defaults to "Back" */
  backLabel?: string;
}

/**
 * Reusable breadcrumb header for training views.
 *
 * Renders: ← Back › Segment 1 › Segment 2 › Segment 3
 * where the last segment is shown in semibold.
 *
 * Used by: AlgorithmDrillView, AlgorithmRecognizeView,
 * PhaseTrainerView, FullSolveView.
 */
export function TrainingBreadcrumb({
  onBack,
  segments,
  backLabel = "Back",
}: TrainingBreadcrumbProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0"
      >
        <ArrowLeft className="size-3" />
        {backLabel}
      </button>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-3">
          <span className="text-[0.6rem] text-ink-3/50">›</span>
          <span
            className={`text-[0.72rem] text-ink ${
              seg.isCurrent ? "font-semibold" : "font-medium"
            }`}
          >
            {seg.label}
          </span>
        </span>
      ))}
    </div>
  );
}
