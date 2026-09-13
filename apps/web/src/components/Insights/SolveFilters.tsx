"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Solve, SolveMethod, SolveSource } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  countActiveFilters,
  cubeFilterOptions,
  methodFilterOptions,
  penaltyFilterCounts,
  sourceFilterOptions,
  type PenaltyFilter,
  type StatsFilters,
} from "@/hooks/useStatsFilters";

/**
 * One label per recording source. Reuses the analysis namespace (the same
 * wording the solve detail already shows) instead of inventing a second set of
 * strings that would drift apart.
 */
const SOURCE_LABEL_KEY = {
  smart: "analysis.smartCube",
  manual: "analysis.manual",
  virtual: "analysis.virtualCube",
} as const satisfies Record<SolveSource, string>;

export interface SolveFiltersProps {
  filters: StatsFilters;
  setFilters: (next: Partial<StatsFilters>) => void;
  /**
   * The full event-scoped set (every penalty, every source) — the ONLY source
   * of options and counts. Derived from the history, never from a hardcoded
   * list, so a chip can never offer a value that matches nothing.
   */
  allSolves: Solve[];
  className?: string;
}

/**
 * The single filter surface of the solve list, replacing the three stacked
 * chip rows that used to live in `SolveListPanel`.
 *
 * Two rules make it "unified" and keep it that way as the app grows:
 *
 * 1. **One control per dimension, never per value.** The result selector is a
 *    single-select segment (a solve is clean OR +2 OR DNF — a multi-select
 *    could express impossible states); everything else is a multi-select
 *    inside one "Filters" popover.
 * 2. **Adding a dimension is local.** Each dimension is one section in the
 *    popover plus one predicate in `useStatsFilters`. Nothing else changes:
 *    the option counts, the trigger badge and the removable chips are all
 *    derived from `filters` itself, so a new key cannot desynchronise them.
 *
 * Reset is deliberately NOT here: it clears the search and the sort too, so it
 * lives next to the search field at the top of the panel instead of pretending
 * to be a filter-scoped control.
 */
