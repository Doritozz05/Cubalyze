"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchReconIndex,
  type ReconIndexEntry,
} from "./reconData";
import { ReconstructionDetailView } from "./ReconstructionDetailView";

// ─── Filter state ───────────────────────────────────────────────────────────

type SortOrder = "fastest" | "slowest" | "newest" | "oldest";

function normalizeMethodName(m: string): string {
  if (!m) return "Other";
  if (m.toUpperCase() === "ORTEGA") return "Ortega";
  return m;
}

const SORT_OPTIONS = [
  { id: "fastest", labelKey: "sortFastest" },
  { id: "slowest", labelKey: "sortSlowest" },
  { id: "newest", labelKey: "sortNewest" },
  { id: "oldest", labelKey: "sortOldest" },
] as const;

const SOURCE_CHIPS: ("All" | "cuberoot" | "reconz")[] = ["All", "cuberoot", "reconz"];

/** Distinct puzzles present in the dataset, sorted (the Select adds "All"). */
function puzzleOptions(index: ReconIndexEntry[] | null): string[] {
  const set = new Set<string>();
  for (const e of index ?? []) set.add(e.puzzle);
  const order = ["3x3", "2x2", "4x4", "5x5", "6x6", "7x7", "pyraminx", "skewb", "square-1", "clock", "megaminx"];
  return [...set].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}


/**
 * Extract a plausible competition year from a free-text source.
 *
 * Returns null when the match is not a real year. CubeRoot URLs embed the
 * numeric solve id (`/recon/2084-…`) which must never be surfaced as a date,
 * so URL scans (`dashPrefixed`) only accept years written dash-prefixed
 * (slugs always write `…-spring-open-2025-f`); the id is never prefixed.
 */
function extractYear(text: string, dashPrefixed = false): string | null {
  const m = text.match(dashPrefixed ? /-(?:19|20)\d{2}/ : /(?:19|20)\d{2}/);
  if (!m) return null;
  const raw = dashPrefixed ? m[0].slice(1) : m[0];
  // WCA competitions exist between 1982 (first World Championship) and the
  // present. Anything outside 1980–2030 is an id, a z-index, or noise.
  const year = Number(raw);
  return year >= 1980 && year <= 2030 ? raw : null;
}

export function formatDisplayDate(date: string | null, competition?: string, url?: string | null): string {
  if (date) return date;
  if (competition) {
    const y = extractYear(competition);
    if (y) return y;
  }
  if (url) {
    const y = extractYear(url, true);
    if (y) return y;
  }
  return "—";
}

export function getSortDate(e: ReconIndexEntry): string {
  if (e.date) return e.date;
  if (e.competition) {
    const y = extractYear(e.competition);
    if (y) return y;
  }
  if (e.url) {
    const y = extractYear(e.url, true);
    if (y) return y;
  }
  // Year-only values ("2023") sort before every ISO date of that year
  // lexicographically — undated solves rank first within their year.
  return "";
}

// ─── Row ────────────────────────────────────────────────────────────────────

