"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, ChevronLeft, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import { useStatsFilters } from "@/hooks/useStatsFilters";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import { useIsTouch } from "@/hooks/use-mobile";
import type { SessionMeta } from "@/hooks/usePersistentSession";
import { SolveListPanel } from "./SolveListPanel";
import { OverviewPanel } from "./OverviewPanel";
import { SolveAnalysisPanel } from "./SolveAnalysisPanel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoveToSessionDialog } from "./MoveToSessionDialog";
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
  /** Re-run the analysis pipeline on a stored solve. */
  onReanalyze: (solve: Solve) => Promise<void>;
  onDeleteSolve: (id: string) => void;
  /** Move solves to another session (batch). */
  onMoveSolves: (ids: string[], targetSessionId: string) => void;
  className?: string;
}

/** Puzzle label from the shared SSoT map ("333" → "3×3", "333oh" → "3×3 OH"). */
function puzzleLabel(pt: string): string {
  return puzzleTypeLabel(pt);
}

/**
 * Unified Insights dashboard with two independent filter dimensions:
 *
 *   1. Session selector — "All sessions" (default) or a specific session.
 *      Picking a non-active session also switches the active session, so the
 *      switcher stays reachable even when the header is hidden.
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
  onReanalyze,
  onDeleteSolve,
  onMoveSolves,
  className,
}: InsightsDashboardProps) {
  const { t } = useTranslation("insights");
  void sessionId;

  // ── Touch regime (<768px): master-detail pages ─────────────────────
  // "list" = solve list page + full-screen detail overlay;
  // "stats" = OverviewPanel page. Desktop shows both side-by-side.
  const isTouch = useIsTouch();
  const [touchSection, setTouchSection] = useState<"list" | "stats">("list");

  // ── Two filter dimensions ───────────────────────────────────────────
  // Session: null = "All sessions", string = specific session id
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Data source: either current session solves or fetched
  const [allSessionSolves, setAllSessionSolves] = useState<Solve[] | null>(null);
  const [specificSessionSolves, setSpecificSessionSolves] = useState<Solve[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch data when filters change
  useEffect(() => {
    let cancelled = false;

    if (selectedSession === null) {
      // "All sessions" — fetch non-active sessions and combine with active session's live `solves`
      setLoadingData(true);
      const otherSessions = sessions.filter((s) => s.id !== activeSessionId);

      Promise.all(otherSessions.map((s) => fetchSessionSolves(s.id)))
        .then((results) => {
          if (!cancelled) {
            setAllSessionSolves([...solves, ...results.flat()]);
            setSpecificSessionSolves(null);
          }
        })
        .catch(() => {
          if (!cancelled) setAllSessionSolves(solves);
        })
        .finally(() => {
          if (!cancelled) setLoadingData(false);
        });
    } else if (selectedSession === activeSessionId) {
      // Active session — use already-loaded solves
      setSpecificSessionSolves(null);
    } else {
      // Specific non-active session — fetch it
      setLoadingData(true);
      fetchSessionSolves(selectedSession)
        .then((rows) => {
          if (!cancelled) {
            setSpecificSessionSolves(rows);
            setAllSessionSolves(null);
          }
        })
        .catch(() => {
          if (!cancelled) setSpecificSessionSolves([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingData(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedSession, sessions, fetchSessionSolves, activeSessionId, solves]);

  // Determine the data pool to filter from. Dedupes by id as a safety net:
  // move+session-switch races could otherwise surface the same solve twice
  // (the hook now guards the race itself; this keeps the UI honest anyway).
  const dataPool = useMemo(() => {
    const base =
      selectedSession === null
        ? (allSessionSolves ?? [])
        : selectedSession === activeSessionId
          ? solves
          : (specificSessionSolves ?? []);
    const seen = new Set<string>();
    return base.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  }, [selectedSession, allSessionSolves, specificSessionSolves, solves, activeSessionId]);

  const { filters, setFilters, filtered, puzzleSolves, totalCount, filteredCount, reset } =
    useStatsFilters(dataPool);

  // Current cube type from filters (always non-null, default "333")
  const currentCube = filters.puzzleType ?? "333";

  // Available cube types in the data pool
  const availableCubeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const s of dataPool) {
      types.add(s.puzzleType ?? "333");
    }
    if (types.size === 0) types.add("333");
    return Array.from(types).sort();
  }, [dataPool]);

  // Ensure current cube type is valid for data pool
  useEffect(() => {
    if (!availableCubeTypes.includes(currentCube) && availableCubeTypes.length > 0) {
      setFilters({ puzzleType: availableCubeTypes[0] });
    }
  }, [availableCubeTypes, currentCube, setFilters]);

  // ── Selection (synced to ?solve= URL param) ────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Confirmation before deleting a solve (mirrors TimerContainer/TimesList).
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Selection mode (touch: long-press a solve row to enter) ────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  // Destination picker for moving solve(s) to another session.
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);

  // The ?solve= URL param is the source of truth until the data pool has
  // loaded. Before that point the URL-sync effect below must never write to
  // the URL: in dev, React StrictMode double-invokes effects on mount, and a
  // sync run while selectedId is still null (data pool not loaded yet) would
  // strip the param — so Analyze/Replay from the timer land on the overview
  // instead of the requested solve's analysis.
  const initializedRef = useRef(false);

  // Resolve the initial selection from ?solve= once the pool is available.
  useEffect(() => {
    if (initializedRef.current) return;
    if (dataPool.length === 0) return; // still loading — keep waiting
    initializedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("solve");
    if (initial && dataPool.some((s) => s.id === initial)) {
      setSelectedId(initial);
    } else if (initial) {
      // The requested solve isn't in the current pool (deleted, other
      // session, filtered puzzle…): drop the stale param so the URL always
      // reflects what is actually shown. Guarded by initializedRef, so this
      // single write can never race StrictMode's mount double-effect.
      const url = new URL(window.location.href);
      url.searchParams.delete("solve");
      window.history.replaceState(null, "", url.toString());
    }
  }, [dataPool]);

  useEffect(() => {
    if (selectedId && !dataPool.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dataPool, selectedId]);

  // Keep the URL in sync with USER-driven selection changes only — never
  // before the initial read above has taken ownership of the URL.
  useEffect(() => {
    if (!initializedRef.current) return;
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

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteSolve(id);
      if (selectedId === id) setSelectedId(null);
    },
    [onDeleteSolve, selectedId],
  );

  const handleDeleteRequest = useCallback(() => {
    setDeleteTargetId(null);
    setConfirmDeleteOpen(true);
  }, []);

  const handleDeleteSolveRow = useCallback((id: string) => {
    setDeleteTargetId(id);
    setConfirmDeleteOpen(true);
  }, []);

  const handleMoveRequest = useCallback((ids: string[]) => {
    setMoveIds(ids);
    setMoveOpen(true);
  }, []);

  const handleMoveSolveRow = useCallback(
    (id: string) => {
      handleMoveRequest([id]);
    },
    [handleMoveRequest],
  );

  // ── Selection-mode handlers ───────────────────────────────────────────
  const handleLongPress = useCallback((id: string) => {
    setSelectedId(null);
    setSelection(new Set([id]));
    setSelectionMode(true);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Leaving the mode when the last tick is removed keeps the UI from
  // hanging in an empty selection state — but only after something was
  // selected: the "Select" button enters with an empty selection on purpose.
  const hadSelectionRef = useRef(false);
  useEffect(() => {
    if (selection.size > 0) hadSelectionRef.current = true;
    if (selectionMode && selection.size === 0 && hadSelectionRef.current) {
      hadSelectionRef.current = false;
      setSelectionMode(false);
    }
  }, [selectionMode, selection]);

  const handleEnterSelection = useCallback(() => {
    hadSelectionRef.current = false;
    setSelection(new Set());
    setSelectionMode(true);
  }, []);

  const handleExitSelection = useCallback(() => {
    hadSelectionRef.current = false;
    setSelectionMode(false);
    setSelection(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selection.size === filtered.length) {
      handleExitSelection();
      return;
    }
    setSelection(new Set(filtered.map((s) => s.id)));
  }, [selection.size, filtered, handleExitSelection]);

  const handleBulkDeleteConfirm = useCallback(() => {
    selection.forEach((id) => handleDelete(id));
    handleExitSelection();
  }, [selection, handleDelete, handleExitSelection]);

  const handleMoveConfirm = useCallback(
    (targetSessionId: string) => {
      if (moveIds.length > 0) onMoveSolves(moveIds, targetSessionId);
      handleExitSelection();
      setMoveIds([]);
    },
    [moveIds, onMoveSolves, handleExitSelection],
  );

  // ── Detail mode (desktop only): reconstruction-style split — replay
  //     pinned large on the left, the solve list hidden.
  const [detailMode, setDetailMode] = useState(false);
  const toggleDetailMode = useCallback(() => setDetailMode((v) => !v), []);

  const handleBackToOverview = useCallback(() => {
    setSelectedId(null);
    setDetailMode(false);
  }, []);

  return (
    <div
      // Desktop (>=768px): the dashboard used to sit flush against the
      // header and left rail with no padding — give it the same breathing
      // room the timer view gets. Touch keeps its own compact margins.
      className="relative flex-1 min-h-0 w-full flex flex-col max-lg:px-3 max-lg:pt-2 lg:px-6 lg:pt-3"
      data-onboarding-target="insights"
    >
      {/* ── Top bar: session + cube dropdowns (filters apply to both pages) ─ */}
      <div className="flex shrink-0 items-center gap-3 pb-3 max-lg:gap-2.5">
        {/* Session selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
            {t("dashboard.session")}
          </span>
          <Select
            value={selectedSession ?? "all"}
            onValueChange={(v) => {
              // PURE FILTER: selecting a session here only filters the list.
              // It must NOT switch the active session — the dashboard remounts
              // when the active session changes (keyed by sessionId) and would
              // reset the filter to "All sessions", making the click look
              // broken. Switching lives in the dock/header switcher.
              setSelectedSession(v === "all" ? null : v);
            }}
          >
            <SelectTrigger
              size="sm"
              // Touch: the shared Select inflates triggers to 44px (min-h-11)
              // for primary pickers — for inline dashboard filters that's
              // huge, so pin it back to the compact desktop height here.
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2 max-lg:min-h-7! max-lg:py-1"
              aria-label={t("dashboard.filterBySession")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t("dashboard.allSessions")}
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
            {t("dashboard.cube")}
          </span>
          <Select
            value={currentCube}
            onValueChange={(v) => setFilters({ puzzleType: v })}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2 max-lg:min-h-7! max-lg:py-1"
              aria-label={t("dashboard.filterByCube")}
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
            {t("dashboard.loading")}
          </span>
        )}

        {/* Count */}
        <span className="text-[0.62rem] text-ink-3 tabular-nums ml-auto">
          {filteredCount}
          <span className="text-ink-3/50"> / {totalCount}</span>
        </span>
      </div>

      {/* ── Touch: Solves | Stats full-width segmented switcher ───────── */}
      {/* Second row on touch (after the filters): a standard iOS-style
          segmented control spanning the content width. */}
      {isTouch && (
        <div className="mb-2.5 flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 lg:hidden">
          <button
            type="button"
            onClick={() => setTouchSection("list")}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
              touchSection === "list"
                ? "bg-ink text-surface shadow-sm"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <List className="size-3" />
            {t("dashboard.solves")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTouchSection("stats");
              setSelectedId(null);
            }}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
              touchSection === "stats"
                ? "bg-ink text-surface shadow-sm"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <BarChart3 className="size-3" />
            {t("dashboard.stats")}
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative min-h-0 flex-1 flex flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5",
          className,
        )}
      >
        {/* Column A: solve list */}
        <SolveListPanel
          solves={filtered}
          allSolves={puzzleSolves}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          setFilters={setFilters}
          filteredCount={filteredCount}
          totalCount={totalCount}
          reset={reset}
          selectionMode={selectionMode}
          selection={selection}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onExitSelection={handleExitSelection}
          onLongPress={handleLongPress}
          onEnterSelection={handleEnterSelection}
          onDeleteSelected={() => setConfirmBulkDeleteOpen(true)}
          onMoveSelected={() => handleMoveRequest(Array.from(selection))}
          onMoveSolve={handleMoveSolveRow}
          onDeleteSolve={handleDeleteSolveRow}
          className={cn(
            "lg:w-85 lg:shrink-0",
            // Detail mode hides the list so the replay gets the full width.
            detailMode && "hidden",
            // Touch: the list is the master page (hidden while in Stats).
            isTouch && touchSection === "stats" && "hidden",
          )}
        />

        {/* Column B: content — NOT mounted on touch while the Solves section
            is active. Mounting OverviewPanel (Recharts) inside a display:none
            container makes ResponsiveContainer measure 0×0 and spam
            "width(0) and height(0)" warnings on every hidden re-render. The
            solve list stays mounted so its scroll survives the toggle. */}
        {isTouch && touchSection === "list" ? null : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg bg-canvas">
            {selected && !isTouch ? (
              <SolveAnalysisPanel
                solve={selected}
                liveMetrics={liveMetrics}
                isLive={isLive}
                onUpdateSolve={(updates) => onUpdateSolve(selected.id, updates)}
                onReanalyze={() => onReanalyze(selected)}
                onDeleteSolve={handleDeleteRequest}
                onMoveSolve={() => handleMoveRequest([selected.id])}
                onBackToOverview={handleBackToOverview}
                detailMode={detailMode}
                onToggleDetailMode={toggleDetailMode}
              />
            ) : (
              <OverviewPanel solves={filtered} pb={pb} />
            )}
          </div>
        )}
      </div>

      {/* ── Touch: solve detail as full-screen overlay ────────────────── */}
      {isTouch && touchSection === "list" && (
        <AnimatePresence>
          {selected && (
            <motion.div
              key="touch-solve-detail"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 z-50 flex flex-col bg-canvas lg:hidden"
            >
              {/* Sticky header with back button (safe-area aware) */}
              <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 pt-safe pb-2">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  aria-label={t("dashboard.backToSolves")}
                  className="flex h-10 items-center gap-1.5 rounded-lg pr-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  <ChevronLeft className="size-5" />
                  <span>{t("dashboard.back")}</span>
                </button>
                <span className="truncate text-xs text-ink-3">{t("dashboard.solveDetails")}</span>
              </div>
              {/* Scrollable content — top padding separates the first panel
                  card (timestamp / badges / delete) from the sticky header. */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-safe">
                <SolveAnalysisPanel
                  solve={selected}
                  liveMetrics={liveMetrics}
                  isLive={isLive}
                  onUpdateSolve={(updates) => onUpdateSolve(selected.id, updates)}
                  onReanalyze={() => onReanalyze(selected)}
                  onDeleteSolve={handleDeleteRequest}
                  onMoveSolve={() => handleMoveRequest([selected.id])}
                  onBackToOverview={handleBackToOverview}
                  className="px-3"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Confirmation before deleting a solve — shared by the desktop panel,
          touch detail overlay, and solve list context menu. */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeleteTargetId(null);
        }}
        title={t("analysis.confirmDeleteTitle")}
        description={t("analysis.confirmDeleteDescription")}
        confirmLabel={t("analysis.delete")}
        onConfirm={() => {
          const target = deleteTargetId ?? selected?.id;
          if (target) handleDelete(target);
          setDeleteTargetId(null);
        }}
      />

      {/* Confirmation before bulk-deleting the selection. */}
      <ConfirmDialog
        open={confirmBulkDeleteOpen}
        onOpenChange={setConfirmBulkDeleteOpen}
        title={t("list.confirmDeleteTitle", { count: selection.size })}
        description={t("analysis.confirmDeleteDescription")}
        confirmLabel={t("analysis.delete")}
        onConfirm={handleBulkDeleteConfirm}
      />

      {/* Destination picker for "Move to another session". */}
      <MoveToSessionDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        sessions={sessions}
        count={moveIds.length}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}
