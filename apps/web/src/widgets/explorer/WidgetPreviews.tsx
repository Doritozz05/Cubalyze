"use client";

import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetRegistry } from "@/widgets/WidgetRegistry";
import type { WidgetId } from "@/widgets/types";

/* ───────────────────────────────────────────────────────────────────────
 * Widget preview components
 *
 * Each preview is a small, simplified visual representation of a widget.
 * These are shown on the WidgetCard to give users a quick idea of what
 * the widget looks like before enabling it.
 *
 * Previews are resolved dynamically via WidgetRegistry — no switch-case.
 * ─────────────────────────────────────────────────────────────────────── */

interface WidgetPreviewProps {
  widgetId: WidgetId;
  className?: string;
}

/** Renders a miniature preview of a widget's UI via WidgetRegistry. */
export function WidgetPreview({ widgetId, className }: WidgetPreviewProps) {
  const reg = WidgetRegistry.get(widgetId);
  const PreviewComponent = reg?.preview;

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2/50",
        className,
      )}
    >
      {PreviewComponent ? (
        <PreviewComponent />
      ) : (
        <div className="grid size-full place-items-center">
          <Box className="size-6 text-ink-3" />
        </div>
      )}
    </div>
  );
}