function ReconRow({
  entry,
  rank,
  selected,
  onSelect,
}: {
  entry: ReconIndexEntry;
  rank: number;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      className={cn(
        "grid w-full grid-cols-[2.75rem_1.6fr_4.25rem_6.75rem_1.7fr_4.5rem_1.2fr] items-center gap-2 border-b border-line/60 px-3 text-left transition-colors",
        "hover:bg-surface-2",
        selected && "bg-surface-2",
      )}
      style={{ height: 44 }}
    >
      <span className="nums text-right text-xs text-ink-3">{rank + 1}</span>

      <span className="min-w-0">
        <span className="block truncate text-[0.8rem] font-medium text-ink">
          {entry.solver}
        </span>
        <span className="block truncate text-[0.6rem] text-ink-3">
          {entry.competition || "—"}
        </span>
      </span>

      <span className="nums text-[0.85rem] font-semibold tabular-nums text-ink">
        {entry.time > 0 ? formatTime(entry.time * 1000) : "—"}
      </span>

      <span className="nums text-xs text-ink-2 max-xl:hidden">
        {formatDisplayDate(entry.date, entry.competition, entry.url)}
      </span>

      <span className="truncate text-xs text-ink-2 max-lg:hidden">
        {entry.competition}
      </span>

      <span>
        <span
          className={cn(
            "inline-block rounded border px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider",
            (entry.method === "CFOP" || entry.methodGroup === "CFOP") && "border-phase-blue/40 bg-phase-blue/10 text-phase-blue",
            (entry.method === "Roux" || entry.methodGroup === "Roux") && "border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
            (entry.method === "EG" || entry.method === "CLL" || entry.method === "Ortega" || entry.method === "ORTEGA") && "border-phase-emerald/40 bg-phase-emerald/10 text-phase-emerald",
            (entry.method === "ZB" || entry.method === "Yau" || entry.method === "Hoya" || entry.method === "L4E") && "border-phase-amber/40 bg-phase-amber/10 text-phase-amber",
            !["CFOP", "Roux", "EG", "CLL", "Ortega", "ORTEGA", "ZB", "Yau", "Hoya", "L4E"].includes(entry.method) && entry.methodGroup !== "CFOP" && entry.methodGroup !== "Roux" && "border-line bg-surface-2 text-ink-3",
          )}
        >
          {entry.method}
        </span>
      </span>

      <span className="flex min-w-0 items-center justify-end gap-1 max-lg:hidden">
        {entry.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="truncate rounded bg-surface-2 px-1.5 py-0.5 text-[0.56rem] font-medium text-ink-2 border border-line/60 max-w-20"
          >
            {t}
          </span>
        ))}
        {entry.tags.length > 2 && (
          <span className="nums text-[0.56rem] text-ink-3">
            +{entry.tags.length - 2}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── View ───────────────────────────────────────────────────────────────────

export function ReconstructionsView() {
  const { t, i18n } = useTranslation("reconstructions");
  const [index, setIndex] = useState<ReconIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<string>("All");
  const [source, setSource] = useState<"All" | "cuberoot" | "reconz">("All");
  const [puzzle, setPuzzle] = useState<string>("all");
  const [sort, setSort] = useState<SortOrder>("fastest");

  // The selected reconstruction lives in the URL (/reconstructions/:key) so
  // details are deep-linkable, shareable and survive reloads.
  const location = useLocation();
  const match = location.pathname.match(/^\/reconstructions\/([^/?#]+)/);
  const selectedKey = match ? decodeURIComponent(match[1]) : undefined;
  const navigate = useNavigate();

  const scrollRef = useRef<HTMLDivElement>(null);

  // t is stable across renders; the fallback error message is static per render
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelled = false;
    fetchReconIndex()
      .then((entries) => {
        if (!cancelled) setIndex(entries);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("list.errorLoad"));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Solves matching puzzle + source filters (before method and search)
  const puzzleScopedSolves = useMemo(() => {
    if (!index) return [];
    return index.filter((e) => {
      if (source !== "All" && e.source !== source) return false;
      if (puzzle !== "all" && e.puzzle !== puzzle) return false;
      return true;
    });
  }, [index, puzzle, source]);

  // Dynamic method counts and chips for the currently selected puzzle and source
  const { methodChips, methodCounts, totalScopedCount } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of puzzleScopedSolves) {
      const norm = normalizeMethodName(e.method);
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
    // Sort methods by count descending, placing 'Other' at the end if present
    let sortedMethods = [...counts.keys()].sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    });

    // In "All puzzles" mode, limit to top primary methods + Other so it doesn't overflow
    if (puzzle === "all" && sortedMethods.length > 6) {
      const top = sortedMethods.filter((m) => m !== "Other").slice(0, 5);
      if (counts.has("Other") || sortedMethods.length > 5) {
        top.push("Other");
      }
      sortedMethods = top;
    }

    return {
      methodChips: ["All", ...sortedMethods],
      methodCounts: counts,
      totalScopedCount: puzzleScopedSolves.length,
    };
  }, [puzzleScopedSolves, puzzle]);

  const getChipCount = useCallback(
    (m: string): number => {
      if (m === "All") return totalScopedCount;
      if (m === "Other" && puzzle === "all" && methodChips.length > 1) {
        const topExplicit = new Set(methodChips.filter((c) => c !== "All" && c !== "Other"));
        let count = 0;
        for (const [key, cnt] of methodCounts.entries()) {
          if (!topExplicit.has(key)) count += cnt;
        }
        return count;
      }
      return methodCounts.get(m) ?? 0;
    },
    [totalScopedCount, puzzle, methodChips, methodCounts],
  );

  // Auto-reset method filter if selected method is not in the new scope
  useEffect(() => {
    if (method !== "All" && !methodChips.includes(method)) {
      setMethod("All");
    }
  }, [method, methodChips]);

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return puzzleScopedSolves.filter((e) => {
      if (method !== "All") {
        const norm = normalizeMethodName(e.method);
        if (method === "Other") {
          const isExplicitTop = methodChips.filter((c) => c !== "All" && c !== "Other").includes(norm);
          if (isExplicitTop) return false;
        } else {
          if (norm !== method && e.method !== method) {
            return false;
          }
        }
      }
      if (!q) return true;
      return (
        e.solver.toLowerCase().includes(q) ||
        e.competition.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        e.method.toLowerCase().includes(q)
      );
    });
  }, [index, puzzleScopedSolves, method, methodChips, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "fastest":
        arr.sort((a, b) => (a.time <= 0 ? 1e9 : a.time) - (b.time <= 0 ? 1e9 : b.time));
        break;
      case "slowest":
        arr.sort((a, b) => (b.time <= 0 ? -1e9 : b.time) - (a.time <= 0 ? -1e9 : a.time));
        break;
      case "newest":
        arr.sort((a, b) => getSortDate(b).localeCompare(getSortDate(a)));
        break;
      case "oldest":
        arr.sort((a, b) => getSortDate(a).localeCompare(getSortDate(b)));
        break;
    }
    return arr;
  }, [filtered, sort]);

  // ── Virtualizer ─────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 14,
  });

  const handleSelect = useCallback(
    (key: string) => navigate(`/reconstructions/${encodeURIComponent(key)}`),
    [navigate],
  );
  const handleBack = useCallback(() => navigate("/reconstructions"), [navigate]);

  // ── Detail mode ─────────────────────────────────────────────────────────
  if (selectedKey) {
    return <ReconstructionDetailView recordKey={selectedKey} onBack={handleBack} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Header + filters ── */}
      <div className="shrink-0 border-b border-line bg-surface/60 px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {i18n.t("nav:reconstructions")}
            </h2>
            <p className="text-xs text-ink-3">
              {t("list.subtitle")}
            </p>
          </div>
          <div className="nums flex items-baseline gap-1.5 text-xs text-ink-3">
            <span className="text-sm font-semibold text-ink">
              {sorted.length.toLocaleString()}
            </span>
            {t("list.solvesCount", { count: sorted.length })}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("list.searchPlaceholder")}
            className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-[0.78rem] text-ink placeholder:text-ink-3/60 focus:border-ink/30 focus:outline-none"
          />
        </div>

        {/* Chips + sort */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5 overflow-x-auto max-w-full">
            {methodChips.map((m) => {
              const count = getChipCount(m);
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[0.66rem] font-medium transition-all shrink-0 whitespace-nowrap",
                    method === m
                      ? "bg-ink text-background"
                      : "text-ink-3 hover:text-ink hover:bg-surface-2",
                  )}
                >
                  {m === "All"
                    ? t("list.allMethods")
                    : m === "Other"
                      ? t("list.methodOther")
                      : m}
                  <span className="nums ml-1 opacity-60">{count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
            {SOURCE_CHIPS.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={cn(
                  "rounded px-2.5 py-1 text-[0.66rem] font-medium transition-all",
                  source === s
                    ? "bg-ink text-background"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2",
                )}
              >
                {s === "All" ? t("list.allSources") : s}
              </button>
            ))}
          </div>

          <Select value={puzzle} onValueChange={setPuzzle}>
            <SelectTrigger className="h-7 w-32 gap-2 rounded-md border-line bg-surface px-2 text-[0.65rem] font-medium text-ink">
              <SelectValue placeholder={t("list.allPuzzles")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[0.68rem]">{t("list.allPuzzles")}</SelectItem>
              {puzzleOptions(index).map((p) => (
                <SelectItem key={p} value={p} className="text-[0.68rem]">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setSort(o.id)}
                className={cn(
                  "rounded px-2 py-1 text-[0.66rem] font-medium transition-all",
                  sort === o.id
                    ? "bg-ink text-background"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2",
                )}
              >
                {t(`list.${o.labelKey}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-dnf">{error}</p>
          <p className="text-xs text-ink-3">
            {t("list.errorHint", {
              command: "pnpm dlx tsx pruebas/scripts/build-recon-web-data.ts",
            })}
          </p>
        </div>
      ) : !index ? (
        <div className="flex flex-1 flex-col gap-1 px-5 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Column header */}
          <div className="grid shrink-0 grid-cols-[2.75rem_1.6fr_4.25rem_6.75rem_1.7fr_4.5rem_1.2fr] items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-3">
            <span className="text-right">#</span>
            <span>{t("list.colSolver")}</span>
            <span>{t("list.colTime")}</span>
            <span className="max-xl:hidden">{t("list.colDate")}</span>
            <span className="max-lg:hidden">{t("list.colCompetition")}</span>
            <span>{t("list.colMethod")}</span>
            <span className="text-right max-lg:hidden">{t("list.colTech")}</span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                <p className="text-sm text-ink-2">{t("list.emptyTitle")}</p>
                <p className="text-xs text-ink-3">{t("list.emptyHint")}</p>
              </div>
            ) : (
              <div
                className="relative w-full"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => (
                  <div
                    key={sorted[vi.index].key}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    <ReconRow
                      entry={sorted[vi.index]}
                      rank={vi.index}
                      selected={false}
                      onSelect={handleSelect}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
