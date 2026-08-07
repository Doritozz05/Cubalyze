"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
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
  useReconIndex,
  type ReconIndexEntry,
  type ReconMethodGroup,
} from "./reconData";
import { ReconstructionDetailView } from "./ReconstructionDetailView";

// ─── Filter state ───────────────────────────────────────────────────────────

type SortOrder = "fastest" | "slowest" | "newest" | "oldest";

const METHOD_CHIPS: (ReconMethodGroup | "All")[] = ["All", "CFOP", "Roux", "Other"];
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
const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "fastest", label: "Fastest" },
  { id: "slowest", label: "Slowest" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
];

function formatDate(date: string | null): string {
  if (!date) return "—";
  return date; // ISO yyyy-mm-dd, already compact + sortable
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
        {formatDate(entry.date)}
      </span>

      <span className="truncate text-xs text-ink-2 max-lg:hidden">
        {entry.competition}
      </span>

      <span>
        <span
          className={cn(
            "inline-block rounded border px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider",
            entry.methodGroup === "CFOP" && "border-phase-blue/40 bg-phase-blue/10 text-phase-blue",
            entry.methodGroup === "Roux" && "border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
            entry.methodGroup === "Other" && "border-line bg-surface-2 text-ink-3",
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
  const [index, setIndex] = useState<ReconIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<ReconMethodGroup | "All">("All");
  const [source, setSource] = useState<"All" | "cuberoot" | "reconz">("All");
  const [puzzle, setPuzzle] = useState<string>("all");
  const [sort, setSort] = useState<SortOrder>("fastest");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    useReconIndex()
      .then((entries) => {
        if (!cancelled) setIndex(entries);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reconstructions");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return index.filter((e) => {
      if (method !== "All" && e.methodGroup !== method) return false;
      if (source !== "All" && e.source !== source) return false;
      if (puzzle !== "all" && e.puzzle !== puzzle) return false;
      if (!q) return true;
      return (
        e.solver.toLowerCase().includes(q) ||
        e.competition.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [index, search, method, source, puzzle]);

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
        arr.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        break;
      case "oldest":
        arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        break;
    }
    return arr;
  }, [filtered, sort]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { All: index?.length ?? 0, CFOP: 0, Roux: 0, Other: 0 };
    for (const e of index ?? []) counts[e.methodGroup] += 1;
    return counts;
  }, [index]);

  // ── Virtualizer ─────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 14,
  });

  const handleSelect = useCallback((key: string) => setSelectedKey(key), []);
  const handleBack = useCallback(() => setSelectedKey(null), []);

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
              Reconstructions
            </h2>
            <p className="text-xs text-ink-3">
              Reconstructed solves from reco.nz and CubeRoot — browse solver
              profiles, cases and techniques.
            </p>
          </div>
          <div className="nums flex items-baseline gap-1.5 text-xs text-ink-3">
            <span className="text-sm font-semibold text-ink">
              {sorted.length.toLocaleString()}
            </span>
            solves
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search solver, competition, technique…"
            className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-[0.78rem] text-ink placeholder:text-ink-3/60 focus:border-ink/30 focus:outline-none"
          />
        </div>

        {/* Chips + sort */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-line/70 bg-surface p-0.5">
            {METHOD_CHIPS.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  "rounded px-2.5 py-1 text-[0.66rem] font-medium transition-all",
                  method === m
                    ? "bg-ink text-background"
                    : "text-ink-3 hover:text-ink hover:bg-surface-2",
                )}
              >
                {m}
                <span className="nums ml-1 opacity-60">{groupCounts[m]}</span>
              </button>
            ))}
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
                {s === "All" ? "All sources" : s}
              </button>
            ))}
          </div>

          <Select value={puzzle} onValueChange={setPuzzle}>
            <SelectTrigger className="h-7 w-32 gap-2 rounded-md border-line bg-surface px-2 text-[0.65rem] font-medium text-ink">
              <SelectValue placeholder="All puzzles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[0.68rem]">All puzzles</SelectItem>
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
                {o.label}
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
            Run <code className="font-mono">pnpm dlx tsx pruebas/scripts/build-recon-web-data.ts</code> to generate the assets.
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
            <span>Solver</span>
            <span>Time</span>
            <span className="max-xl:hidden">Date</span>
            <span className="max-lg:hidden">Competition</span>
            <span>Method</span>
            <span className="text-right max-lg:hidden">Tech</span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                <p className="text-sm text-ink-2">No reconstructions match</p>
                <p className="text-xs text-ink-3">Try clearing the search or filters.</p>
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
