"use client";

import { useMemo, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import type { Solve, SolveMethod } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";

/** Sort orders for the solves list. */
export type SortOrder =
  | "newest"
  | "oldest"
  | "best"
  | "worst"
  | "pbDelta";

export type SolveFilterCategory =
  | "clean"
  | "+2" | "DNF"
  | "smart"
  | "virtual"
  | null;

export interface StatsFilters {
  dateFrom: number | null;
  dateTo: number | null;
  activeFilter: SolveFilterCategory;
  methods: Set<SolveMethod>;
  sort: SortOrder;
  search: string;
  /** Filter by puzzle type. null = show all. Default "333". */
  puzzleType: string | null;
}

export const DEFAULT_FILTERS: StatsFilters = {
  dateFrom: null,
  dateTo: null,
  activeFilter: null,
  methods: new Set(),
  sort: "newest",
  search: "",
  puzzleType: "333",
};

/**
 * Filter + sort solves in-memory. Hook returns memoised `filtered` plus
 * the active filter state + setters. Reset clears everything to defaults.
 *
 * Real-world list sizes: a power-user cuber averages 50–300 solves/session.
 * For 1000+ solves the O(n log n) sort cost remains negligible; this is
 * fine without virtualization in v1.
 */
export function useStatsFilters(
  solves: Solve[],
  initial?: Partial<StatsFilters>,
) {
  const [filters, setFiltersState] = useState<StatsFilters>({
    ...DEFAULT_FILTERS,
    ...initial,
  });

  // Debounce the search string so typing doesn't re-filter thousands of
  // solves on every keystroke (filtering still feels instant on submit).
  const [debouncedSearch] = useDebounce(filters.search, 200);

  /** Allow toggleSet-style setFilters updates. */
  const setFilters = useCallback(
    (next: Partial<StatsFilters>) =>
      setFiltersState((prev) => ({ ...prev, ...next })),
    [],
  );

  // Solves scoped to the active puzzle type (e.g. "333")
  const puzzleSolves = useMemo(() => {
    if (filters.puzzleType == null) return solves;
    return solves.filter((s) => (s.puzzleType ?? "333") === filters.puzzleType);
  }, [solves, filters.puzzleType]);

  const filtered = useMemo(() => {
    return puzzleSolves.filter((s) => {
      if (filters.dateFrom != null && s.timestamp < filters.dateFrom)
        return false;
      if (filters.dateTo != null && s.timestamp > filters.dateTo)
        return false;
      const normalizedPen = normalizePenalty(s.penalty);
      if (filters.activeFilter === "clean" && normalizedPen !== "none")
        return false;
      if (filters.activeFilter === "+2" && normalizedPen !== "+2")
        return false;
      if (filters.activeFilter === "DNF" && normalizedPen !== "DNF")
        return false;
      if (filters.activeFilter === "smart" && s.source !== "smart")
        return false;
      if (filters.activeFilter === "virtual" && s.source !== "virtual")
        return false;
      if (
        s.method &&
        filters.methods.size > 0 &&
        !filters.methods.has(s.method)
      )
        return false;
      if (debouncedSearch.trim().length > 0) {
        const q = debouncedSearch.trim().toLowerCase();
        const noteOk = s.note?.toLowerCase().includes(q) ?? false;
        const scrOk = s.scramble.toLowerCase().includes(q);
        const penOk = normalizedPen.toLowerCase().includes(q);
        const timeOk = formatTime(effectiveTime(s)).toLowerCase().includes(q);
        if (!noteOk && !scrOk && !penOk && !timeOk) return false;
      }
      return true;
    });
  }, [
    puzzleSolves,
    filters.dateFrom,
    filters.dateTo,
    filters.activeFilter,
    filters.methods,
    debouncedSearch,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (filters.sort) {
      case "newest":
        arr.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case "oldest":
        arr.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case "best":
        arr.sort((a, b) => effectiveTime(a) - effectiveTime(b));
        break;
      case "worst":
        arr.sort((a, b) => effectiveTime(b) - effectiveTime(a));
        break;
      case "pbDelta": {
        const valid = puzzleSolves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
        if (valid.length === 0) {
          arr.sort((a, b) => b.timestamp - a.timestamp);
          break;
        }
        const pb = Math.min(...valid.map((s) => effectiveTime(s)));
        arr.sort(
          (a, b) =>
            effectiveTime(a) - pb - (effectiveTime(b) - pb),
        );
        break;
      }
    }
    return arr;
  }, [filtered, filters.sort, puzzleSolves]);

  const reset = useCallback(
    () => setFiltersState({ ...DEFAULT_FILTERS }),
    [],
  );

  return {
    filters,
    setFilters,
    filtered: sorted,
    puzzleSolves,
    totalCount: puzzleSolves.length,
    filteredCount: sorted.length,
    reset,
  };
}
