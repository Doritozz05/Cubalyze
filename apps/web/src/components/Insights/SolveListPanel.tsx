"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X, ChevronDown, Check, CheckSquare, FolderInput, Trash2, Box } from "lucide-react";
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
import { actionsForSurface, buildSolveActionGroups } from "./solveActions";

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
  onAssignSelected: () => void;
  /** Single-solve context menu actions.
   *
   *  The row menu renders the SAME action list as the solve detail panel
   *  (`solveActions`), so a right-click offers re-analyze and retry too — not
   *  just the three management entries it used to. */
  onMoveSolve?: (id: string) => void;
  onDeleteSolve?: (id: string) => void;
  onAssignSolve?: (id: string) => void;
  /** Re-run the analysis pipeline on a stored solve. */
  onReanalyze?: (solve: Solve) => void | Promise<void>;
  /** Put that solve's exact scramble back on the timer. */
  onRetryScramble?: (solve: Solve) => void;
  /** Solve whose live analysis is still pending (re-running it would race). */
  liveSolveId?: string | null;
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
  onAssignSelected,
  onMoveSolve,
  onDeleteSolve,
  onAssignSolve,
  onReanalyze,
  onRetryScramble,
  liveSolveId,
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
  // Latest pointer position (viewport coords) + live solves for the
  // edge-autoscroll loop below. Refs avoid stale closures inside rAF.
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const dragScrollRafRef = useRef<number | null>(null);

  const stopDragScroll = () => {
    if (dragScrollRafRef.current !== null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  };

  // Last row index touched by the drag. Pointerenter/elementFromPoint only
  // report sampled positions — a fast drag jumps over 40px rows — so every
  // arrival paints the whole [last, current] range instead of one row.
  const lastDragIndexRef = useRef<number | null>(null);

  const paintDragRange = (toIndex: number) => {
    const solves = solvesRef.current;
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= solves.length) return;
    const setSelected = onSetSelectedRef.current;
    const from = lastDragIndexRef.current;
    if (from === null || from === toIndex) {
      lastDragIndexRef.current = toIndex;
      const solve = solves[toIndex];
      if (solve && setSelected) setSelected(solve.id, dragTargetCheckedRef.current);
      return;
    }
    const [lo, hi] = from < toIndex ? [from, toIndex] : [toIndex, from];
    if (setSelected) {
      for (let idx = lo; idx <= hi; idx++) {
        const solve = solves[idx];
        if (solve) setSelected(solve.id, dragTargetCheckedRef.current);
      }
    }
    lastDragIndexRef.current = toIndex;
  };

  const startDragScroll = () => {
    stopDragScroll();
    const EDGE_PX = 56;
    const MAX_SPEED = 14;
    const step = () => {
      if (!isDraggingRef.current) {
        dragScrollRafRef.current = null;
        return;
      }
      const viewport = viewportRef.current;
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const { x, y } = lastPointerRef.current;
        let dy = 0;
        if (y > rect.bottom - EDGE_PX) {
          const proximity = Math.min(1, Math.max(0, (y - (rect.bottom - EDGE_PX)) / EDGE_PX));
          dy = 2 + MAX_SPEED * proximity;
        } else if (y < rect.top + EDGE_PX) {
          const proximity = Math.min(1, Math.max(0, ((rect.top + EDGE_PX) - y) / EDGE_PX));
          dy = -(2 + MAX_SPEED * proximity);
        }
        if (dy !== 0) {
          viewport.scrollTop += dy;
          // pointerenter doesn't fire during programmatic scroll, so hit-test
          // the row under the pointer and extend the selection manually.
          const clampedY = Math.min(Math.max(y, rect.top + 1), rect.bottom - 1);
          const el = document.elementFromPoint(x, clampedY);
          const row = (el as HTMLElement | null)?.closest?.("[data-index]");
          const indexAttr = row?.getAttribute("data-index");
          if (indexAttr !== null && indexAttr !== undefined) {
            paintDragRange(Number(indexAttr));
          }
        }
      }
      dragScrollRafRef.current = requestAnimationFrame(step);
    };
    dragScrollRafRef.current = requestAnimationFrame(step);
  };

  // Window pointerup listener to end drag-select anywhere in the window
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.button === 0 && isDraggingRef.current) {
        isDraggingRef.current = false;
        lastDragIndexRef.current = null;
        stopDragScroll();
      }
    };
    const handleGlobalCancel = () => {
      isDraggingRef.current = false;
      lastDragIndexRef.current = null;
      stopDragScroll();
    };
    const handleGlobalMove = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalCancel);
    window.addEventListener("pointermove", handleGlobalMove);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalCancel);
      window.removeEventListener("pointermove", handleGlobalMove);
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
                      lastPointerRef.current = { x: e.clientX, y: e.clientY };
                      lastDragIndexRef.current = vi.index;
                      const nextChecked = !isChecked;
                      dragTargetCheckedRef.current = nextChecked;
                      if (onSetSelectedRef.current) {
                        onSetSelectedRef.current(s.id, nextChecked);
                      } else {
                        onToggleSelectRef.current(s.id);
                      }
                      startDragScroll();
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
                        paintDragRange(vi.index);
                      } else if (isChecked !== dragTargetCheckedRef.current) {
                        onToggleSelectRef.current(s.id);
                      }
                    }
                  }}
                  onPointerUp={(e) => {
                    if (e.button === 0 && isDraggingRef.current) {
                      isDraggingRef.current = false;
                      lastDragIndexRef.current = null;
                      stopDragScroll();
                    }
                    clearPress();
                  }}
                  onPointerLeave={clearPress}
                  onPointerCancel={() => {
                    isDraggingRef.current = false;
                    lastDragIndexRef.current = null;
                    stopDragScroll();
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
                    // One declaration, three surfaces: this menu asks for the
                    // `context` set of the very list the detail panel renders,
                    // so it can never offer fewer actions than the panel.
                    const groups = actionsForSurface(
                      buildSolveActionGroups({
                        t,
                        solve: s,
                        liveSolveId,
                        multi: isMulti,
                        // With several rows ticked the same actions aim at the
                        // SELECTION, and say so — the batch wording already
                        // lives in the `contextMenu` namespace.
                        labelOverrides: isMulti
                          ? {
                              move: i18n.t("contextMenu:moveToSession"),
                              assign: i18n.t("contextMenu:assignCube"),
                              delete: i18n.t("contextMenu:deleteSolves"),
                            }
                          : undefined,
                        handlers: {
                          onRetryScramble,
                          onReanalyze,
                          onMoveSolve,
                          onAssignSolve,
                          onDeleteSolve,
                          onMoveSelected,
                          onAssignSelected,
                          onDeleteSelected,
                        },
                      }),
                      "context",
                    );
                    const items: ContextMenuItem[] = groups.flatMap((group, groupIndex) =>
                      group.map((item, itemIndex) => ({
                        id: item.id,
                        // Labels come resolved from `solveActions` (insights
                        // namespace) — the same string the panel shows.
                        labelText: item.label,
                        icon: item.icon,
                        disabled: item.disabled,
                        destructive: item.destructive,
                        hint: item.hint,
                        separatorBefore: groupIndex > 0 && itemIndex === 0,
                        onClick: item.onSelect,
                      })),
                    );
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

      {/* ── Selection action bar (bulk move / assign / delete, icon-only) ── */}
      {selectionMode && (
        <div className="flex shrink-0 items-center gap-1 border-t border-line bg-surface px-3 py-2 pb-safe">
          <span className="nums text-xs tabular-nums text-ink-3">
            {t("list.selected", { count: selection.size })}
          </span>
          <span className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMoveSelected}
                disabled={selection.size === 0}
                aria-label={t("list.moveToSession")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors",
                  selection.size === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-surface-2 hover:text-ink cursor-pointer",
                )}
              >
                <FolderInput className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("list.moveToSession")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAssignSelected}
                disabled={selection.size === 0}
                aria-label={t("list.assignCube")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors",
                  selection.size === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-surface-2 hover:text-ink cursor-pointer",
                )}
              >
                <Box className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("list.assignCube")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDeleteSelected}
                disabled={selection.size === 0}
                aria-label={i18n.t("common:delete")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors",
                  selection.size === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-surface-2 hover:text-dnf cursor-pointer",
                )}
              >
                <Trash2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{i18n.t("common:delete")}</TooltipContent>
          </Tooltip>
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

