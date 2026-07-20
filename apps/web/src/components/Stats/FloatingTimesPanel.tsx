"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ListOrdered, X, ChevronDown, ChevronUp } from "lucide-react";
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
}

/**
 * Floating solve-log panel.
 *
 * - **Desktop**: free-floating, draggable by the header, minimizable (collapse
 *   to header-only), closable (collapses to a pill that re-opens it).
 * - **Mobile**: fixed bottom bar, expand/collapse by tapping the header (not
 *   draggable — dragging on small screens is awkward).
 *
 * Portaled to `document.body` so it never affects the main layout flow.
 */
export function FloatingTimesPanel(props: FloatingTimesPanelProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => setMounted(true), []);

  const drag = useDraggable(DEFAULT_POS, {
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
              props.onClear();
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
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Close panel"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </>
  );

  // ── Mobile: fixed bottom bar (not draggable) ───────────────────────────
  if (isMobile) {
    return createPortal(
      <>
        {/* Re-open pill */}
        {!open && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setOpen(true);
              setMinimized(false);
            }}
            className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-lg"
          >
            <ListOrdered className="size-4 text-ink-3" />
            <span className="text-xs font-medium text-ink">Times</span>
            <span className="nums text-[0.6rem] text-ink-3">
              {props.solves.length}
            </span>
          </motion.button>
        )}

        {open && (
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
                  hideHeader
                  className="h-full"
                />
              </div>
            )}
          </div>
        )}
      </>,
      document.body,
    );
  }

  // ── Desktop: free-floating draggable panel ─────────────────────────────
  return createPortal(
    <>
      {/* Re-open pill */}
      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-lg transition-colors hover:border-ink-2/40"
        >
          <ListOrdered className="size-4 text-ink-3" />
          <span className="text-xs font-medium text-ink">Times</span>
          <span className="nums text-[0.6rem] text-ink-3">
            {props.solves.length}
          </span>
        </motion.button>
      )}

      {open && (
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
            "fixed z-40 flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
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
              minimized && "border-b-0",
            )}
          >
            {headerContent}
          </div>

          {/* Body */}
          {!minimized && (
            <div style={{ height: PANEL_HEIGHT }} className="min-h-0">
              <TimesList
                solves={props.solves}
                onUpdate={props.onUpdate}
                onDelete={props.onDelete}
                onAnalyze={props.onAnalyze}
                hideHeader
                className="h-full"
              />
            </div>
          )}
        </motion.div>
      )}
    </>,
    document.body,
  );
}
