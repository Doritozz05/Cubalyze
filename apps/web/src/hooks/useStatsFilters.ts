"use client";

import { useMemo, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import type { Penalty, Solve, SolveMethod, SolveSource } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { formatTime } from "@/utils/formatTime";

/**
 * Sort orders for the solves list.
 *
 * There used to be a fifth one, `pbDelta` ("PB gap"), whose comparator was
 * `(a - pb) - (b - pb)`. With a single `pb` for the whole list that expression
 * degrades to `a - b`, i.e. it was byte-for-byte the same order as `best` — a
 * duplicate option that silently did nothing. Removed rather than dressed up.
 */
export type SortOrder = "newest" | "oldest" | "best" | "worst";

/**
 * The penalty dimension. Single-select BY NATURE: a solve is clean OR +2 OR
 * DNF, never two of them, so a multi-select here would be able to express
 * states that cannot exist.
 */
export type PenaltyFilter = "all" | "clean" | "+2" | "DNF";

/**
 * Every filter the solve list understands. Each key is one DIMENSION of the
 * data, and each dimension is independent of the others (the hook ANDs them):
 *
 * - `penalty`  → single-select state of the solve
 * - `sources`  → how it was recorded (matches `SolveSource`)
 * - `methods`  → solving method (only the events that declare one)
 * - `cubeId`   → the physical Locker item it was done with
 * - `puzzleType` / `dateFrom` / `dateTo` / `search` / `sort`
 *
 * The dimensions were previously flattened into ONE `activeFilter` union
 * (`"clean" | "+2" | "DNF" | "smart" | "virtual"`) which mixed two unrelated
 * questions — the penalty of a solve and how it was recorded — into a single
 * mutually-exclusive choice. Picking "Smart" therefore hid every +2 solve,
 * which is not something a user can reason about. Splitting them is what makes
 * a unified UI possible: the popover renders one section per dimension, and
 * adding a dimension later (a date range, "has analysis"…) is one key + one
 * section, never a new union member that steals the meaning of the others.
 *
 * Empty `Set` means "no filter" for that dimension, never "match nothing".
 */
export interface StatsFilters {
  dateFrom: number | null;
  dateTo: number | null;
  penalty: PenaltyFilter;
  sources: Set<SolveSource>;
  methods: Set<SolveMethod>;
  sort: SortOrder;
  search: string;
  /** Filter by puzzle type. null = show all. Default "333". */
  puzzleType: string | null;
  /**
   * Filter by the LOCKER item the solve was done with (`solve.cubeId`).
   * null = every cube.
   *
   * It is scoped to one event, not global: you cannot solve 2×2 with a 3×3, so
   * a cube chosen for a 3×3 is meaningless the moment the event selector moves.
   * `mergeStatsFilters` enforces that (see below) instead of leaving a stale id
   * to silently match nothing.
   */
  cubeId: string | null;
}

/**
 * A fresh set of defaults. Always returns NEW `Set` instances: a shared
 * `DEFAULT_FILTERS` object handed the same Set to every hook instance and to
 * `reset()`, so any future in-place mutation of one filter set would have
 * corrupted the defaults for the whole app.
 */
export function freshFilters(overrides?: Partial<StatsFilters>): StatsFilters {
  return {
    dateFrom: null,
    dateTo: null,
    penalty: "all",
    sources: new Set<SolveSource>(),
    methods: new Set<SolveMethod>(),
    sort: "newest",
    search: "",
    puzzleType: "333",
    cubeId: null,
    ...overrides,
  };
}

// ─── Predicates (pure, exported for tests) ─────────────────────────────────

/**
 * Does a solve pass the penalty filter?
 *
 * `"all"` is the absence of a filter. The comparison runs through
 * `normalizePenalty` so a row stored as "dnf" still matches the DNF chip.
 */
export function passesPenaltyFilter(
  solve: Pick<Solve, "penalty">,
  penalty: PenaltyFilter,
): boolean {
  if (penalty === "all") return true;
  const normalized = normalizePenalty(solve.penalty);
  return penalty === "clean" ? normalized === "none" : normalized === penalty;
}

/**
 * Does a solve pass the source filter?
 *
 * An EMPTY selection means "no filter". A non-empty one excludes solves with
 * no source, exactly like the method and cube filters: a solve nobody recorded
 * a source for is not a vote for "smart", and letting it through would make the
 * list disagree with the count shown next to the option.
 */
export function passesSourceFilter(
  solve: Pick<Solve, "source">,
  sources: ReadonlySet<SolveSource>,
): boolean {
  if (sources.size === 0) return true;
  return solve.source != null && sources.has(solve.source);
}

/**
 * Does a solve pass the method filter?
 *
 * An EMPTY selection means "no filter" and lets everything through. A
 * non-empty one excludes solves with no method: since only the events whose
 * spec declares methods (3×3, 3×3 OH) store one, a 2×2 or Pyraminx solve is
 * not a vote for CFOP and must not slip past a CFOP filter (that was the old
 * `if (s.method && …)` behaviour).
 */
export function passesMethodFilter(
  solve: Pick<Solve, "method">,
  methods: ReadonlySet<SolveMethod>,
): boolean {
  if (methods.size === 0) return true;
  return solve.method != null && methods.has(solve.method);
}

/**
 * Does a solve pass the physical-cube filter?
 *
 * `null` means "every cube" and lets everything through. With a cube selected
 * this keeps ONLY that cube's solves — the same rule as the other dimensions,
 * and for the same reason: a solve with no cube attributed is not a solve with
 * this cube, and letting it through would make the list disagree with the count
 * shown next to the option ("GAN 12 · 2" must show two rows, not three).
 *
 * Unattributed solves are therefore reachable through the unfiltered view and
 * through a search, but not through "I used this cube".
 */
export function passesCubeFilter(
  solve: Pick<Solve, "cubeId">,
  cubeId: string | null,
): boolean {
  if (cubeId == null) return true;
  return solve.cubeId === cubeId;
}

// ─── Option derivation (from the data, never hardcoded) ────────────────────

/** How many solves of each penalty state the set contains. */
export function penaltyFilterCounts(
  solves: readonly Pick<Solve, "penalty">[],
): { all: number; clean: number; "+2": number; DNF: number } {
  let clean = 0;
  let plus2 = 0;
  let dnf = 0;
  for (const solve of solves) {
    const normalized: Penalty = normalizePenalty(solve.penalty);
    if (normalized === "none") clean += 1;
    else if (normalized === "+2") plus2 += 1;
    else dnf += 1;
  }
  return { all: solves.length, clean, "+2": plus2, DNF: dnf };
}

/**
 * The sources that actually appear in a set of solves, most used first.
 *
 * Same reasoning as the method and cube options: deriving them from the data
 * means an app that only ever produced "manual" solves never offers a "Virtual"
 * chip that could only ever return an empty list.
 */
export function sourceFilterOptions(
  solves: readonly Pick<Solve, "source">[],
): { source: SolveSource; count: number }[] {
  const bySource = new Map<SolveSource, number>();
  for (const solve of solves) {
    if (!solve.source) continue;
    bySource.set(solve.source, (bySource.get(solve.source) ?? 0) + 1);
  }
  return [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

/**
 * The methods that actually appear in a set of solves, most used first.
 *
 * The list comes from the data, so a solver who only ever used Petrus sees
 * Petrus — not a hardcoded CFOP/Roux pair the analysis engine happens to know
 * about.
 */
export function methodFilterOptions(
  solves: readonly Pick<Solve, "method">[],
): { method: SolveMethod; count: number }[] {
  const byMethod = new Map<SolveMethod, number>();
  for (const solve of solves) {
    if (!solve.method) continue;
    byMethod.set(solve.method, (byMethod.get(solve.method) ?? 0) + 1);
  }
  return [...byMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method));
}

/**
 * The cube ids that actually appear in a set of solves, with their counts and
 * the label frozen on the rows — newest-first, most used first.
 *
 * Derived from the HISTORY rather than from the Locker, for two reasons: a cube
 * with zero solves is not a useful filter option, and a cube you have since
 * deleted from the Locker still has solves that must stay reachable.
 */
export function cubeFilterOptions(
  solves: readonly Pick<Solve, "cubeId" | "cubeLabel">[],
): { id: string; label: string; count: number }[] {
  const byId = new Map<string, { id: string; label: string; count: number }>();
  for (const solve of solves) {
    if (!solve.cubeId) continue;
    const existing = byId.get(solve.cubeId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byId.set(solve.cubeId, {
      id: solve.cubeId,
      label: solve.cubeLabel?.trim() || solve.cubeId,
      count: 1,
    });
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * How many dimensions are narrowing the list right now. Drives the badge on
 * the "Filters" trigger, so the count can never drift from the applied state.
 */
export function countActiveFilters(filters: StatsFilters): number {
  let count = 0;
  if (filters.penalty !== "all") count += 1;
  if (filters.sources.size > 0) count += 1;
  if (filters.methods.size > 0) count += 1;
  if (filters.cubeId !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}

/**
 * Merge a partial update into the current filters, enforcing the one rule that
 * ties the event selector to the cube filter: **changing the event clears the
 * cube filter**.
 *
 * A cube belongs to exactly one event, so carrying the choice across a change
 * would leave a filter that can never match anything: the list would empty out
 * with no visible reason and the Reset button would be the only way back.
 * Callers that genuinely mean to set both at once can pass `cubeId` explicitly.
 *
 * Pure and exported so the rule is testable without rendering the hook.
 */
export function mergeStatsFilters(
  prev: StatsFilters,
  next: Partial<StatsFilters>,
): StatsFilters {
  const merged = { ...prev, ...next };
  const switchingEvent = next.puzzleType !== undefined && next.puzzleType !== prev.puzzleType;
  if (switchingEvent && next.cubeId === undefined) merged.cubeId = null;
  return merged;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

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
  const [filters, setFiltersState] = useState<StatsFilters>(() => freshFilters(initial));

  // Debounce the search string so typing doesn't re-filter thousands of
  // solves on every keystroke (filtering still feels instant on submit).
  const [debouncedSearch] = useDebounce(filters.search, 200);

  /** Allow toggleSet-style setFilters updates. */
  const setFilters = useCallback(
    (next: Partial<StatsFilters>) => setFiltersState((prev) => mergeStatsFilters(prev, next)),
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
      if (!passesPenaltyFilter(s, filters.penalty)) return false;
      if (!passesSourceFilter(s, filters.sources)) return false;
      if (!passesMethodFilter(s, filters.methods)) return false;
      if (!passesCubeFilter(s, filters.cubeId)) return false;
      if (debouncedSearch.trim().length > 0) {
        const q = debouncedSearch.trim().toLowerCase();
        const noteOk = s.note?.toLowerCase().includes(q) ?? false;
        const scrOk = s.scramble.toLowerCase().includes(q);
        const penOk = normalizePenalty(s.penalty).toLowerCase().includes(q);
        const timeOk = formatTime(effectiveTime(s)).toLowerCase().includes(q);
        if (!noteOk && !scrOk && !penOk && !timeOk) return false;
      }
      return true;
    });
  }, [
    puzzleSolves,
    filters.dateFrom,
    filters.dateTo,
    filters.penalty,
    filters.sources,
    filters.methods,
    filters.cubeId,
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
    }
    return arr;
  }, [filtered, filters.sort]);

  const reset = useCallback(() => setFiltersState(freshFilters()), []);

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
