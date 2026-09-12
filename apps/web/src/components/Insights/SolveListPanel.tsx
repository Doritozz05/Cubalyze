"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X, ChevronDown, Check, CheckSquare, FolderInput, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveTime } from "@/types";
import { formatTime, computeStats } from "@/utils/formatTime";
import { deriveSparkline } from "@/utils/insights";
import type { Solve } from "@/types";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PenaltyBadge, Sparkline, EmptyState } from "./atoms";
import { SolveFilters } from "./SolveFilters";
import { countActiveFilters, type StatsFilters, type SortOrder } from "@/hooks/useStatsFilters";
import { contextMenuStore, type ContextMenuItem } from "@/components/ContextMenu/contextMenuStore";

// ─── Constants ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: {
  value: SortOrder;
  labelKey:
    | "list.sortNewest"
    | "list.sortOldest"
    | "list.sortFastest"
    | "list.sortSlowest";
}[] = [
  { value: "newest", labelKey: "list.sortNewest" },
  { value: "oldest", labelKey: "list.sortOldest" },
  { value: "best", labelKey: "list.sortFastest" },
  { value: "worst", labelKey: "list.sortSlowest" },
];

// ─── Main component ────────────────────────────────────────────────────────

export interface SolveListPanelProps {
  /** Filtered + sorted solves to display in the list. */
  solves: Solve[];
  /** Full unfiltered set — used for filter-chip counts only. */
  allSolves: Solve[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filters: StatsFilters;
  setFilters: (next: Partial<StatsFilters>) => void;
  filteredCount: number;
  totalCount: number;
  reset: () => void;
  /** Touch selection mode (iPad/mobile): rows show tick checkboxes. */
  selectionMode: boolean;
  /** Ids currently ticked in selection mode. */
  selection: ReadonlySet<string>;
  onToggleSelect: (id: string) => void;
  onSetSelected?: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onExitSelection: () => void;
  /** Long-press on a row (touch) — enters selection mode with that solve. */
  onLongPress: (id: string) => void;
  /** Enter selection mode (header "Select" button — desktop + touch). */
  onEnterSelection: () => void;
  /** Bulk actions from the selection bar. */
  onDeleteSelected: () => void;
  onMoveSelected: () => void;
  /** Single-solve context menu actions */
  onMoveSolve?: (id: string) => void;
  onDeleteSolve?: (id: string) => void;
  className?: string;
}

/**
 * Left panel of the Insights dashboard: sparkline trend, filter chips with
 * counts, sort control, search, and a scrollable solve list with per-solve
 * mini phase bars and delta-vs-average colour coding.
 *
 * Owns its own scroll (overflow-hidden container + ScrollArea flex-1) so it
 * never stretches to match the content panel's height.
 */
export const SolveListPanel = memo(function SolveListPanel({
  solves,
  allSolves,
  selectedId,
  onSelect,
  filters,
  setFilters,
  filteredCount,
  totalCount,
  reset,
  selectionMode,
  selection,
  onToggleSelect,
  onSetSelected,
  onSelectAll,
  onExitSelection,
  onLongPress,
  onEnterSelection,
  onDeleteSelected,
  onMoveSelected,
  onMoveSolve,
  onDeleteSolve,
  className,
}: SolveListPanelProps) {
  const { t } = useTranslation("insights");
  // ── Virtualized list ──────────────────────────────────────────────────
  // Power users accumulate thousands of solves; virtualize the list so we
  // only mount the ~20 visible rows + overscan instead of the whole array.
  const viewportRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: solves.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  // ── Derived data ──────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(solves), [solves]);
  const bestTime = Number.isFinite(stats.best) ? stats.best : null;
  const mean = stats.mean;
  const sparkData = useMemo(() => deriveSparkline(solves, solves.length), [solves]);


  // Every filter option and count inside `SolveFilters` is derived from the
  // full unfiltered set of this event, never from a hardcoded list: a solver
  // who only ever used Petrus sees Petrus, and a cube deleted from the Locker
  // still has solves worth filtering to. `countActiveFilters` is the single
  // source of "is anything narrowing the list", so the trigger badge and this
  // flag can never disagree.
  const isFiltered =
    filteredCount !== totalCount ||
    filters.search.trim().length > 0 ||
    countActiveFilters(filters) > 0;
  const currentSort =
    SORT_OPTIONS.find((o) => o.value === filters.sort) ?? SORT_OPTIONS[0];

  // ── Empty states ──────────────────────────────────────────────────────
  const showNoSolvesState = totalCount === 0;
  const showNoMatchesState = totalCount > 0 && solves.length === 0;

  // ── Touch long-press & Drag-to-Select (selection mode) ───────────────
  // Shared across virtualized rows: only one press can be in flight, and a
  // single ref also lets us swallow the click that follows the long-press
  // (otherwise the tap-up would immediately untick the solve).
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const clearPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Drag-to-select: when in selectionMode, holding left-mouse and dragging
  // across solve rows selects/unselects items without native text selection.
  const isDraggingRef = useRef(false);
  const dragTargetCheckedRef = useRef<boolean>(true);
  const onSetSelectedRef = useRef(onSetSelected);
  onSetSelectedRef.current = onSetSelected;
  const onToggleSelectRef = useRef(onToggleSelect);
  onToggleSelectRef.current = onToggleSelect;

  // Window pointerup listener to end drag-select anywhere in the window
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.button === 0 && isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
        selectionMode && "select-none",
        className,
      )}
    >
      {/* ── Header (shrink-0) ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-line">
        {/* Title + sort dropdown + count */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Title is redundant on touch (the segmented switcher already
              labels this page) — keep it for the desktop left panel. */}
          <span className="text-[0.7rem] font-medium text-ink-2 max-lg:hidden">{t("common.solves")}</span>
          <div className="flex items-center gap-2.5">
            {!selectionMode && (
              <button
                onClick={onEnterSelection}
                className="flex items-center gap-1 text-[0.62rem] text-ink-3 transition-colors hover:text-ink max-lg:h-8 max-lg:px-1"
              >
                <CheckSquare className="size-3" />
                {t("list.select")}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-[0.62rem] text-ink-3 transition-colors hover:text-ink">
                  {t(currentSort.labelKey)}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setFilters({ sort: opt.value })}
                    className="text-xs"
                  >
                    {t(opt.labelKey)}
                    {opt.value === filters.sort && (
                      <Check className="ml-auto size-3.5 text-ink-3" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Count also lives in the dashboard filter bar on touch. */}
            <span className="nums text-[0.62rem] tabular-nums text-ink-3 max-lg:hidden">
              {filteredCount}
              <span className="text-ink-3/50"> / {totalCount}</span>
            </span>
          </div>
        </div>

        {/* Sparkline trend (last 20 non-DNF times) */}
        {sparkData.length >= 2 && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-3/60">
                {t("list.trend")}
              </span>
              {mean !== null && (
                <span className="nums text-[0.55rem] text-ink-3/60">
                  {t("list.avg", { time: formatTime(mean) })}
                </span>
              )}
            </div>
            <Sparkline
              data={sparkData}
              width={300}
              height={28}
              fill
              dot
              color="ink"
              className="mt-1 w-full"
            />
          </div>
        )}

        {/* The unified filter surface: a result segment plus one popover with
            a section per dimension (source, method, cube). Rendered only when
            there is something to filter — an empty control would be a lie
            about what exists. */}
        {totalCount > 0 ? (
          <SolveFilters
            filters={filters}
            setFilters={setFilters}
            allSolves={allSolves}
          />
        ) : null}

        {/* Search + reset */}
        <div className="flex items-center gap-2 px-2.5 pb-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-3" />              <Input
              placeholder={t("list.searchPlaceholder")}
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="h-7 pl-7 pr-2 text-[0.72rem] max-lg:h-8"
            />
          </div>
          {isFiltered && (
            <button
              onClick={reset}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink max-lg:h-8 max-lg:px-2.5"
            >
              <X className="size-3" />
              {t("list.reset")}
            </button>
          )}
        </div>
      </div>

      {/* ── List (own scroll) ───────────────────────────────────────────── */}
      {showNoSolvesState ? (
        <EmptyState
          title={t("overview.emptyTitle")}
          description={t("list.emptyDescription")}
          className="m-3 flex-1"
        />
      ) : showNoMatchesState ? (
        <EmptyState
          title={t("list.noMatchTitle")}
          description={t("list.noMatchDescription")}
          action={
            <button
              onClick={reset}
              className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:text-ink"
            >
              {t("list.resetFilters")}
            </button>
          }
          className="m-3 flex-1"
        />
      ) : (
        <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
          {selectionMode && (
            /* Sticky header INSIDE the glass panel, so it must use the panel
               token family and let the liquid-glass engine repaint it: a
               `bg-surface-2` div with a `border-b` is one of the engine's own
               panel selectors, so it picks up the themed `--glass-bg` plus a
               real backdrop-blur (which is what hides the rows scrolling
               under it). `--glass-bg-dense` was wrong here: it is a
               near-opaque literal the theme presets never set, so every
               custom palette got a raw white/black strip. */
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
              <button
                onClick={onExitSelection}
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-3.5" />
                {i18n.t("common:cancel")}
              </button>
              <span className="nums text-xs tabular-nums text-ink-2">
                {t("list.selected", { count: selection.size })}
              </span>
              <button
                onClick={onSelectAll}
                className="ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Check className="size-3.5" />
                {t("list.selectAll")}
              </button>
            </div>
          )}
          <ul
            className="relative w-full py-1"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const s = solves[vi.index];
              const i = vi.index;
              const eff = effectiveTime(s);
              const isDnf = !Number.isFinite(eff);
              const isBest = bestTime !== null && eff === bestTime && !isDnf;
              const isSelected = s.id === selectedId;
              const isChecked = selectionMode && selection.has(s.id);
              // Delta vs session average (only when meaningful).
              const delta = mean !== null ? eff - mean : 0;
              const showDelta =
                mean !== null &&
                solves.length >= 5 &&
                !isDnf &&
                !isBest &&
                Math.abs(delta) > 500;

              return (
                <li
                  key={s.id}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    if (selectionMode) {
                      // Handled by onPointerDown / drag-to-select for mouse
                      return;
                    }
                    onSelect(isSelected ? null : s.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    if (selectionMode && e.pointerType === "mouse") {
                      e.preventDefault();
                      isDraggingRef.current = true;
                      const nextChecked = !isChecked;
                      dragTargetCheckedRef.current = nextChecked;
                      if (onSetSelectedRef.current) {
                        onSetSelectedRef.current(s.id, nextChecked);
                      } else {
                        onToggleSelectRef.current(s.id);
                      }
                      return;
                    }
                    // Long-press (touch only) enters selection mode. Mouse
                    // users keep click-to-open; fine pointers never arm.
                    if (e.pointerType !== "touch") return;
                    clearPress();
                    pressTimerRef.current = setTimeout(() => {
                      pressTimerRef.current = null;
                      suppressClickRef.current = true;
                      onLongPress(s.id);
                    }, 450);
                  }}
                  onPointerEnter={(e) => {
                    if (selectionMode && isDraggingRef.current && (e.buttons === 1 || e.pointerType === "mouse")) {
                      if (onSetSelectedRef.current) {
                        onSetSelectedRef.current(s.id, dragTargetCheckedRef.current);
                      } else if (isChecked !== dragTargetCheckedRef.current) {
                        onToggleSelectRef.current(s.id);
                      }
                    }
                  }}
                  onPointerUp={(e) => {
                    if (e.button === 0 && isDraggingRef.current) {
                      isDraggingRef.current = false;
                    }
                    clearPress();
                  }}
                  onPointerLeave={clearPress}
                  onPointerCancel={() => {
                    isDraggingRef.current = false;
                    clearPress();
                  }}
                  onFocus={() => virtualizer.scrollToIndex(vi.index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selectionMode) onToggleSelect(s.id);
                      else onSelect(isSelected ? null : s.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isMulti = selectionMode && selection.has(s.id) && selection.size > 1;
                    const items: ContextMenuItem[] = [
                      {
                        id: "move-solve",
                        label: "moveToSession",
                        icon: FolderInput,
                        onClick: () => {
                          if (isMulti) onMoveSelected();
                          else onMoveSolve?.(s.id);
                        },
                      },
                      {
                        id: "delete-solve",
                        label: isMulti ? "deleteSolves" : "deleteSolve",
                        icon: Trash2,
                        destructive: true,
                        onClick: () => {
                          if (isMulti) onDeleteSelected();
                          else onDeleteSolve?.(s.id);
                        },
                      },
                    ];
                    contextMenuStore.open(e.clientX, e.clientY, items);
                  }}
                  aria-label={`${t("common.solveAria", {
                    number: solves.length - i,
                    time: isDnf ? "DNF" : formatTime(eff),
                  })}${s.method ? `, ${s.method}` : ""}`}
                  className={cn(
                    "group absolute left-0 top-0 w-full cursor-pointer px-1.5 py-0.5 outline-none",
                    "transition-colors duration-150",
                  )}
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {/* Hover pill — subtle solid inset card */}
                  <div className="pointer-events-none absolute inset-x-1.5 inset-y-0.5 rounded-md bg-transparent transition-colors duration-150 group-hover:bg-surface-2" />
                  {/* Active-row card — Linear/Raycast style hairline inset card */}
                  <ActivePill active={selectionMode ? isChecked : isSelected} />

                  <div className="relative z-10 px-3 pb-1.75 pt-1.75 max-lg:px-2.5 max-lg:py-2.5">
                    {/* Line 1: index + time + delta + source + penalty */}
                    <div className="flex items-center gap-2.5">
                      {selectionMode ? (
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                            isChecked
                              ? "border-ink bg-ink text-surface"
                              : "border-ink-3/40 bg-transparent",
                          )}
                        >
                          {isChecked && <Check className="size-3" />}
                        </span>
                      ) : (
                      <span className="flex w-7 shrink-0 items-center justify-end gap-1.5">
                        {isBest ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="size-1.5 shrink-0 rounded-full bg-ready" />
                            </TooltipTrigger>
                            <TooltipContent side="right">{t("list.sessionBest")}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="size-1.5 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "nums text-right text-xs tabular-nums transition-colors duration-150",
                            isSelected ? "text-ink" : "text-ink-3",
                          )}
                        >
                          {solves.length - i}
                        </span>
                      </span>
                      )}