export function SolveFilters({
  filters,
  setFilters,
  allSolves,
  className,
}: SolveFiltersProps) {
  const { t } = useTranslation("insights");

  const counts = useMemo(() => penaltyFilterCounts(allSolves), [allSolves]);
  const sourceOptions = useMemo(() => sourceFilterOptions(allSolves), [allSolves]);
  const methodOptions = useMemo(() => methodFilterOptions(allSolves), [allSolves]);
  const cubeOptions = useMemo(() => cubeFilterOptions(allSolves), [allSolves]);

  const activeCount = countActiveFilters(filters);
  const hasPopoverOptions =
    sourceOptions.length > 0 || methodOptions.length > 0 || cubeOptions.length > 0;

  const toggleSource = (source: SolveSource) => {
    const next = new Set(filters.sources);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setFilters({ sources: next });
  };

  const toggleMethod = (method: SolveMethod) => {
    const next = new Set(filters.methods);
    if (next.has(method)) next.delete(method);
    else next.add(method);
    setFilters({ methods: next });
  };

  // Chips for everything EXCEPT the result segment: that one is already
  // visible and highlighted above, and showing it twice would imply two
  // independent filters.
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  for (const source of filters.sources) {
    activeChips.push({
      key: `source:${source}`,
      label: t(SOURCE_LABEL_KEY[source]),
      onRemove: () => toggleSource(source),
    });
  }
  for (const method of filters.methods) {
    activeChips.push({
      key: `method:${method}`,
      label: method,
      onRemove: () => toggleMethod(method),
    });
  }
  if (filters.cubeId) {
    const cube = cubeOptions.find((option) => option.id === filters.cubeId);
    activeChips.push({
      key: `cube:${filters.cubeId}`,
      label: cube?.label ?? filters.cubeId,
      onRemove: () => setFilters({ cubeId: null }),
    });
  }

  return (
    <div className={cn("px-3 pb-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Result — the one dimension worth a permanently visible control. */}
        <div
          role="group"
          aria-label={t("list.filterByResult")}
          className="flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5"
        >
          {(
            [
              { value: "all", label: t("list.all"), count: counts.all },
              { value: "clean", label: t("common.clean"), count: counts.clean, dot: "bg-ready" },
              { value: "+2", label: "+2", count: counts["+2"], dot: "bg-plus2" },
              { value: "DNF", label: "DNF", count: counts.DNF, dot: "bg-dnf" },
            ] as { value: PenaltyFilter; label: string; count: number; dot?: string }[]
          ).map((option) => {
            const active = filters.penalty === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters({ penalty: option.value })}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[0.62rem] font-medium transition-colors",
                  "max-lg:h-7 max-lg:px-2 max-lg:text-[0.68rem]",
                  active ? "bg-ink text-surface shadow-sm" : "text-ink-3 hover:text-ink",
                )}
              >
                {option.dot ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-opacity",
                      option.dot,
                      !active && "opacity-50",
                    )}
                  />
                ) : null}
                {/* Label + count sit on ONE baseline. They used to be direct
                    children of a centered row: the smaller mono digits were
                    centered by line box, so they floated above the label's
                    baseline instead of resting on it. `items-baseline` inside
                    a wrapper fixes the pair while the dot keeps `items-center`
                    (a dot has no baseline to align to). */}
                <span className="flex items-baseline gap-1">
                  {option.label}
                  <span
                    className={cn("nums text-[0.55rem] tabular-nums", active ? "opacity-70" : "opacity-50")}
                  >
                    {option.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Everything else, grouped by dimension. */}
        {hasPopoverOptions ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md border px-1.5 text-[0.62rem] font-medium transition-colors",
                  "max-lg:h-7 max-lg:px-2 max-lg:text-[0.68rem]",
                  activeCount > 0
                    ? "border-line bg-surface-2 text-ink"
                    : "border-line bg-transparent text-ink-3 hover:text-ink",
                )}
              >
                <SlidersHorizontal className="size-3" />
                {t("list.filters")}
                {activeCount > 0 ? (
                  <span className="nums grid size-3.5 place-items-center rounded-full bg-ink text-[0.5rem] font-semibold text-surface">
                    {activeCount}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 gap-0 p-0">
              <div className="max-h-80 overflow-y-auto">
                {sourceOptions.length > 0 ? (
                  <FilterSection title={t("list.source")}>
                    {sourceOptions.map(({ source, count }) => (
                      <OptionChip
                        key={source}
                        active={filters.sources.has(source)}
                        count={count}
                        onClick={() => toggleSource(source)}
                      >
                        {t(SOURCE_LABEL_KEY[source])}
                      </OptionChip>
                    ))}
                  </FilterSection>
                ) : null}

                {methodOptions.length > 0 ? (
                  <FilterSection title={t("list.method")}>
                    {methodOptions.map(({ method, count }) => (
                      <OptionChip
                        key={method}
                        active={filters.methods.has(method)}
                        count={count}
                        onClick={() => toggleMethod(method)}
                      >
                        {method}
                      </OptionChip>
                    ))}
                  </FilterSection>
                ) : null}

                {cubeOptions.length > 0 ? (
                  <FilterSection title={t("list.myCube")} layout="list">
                    {cubeOptions.map((option) => {
                      const active = filters.cubeId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setFilters({ cubeId: active ? null : option.id })
                          }
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[0.68rem] transition-colors",
                            active ? "text-ink" : "text-ink-3 hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors",
                              active
                                ? "border-ink bg-ink text-surface"
                                : "border-ink-3/40",
                            )}
                          >
                            {active ? <Check className="size-2.5" /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          <span className="nums shrink-0 text-[0.55rem] tabular-nums text-ink-3">
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </FilterSection>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

      </div>

      {/* Applied, non-result filters as removable chips: visible while the
          popover is closed, so the list is never narrower than it looks. */}
      {activeChips.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-[0.6rem] text-ink-2"
            >
              {chip.label}
              <button
                type="button"
                aria-label={t("list.removeFilter", { label: chip.label })}
                onClick={chip.onRemove}
                className="grid size-3.5 place-items-center rounded-full text-ink-3 transition-colors hover:bg-line hover:text-ink"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function FilterSection({
  title,
  layout = "chips",
  children,
}: {
  title: string;
  layout?: "chips" | "list";
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line px-3 py-2.5 last:border-b-0">
      <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.16em] text-ink-3/60">{title}</p>
      <div className={cn(layout === "chips" ? "flex flex-wrap gap-1" : "flex flex-col gap-0.5")}>
        {children}
      </div>
    </div>
  );
}

function OptionChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem] font-medium transition-colors",
        active
          ? "border-transparent bg-ink text-surface"
          : "border-line text-ink-2 hover:border-ink-3/50 hover:text-ink",
      )}
    >
      {/* Same one-baseline rule as the result segment: the digits share the
          label's baseline instead of being centered by line box (which made
          the number look like it was floating above the text). */}
      <span className="flex items-baseline gap-1">
        {children}
        <span className={cn("nums text-[0.55rem] tabular-nums", active ? "opacity-70" : "opacity-50")}>
          {count}
        </span>
      </span>
    </button>
  );
}
