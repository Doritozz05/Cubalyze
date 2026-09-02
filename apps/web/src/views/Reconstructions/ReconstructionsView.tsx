"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
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

/** Desktop/tablet table columns: # · solver · time · date · competition · method · tech (≥xl).
 *  Uses fixed tracks for numerical/badge columns and proportional fr tracks for
 *  solver and competition so column positions align with 100% precision across
 *  every row regardless of tag count or text lengths. */
const ROW_GRID =
  "grid-cols-[2.25rem_minmax(0,1.2fr)_4.25rem_5.75rem_minmax(0,1.6fr)_4.5rem_5.25rem] xl:grid-cols-[2.25rem_minmax(0,1.2fr)_4.25rem_5.75rem_minmax(0,1.6fr)_4.5rem_5.25rem_6.25rem]";

/** Method chip, coloured per family with the design-system phase palette.
 *  Chips use SOLID fills + paper/white labels — the same badge treatment the
 *  app's lists use (e.g. the SRS review queue: `bg-phase-* text-white`) —
 *  never translucent tints. The amber family follows the `bg-caution
 *  text-surface` pairing (amber is too light for white text). */
function methodBadgeClass(entry: ReconIndexEntry): string {
  const m = (entry.method || "").toUpperCase();
  const group = (entry.methodGroup || "").toUpperCase();

  if (m === "CFOP" || group === "CFOP") {
    return "bg-phase-blue text-white";
  }
  if (m === "ROUX" || group === "ROUX") {
    return "bg-phase-violet text-white";
  }
  if (m.startsWith("EG") || m === "CLL" || m.includes("ORTEGA")) {
    return "bg-phase-emerald text-white";
  }
  if (
    m.startsWith("ZB") ||
    m === "YAU" ||
    m === "HOYA" ||
    m.startsWith("L4E") ||
    m.startsWith("L2L") ||
    m === "ZZ" ||
    m === "PETRUS"
  ) {
    return "bg-caution text-surface";
  }
  if (m.includes("MOVER")) {
    return "bg-phase-purple text-white";
  }
  return "border-line bg-surface-2 text-ink-3";
}

function MethodBadge({ entry }: { entry: ReconIndexEntry }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-fit max-w-full rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider whitespace-nowrap",
        methodBadgeClass(entry),
      )}
      title={entry.method}
    >
      <span className="truncate">{entry.method}</span>
    </span>
  );
}

/** Subtle badge showing which puzzle a row belongs to ("2x2", "pyraminx", …). */
function PuzzleBadge({ puzzle }: { puzzle: string }) {
  return (
    <span
      className="inline-flex w-fit max-w-full shrink-0 items-center justify-center rounded border border-line/60 bg-surface-2/60 px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap text-ink-2"
      title={puzzle}
    >
      <span className="truncate">{puzzle}</span>
    </span>
  );
}

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
  const time = entry.time > 0 ? formatTime(entry.time * 1000) : "—";
  const date = formatDisplayDate(entry.date, entry.competition, entry.url);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      className={cn(
        "block w-full border-b border-line/60 px-3 text-left transition-colors",
        "hover:bg-surface-2",
        selected && "bg-surface-2",
      )}
    >
      {/* Desktop / tablet (≥lg) — single-line table row */}
      <span
        className={cn(
          "hidden w-full items-center gap-2.5 py-2 lg:grid",
          ROW_GRID,
        )}
      >
        <span className="nums text-right text-xs text-ink-3">{rank + 1}</span>

        <span className="min-w-0 truncate text-[0.8rem] font-medium text-ink">
          {entry.solver}
        </span>

        <span className="nums text-right text-[0.85rem] font-semibold text-ink">
          {time}
        </span>

        <span className="nums text-xs text-ink-3 truncate">{date}</span>

        <span className="min-w-0 truncate text-xs text-ink-2">
          {entry.competition || "—"}
        </span>

        <div className="flex min-w-0 items-center justify-start">
          <PuzzleBadge puzzle={entry.puzzle} />
        </div>

        <div className="flex min-w-0 items-center justify-start">
          <MethodBadge entry={entry} />
        </div>

        <div className="hidden xl:flex min-w-0 items-center justify-end gap-1">
          {entry.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="max-w-16 truncate rounded border border-line/60 bg-surface-2 px-1.5 py-0.5 text-[0.56rem] font-medium text-ink-2"
              title={t}
            >
              {t}
            </span>
          ))}
          {entry.tags.length > 2 && (
            <span
              className="nums text-[0.56rem] text-ink-3"
              title={entry.tags.slice(2).join(", ")}
            >
              +{entry.tags.length - 2}
            </span>
          )}
        </div>
      </span>

      {/* Mobile (<lg) — compact two-line card */}
      <span className="flex w-full items-center gap-2.5 py-2 lg:hidden">
        <span className="nums w-6 shrink-0 text-right text-xs text-ink-3">
          {rank + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium text-ink">
            {entry.solver}
          </span>
          <span className="flex items-center gap-1 text-[0.62rem] text-ink-3">
            <span className="truncate">{entry.competition || "—"}</span>
            <PuzzleBadge puzzle={entry.puzzle} />
          </span>
        </span>

        <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
          <span className="nums block text-[0.85rem] font-semibold text-ink">
            {time}
          </span>
          <MethodBadge entry={entry} />
        </div>
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

  // Localized document title: "Reconstructions — 250 reconstructions" for the
  // list, "Reconstruction 2510 — Feliks Zemdegs" while a record is selected.
  const { t: tMeta } = useTranslation("meta");
  const selectedEntry = useMemo(
    () => (selectedKey && index ? index.find((e) => e.key === selectedKey) : undefined),
    [selectedKey, index],
  );
  useDocumentTitle(
    selectedKey
      ? tMeta("reconstruction", {
          id: selectedEntry?.id ?? selectedKey,
          solver: selectedEntry?.solver ?? "",
        })
      : tMeta("reconstructions", { count: index?.length ?? 0 }),
  );

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
    // Mobile rows are two-line cards, desktop rows single-line — every row is
    // re-measured after mount (measureElement), so this is just a start size.
    estimateSize: () => 48,
    overscan: 14,
    getItemKey: (i) => sorted[i].key,
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

        {/* Chips + sort — one horizontally scrollable strip on mobile, wrapping on desktop */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:overflow-visible">
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
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

          <div className="flex shrink-0 items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
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
            <SelectTrigger className="h-7 w-32 shrink-0 gap-2 rounded-md border-line bg-surface px-2 text-[0.65rem] font-medium text-ink">
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

          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
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
          {/* Column header — desktop/tablet only; mobile cards are self-explanatory */}
          <div
            className={cn(
              "hidden shrink-0 items-center gap-2.5 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-3 lg:grid",
              ROW_GRID,
            )}
          >
            <span className="text-right">#</span>
            <span>{t("list.colSolver")}</span>
            <span className="text-right">{t("list.colTime")}</span>
            <span>{t("list.colDate")}</span>
            <span>{t("list.colCompetition")}</span>
            <span>{t("list.colPuzzle")}</span>
            <span>{t("list.colMethod")}</span>
            <span className="text-right hidden xl:block">{t("list.colTech")}</span>
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
                    data-index={vi.index}
                    ref={rowVirtualizer.measureElement}
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