                      <span
                        className={cn(
                          "nums text-[0.95rem] tabular-nums",
                          isDnf
                            ? "text-dnf"
                            : isBest
                              ? "text-ready"
                              : "text-ink",
                        )}
                      >
                        {isDnf ? "DNF" : formatTime(eff)}
                      </span>

                      {showDelta && (
                        <span
                          className={cn(
                            "nums text-[0.62rem] tabular-nums",
                            delta > 0 ? "text-caution/80" : "text-ready/80",
                          )}
                        >
                          {delta > 0 ? "+" : "−"}
                          {(Math.abs(delta) / 1000).toFixed(1)}s
                        </span>
                      )}

                      {/* Spacer pushes trailing items right */}
                      <span className="flex-1" />

                      <PenaltyBadge penalty={s.penalty} />
                    </div>

                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {/* ── Selection action bar (bulk delete / move) ─────────────────── */}
      {selectionMode && (
        <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-2 pb-safe">
          <span className="nums text-xs tabular-nums text-ink-3">
            {t("list.selected", { count: selection.size })}
          </span>
          <span className="flex-1" />
          <button
            onClick={onMoveSelected}
            disabled={selection.size === 0}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md px-3 text-xs text-ink-2 transition-colors",
              selection.size === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-surface-2 hover:text-ink cursor-pointer",
            )}
          >
            <FolderInput className="size-3.5" />
            {t("list.moveToSession")}
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={selection.size === 0}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-md px-3 text-xs text-ink-2 transition-colors",
              selection.size === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-surface-2 hover:text-dnf cursor-pointer",
            )}
          >
            <Trash2 className="size-3.5" />
            {i18n.t("common:delete")}
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Active row pill ────────────────────────────────────────────────────────
// Linear / Raycast style: Inset card with a crisp hairline border ring,
// subtle surface-2 elevation, and a smooth micro-fade transition.

function ActivePill({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="active-pill"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? {} : { opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="pointer-events-none absolute inset-x-1.5 inset-y-0.5 rounded-md bg-sidebar-accent glass-active-pill"
        />
      )}
    </AnimatePresence>
  );
}

