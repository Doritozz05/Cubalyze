"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Trophy, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/useDraggable";
import { effectiveTime } from "@/types";
import { formatTime } from "@/utils/formatTime";
import type { Solve } from "@/types";

const STORAGE_KEY = "cubeforge:pbProgPanelPos";
const DEFAULT_POS = { x: 420, y: 380 };

export interface FloatingPbProgressionProps {
  solves: Solve[];
}

interface PbMilestone {
  /** 1-based solve number (newest=1, oldest=N) */
  solveNumber: number;
  /** Solve timestamp */
  timestamp: number;
  /** PB time in ms */
  time: number;
  /** Improvement delta from previous PB (ms, negative = better) */
  delta: number | null;
  /** Whether this is the current (latest) PB */
  isCurrent: boolean;
  /** Solve id for linking */
  solveId: string;
}

/**
 * Floating widget showing Personal Best progression over time.
 * Displays a vertical timeline of PB milestones so the user can see
 * their improvement at a glance.
 */
export function FloatingPbProgression({ solves }: FloatingPbProgressionProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => setMounted(true), []);

  const drag = useDraggable<HTMLDivElement>(DEFAULT_POS, {
    storageKey: STORAGE_KEY,
    clickThreshold: 4,
  });

  const milestones = useMemo(() => {
    // Newest first → oldest first for chronological detection
    const chrono = [...solves].reverse();
    let runningPb = Infinity;
    const pbs: PbMilestone[] = [];
    let previousPb: number | null = null;

    for (let i = 0; i < chrono.length; i++) {
      const solve = chrono[i];
      const t = effectiveTime(solve);
      if (!Number.isFinite(t)) continue;
      if (t < runningPb) {
        // New PB!
        const delta = previousPb !== null ? t - previousPb : null;
        pbs.push({
          solveNumber: solves.length - i, // Convert index to 1-based from newest
          timestamp: solve.timestamp,
          time: t,
          delta,
          isCurrent: false, // Will set below
          solveId: solve.id,
        });
        previousPb = t;
        runningPb = t;
      }
    }

    // Mark the last PB as current
    if (pbs.length > 0) {
      pbs[pbs.length - 1].isCurrent = true;
    }

    // Show newest PB first (reverse chronological)
    return pbs.reverse();
  }, [solves]);

  const currentPb = milestones.find((m) => m.isCurrent);
  const pbCount = milestones.length;

  if (!mounted) return null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <Trophy className="size-3.5 text-ink-3" />
        <span className="text-xs font-medium text-ink">PB Progression</span>
        {currentPb && (
          <span className="nums text-[0.6rem] text-ready">
            {formatTime(currentPb.time)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
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

  // ── Minimized pill ─────────────────────────────────────────────────
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
        <Trophy className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">PB Progression</span>
        {currentPb && (
          <span className="nums text-[0.65rem] text-ready">{formatTime(currentPb.time)}</span>
        )}
        <span className="nums text-[0.55rem] text-ink-3">{pbCount} PB{pbCount !== 1 ? "s" : ""}</span>
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

  // ── Expanded panel ─────────────────────────────────────────────────
  return createPortal(
    <motion.div
      ref={drag.elementRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{ left: drag.position.x, top: drag.position.y, width: 300 }}
      className={cn(
        "fixed z-45 flex flex-col touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-xl",
        drag.isDragging && "shadow-2xl",
      )}
    >
      {/* Header */}
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
      <div className="max-h-[320px] overflow-y-auto p-3">
        {milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Trophy className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No PB yet</p>
            <p className="text-xs text-ink-3">Complete a solve to set your first PB.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-ink-3/20" />

            {milestones.map((pb, i) => {
              const isFirst = i === 0;
              const isLast = i === milestones.length - 1;
              const improvement = pb.delta !== null && pb.delta < 0;

              return (
                <div key={pb.solveId} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  {/* Dot on the timeline */}
                  <div className="relative z-10 mt-1">
                    {pb.isCurrent ? (
                      <div className="flex size-[22px] items-center justify-center rounded-full bg-ready-soft">
                        <Sparkles className="size-3 text-ready" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "size-[22px] rounded-full border-2 flex items-center justify-center",
                          isFirst
                            ? "border-ink-3/30 bg-surface"
                            : "border-ink-3/20 bg-surface",
                        )}
                      >
                        <div className="size-1.5 rounded-full bg-ink-3/40" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "nums text-sm font-medium",
                          pb.isCurrent ? "text-ready" : "text-ink",
                        )}
                      >
                        {formatTime(pb.time)}
                      </span>
                      <span className="nums text-[0.55rem] text-ink-3">
                        Solve #{pb.solveNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[0.6rem] text-ink-3">
                      {pb.delta !== null && (
                        <span
                          className={cn(
                            "nums",
                            improvement ? "text-ready" : "text-ink-3",
                          )}
                        >
                          {improvement ? "−" : "+"}{formatTime(Math.abs(pb.delta))}
                          {improvement ? " improvement" : ""}
                        </span>
                      )}
                      <span>
                        {formatTimestamp(pb.timestamp)}
                      </span>
                    </div>

                    {pb.isCurrent && (
                      <span className="mt-0.5 inline-flex w-fit rounded bg-ready-soft px-1.5 py-0.5 text-[0.5rem] font-medium uppercase tracking-wide text-ready">
                        Current PB
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {milestones.length > 1 && currentPb && (
          <div className="mt-2 border-t border-line/50 pt-2.5 text-center text-[0.55rem] text-ink-3">
            {milestones.length} PB{milestones.length !== 1 ? "s" : ""} across {solves.length} solves
            {" · "}
            Total improvement:{" "}
            <span className="nums text-ready">
              −{formatTime(milestones[0].time - (milestones[milestones.length - 1]?.time ?? milestones[0].time))}
            </span>
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
