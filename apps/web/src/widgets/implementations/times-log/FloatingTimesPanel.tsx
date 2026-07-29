"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ListOrdered } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWidgetStore } from "@/widgets/widgetStore";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { TimesList } from "@/components/Stats/TimesList";
import type { Solve } from "@/types";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 380;

export interface FloatingTimesPanelProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear?: () => void;
  onAnalyze?: (solve: Solve) => void;
  onReplay?: (solve: Solve) => void;
  puzzle?: string;
}

/**
 * Floating solve-log panel — always open, draggable, minimizable.
 *
 * - **Desktop**: uses FloatingWidgetWrapper for portal/drag/minimize.
 * - **Mobile**: fixed bottom bar (not draggable). Minimize collapses to header only.
 */
export function FloatingTimesPanel(props: FloatingTimesPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileTimesPanel {...props} />;
  }

  return <DesktopTimesPanel {...props} />;
}

/** Desktop: uses the shared FloatingWidgetWrapper. */
function DesktopTimesPanel({
  solves,
  onUpdate,
  onDelete,
  onClear,
  onAnalyze,
  onReplay,
  puzzle,
}: FloatingTimesPanelProps) {
  const headerActions = (
    <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      {puzzle && (
        <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-brand tracking-wider">
          {puzzle}
        </span>
      )}
      {solves.length > 0 && onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="rounded px-1.5 py-1 text-[0.65rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-dnf"
        >
          Clear
        </button>
      )}
    </div>
  );

  return (
    <FloatingWidgetWrapper
      widgetId="times-log"
      icon={ListOrdered}
      label="Times"
      pillBadge={`${solves.length}`}
      pillBadge2={puzzle}
      panelWidth={PANEL_WIDTH}
      defaultPosition={{ x: 72, y: 120 }}
      headerActions={headerActions}
    >
      <div style={{ height: PANEL_HEIGHT }} className="min-h-0">
        <TimesList
          solves={solves}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAnalyze={onAnalyze}
          onReplay={onReplay}
          hideHeader
          className="h-full"
        />
      </div>
    </FloatingWidgetWrapper>
  );
}

/** Mobile: fixed bottom bar — NOT using the wrapper (different layout). */
function MobileTimesPanel({
  solves,
  onUpdate,
  onDelete,
  onClear,
  onAnalyze,
  onReplay,
  puzzle,
}: FloatingTimesPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => setMounted(true), []);

  // Read visibility from widgetStore so the toggle in WidgetExplorer works on mobile too
  const instance = useWidgetStore(
    useCallback((s) => s.instances["times-log"], []),
  );
  const visible = instance?.visible ?? true;

  if (!mounted || !visible) return null;

  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-xl">
      <div
        className="flex items-center justify-between px-3 py-2 select-none"
        onClick={() => setMinimized((m) => !m)}
      >
        <div className="flex items-center gap-2">
          <ListOrdered className="size-3.5 text-ink-3" />
          <span className="text-xs font-medium text-ink">Times</span>
          {puzzle && (
            <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-brand tracking-wider">
              {puzzle}
            </span>
          )}
          <span className="nums text-[0.6rem] text-ink-3">{solves.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {solves.length > 0 && onClear && !minimized && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="rounded px-1.5 py-1 text-[0.65rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-dnf"
            >
              Clear
            </button>
          )}
          <span className="text-[0.6rem] text-ink-3">
            {minimized ? "▲" : "▼"}
          </span>
        </div>
      </div>
      {!minimized && (
        <div style={{ height: "50vh" }} className="min-h-0">
          <TimesList
            solves={solves}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAnalyze={onAnalyze}
            onReplay={onReplay}
            hideHeader
            className="h-full"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
