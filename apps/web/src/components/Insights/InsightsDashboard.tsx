"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, ChevronLeft, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Penalty, Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import { useStatsFilters } from "@/hooks/useStatsFilters";
import { useIsTouch } from "@/hooks/use-mobile";
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
  /** Switch the active session (selecting a non-active session in the dropdown). */
  onSwitchSession?: (id: string) => void;
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
  onSwitchSession,
  pb,
  pendingAnalysis,
  sessionId,
  onUpdateSolve,
  onDeleteSolve,
  className,
}: InsightsDashboardProps) {
  const { t } = useTranslation("insights");
  void sessionId;

  // ── Touch regime (<1024px): master-detail pages ─────────────────────
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

  const { filters, setFilters, filtered, puzzleSolves, totalCount, filteredCount, reset } =
    useStatsFilters(dataPool);

  // Current cube type from filters (always non-null, default "3x3x3")
  const currentCube = filters.puzzleType ?? "3x3x3";

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

  // ── Selection (synced to ?solve= URL param) ────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isFirstPush = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("solve");
    if (initial && dataPool.some((s) => s.id === initial)) {
      setSelectedId(initial);
    }
  }, [dataPool]);

  useEffect(() => {
    if (selectedId && !dataPool.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dataPool, selectedId]);

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
    <div className="relative flex-1 min-h-0 w-full flex flex-col" data-onboarding-target="insights">
      {/* ── Top bar: session + cube dropdowns ────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 px-1 pb-3">
        {/* Session selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
            {t("dashboard.session")}
          </span>
          <Select
            value={selectedSession ?? "all"}
            onValueChange={(v) => {
              if (v === "all") {
                setSelectedSession(null);
                return;
              }
              // Selecting a non-active session switches the active session
              // too — the session switcher lives in the header, so this
              // keeps switching possible when the header is hidden. (The
              // dashboard remounts on switch and resets to "All sessions",
              // matching header-switch behavior.)
              if (v !== activeSessionId) onSwitchSession?.(v);
              setSelectedSession(v);
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2"
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
              className="h-7 w-auto gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-ink-2"
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

      {/* ── Touch: Solves | Stats page toggle ─────────────────────────── */}
      {isTouch && (
        <div className="flex shrink-0 items-center gap-1 pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setTouchSection("list")}
            className={cn(
              "flex h-9 max-lg:h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
              touchSection === "list"
                ? "bg-ink text-surface shadow-sm"
                : "border border-line bg-surface text-ink-3 hover:text-ink",
            )}
          >
            <List className="size-3.5" />
            {t("dashboard.solves")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTouchSection("stats");
              setSelectedId(null);
            }}
            className={cn(
              "flex h-9 max-lg:h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
              touchSection === "stats"
                ? "bg-ink text-surface shadow-sm"
                : "border border-line bg-surface text-ink-3 hover:text-ink",
            )}
          >
            <BarChart3 className="size-3.5" />
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
          className={cn(
            "lg:w-85 lg:shrink-0",
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
                onDeleteSolve={() => handleDelete(selected.id)}
                onBackToOverview={handleBackToOverview}
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
              {/* Scrollable content */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-safe">
                <SolveAnalysisPanel
                  solve={selected}
                  liveMetrics={liveMetrics}
                  isLive={isLive}
                  onUpdateSolve={(updates) => onUpdateSolve(selected.id, updates)}
                  onDeleteSolve={() => handleDelete(selected.id)}
                  onBackToOverview={handleBackToOverview}
                  className="px-3"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
