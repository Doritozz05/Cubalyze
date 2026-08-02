"use client";

import { useMemo, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import type { Solve, Penalty, SolveMethod } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";

/** Sort orders for the solves list. */
export type SortOrder =
  | "newest"
  | "oldest"
  | "best"
  | "worst"
  | "pbDelta";

export interface StatsFilters {
  dateFrom: number | null;
  dateTo: number | null;
  penalties: Set<Penalty>;
  methods: Set<SolveMethod>;
  sort: SortOrder;
  /** Keep only solves recorded with a Smart Cube (i.e. `source === "smart"`). */
  smartCubeOnly: boolean;
  search: string;
  /** Filter by puzzle type. null = show all. Default "3x3x3". */
  puzzleType: string | null;
}

export const DEFAULT_FILTERS: StatsFilters = {
  dateFrom: null,
  dateTo: null,
  penalties: new Set(["none", "+2", "DNF"]),
  methods: new Set(),
  sort: "newest",
  smartCubeOnly: false,
  search: "",
  puzzleType: "3x3x3",
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

  const filtered = useMemo(() => {
    return solves.filter((s) => {
      if (filters.dateFrom != null && s.timestamp < filters.dateFrom)
        return false;
      if (filters.dateTo != null && s.timestamp > filters.dateTo)
        return false;
      const normalizedPen = normalizePenalty(s.penalty);
      if (!filters.penalties.has(normalizedPen)) return false;
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
      if (filters.smartCubeOnly && s.source !== "smart") return false;
      if (filters.puzzleType != null && (s.puzzleType ?? "3x3x3") !== filters.puzzleType) return false;
      return true;
    });
  }, [
    solves,
    filters.dateFrom,
    filters.dateTo,
    filters.penalties,
    filters.methods,
    debouncedSearch,
    filters.smartCubeOnly,
    filters.puzzleType,
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
        const valid = solves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
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
  }, [filtered, filters.sort, solves]);

  const reset = useCallback(
    () => setFiltersState({ ...DEFAULT_FILTERS }),
    [],
  );

  return {
    filters,
    setFilters,
    filtered: sorted,
    totalCount: solves.length,
    filteredCount: sorted.length,
    reset,
  };
}
