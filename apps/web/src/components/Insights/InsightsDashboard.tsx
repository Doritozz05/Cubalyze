"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import { useStatsFilters } from "@/hooks/useStatsFilters";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import { SolveListPanel } from "./SolveListPanel";
import { OverviewPanel } from "./OverviewPanel";
import { SolveAnalysisPanel } from "./SolveAnalysisPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface InsightsDashboardProps {
  /** Solves from the CURRENT active session (used for specific-session views). */
  solves: Solve[];
  /** All known sessions (for the session selector dropdown). */
  sessions: SessionMeta[];
  /** Fetch solves for any session by ID. */
  fetchSessionSolves: (sessionId: string) => Promise<Solve[]>;
  /** Active session ID — used to pre-select in the dropdown. */
  activeSessionId: string | null;
  /** Personal best across the active session. */
  pb?: number;
  /** Pending analysis from the just-completed live solve. */
  pendingAnalysis: SolveMetrics | null;
  /** Active session id — the component is keyed by this in App.tsx so it remounts. */
  sessionId: string | null;
  onUpdateSolve: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  onDeleteSolve: (id: string) => void;
  className?: string;
}

/** Puzzle type label: "3x3x3" → "3×3", "2x2x2" → "2×2" */
function puzzleLabel(pt: string): string {
  if (pt === "2x2x2") return "2×2";
  if (pt === "3x3x3") return "3×3";
  return pt.replace(/x/g, "×");
}

/**
 * Unified Insights dashboard with two independent filter dimensions:
 *
 *   1. Session selector — "All sessions" (default) or a specific session
 *   2. Cube selector — "3×3" (default) or "2×2" (never mixed)
 *
 * Data = intersection of both filters:
 *   • All + 3×3 → all 3×3 solves across ALL sessions
 *   • Session X + 2×2 → only 2×2 solves from session X
 */
