"use client";

import { memo, useMemo } from "react";
import { Search, X, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime, computeStats } from "@/utils/formatTime";
import { deriveSparkline } from "@/utils/insights";
import type { Solve, Penalty } from "@/types";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PenaltyBadge, Sparkline, EmptyState } from "./atoms";
import type { StatsFilters, SortOrder } from "@/hooks/useStatsFilters";
import { phaseColorHex } from "@/utils/phaseColors";

// ─── Constants ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "best", label: "Fastest" },
  { value: "worst", label: "Slowest" },
  { value: "pbDelta", label: "PB gap" },
];

// ─── Sub-components ────────────────────────────────────────────────────────

interface FilterChipProps {
  active: boolean;
  count: number;
  dot?: string;
  onClick: () => void;
  children: React.ReactNode;
}

/** Compact toggle chip with an optional colored dot and a count badge. */
function FilterChip({ active, count, dot, onClick, children }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-medium transition-colors",
        active
          ? "bg-surface-2 text-ink"
          : "bg-transparent text-ink-3/50 hover:text-ink-3",
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full transition-opacity",
            dot,
            !active && "opacity-40",
          )}
        />
      )}
      {children}
      <span className="nums text-[0.55rem] tabular-nums opacity-60">{count}</span>
    </button>
  );
}

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
  className,
}: SolveListPanelProps) {
  // ── Derived data ──────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(solves), [solves]);
  const bestTime = Number.isFinite(stats.best) ? stats.best : null;
  const mean = stats.mean;
  const sparkData = useMemo(() => deriveSparkline(solves, solves.length), [solves]);


  // Chip counts (from the full unfiltered set so they don't change when
  // you toggle a penalty chip).
  const chipCounts = useMemo(() => {
    let clean = 0, plus2 = 0, dnf = 0, smart = 0;
    for (const s of allSolves) {
      const pen = normalizePenalty(s.penalty);
      if (pen === "none") clean++;
      else if (pen === "+2") plus2++;
      else if (pen === "DNF") dnf++;
      if (s.source === "smart") smart++;
    }
    return { clean, plus2, dnf, smart };
  }, [allSolves]);

  const isFiltered =
    filteredCount !== totalCount || filters.search.trim().length > 0;
  const currentSort =
    SORT_OPTIONS.find((o) => o.value === filters.sort) ?? SORT_OPTIONS[0];

  // ── Handlers ──────────────────────────────────────────────────────────
  const togglePenalty = (p: Penalty) => {
    const next = new Set(filters.penalties);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setFilters({ penalties: next });
  };

  // ── Empty states ──────────────────────────────────────────────────────
  const showNoSolvesState = totalCount === 0;
  const showNoMatchesState = totalCount > 0 && solves.length === 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {/* ── Header (shrink-0) ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-line">
        {/* Title + sort dropdown + count */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[0.7rem] font-medium text-ink-2">Solves</span>
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-[0.62rem] text-ink-3 transition-colors hover:text-ink">
                  {currentSort.label}
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
                    {opt.label}
                    {opt.value === filters.sort && (
                      <Check className="ml-auto size-3.5 text-ink-3" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="nums text-[0.62rem] tabular-nums text-ink-3">
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
                Trend
              </span>
              {mean !== null && (
                <span className="nums text-[0.55rem] text-ink-3/60">
                  avg {formatTime(mean)}
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

        {/* Filter chips with counts */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            <FilterChip
              active={filters.penalties.has("none")}
              count={chipCounts.clean}
              dot="bg-ready"
              onClick={() => togglePenalty("none")}
            >
              Clean
            </FilterChip>
            <FilterChip
              active={filters.penalties.has("+2")}
              count={chipCounts.plus2}
              dot="bg-plus2"
              onClick={() => togglePenalty("+2")}
            >
              +2
            </FilterChip>
            <FilterChip
              active={filters.penalties.has("DNF")}
              count={chipCounts.dnf}
              dot="bg-dnf"
              onClick={() => togglePenalty("DNF")}
            >
              DNF
            </FilterChip>
            <FilterChip
              active={filters.smartCubeOnly}
              count={chipCounts.smart}
              dot="bg-ink"
              onClick={() =>
                setFilters({ smartCubeOnly: !filters.smartCubeOnly })
              }
            >
              Smart
            </FilterChip>
          </div>
        )}

        {/* Search + reset */}
        <div className="flex items-center gap-2 px-2.5 pb-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-3" />
            <Input
              placeholder="Search time, scramble, DNF, notes…"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="h-7 pl-7 pr-2 text-[0.72rem]"
            />
          </div>
          {isFiltered && (
            <button
              onClick={reset}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── List (own scroll) ───────────────────────────────────────────── */}
      {showNoSolvesState ? (
        <EmptyState
          title="No solves yet"
          description="Complete a solve to start building your session."
          className="m-3 flex-1"
        />
      ) : showNoMatchesState ? (
        <EmptyState
          title="No solves match"
          description="Try adjusting your filters or search."
          action={
            <button
              onClick={reset}
              className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:text-ink"
            >
              Reset filters
            </button>
          }
          className="m-3 flex-1"
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul>
            {solves.map((s, i) => {
              const eff = effectiveTime(s);
              const isDnf = !Number.isFinite(eff);
              const isBest = bestTime !== null && eff === bestTime && !isDnf;
              const isSelected = s.id === selectedId;
              const hasAnalysis =
                !!s.analysis && s.analysis.phases.length > 0;

              // Delta vs session average (only when meaningful).
              const delta = mean !== null ? eff - mean : 0;
              const showDelta =
                mean !== null &&
                solves.length >= 5 &&
                !isDnf &&
                !isBest &&
                Math.abs(delta) > 500;

              // Phase bar data.
              const phases = s.analysis?.phases ?? [];
              const totalPhaseMs = phases.reduce(
                (sum, p) => sum + p.durationMs,
                0,
              );

              return (
                <li
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(isSelected ? null : s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSelected ? null : s.id);
                    }
                  }}
                  aria-label={`Solve ${solves.length - i}: ${isDnf ? "DNF" : formatTime(eff)}${s.method ? `, ${s.method}` : ""}`}
                  className={cn(
                    "relative cursor-pointer border-b border-line/70 outline-none transition-colors last:border-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink/30",
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2/60",
                  )}
               >
                  {/* Selection accent bar (no layout shift) */}
                  <span
                    className={cn(
                      "absolute left-0 top-0 h-full w-0.5 transition-colors",
                      isSelected ? "bg-ink" : "bg-transparent",
                    )}
                  />

                  <div className="px-3 pb-1.75 pt-1.75">
                    {/* Line 1: index + time + delta + source + penalty */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex w-7 shrink-0 items-center justify-end gap-1.5">
                        {isBest ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-ready"
                            title="Session best"
                          />
                        ) : (
                          <span className="size-1.5 shrink-0" />
                        )}
                        <span className="nums text-right text-xs tabular-nums text-ink-3">
                          {solves.length - i}
                        </span>
                      </span>

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

                    {/* Line 2: mini phase bar (analysed solves only) */}
                    {hasAnalysis && totalPhaseMs > 0 && (
                      <div
                        className="mt-1.5 flex h-1 gap-px overflow-hidden rounded-full"
                        title={phases
                          .map(
                            (p) => `${p.phaseName}: ${formatTime(p.durationMs)}`,
                          )
                          .join(" · ")}
                      >
                        {phases.map((p, pi) => {
                          const pct = (p.durationMs / totalPhaseMs) * 100;
                          return (
                            <div
                              key={p.phaseName}
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: phaseColorHex(p.phaseName, pi),
                                opacity: 0.55,
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
});
