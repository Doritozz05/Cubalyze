"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, SUBSETS, getSeedData } from "@cubeforge/algorithm-db";
import type { AlgorithmCase } from "@cubeforge/algorithm-db";
import {
  ArrowLeft, Target, Clock, Flame, RotateCcw, TrendingUp, TrendingDown,
  ChevronRight, Lightbulb,
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

/* ──────────────────────────────────────────────────────────────────────────
   Mock helpers
   ─────────────────────────────────────────────────────────────────────── */

function mockCaseMastery(caseNumber: string) {
  const n = parseInt(caseNumber.replace(/\D/g, ""), 10) || 0;
  return Math.min(99, 30 + ((n * 17) % 70));
}

function mockCaseBestTime(caseNumber: string) {
  const n = parseInt(caseNumber.replace(/\D/g, ""), 10) || 0;
  return 600 + ((n * 53) % 2200);
}

function mockSessionHistory() {
  return Array.from({ length: 14 }, (_, i) => ({
    day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
    avgTime: 1.2 + Math.random() * 0.8,
    accuracy: 75 + Math.random() * 25,
    attempts: 10 + Math.floor(Math.random() * 40),
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "--";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

function masteryLabel(pct: number): string {
  if (pct >= 90) return "Mastered";
  if (pct >= 60) return "Learning";
  if (pct > 0) return "Beginner";
  return "New";
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export function PhaseStatsView({
  methodId, phaseId, phaseName, onBack,
}: PhaseStatsProps) {
  void phaseId;
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);
  const { cases: allCases } = useMemo(() => getSeedData(), []);
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "history">("overview");

  // Find subset for this phase
  const subset = useMemo(() => {
    const phaseToName: Record<string, string> = {
      "oll": "OLL", "pll": "PLL", "f2l": "F2L", "cmll": "CMLL",
      "f2l-zz": "F2L", "ll-zz": "OCLL", "f2l-petrus": "F2L", "ll-petrus": "COLL",
    };
    const name = phaseToName[phaseId];
    if (!name) return null;
    return SUBSETS.find((s) => s.methodId === methodId && s.name === name)
      ?? SUBSETS.find((s) => s.name === name);
  }, [methodId, phaseId]);

  const subsetCases = useMemo(() => {
    if (!subset) return [];
    return allCases.filter((c) => c.subsetId === subset.id).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allCases, subset]);

  const hasAlgorithms = subsetCases.length > 0;

  const sessionHistory = useMemo(() => mockSessionHistory(), []);

  // Aggregate stats
  const caseStats = useMemo(() => {
    return subsetCases.map((c) => ({
      case: c,
      mastery: mockCaseMastery(c.caseNumber),
      bestTime: mockCaseBestTime(c.caseNumber),
      attempts: 5 + Math.floor(Math.random() * 40),
    }));
  }, [subsetCases]);

  const mastered = caseStats.filter((c) => c.mastery >= 90).length;
  const learning = caseStats.filter((c) => c.mastery >= 60 && c.mastery < 90).length;
  const beginner = caseStats.filter((c) => c.mastery > 0 && c.mastery < 60).length;
  const newCases = caseStats.filter((c) => c.mastery === 0).length;
  const avgMastery = caseStats.length > 0 ? Math.round(caseStats.reduce((s, c) => s + c.mastery, 0) / caseStats.length) : 0;
  const bestTime = caseStats.length > 0 ? Math.min(...caseStats.map((c) => c.bestTime)) : 0;
  const totalAttempts = caseStats.reduce((s, c) => s + c.attempts, 0);

  const weakCases = useMemo(
    () => [...caseStats].sort((a, b) => a.mastery - b.mastery).slice(0, 5),
    [caseStats],
  );

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Header */}
        <header className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.68rem] text-ink-3 hover:text-ink transition-colors shrink-0">
              <ArrowLeft className="size-3" />Back
            </button>
            <span className="text-[0.6rem] text-ink-3/50">›</span>
            <span className="text-[0.72rem] font-medium text-ink">{method?.name ?? "?"}</span>
            <span className="text-[0.6rem] text-ink-3/50">›</span>
            <span className="text-[0.72rem] font-semibold text-ink">{phaseName}</span>
            <span className="text-[0.6rem] text-ink-3/50">›</span>
            <span className="text-[0.72rem] font-semibold text-ink">Stats</span>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0.5">
            {(["overview", "cases", "history"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors capitalize",
                  activeTab === tab ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")}>
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="stats-tab-active" className="absolute inset-0 rounded-md bg-ink -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Body: scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === "overview" && (
            <OverviewTab
              mastered={mastered} learning={learning} beginner={beginner} newCases={newCases}
              totalCases={subsetCases.length} avgMastery={avgMastery} bestTime={bestTime}
              totalAttempts={totalAttempts} hasAlgorithms={hasAlgorithms}
              weakCases={weakCases} sessionHistory={sessionHistory}
            />
          )}
          {activeTab === "cases" && (
            <CasesTab caseStats={caseStats} />
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
  hasAlgorithms, weakCases, sessionHistory,
}: {
  mastered: number; learning: number; beginner: number; newCases: number; totalCases: number;
  avgMastery: number; bestTime: number; totalAttempts: number; hasAlgorithms: boolean;
  weakCases: { case: AlgorithmCase; mastery: number; bestTime: number; attempts: number }[];
  sessionHistory: { day: string; avgTime: number; accuracy: number; attempts: number }[];
}) {
  return (
    <div className="space-y-5 pb-8">
      {/* Stat chips row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Target} label="Avg Mastery" value={`${avgMastery}%`}
          color={avgMastery >= 80 ? "text-ready" : avgMastery >= 50 ? "text-caution" : "text-hold"} />
        <StatCard icon={Clock} label="Best Time" value={bestTime > 0 ? formatTime(bestTime) : "--"} />
        <StatCard icon={Flame} label="Total Attempts" value={`${totalAttempts}`} />
        <StatCard icon={RotateCcw} label="Cases" value={hasAlgorithms ? `${mastered}/${totalCases} mastered` : `${totalAttempts} attempts`} />
      </div>

      {/* Mastery distribution — only for algorithmic phases */}
      {hasAlgorithms && totalCases > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">Mastery Distribution</h3>
          <div className="flex gap-2 h-6 rounded-full overflow-hidden bg-surface-2">
            {mastered > 0 && (
              <motion.div initial={{ width: 0 }} animate={{ width: `${(mastered / totalCases) * 100}%` }}
                transition={{ duration: 0.6 }}
                className="bg-ready h-full flex items-center justify-center"
                title={`${mastered} mastered`} />
            )}
            {learning > 0 && (
              <motion.div initial={{ width: 0 }} animate={{ width: `${(learning / totalCases) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-caution h-full flex items-center justify-center"
                title={`${learning} learning`} />
            )}
            {beginner > 0 && (
              <motion.div initial={{ width: 0 }} animate={{ width: `${(beginner / totalCases) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-hold h-full flex items-center justify-center"
                title={`${beginner} beginner`} />
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <LegendDot color="bg-ready" label="Mastered" count={mastered} />
            <LegendDot color="bg-caution" label="Learning" count={learning} />
            <LegendDot color="bg-hold" label="Beginner" count={beginner} />
            {newCases > 0 && <LegendDot color="bg-ink-2" label="New" count={newCases} />}
          </div>
        </section>
      )}

      {/* Mini trend chart */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">14-Day Trend</h3>
        <div className="flex items-end gap-1 h-32">
          {sessionHistory.map((day, idx) => {
            const maxTime = 2.5;
            const pct = Math.min(100, (day.avgTime / maxTime) * 100);
            const prevDay = sessionHistory[idx - 1];
            const trend = prevDay ? day.avgTime < prevDay.avgTime : true;
            return (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="nums text-[0.48rem] text-ink-3/70">{day.avgTime.toFixed(1)}s</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.03 }}
                  className={cn("w-full rounded-t-sm", trend ? "bg-ink/50" : "bg-hold/40")}
                />
                <span className="text-[0.48rem] text-ink-3/50 leading-none">{day.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 mt-2 text-[0.55rem] text-ink-3/60">
          <TrendingDown className="size-3 text-ready" /> Avg time trending down — good progress!
        </div>
      </section>

      {/* Weakest cases preview */}
      {hasAlgorithms && weakCases.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3">Weakest Cases</h3>
            <span className="text-[0.55rem] text-ink-3/60">Focus on these</span>
          </div>
          <div className="space-y-1.5">
            {weakCases.map((sc) => (
              <div key={sc.case.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-surface-2/50">
                <span className={cn("nums text-[0.62rem] font-medium shrink-0 w-10",
                  sc.mastery < 30 ? "text-hold" : sc.mastery < 60 ? "text-caution" : "text-ink-2")}>
                  {sc.case.caseNumber}
                </span>
                <span className="text-[0.6rem] text-ink-3 truncate flex-1">{sc.case.name}</span>
                <span className="nums text-[0.58rem] text-ink-3 shrink-0">{formatTime(sc.bestTime)}</span>
                <div className="h-1.5 w-14 rounded-full bg-surface-2 overflow-hidden shrink-0">
                  <div className={cn("h-full rounded-full", sc.mastery >= 90 ? "bg-ready" : sc.mastery >= 60 ? "bg-caution" : "bg-hold")}
                    style={{ width: `${sc.mastery}%` }} />
                </div>
                <span className="nums text-[0.55rem] text-ink-2 shrink-0 w-7 text-right">{sc.mastery}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SRS recommendation */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
            <Lightbulb className="size-4 text-caution" />
          </div>
          <div>
            <h4 className="text-[0.7rem] font-semibold text-ink">Spaced Repetition Ready</h4>
            <p className="text-[0.6rem] text-ink-3 mt-0.5">
              {hasAlgorithms
                ? `${mastered} cases mastered. Review them in 1 day, 3 days, 7 days to lock in long-term retention.`
                : `${totalAttempts} total attempts. Keep training to improve your efficiency and reduce move count.`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Cases Tab (algorithmic phases only)
   ─────────────────────────────────────────────────────────────────────── */

function CasesTab({ caseStats }: { caseStats: { case: AlgorithmCase; mastery: number; bestTime: number; attempts: number }[] }) {
  const [sortBy, setSortBy] = useState<"mastery" | "time" | "name">("mastery");
  const sorted = useMemo(() => {
    return [...caseStats].sort((a, b) => {
      if (sortBy === "mastery") return a.mastery - b.mastery;
      if (sortBy === "time") return a.bestTime - b.bestTime;
      return parseInt(a.case.caseNumber.replace(/\D/g, ""), 10) - parseInt(b.case.caseNumber.replace(/\D/g, ""), 10);
    });
  }, [caseStats, sortBy]);

  if (caseStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[0.72rem] text-ink-3">No algorithm cases for this phase</p>
        <p className="text-[0.6rem] text-ink-3/50 mt-1">Phase stats are tracked through training sessions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <span className="text-[0.58rem] text-ink-3">Sort by:</span>
        {(["mastery", "time", "name"] as const).map((s) => (
          <button key={s} onClick={() => setSortBy(s)}
            className={cn("rounded px-2 py-0.5 text-[0.58rem] font-medium capitalize transition-colors",
              sortBy === s ? "bg-ink text-surface" : "text-ink-3 hover:text-ink bg-surface-2")}>
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          {sorted.map((sc, idx) => (
            <div key={sc.case.id}
              className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/50",
                idx < sorted.length - 1 && "border-b border-line")}>
              {/* Rank */}
              <span className="nums text-[0.55rem] text-ink-3/50 shrink-0 w-5">{idx + 1}</span>

              {/* Case info */}
              <div className="flex-1 min-w-0">
                <span className="nums text-[0.68rem] font-medium text-ink">{sc.case.caseNumber}</span>
                <span className="text-[0.6rem] text-ink-3 ml-2">{sc.case.name}</span>
              </div>

              {/* Mastery bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden">
                  <div className={cn("h-full rounded-full", sc.mastery >= 90 ? "bg-ready" : sc.mastery >= 60 ? "bg-caution" : "bg-hold")}
                    style={{ width: `${sc.mastery}%` }} />
                </div>
                <span className={cn("nums text-[0.58rem] w-8 text-right", sc.mastery >= 90 ? "text-ready" : sc.mastery >= 60 ? "text-caution" : "text-hold")}>
                  {sc.mastery}%
                </span>
              </div>

              {/* Best time */}
              <span className="nums text-[0.58rem] text-ink-3 shrink-0 w-14 text-right">{formatTime(sc.bestTime)}</span>

              {/* Attempts */}
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
  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-4">Session History (14 days)</h3>
        <div className="space-y-0.5">
          {[...sessionHistory].reverse().map((day, idx) => {
            const prevDay = sessionHistory[13 - idx - 1];
            const timeTrend = prevDay ? day.avgTime <= prevDay.avgTime : null;
            return (
              <div key={day.day} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-2/50 transition-colors">
                <span className="text-[0.62rem] font-medium text-ink-2 w-8">{day.day}</span>
                <div className="flex items-center gap-1.5">
                  {timeTrend === true && <TrendingDown className="size-3 text-ready" />}
                  {timeTrend === false && <TrendingUp className="size-3 text-hold" />}
                  {timeTrend === null && <span className="w-3" />}
                  <span className="nums text-[0.62rem] text-ink">{day.avgTime.toFixed(2)}s avg</span>
                </div>
                <span className="text-[0.58rem] text-ink-3">{Math.round(day.accuracy)}% acc</span>
                <span className="text-[0.55rem] text-ink-3/60 ml-auto">{day.attempts} attempts</span>
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
