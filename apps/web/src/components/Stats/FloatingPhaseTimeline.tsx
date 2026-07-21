"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/useDraggable";
import { formatTime } from "@/utils/formatTime";
import { deriveTimeline } from "@/utils/insights";
import { phaseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";

const STORAGE_KEY = "cubeforge:phaseTimelinePanelPos";
const DEFAULT_POS = { x: 72, y: 120 };

/** Number of most recent solves to show in the solve picker. */
const MAX_SOLVES_IN_PICKER = 3;

export interface FloatingPhaseTimelineProps {
  solves: Solve[];
  /** Pending analysis from the just-completed solve (not yet persisted). */
  lastAnalysis?: SolveMetrics | null;
}

interface TimelineEntry {
  phaseName: string;
  durationMs: number;
  color: string;
  fraction: number;
  moveCount: number;
  tps: number;
  // Per-phase pause info
  pauseCount: number;
  pauseDurationMs: number;
}

/**
 * Floating widget showing the phase breakdown + pauses of the last solve.
 * Displays a compact horizontal phase bar and a detailed breakdown list.
 *
 * The user can also pick from recent solves to see their timelines.
 */
export function FloatingPhaseTimeline({
  solves,
  lastAnalysis,
}: FloatingPhaseTimelineProps) {
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(true);
  // Which recent solve index is selected: 0 = most recent
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => setMounted(true), []);

  const drag = useDraggable<HTMLDivElement>(DEFAULT_POS, {
    storageKey: STORAGE_KEY,
    clickThreshold: 4,
  });

  // ── Resolve the solve to show ─────────────────────────────────────────
  const { selectedSolve, derived } = useMemo(() => {
    // The most recent solve might still have pending analysis (not persisted)
    const firstSolve = solves[0];
    const hasPending =
      selectedIdx === 0 && lastAnalysis && firstSolve && !firstSolve.analysis;
    const solve: Solve | null =
      solves[selectedIdx] ??
      (solves.length > 0 ? solves[0] : null);

    if (!solve) return { selectedSolve: null, derived: null };

    // Merge pending analysis into the solve for timeline derivation
    const effectiveSolve: Solve = hasPending
      ? { ...solve, analysis: lastAnalysis! }
      : solve;
    const tl = deriveTimeline(effectiveSolve);
    return { selectedSolve: solve, derived: tl };
  }, [solves, selectedIdx, lastAnalysis]);

  const timelinePhaseEntries = useMemo<TimelineEntry[]>(() => {
    if (!derived || derived.stageSegments.length === 0) return [];
    return derived.stageSegments.map((seg) => {
      const pauseMarks = derived.pauseMarks.filter(
        (p) => p.phase === seg.phaseName,
      );
      const totalPauseMs = pauseMarks.reduce((s, p) => s + p.durationMs, 0);
      return {
        phaseName: seg.phaseName,
        durationMs: seg.durationMs,
        color: phaseColorHex(seg.phaseName, derived.stageSegments.indexOf(seg)),
        fraction: derived.totalMs > 0 ? seg.durationMs / derived.totalMs : 0,
        moveCount: seg.moveCount,
        tps: seg.tps,
        pauseCount: pauseMarks.length,
        pauseDurationMs: totalPauseMs,
      };
    });
  }, [derived]);

  const pauseCount = derived?.pauseMarks.length ?? 0;
  const totalPauseMs = derived?.pauseMarks.reduce((s, p) => s + p.durationMs, 0) ?? 0;
  const totalMs = derived?.totalMs ?? 0;

  // Available recent solves for picker
  const recentSolves = useMemo(
    () => solves.slice(0, MAX_SOLVES_IN_PICKER),
    [solves],
  );

  // Auto-reset to index 0 when new solves arrive (newest changes)
  useEffect(() => {
    setSelectedIdx(0);
  }, [solves.length]);

  if (!mounted) return null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2">
        <Activity className="size-3.5 text-ink-3" />
        <span className="text-xs font-medium text-ink">Solve Timeline</span>
        {selectedSolve && (
          <span className="nums text-[0.6rem] text-ink-3">
            {formatTime(selectedSolve.time)}
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
        <Activity className="size-4 text-ink-3" />
        <span className="text-xs font-medium text-ink">Solve Timeline</span>
        {selectedSolve && (
          <span className="nums text-[0.65rem] text-ink">
            {formatTime(selectedSolve.time)}
          </span>
        )}
        {timelinePhaseEntries.length > 0 && (
          <span className="nums text-[0.55rem] text-ink-3">
            {timelinePhaseEntries.length} phases
          </span>
        )}
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
      style={{ left: drag.position.x, top: drag.position.y, width: 340 }}
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
      <div className="max-h-[360px] overflow-y-auto p-3">
        {!selectedSolve ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No solves yet</p>
            <p className="text-xs text-ink-3">Complete a solve to see the phase timeline.</p>
          </div>
        ) : !selectedSolve.analysis && !(selectedIdx === 0 && lastAnalysis) ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Activity className="size-8 text-ink-3/30" />
            <p className="text-sm text-ink-2">No analysis yet</p>
            <p className="text-xs text-ink-3">
              {selectedSolve.source === "smart"
                ? "The analysis pipeline is running. Check back shortly."
                : "Manual entry. Connect a Smart Cube to get phase analysis."}
            </p>
          </div>
        ) : (
          <>
            {/* Solve picker (if multiple recent solves) */}
            {recentSolves.length > 1 && (
              <div className="mb-3 flex gap-1">
                {recentSolves.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedIdx(i)}
                    className={cn(
                      "rounded px-2 py-1 text-[0.6rem] transition-colors",
                      i === selectedIdx
                        ? "bg-ink text-surface"
                        : "bg-surface-2 text-ink-3 hover:text-ink",
                    )}
                  >
                    #{solves.length - i}
                    {" "}
                    <span className="nums">
                      {formatTime(s.time)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Horizontal phase bar */}
            {timelinePhaseEntries.length > 0 && (
              <>
                <div className="mb-2 flex h-7 w-full overflow-hidden rounded-md">
                  {timelinePhaseEntries.map((entry, i) => (
                    <div
                      key={entry.phaseName}
                      className="relative flex items-center justify-center text-[0.5rem] font-medium text-white transition-all"
                      style={{
                        width: `${Math.max(entry.fraction * 100, 4)}%`,
                        backgroundColor: entry.color,
                        opacity: 0.85,
                      }}
                      title={`${entry.phaseName}: ${formatTime(entry.durationMs)}`}
                    >
                      {entry.fraction > 0.1 && (
                        <span className="truncate px-0.5 drop-shadow-sm">
                          {entry.phaseName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Phase breakdown */}
                <div className="overflow-hidden rounded-lg border border-line/60">
                  {timelinePhaseEntries.map((entry, i) => (
                    <div
                      key={entry.phaseName}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 text-xs",
                        i !== timelinePhaseEntries.length - 1 && "border-b border-line/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-medium text-ink-2 uppercase tracking-wide text-[0.6rem]">
                          {entry.phaseName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 nums text-[0.6rem] text-ink-3">
                        <span>{formatTime(entry.durationMs)}</span>
                        <span className="text-ink-2">{entry.tps.toFixed(1)} TPS</span>
                        <span>{entry.moveCount}m</span>
                        {entry.pauseCount > 0 && (
                          <span className="flex items-center gap-0.5 text-caution/70" title={`${entry.pauseCount} pause${entry.pauseCount > 1 ? "s" : ""}: ${formatTime(entry.pauseDurationMs)}`}>
                            <Pause className="size-2.5" />
                            {formatTime(entry.pauseDurationMs)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary stats */}
                <div className="mt-2 flex items-center justify-between text-[0.55rem] text-ink-3">
                  <span>
                    {selectedSolve.moves?.length ?? 0} moves ·{" "}
                    {formatTime(totalMs)} total
                  </span>
                  {pauseCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-1.5 rounded-sm" style={{ backgroundColor: PAUSE_COLOR_BY_CATEGORY["mid-phase"] }} />
                      {pauseCount} pause{pauseCount > 1 ? "s" : ""} ·{" "}
                      {formatTime(totalPauseMs)}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Fallback when phases exist in analysis but no timeline segments */}
            {timelinePhaseEntries.length === 0 && selectedSolve.analysis && (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <p className="text-xs text-ink-3">
                  Timeline data unavailable for this solve.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
