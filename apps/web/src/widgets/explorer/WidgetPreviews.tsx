"use client";

import { useEffect, useSyncExternalStore } from "react";
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
 * Previews are resolved lazily via WidgetRegistry (no switch-case): the
 * first time the explorer opens, each widget's chunk is downloaded. The
 * resolution is observed through an external-store subscription
 * (useSyncExternalStore), so no setState is called from a promise — this
 * is immune to React 19 StrictMode's "Do not call Hooks inside useEffect"
 * check. While a chunk is pending a placeholder is shown.
 * ─────────────────────────────────────────────────────────────────────── */

interface WidgetPreviewProps {
  widgetId: WidgetId;
  className?: string;
}

function PreviewPlaceholder() {
  return (
    <div className="grid size-full place-items-center">
      <Box className="size-6 text-ink-3" />
    </div>
  );
}

function WidgetPreviewContent({ widgetId }: { widgetId: WidgetId }) {
  // Observe the registry as an external store: when ensure() resolves, the
  // registry notifies subscribers and React re-renders this component with
  // the resolved registration — no useState/setState involved.
  const reg = useSyncExternalStore(
    (onChange) => WidgetRegistry.subscribe(onChange),
    () => WidgetRegistry.get(widgetId),
  );

  // Kick off the lazy chunk download (fire-and-forget; the subscription
  // above drives the re-render when it resolves).
  useEffect(() => {
    WidgetRegistry.ensure(widgetId);
  }, [widgetId]);

  const Preview = reg?.preview;

  // Defensive runtime guard: only functions are renderable components. Any
  // other value (an element, undefined, …) falls back to the placeholder
  // instead of crashing React with "Element type is invalid". Log a warning
  // so a broken registration is visible instead of silently hidden.
  const PreviewComponent =
    typeof Preview === "function" ? Preview : undefined;
  if (reg && typeof Preview !== "function") {
    console.warn(`[WidgetRegistry] widget "${widgetId}" resolved a non-function preview`, Preview);
  }

  return PreviewComponent ? <PreviewComponent /> : <PreviewPlaceholder />;
}

export function WidgetPreview({ widgetId, className }: WidgetPreviewProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2/50",
        className,
      )}
    >
      <WidgetPreviewContent widgetId={widgetId} />
    </div>
  );
}
