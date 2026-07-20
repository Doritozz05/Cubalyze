"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import { useStatsFilters } from "@/hooks/useStatsFilters";
import { SolveListPanel } from "./SolveListPanel";
import { OverviewPanel } from "./OverviewPanel";
import { SolveAnalysisPanel } from "./SolveAnalysisPanel";

export interface InsightsDashboardProps {
  solves: Solve[];
  /** Personal best across the active session. */
  pb?: number;
  /** Pending analysis from the just-completed live solve (not yet persisted).
   *  Only surfaced when the user selects the most recent solve that has no
   *  stored analysis yet — never for arbitrary old solves. */
  pendingAnalysis: SolveMetrics | null;
  /** Active session id — the component is keyed by this in App.tsx so it
   *  remounts (clean state) on session switch. */
  sessionId: string | null;
  /** Penalty / note editor for the currently selected solve. */
  onUpdateSolve: (
    id: string,
    updates: { penalty?: Penalty; note?: string | null },
  ) => void;
  /** Hard-delete a solve. */
  onDeleteSolve: (id: string) => void;
  className?: string;
}

/**
 * Unified Insights dashboard (Fase 2). Replaces the old separate
 * `StatsDashboard` + `AnalysisDashboard` pair with a single two-column
 * layout where each panel scrolls independently:
 *
 *  ┌──────────────────┬──────────────────────────────┐
 *  │ SolveListPanel   │ ContentPanel (flex-1)        │
 *  │ 340px / lg+      │  ├─ overview → OverviewPanel │
 *  │ own scroll       │  └─ solve → SolveAnalysisPanel│
 *  └──────────────────┴──────────────────────────────┘
 *
 * - One `useStatsFilters` instance shared across both panels.
 * - Selection synced to `?solve=<id>` in the URL (addressable, shareable).
 * - Filters + selection reset only when the session identity changes
 *   (`sessionId`), not on every solve — fixing the old "filters reset on
 *   each new solve" bug.
 */
export function InsightsDashboard({
  solves,
  pb,
  pendingAnalysis,
  sessionId,
  onUpdateSolve,
  onDeleteSolve,
  className,
}: InsightsDashboardProps) {
  void sessionId; // The component is keyed by sessionId in App.tsx → remounts.

  const { filters, setFilters, filtered, totalCount, filteredCount, reset } =
    useStatsFilters(solves);

  // ── Selection (synced to ?solve= URL param) ────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Guards the push-to-URL effect so it skips its own first execution
  // (mount). On mount, the read effect (declared above) reads ?solve= and
  // calls setSelectedId, but that state update is batched — so when the
  // push effect runs right after, selectedId is still null and it would
  // delete ?solve= from the URL. Skipping the first push run prevents that
  // clobber; the subsequent render (after setSelectedId applies) pushes the
  // correct value.
  const isFirstPush = useRef(true);

  // On first mount, read ?solve= from the URL; if it points to an existing
  // solve, select it. Otherwise leave null (overview mode).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("solve");
    if (initial && solves.some((s) => s.id === initial)) {
      setSelectedId(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the selected solve is no longer in the list (deleted, or filtered
  // out), fall back to null (overview) so we never show a stale panel.
  useEffect(() => {
    if (selectedId && !solves.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solves]);

  // Push selection to URL whenever it changes — but skip the first run
  // (mount) to avoid clobbering the URL before the mount-read effect has
  // had a chance to set selectedId.
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

  // The most recent solve (newest timestamp) — used to decide whether the
  // pending live analysis belongs to the selected solve.
  const latestSolveId = useMemo(
    () => (solves.length > 0 ? solves.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).id : null),
    [solves],
  );

  // Live metrics: prefer the selected solve's stored analysis. Only fall
  // back to the pending live analysis when the selected solve IS the most
  // recent one AND it has no stored analysis yet — otherwise we'd show the
  // last solve's analysis mislabeled as belonging to an old selected solve.
  const liveMetrics: SolveMetrics | null =
    selected?.analysis ??
    (selected && selected.id === latestSolveId && !selected.analysis ? pendingAnalysis : null);
  const isLive =
    !!selected &&
    !selected.analysis &&
    selected.id === latestSolveId &&
    !!pendingAnalysis;

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteSolve(id);
      // Fall back to overview after deleting the selected solve.
      setSelectedId(null);
    },
    [onDeleteSolve],
  );

  const handleBackToOverview = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div
        className={cn(
          "absolute inset-0 flex flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5",
          className,
        )}
      >
      {/* Column A: solve list (fixed width on desktop, own scroll) */}
      <SolveListPanel
        solves={filtered}
        allSolves={solves}
        selectedId={selectedId}
        onSelect={setSelectedId}
        filters={filters}
        setFilters={setFilters}
        filteredCount={filteredCount}
        totalCount={totalCount}
        reset={reset}
        className="lg:w-85 lg:shrink-0"
      />

      {/* Column B: content (flex-1, own scroll) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg">
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


