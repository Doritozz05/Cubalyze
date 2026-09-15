"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData } from "@cubalyze/algorithm-db";
import type { AlgorithmCase } from "@cubalyze/algorithm-db";
import { TrainingBreadcrumb } from "./components";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { findSubsetId, masteryLevel } from "@cubalyze/training";
import type { AlgorithmProgressRecord, PhaseStatsRecord } from "@cubalyze/training";
import {
  Target, Clock, Flame, RotateCcw, TrendingUp, TrendingDown,
  ChevronRight, Lightbulb, Gauge, AlertTriangle, Brain,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

interface PhaseStatsProps {
  methodId: string;
  phaseId: string;
  phaseName: string;
  onBack: () => void;
}

interface CaseStat {
  case: AlgorithmCase;
  mastery: number;
  bestTimeMs: number;
  attempts: number;
  recognitionAccuracy: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "--";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export function PhaseStatsView({
  methodId, phaseId, phaseName, onBack,
}: PhaseStatsProps) {
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const { cases: allCases } = useMemo(() => getSeedData(), []);
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "history">(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("cubeforge_phase_stats_tab");
        if (saved === "overview" || saved === "cases" || saved === "history") {
          return saved;
        }
      }
      return "overview";
    },
  );

  const handleTabChange = (tab: "overview" | "cases" | "history") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cubeforge_phase_stats_tab", tab);
      } catch (e) {
        console.warn("[PhaseStatsView] Failed to save tab to localStorage", e);
      }
    }
  };

  // ── Real progress from DB ──────────────────────────────────────────────
  const { ready, getSubsetProgress, getPhaseStats, getTrainingSessions } = useTrainingProgress();
  const [progressMap, setProgressMap] = useState<Map<string, AlgorithmProgressRecord>>(new Map());
  const [phaseStats, setPhaseStats] = useState<PhaseStatsRecord | null>(null);
  const [sessionHistory, setSessionHistory] = useState<{ day: string; avgTime: number; accuracy: number; attempts: number }[]>([]);

  // Load phase-level aggregates (avg time, accuracy, efficiency) from
  // training_attempts — these cover phase-target trainings (Cross/EO/LSE)
  // that have no per-algorithm cases.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void getPhaseStats(methodId, phaseId).then((stats) => {
      if (!cancelled) setPhaseStats(stats);
    });
    void getTrainingSessions(methodId, phaseId, 50).then((sessions) => {
      if (cancelled) return;
      setSessionHistory(sessions
        .filter((session) => session.totalAttempts > 0)
        .map((session) => ({
          day: new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          avgTime: session.avgTimeMs / 1000,
          accuracy: session.accuracy,
          attempts: session.totalAttempts,
        }))
        .reverse());
    });
    return () => { cancelled = true; };
  }, [ready, methodId, phaseId, getPhaseStats, getTrainingSessions]);

  // Find subset for this phase — canonical mapping from @cubalyze/training
  const subset = useMemo(() => {
    const subsetId = findSubsetId(methodId, phaseId);
    return subsetId ? SUBSETS.find((s) => s.id === subsetId) ?? null : null;
  }, [methodId, phaseId]);

  const subsetCases = useMemo(() => {
    if (!subset) return [];
    return allCases.filter((c) => c.subsetId === subset.id)
      .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, undefined, { numeric: true }));
  }, [allCases, subset]);

  const hasAlgorithms = subsetCases.length > 0;

  // Load real progress data
  useEffect(() => {
    if (!ready || !subset) return;
    getSubsetProgress(subset.id).then((records) => {
      const map = new Map<string, AlgorithmProgressRecord>();
      for (const r of records) {
        map.set(r.algorithmId, r);
      }
      setProgressMap(map);
    });
  }, [ready, subset, getSubsetProgress]);

  // Build case stats from real data
  const caseStats: CaseStat[] = useMemo(() => {
    if (!ready || progressMap.size === 0) return [];
    return subsetCases.map((c) => {
      const prog = progressMap.get(c.id);
      return {
        case: c,
        mastery: prog?.mastery ?? 0,
        bestTimeMs: prog?.bestTimeMs ?? 0,
        attempts: prog?.totalAttempts ?? 0,
        recognitionAccuracy: prog?.recognitionAccuracy ?? 0,
      };
    });
  }, [subsetCases, progressMap, ready]);

  const mastered = caseStats.filter((c) => masteryLevel(c.mastery) === "mastered" || masteryLevel(c.mastery) === "expert").length;
  const learning = caseStats.filter((c) => masteryLevel(c.mastery) === "practicing").length;
  const beginner = caseStats.filter((c) => masteryLevel(c.mastery) === "learning").length;
  const newCases = caseStats.filter((c) => masteryLevel(c.mastery) === "new").length;
  const avgMastery = caseStats.length > 0 ? Math.round(caseStats.reduce((s, c) => s + c.mastery, 0) / caseStats.length) : 0;
  const bestTime = caseStats.length > 0 ? Math.min(...caseStats.filter(c => c.bestTimeMs > 0).map((c) => c.bestTimeMs), Infinity) : 0;
  const totalAttempts = caseStats.reduce((s, c) => s + c.attempts, 0);

  const weakCases = useMemo(
    () => [...caseStats].filter(c => c.mastery < 100).sort((a, b) => a.mastery - b.mastery).slice(0, 5),
    [caseStats],
  );

  const weakRecognition = useMemo(
    () => [...caseStats]
      .filter(c => c.recognitionAccuracy > 0 && c.recognitionAccuracy < 80)
      .sort((a, b) => a.recognitionAccuracy - b.recognitionAccuracy)
      .slice(0, 5),
    [caseStats],
  );

  const { t } = useTranslation("training");
  const TAB_KEYS = {
    overview: "statsView.tabs.overview",
    cases: "statsView.tabs.cases",
    history: "statsView.tabs.history",
  } as const;

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Header */}
        <header className="flex flex-col gap-2 shrink-0">
          <TrainingBreadcrumb
            onBack={onBack}
            segments={[
              { label: method?.name ?? "?" },
              { label: phaseName },
              { label: t("stats"), isCurrent: true },
            ]}
          />
          <div className="flex gap-0.5">
            {(["overview", "cases", "history"] as const).map((tab) => (
              <button key={tab} onClick={() => handleTabChange(tab)}
                className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors",
                  activeTab === tab ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")}>
                {t(TAB_KEYS[tab])}
                {activeTab === tab && (
                  <motion.div layoutId="stats-tab-active" className="absolute inset-0 rounded-md bg-ink -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          {!ready ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-[0.7rem] text-ink-3">{t("statsView.loading")}</p>
            </div>
          ) : activeTab === "overview" && (
            <OverviewTab
              mastered={mastered} learning={learning} beginner={beginner} newCases={newCases}
              totalCases={subsetCases.length} avgMastery={avgMastery} bestTime={bestTime === Infinity ? 0 : bestTime}
              totalAttempts={totalAttempts} hasAlgorithms={hasAlgorithms}
              weakCases={weakCases} sessionHistory={sessionHistory}
              phaseStats={phaseStats} weakRecognition={weakRecognition}
            />
          )}
          {activeTab === "cases" && (
            <CasesTab caseStats={caseStats.length > 0 ? caseStats : subsetCases.map((c) => ({
              case: c, mastery: 0, bestTimeMs: 0, attempts: 0, recognitionAccuracy: 0,
            }))} />
          )}
          {activeTab === "history" && (
            <HistoryTab sessionHistory={sessionHistory} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Overview Tab
   ─────────────────────────────────────────────────────────────────────── */

function OverviewTab({
  mastered, learning, beginner, newCases, totalCases, avgMastery, bestTime, totalAttempts,
  hasAlgorithms, weakCases, sessionHistory, phaseStats, weakRecognition,
}: {
  mastered: number; learning: number; beginner: number; newCases: number; totalCases: number;
  avgMastery: number; bestTime: number; totalAttempts: number; hasAlgorithms: boolean;
  weakCases: CaseStat[];
  sessionHistory: { day: string; avgTime: number; accuracy: number; attempts: number }[];
  phaseStats: PhaseStatsRecord | null;
  weakRecognition: CaseStat[];
}) {
  const { t } = useTranslation("training");
  return (
    <div className="space-y-5 pb-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Target} label={t("statsView.avgMastery")} value={`${avgMastery}%`}
          color={avgMastery >= 80 ? "text-ready" : avgMastery >= 50 ? "text-caution" : "text-hold"} />
        <StatCard icon={Clock} label={t("statsView.bestTime")} value={bestTime > 0 ? formatTime(bestTime) : "--"} />
        <StatCard icon={Flame} label={t("statsView.totalAttempts")} value={`${totalAttempts}`} />
        <StatCard icon={RotateCcw} label={t("statsView.cases")} value={hasAlgorithms ? t("statsView.masteredOf", { mastered, total: totalCases }) : t("practice.attemptsCount", { count: totalAttempts })} />
      </div>

      {hasAlgorithms && totalCases > 0 && totalAttempts > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">{t("statsView.masteryDistribution")}</h3>
          <div className="flex gap-2 h-6 rounded-full overflow-hidden bg-surface-2">
            {mastered > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(mastered / totalCases) * 100}%` }}
                    transition={{ duration: 0.6 }} className="bg-ready h-full" />
                </TooltipTrigger>
                <TooltipContent side="top">{t("drill.masteredCount", { count: mastered })}</TooltipContent>
              </Tooltip>
            )}
            {learning > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(learning / totalCases) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }} className="bg-caution h-full" />
                </TooltipTrigger>
                <TooltipContent side="top">{t("statsView.countLearning", { count: learning })}</TooltipContent>
              </Tooltip>
            )}
            {beginner > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(beginner / totalCases) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }} className="bg-hold h-full" />
                </TooltipTrigger>
                <TooltipContent side="top">{t("statsView.countBeginner", { count: beginner })}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <LegendDot color="bg-ready" label={t("mastery.mastered")} count={mastered} />
            <LegendDot color="bg-caution" label={t("mastery.learning")} count={learning} />
            <LegendDot color="bg-hold" label={t("statsView.legendBeginner")} count={beginner} />
            {newCases > 0 && <LegendDot color="bg-ink-2" label={t("mastery.new")} count={newCases} />}
          </div>
        </section>
      )}

      {hasAlgorithms && totalAttempts === 0 && (
        <section className="rounded-xl border border-line bg-surface p-8 flex flex-col items-center justify-center text-center">
          <RotateCcw className="size-8 text-ink-3/30 mb-3" />
          <h3 className="text-[0.72rem] font-semibold text-ink">{t("statsView.noTrainingData")}</h3>
          <p className="text-[0.6rem] text-ink-3 mt-1 max-w-sm">
            {t("statsView.noTrainingHint")}
          </p>
        </section>
      )}

      {sessionHistory.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">{t("statsView.trend14Day")}</h3>
          <div className="flex items-end gap-1 h-32">
            {(() => {
              // Real scale: percentile-90 of the actual per-day averages instead
              // of a fabricated cap, so the bars stay meaningful as you improve.
              const sorted = [...sessionHistory].map((d) => d.avgTime).sort((a, b) => a - b);
              const p90 =
                sorted.length > 0
                  ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]
                  : 1;
              const maxTime = Math.max(p90, 0.5); // floor keeps bars visible on fast sessions
              return (
                <>
                  {sessionHistory.map((day, idx) => {
                    const pct = Math.min(100, (day.avgTime / maxTime) * 100);
                    const prevDay = sessionHistory[idx - 1];
                    const trend = prevDay ? day.avgTime < prevDay.avgTime : true;
                    return (
                      <div key={day.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                        <span className="nums text-[0.48rem] text-ink-3/70">{day.avgTime.toFixed(1)}s</span>
                        <motion.div initial={{ height: 0 }} animate={{ height: `${pct}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.03 }}
                          className={cn("w-full rounded-t-sm", trend ? "bg-ink/50" : "bg-hold/40")} />
                        <span className="text-[0.48rem] text-ink-3/50 leading-none">{day.day}</span>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[0.55rem] text-ink-3/60">
            <TrendingDown className="size-3 text-ready" /> {t("statsView.trendHint")}
          </div>
        </section>
      )}

      {phaseStats && phaseStats.totalAttempts > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">{t("statsView.phasePerformance")}</h3>
            <span className="text-[0.55rem] text-ink-3/60">{t("statsView.fromAllSessions")}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><Clock className="size-2.5" />{t("drill.avgTime")}</span>
              <span className="nums text-[0.9rem] font-bold text-ink mt-1 block">{formatTime(phaseStats.avgTimeMs)}</span>
            </div>
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><Target className="size-2.5" />{t("statsView.execAcc")}</span>
              <span className={cn("nums text-[0.9rem] font-bold mt-1 block", phaseStats.execAccuracy >= 80 ? "text-ready" : phaseStats.execAccuracy >= 50 ? "text-caution" : "text-hold")}>
                {phaseStats.execAccuracy}%
              </span>
            </div>
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><Brain className="size-2.5" />{t("statsView.recAcc")}</span>
              <span className={cn("nums text-[0.9rem] font-bold mt-1 block", phaseStats.recAccuracy >= 80 ? "text-ready" : phaseStats.recAccuracy >= 50 ? "text-caution" : "text-hold")}>
                {phaseStats.recAttempts > 0 ? `${phaseStats.recAccuracy}%` : "--"}
              </span>
            </div>
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><Gauge className="size-2.5" />{t("statsView.efficiency")}</span>
              <span className="nums text-[0.9rem] font-bold text-ink mt-1 block">
                {phaseStats.efficiency > 0 ? `${Math.round(phaseStats.efficiency * 100)}%` : "--"}
              </span>
            </div>
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><AlertTriangle className="size-2.5" />{t("statsView.failRate")}</span>
              <span className={cn("nums text-[0.9rem] font-bold mt-1 block", phaseStats.failRate < 0.2 ? "text-ready" : phaseStats.failRate < 0.4 ? "text-caution" : "text-hold")}>
                {Math.round(phaseStats.failRate * 100)}%
              </span>
            </div>
            <div className="rounded-lg bg-surface-2/60 p-3">
              <span className="text-[0.55rem] text-ink-3 flex items-center gap-1"><Flame className="size-2.5" />{t("practice.attempts")}</span>
              <span className="nums text-[0.9rem] font-bold text-ink mt-1 block">{phaseStats.totalAttempts}</span>
            </div>
          </div>
          <p className="text-[0.55rem] text-ink-3/60 mt-3">
            {t("statsView.accuracyNote", { count: phaseStats.totalAttempts })}
          </p>
        </section>
      )}

      {hasAlgorithms && weakCases.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">{t("statsView.weakestCases")}</h3>
            <span className="text-[0.55rem] text-ink-3/60">{t("statsView.focusOnThese")}</span>
          </div>
          <div className="space-y-1.5">
            {weakCases.map((sc) => (
              <div key={sc.case.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-surface-2/50">
                <span className={cn("nums text-[0.62rem] font-medium shrink-0 w-10",
                  masteryLevel(sc.mastery) === "new" ? "text-ink-3" : masteryLevel(sc.mastery) === "learning" ? "text-hold" : masteryLevel(sc.mastery) === "practicing" ? "text-caution" : "text-ink-2")}>
                  {sc.case.caseNumber}
                </span>
                <span className="text-[0.6rem] text-ink-3 truncate flex-1">{sc.case.name}</span>
                <span className="nums text-[0.58rem] text-ink-3 shrink-0">{sc.bestTimeMs > 0 ? formatTime(sc.bestTimeMs) : "--"}</span>
                <div className="h-1.5 w-14 rounded-full bg-surface-2 overflow-hidden shrink-0">
                  <div className={cn("h-full rounded-full",
                    masteryLevel(sc.mastery) === "mastered" || masteryLevel(sc.mastery) === "expert" ? "bg-ready" : masteryLevel(sc.mastery) === "practicing" ? "bg-caution" : "bg-hold")}
                    style={{ width: `${sc.mastery}%` }} />
                </div>
                <span className="nums text-[0.55rem] text-ink-2 shrink-0 w-7 text-right">{sc.mastery}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasAlgorithms && weakRecognition.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">{t("statsView.weakRecognition")}</h3>
            <span className="text-[0.55rem] text-ink-3/60">{t("statsView.weakRecognitionHint")}</span>
          </div>
          <div className="space-y-1.5">
            {weakRecognition.map((sc) => (
              <div key={sc.case.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-surface-2/50">
                <span className="nums text-[0.62rem] font-medium text-ink-2 shrink-0 w-10">{sc.case.caseNumber}</span>
                <span className="text-[0.6rem] text-ink-3 truncate flex-1">{sc.case.name}</span>
                <span className="nums text-[0.58rem] text-ink-2 shrink-0">{t("statsView.recogPct", { pct: sc.recognitionAccuracy })}</span>
                <div className="h-1.5 w-14 rounded-full bg-surface-2 overflow-hidden shrink-0">
                  <div className={cn("h-full rounded-full", sc.recognitionAccuracy >= 80 ? "bg-ready" : sc.recognitionAccuracy >= 50 ? "bg-caution" : "bg-hold")}
                    style={{ width: `${sc.recognitionAccuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasAlgorithms && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
              <Lightbulb className="size-4 text-caution" />
            </div>
            <div>
              <h4 className="text-[0.7rem] font-semibold text-ink">{t("statsView.srsReady")}</h4>
              <p className="text-[0.6rem] text-ink-3 mt-0.5">
                {totalAttempts > 0
                  ? t("statsView.srsReadyBody", { mastered })
                  : t("statsView.srsReadyEmpty")}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Cases Tab
   ─────────────────────────────────────────────────────────────────────── */

function CasesTab({ caseStats }: { caseStats: CaseStat[] }) {
  const { t } = useTranslation("training");
  const SORT_KEYS = {
    mastery: "statsView.sort.mastery",
    time: "statsView.sort.time",
    name: "statsView.sort.name",
  } as const;
  const [sortBy, setSortBy] = useState<"mastery" | "time" | "name">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cubeforge_phase_stats_sort");
      if (saved === "mastery" || saved === "time" || saved === "name") {
        return saved;
      }
    }
    return "mastery";
  });

  const handleSortChange = (s: "mastery" | "time" | "name") => {
    setSortBy(s);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cubeforge_phase_stats_sort", s);
      } catch (e) {
        console.warn("[PhaseStatsView] Failed to save sort option to localStorage", e);
      }
    }
  };

  const sorted = useMemo(() => {
    return [...caseStats].sort((a, b) => {
      if (sortBy === "mastery") return a.mastery - b.mastery;
      if (sortBy === "time") return a.bestTimeMs - b.bestTimeMs;
      return parseInt(a.case.caseNumber.replace(/\D/g, ""), 10) - parseInt(b.case.caseNumber.replace(/\D/g, ""), 10);
    });
  }, [caseStats, sortBy]);

  if (caseStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[0.72rem] text-ink-3">{t("statsView.noCases")}</p>
        <p className="text-[0.6rem] text-ink-3/50 mt-1">{t("statsView.noCasesHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <span className="text-[0.58rem] text-ink-3">{t("statsView.sortBy")}</span>
        {(["mastery", "time", "name"] as const).map((s) => (
          <button key={s} onClick={() => handleSortChange(s)}
            className={cn("rounded px-2 py-0.5 text-[0.58rem] font-medium transition-colors",
              sortBy === s ? "bg-ink text-surface" : "text-ink-3 hover:text-ink bg-surface-2")}>
            {t(SORT_KEYS[s])}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="max-h-125 overflow-y-auto">
          {sorted.map((sc, idx) => (
            <div key={sc.case.id}
              className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
                idx < sorted.length - 1 && "border-b border-line")}>
              <span className="nums text-[0.55rem] text-ink-3/50 shrink-0 w-5">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="nums text-[0.68rem] font-medium text-ink">{sc.case.caseNumber}</span>
                <span className="text-[0.6rem] text-ink-3 ml-2">{sc.case.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden">
                  <div className={cn("h-full rounded-full",
                    masteryLevel(sc.mastery) === "mastered" || masteryLevel(sc.mastery) === "expert" ? "bg-ready" : masteryLevel(sc.mastery) === "practicing" ? "bg-caution" : "bg-hold")}
                    style={{ width: `${sc.mastery}%` }} />
                </div>
                <span className={cn("nums text-[0.58rem] w-8 text-right",
                  masteryLevel(sc.mastery) === "mastered" || masteryLevel(sc.mastery) === "expert" ? "text-ready" : masteryLevel(sc.mastery) === "practicing" ? "text-caution" : "text-hold")}>
                  {sc.mastery}%
                </span>
              </div>
              <span className="nums text-[0.58rem] text-ink-3 shrink-0 w-14 text-right">{sc.bestTimeMs > 0 ? formatTime(sc.bestTimeMs) : "--"}</span>
              <span className="text-[0.55rem] text-ink-3/60 shrink-0 w-10 text-right">{sc.attempts}x</span>
              <ChevronRight className="size-3 text-ink-3/20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   History Tab
   ─────────────────────────────────────────────────────────────────────── */

function HistoryTab({ sessionHistory }: { sessionHistory: { day: string; avgTime: number; accuracy: number; attempts: number }[] }) {
  const { t } = useTranslation("training");
  if (sessionHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <RotateCcw className="size-6 text-ink-3/20 mb-3" />
        <p className="text-[0.7rem] text-ink-3">{t("statsView.noHistory")}</p>
        <p className="text-[0.6rem] text-ink-3/50 mt-1">{t("statsView.noHistoryHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">{t("statsView.sessionHistory")}</h3>
        <div className="space-y-0.5">
          {[...sessionHistory].reverse().map((day, idx) => {
            const prevDay = sessionHistory[13 - idx - 1];
            const timeTrend = prevDay ? day.avgTime <= prevDay.avgTime : null;
            return (
              <div key={day.day} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-2 transition-colors">
                <span className="text-[0.62rem] font-medium text-ink-2 w-8">{day.day}</span>
                <div className="flex items-center gap-1.5">
                  {timeTrend === true && <TrendingDown className="size-3 text-ready" />}
                  {timeTrend === false && <TrendingUp className="size-3 text-hold" />}
                  {timeTrend === null && <span className="w-3" />}
                  <span className="nums text-[0.62rem] text-ink">{t("statsView.avgSuffix", { time: day.avgTime.toFixed(2) })}</span>
                </div>
                <span className="text-[0.58rem] text-ink-3">{t("statsView.accSuffix", { acc: Math.round(day.accuracy) })}</span>
                <span className="text-[0.55rem] text-ink-3/60 ml-auto">{t("practice.attemptsCount", { count: day.attempts })}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-line bg-surface">
      <span className="flex items-center gap-1.5 text-[0.58rem] text-ink-3">
        <Icon className="size-3" />{label}
      </span>
      <span className={cn("nums text-[1.05rem] font-bold", color ?? "text-ink")}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("size-2.5 rounded-full", color)} />
      <span className="text-[0.58rem] text-ink-3">{label}</span>
      <span className="nums text-[0.58rem] font-medium text-ink">{count}</span>
    </div>
  );
}
