import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { cn } from "@/lib/utils";
import { computeStats, statLabel, computeBpaWpa, formatTime } from "@/utils/formatTime";
import type { Solve } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SessionStatsProps {
  solves: Solve[];
  className?: string;
  /** When provided, the row becomes a clickable shortcut to the full Stats view. */
  onExpand?: () => void;
  /** Filter solves to a specific puzzle type (e.g. '3x3x3', '2x2x2'). */
  puzzleFilter?: string;
}

interface Cell {
  label: string;
  value: string;
  /** Highlight: the best single stands out subtly. */
  accent?: boolean;
}

/**
 * Compact, flat summary row shown beneath the timer: Ao5, Ao12, Best, Mean.
 * Includes a subtle toggle button to minimize/collapse stats downwards.
 */
export function SessionStats({ solves, className, onExpand, puzzleFilter }: SessionStatsProps) {
  const showBpaWpa = useStore(preferencesStore, (s) => s.showBpaWpa);
  const [isMinimized, setIsMinimized] = useState(false);

  const filtered = useMemo(() => {
    if (!puzzleFilter) return solves;
    return solves.filter((s) => (s.puzzleType ?? "3x3x3") === puzzleFilter);
  }, [solves, puzzleFilter]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const bpaWpa = useMemo(() => {
    if (!showBpaWpa || filtered.length === 0) return null;
    const statSolves = filtered.map((s) => ({ time: s.time ?? 0, penalty: s.penalty }));
    if (statSolves.length % 5 === 4) {
      return computeBpaWpa(statSolves.slice(0, 4), 5);
    }
    if (statSolves.length % 12 === 11) {
      return computeBpaWpa(statSolves.slice(0, 11), 12);
    }
    return null;
  }, [filtered, showBpaWpa]);

  const cells: Cell[] = [
    { label: "Ao5", value: statLabel(stats.ao5) },
    { label: "Ao12", value: statLabel(stats.ao12) },
    { label: "Best", value: statLabel(stats.best), accent: Number.isFinite(stats.best) },
    { label: "Mean", value: statLabel(stats.mean) },
  ];

  const interactive = !!onExpand;

  return (
    <div className="relative w-full flex flex-col items-center">
      <AnimatePresence initial={false} mode="wait">
        {isMinimized ? (
          <motion.div
            key="minimized-pill"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="flex justify-center py-0.5"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsMinimized(false)}
                  // Touch: bigger restore pill for thumb use.
                  className="flex size-7 items-center justify-center rounded-full border border-line bg-surface/90 text-ink-3 shadow-xs hover:border-ink-2/40 hover:bg-surface-2 hover:text-ink transition-all duration-200 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring max-lg:size-9"
                  aria-label="Restore Session Stats"
                >
                  <ChevronUp className="size-4 max-lg:size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Show stats</TooltipContent>
            </Tooltip>
          </motion.div>
        ) : (
          <motion.div
            key="full-stats"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full"
          >
            <div className="relative flex flex-col items-center w-full">
              {bpaWpa != null && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 rounded-full border border-line/70 bg-surface/95 px-3 py-0.5 text-[0.68rem] text-ink-3 shadow-xs backdrop-blur-md whitespace-nowrap z-10 animate-in fade-in slide-in-from-bottom-1">
                  <span className="font-mono">
                    Ao{bpaWpa.targetN} BPA: <strong className="text-ready font-semibold">{formatTime(bpaWpa.bpa ?? 0)}</strong>
                  </span>
                  <span>•</span>
                  <span className="font-mono">
                    WPA: <strong className="text-ink-2 font-semibold">{formatTime(bpaWpa.wpa ?? 0)}</strong>
                  </span>
                </div>
              )}

              <div className="relative w-full">
                <div
                  className={cn(
                    "grid grid-cols-4 overflow-hidden rounded-lg border border-line bg-surface transition-colors",
                    interactive &&
                      "cursor-pointer hover:border-ink-2/40 focus-visible:border-ink-2 focus-visible:outline-none",
                    className,
                  )}
                  onClick={interactive ? onExpand : undefined}
                  onKeyDown={
                    interactive
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onExpand();
                          }
                        }
                      : undefined
                  }
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                >
                  {cells.map((c, i) => (
                    <div
                      key={c.label}
                      className={cn(
                        "flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3 sm:px-3",
                        // Touch: slightly tighter rows but larger numerals so the
                        // strip stays readable at a glance. Desktop unchanged.
                        "max-lg:gap-0.5 max-lg:px-1.5 max-lg:py-2.5",
                        i !== 0 && "border-l border-line",
                        c.accent && "bg-ready-soft/40",
                      )}
                    >
                      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3 max-lg:text-[0.62rem]">
                        {c.label}
                      </span>
                      <span
                        className={cn(
                          "nums text-sm tabular-nums text-ink sm:text-[0.95rem]",
                          "max-lg:text-base",
                          c.accent && "text-ready",
                        )}
                      >
                        {c.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtle Icon-Only Minimize Button in top right corner of stats panel */}
                <div className="absolute right-1 top-1 z-10 pointer-events-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMinimized(true);
                        }}
                      // Touch: bigger hit area for thumb use.
                      className="flex size-5 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring max-lg:size-7"
                        aria-label="Minimize Stats"
                      >
                        <ChevronDown className="size-3 max-lg:size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Minimize stats</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