export function InsightsDashboard({
  solves,
  sessions,
  fetchSessionSolves,
  activeSessionId,
  pb,
  pendingAnalysis,
  sessionId,
  onUpdateSolve,
  onDeleteSolve,
  className,
}: InsightsDashboardProps) {
  void sessionId;

  // ── Two filter dimensions ───────────────────────────────────────────
  // Session: null = "All sessions", string = specific session id
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Data source: either current session solves or fetched
  const [allSessionSolves, setAllSessionSolves] = useState<Solve[] | null>(null);
  const [specificSessionSolves, setSpecificSessionSolves] = useState<Solve[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch data when filters change
  useEffect(() => {
    if (selectedSession === null) {
      // "All sessions" — fetch all
      setLoadingData(true);
      Promise.all(sessions.map((s) => fetchSessionSolves(s.id)))
        .then((results) => {
          setAllSessionSolves(results.flat());
          setSpecificSessionSolves(null);
        })
        .catch(() => setAllSessionSolves([]))
        .finally(() => setLoadingData(false));
    } else if (selectedSession === activeSessionId) {
      // Active session — use already-loaded solves
      setSpecificSessionSolves(null);
    } else {
      // Specific non-active session — fetch it
      setLoadingData(true);
      fetchSessionSolves(selectedSession)
        .then((rows) => {
          setSpecificSessionSolves(rows);
          setAllSessionSolves(null);
        })
        .catch(() => setSpecificSessionSolves([]))
        .finally(() => setLoadingData(false));
    }
  }, [selectedSession, sessions, fetchSessionSolves, activeSessionId]);

  // Determine the data pool to filter from
  const dataPool = useMemo(() => {
    if (selectedSession === null) {
      return allSessionSolves ?? [];
    }
    if (selectedSession === activeSessionId) {
      return solves;
    }
    return specificSessionSolves ?? [];
  }, [selectedSession, allSessionSolves, specificSessionSolves, solves, activeSessionId]);

  // Available cube types in the data pool
  const availableCubeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const s of dataPool) {
      types.add(s.puzzleType ?? "3x3x3");
    }
    if (types.size === 0) types.add("3x3x3");
    return Array.from(types).sort();
  }, [dataPool]);

  // Ensure current cube type is valid for data pool
  useEffect(() => {
    if (!availableCubeTypes.includes(currentCube) && availableCubeTypes.length > 0) {
      setFilters({ puzzleType: availableCubeTypes[0] });
    }
  }, [availableCubeTypes, currentCube, setFilters]);

  const { filters, setFilters, filtered, totalCount, filteredCount, reset } =
    useStatsFilters(dataPool);

  // Current cube type from filters (always non-null, default "3x3x3")
  const currentCube = filters.puzzleType ?? "3x3x3";

  // ── Selection (synced to ?solve= URL param) ────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isFirstPush = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("solve");
    if (initial && dataPool.some((s) => s.id === initial)) {
      setSelectedId(initial);
    }
  }, []);

  useEffect(() => {
    if (selectedId && !dataPool.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dataPool]);

  useEffect(() => {
    if (isFirstPush.current) {
      isFirstPush.current = false;
      return;
    }
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("solve", selectedId);
    else url.searchParams.delete("solve");
    window.history.replaceState(null, "", url.toString());
  }, [selectedId]);

  const selected = useMemo<Solve | null>(
    () => filtered.find((s) => s.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const latestSolveId = useMemo(
    () => (dataPool.length > 0 ? dataPool.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).id : null),
    [dataPool],
  );

  const liveMetrics: SolveMetrics | null =
    selected?.analysis ??
    (selected && selected.id === latestSolveId && !selected.analysis ? pendingAnalysis : null);
  const isLive = !!selected && !selected.analysis && selected.id === latestSolveId && !!pendingAnalysis;

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteSolve(id);
      setSelectedId(null);
    },
    [onDeleteSolve],
  );

  const handleBackToOverview = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="relative flex-1 min-h-0 w-full">
      {/* ── Top bar: session + cube dropdowns ────────────────────────── */}
      <div className="flex items-center gap-3 px-1 pb-3">
        {/* Session selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
            Session
          </span>
          <Select
            value={selectedSession ?? "all"}
            onValueChange={(v) =>
              setSelectedSession(v === "all" ? null : v)
            }
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2"
              aria-label="Filter by session"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All sessions
              </SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cube selector — always specific, never "all" */}
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
            Cube
          </span>
          <Select
            value={currentCube}
            onValueChange={(v) => setFilters({ puzzleType: v })}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2"
              aria-label="Filter by cube type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableCubeTypes.map((pt) => (
                <SelectItem key={pt} value={pt} className="text-xs">
                  {puzzleLabel(pt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading indicator */}
        {loadingData && (
          <span className="text-[0.6rem] text-ink-3 animate-pulse">
            Loading...
          </span>
        )}

        {/* Count */}
        <span className="text-[0.62rem] text-ink-3 tabular-nums ml-auto">
          {filteredCount}
          <span className="text-ink-3/50"> / {totalCount}</span>
        </span>
      </div>

      <div
        className={cn(
          "absolute inset-0 top-10 flex flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5",
          className,
        )}
      >
        {/* Column A: solve list */}
        <SolveListPanel
          solves={filtered}
          allSolves={dataPool}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          setFilters={setFilters}
          filteredCount={filteredCount}
          totalCount={totalCount}
          reset={reset}
          className="lg:w-85 lg:shrink-0"
        />

        {/* Column B: content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg bg-canvas">
          {selected ? (
            <SolveAnalysisPanel
              solve={selected}
              liveMetrics={liveMetrics}
              isLive={isLive}
              onUpdateSolve={(updates) => onUpdateSolve(selected.id, updates)}
              onDeleteSolve={() => handleDelete(selected.id)}
              onBackToOverview={handleBackToOverview}
            />
          ) : (
            <OverviewPanel solves={filtered} pb={pb} />
          )}
        </div>
      </div>
    </div>
  );
}
