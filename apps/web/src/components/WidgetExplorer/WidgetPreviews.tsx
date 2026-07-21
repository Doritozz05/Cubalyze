"use client";

import { useMemo } from "react";
import { Box, Cuboid, ListOrdered, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetDefinition, WidgetId } from "@/widgets/types";

/* ───────────────────────────────────────────────────────────────────────
 * Widget preview components
 *
 * Each preview is a small, simplified visual representation of a widget.
 * These are shown on the WidgetCard to give users a quick idea of what
 * the widget looks like before enabling it.
 * ─────────────────────────────────────────────────────────────────────── */

function TimesLogPreview() {
  return (
    <div className="flex flex-col gap-[2px] p-1.5">
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-ready" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[18px] rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/15" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[14px] rounded-sm bg-plus2-soft/50" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 w-3/4 rounded-sm bg-ink-3/15" />
      </div>
    </div>
  );
}

function Scramble2DPreview() {
  const S = 4;
  const G = 0.5;
  const FG = 2;
  const FACE = 3 * S + 2 * G;
  const PAD = 2;

  const colors = {
    U: "#ffffff",
    R: "#dc2626",
    F: "#16a34a",
    D: "#eab308",
    L: "#f97316",
    B: "#2563eb",
  };

  const faces: Record<string, [number, number]> = {
    U: [PAD + FACE + FG, PAD],
    L: [PAD, PAD + FACE + FG],
    F: [PAD + FACE + FG, PAD + FACE + FG],
    R: [PAD + 2 * FACE + 2 * FG, PAD + FACE + FG],
    B: [PAD + 3 * FACE + 3 * FG, PAD + FACE + FG],
    D: [PAD + FACE + FG, PAD + 2 * FACE + 2 * FG],
  };

  return (
    <svg viewBox="0 0 56 44" className="size-full">
      <rect width="56" height="44" fill="transparent" rx={2} />
      {Object.entries(faces).map(([face, [fx, fy]]) => {
        const c = colors[face as keyof typeof colors];
        return (
          <g key={face}>
            <rect
              x={fx - 0.5}
              y={fy - 0.5}
              width={FACE + 1}
              height={FACE + 1}
              fill="#111"
              rx={0.4}
            />
            {Array.from({ length: 9 }).map((_, i) => {
              const sr = Math.floor(i / 3);
              const sc = i % 3;
              return (
                <rect
                  key={i}
                  x={fx + sc * (S + G)}
                  y={fy + sr * (S + G)}
                  width={S}
                  height={S}
                  fill={c}
                  rx={0.3}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function Cube3DPreview() {
  return (
    <div className="grid size-full place-items-center">
      <svg viewBox="0 0 24 24" className="size-8 text-ink-2">
        {/* Isometric cube */}
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M12 2v20M2 7l10 5M22 7l-10 5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        <path d="M2 7l10 5M22 7l-10 5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      </svg>
    </div>
  );
}

function SessionStatsPreview() {
  return (
    <div className="grid grid-cols-4 gap-px p-1.5">
      {["Ao5", "Ao12", "Best", "Mean"].map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-0.5 rounded-sm px-0.5 py-1">
          <span className="text-[4px] uppercase tracking-wider text-ink-3">{label}</span>
          <span className={cn(
            "nums h-1.5 w-[80%] rounded-sm",
            i === 2 ? "bg-ready/30" : "bg-ink-3/20",
          )} />
        </div>
      ))}
    </div>
  );
}

/* ── Preview resolver ──────────────────────────────────────────────────── */

interface WidgetPreviewProps {
  widgetId: WidgetId;
  className?: string;
}

/** Renders a miniature preview of a widget's UI. */
export function WidgetPreview({ widgetId, className }: WidgetPreviewProps) {
  const preview = useMemo(() => {
    switch (widgetId) {
      case "times-log":
        return <TimesLogPreview />;
      case "scramble-2d":
        return <Scramble2DPreview />;
      case "cube-3d":
        return <Cube3DPreview />;
      case "cube-button":
        return <Cube3DPreview />;
      case "session-stats":
        return <SessionStatsPreview />;
      default:
        return (
          <div className="grid size-full place-items-center">
            <Box className="size-6 text-ink-3" />
          </div>
        );
    }
  }, [widgetId]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2/50",
        className,
      )}
    >
      {preview}
    </div>
  );
}
