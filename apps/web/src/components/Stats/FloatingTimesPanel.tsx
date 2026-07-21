"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDraggable } from "@/hooks/useDraggable";
import { TimesList } from "./TimesList";
import type { Solve } from "@/types";

const STORAGE_KEY = "cubeforge:timesPanelPos";
const DEFAULT_POS = { x: 72, y: 120 };
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 380;

export interface FloatingTimesPanelProps {
  solves: Solve[];
  onUpdate: (id: string, updates: Partial<Solve>) => void;
  onDelete: (id: string) => void;
  onClear?: () => void;
  onAnalyze?: (solve: Solve) => void;
  onReplay?: (solve: Solve) => void;
}

/**
 * Floating solve-log panel — always open, draggable, minimizable.
 *
 * - **Desktop**: free-floating panel. Minimizing collapses it to a compact
 *   rounded-full pill (icon + count) so it takes minimal screen space while
 *   staying draggable.
 * - **Mobile**: fixed bottom bar. Minimizing collapses it to the header only.
 *
 * Portaled to `document.body` so it never affects the main layout flow.
 */
export function FloatingTimesPanel(props: FloatingTimesPanelProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  // Start in the compact pill state by default — matches the 3D panel's
  // behaviour (closed on entry, user opens when they want it). We deliberately
  // do not persist the toggle, so users who expand once get the pill back
  // next session — a surprise-free default for an opt-in widget.
  const [minimized, setMinimized] = useState(true);

  useEffect(() => setMounted(true), []);

  const drag = useDraggable<HTMLDivElement>(DEFAULT_POS, {
    storageKey: STORAGE_KEY,
    clickThreshold: 4,
  });

  if (!mounted) return null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <ListOrdered className="size-3.5 text-ink-3" />
        <span className="text-xs font-medium text-ink">Times</span>
        <span className="nums text-[0.6rem] text-ink-3">
          {props.solves.length}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {props.solves.length > 0 && props.onClear && !minimized && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              props.onClear?.();
            }}
            className="rounded px-1.5 py-1 text-[0.65rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-dnf"
          >
            Clear
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized((m) => !m);
          }}
          className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>
    </>
  );

  // ── Mobile: fixed bottom bar (not draggable) ───────────────────────────
  if (isMobile) {
    return createPortal(
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-xl">
        <div
          className="flex items-center justify-between px-3 py-2 select-none"
          onClick={() => setMinimized((m) => !m)}
        >
          {headerContent}
        </div>
        {!minimized && (
          <div style={{ height: "50vh" }} className="min-h-0">
            <TimesList
              solves={props.solves}
              onUpdate={props.onUpdate}
              onDelete={props.onDelete}
              onAnalyze={props.onAnalyze}
              onReplay={props.onReplay}
              hideHeader
              className="h-full"
            />
          </div>
        )}
      </div>,
      document.body,
    );
  }

  // ── Desktop: free-floating draggable panel ─────────────────────────────
  // When minimized, collapse to a compact rounded-full pill (icon + count +
  // expand chevron) so it occupies minimal space while staying draggable.
  if (minimized) {
    return createPortal(
      <motion.div
        ref={drag.elementRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{ left: drag.position.x, top: drag.position.y }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "fixed z-45 flex touch-none select-none items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-3 pr-2 shadow-lg",
          drag.isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
          "transition-colors hover:border-ink-2/40",
        )}
      >
        <ListOrdered className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">Times</span>
        <span className="nums text-[0.6rem] text-ink-3">
          {props.solves.length}
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Expand"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  return createPortal(
    <motion.div
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{
        left: drag.position.x,
        top: drag.position.y,
        width: PANEL_WIDTH,
      }}
      className={cn(
        "fixed z-45 flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
        drag.isDragging && "shadow-2xl",
      )}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          "flex items-center justify-between border-b border-line px-3 py-2",
          drag.isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {headerContent}
      </div>

      {/* Body */}
      <div style={{ height: PANEL_HEIGHT }} className="min-h-0">
        <TimesList
          solves={props.solves}
          onUpdate={props.onUpdate}
          onDelete={props.onDelete}
          onAnalyze={props.onAnalyze}
          onReplay={props.onReplay}
          hideHeader
          className="h-full"
        />
      </div>
    </motion.div>,
    document.body,
  );
}
