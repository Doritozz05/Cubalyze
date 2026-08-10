"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Timer,
  BarChart3,
  Target,
  BookOpen,
  Network,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useProfileStats, type PuzzleStats, type ProfileStats, bestEffectiveTime } from "@/hooks/useProfileStats";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useSkillProgress } from "@/hooks/useSkillProgress";
import { ProfileHero } from "@/components/Identity/ProfileHero";
import { StatStrip } from "@/components/Identity/StatStrip";
import { computeSubBadges } from "@/utils/subBadges";
import { ActivityHeatmap } from "@/components/Insights/atoms/ActivityHeatmap";
import { EmptyState } from "@/components/Insights/atoms/EmptyState";
import { SectionHeader } from "@/components/Insights/atoms/SectionHeader";
import { MetricRing } from "@/components/Insights/atoms/MetricRing";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatTime, statLabel } from "@/utils/formatTime";
import { effectiveTime } from "@/types";
import { ALL_SKILL_NODES } from "@/views/SkillTree/skillTreeData";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Solve as UISolve } from "@/types";

const QUICK_ACTIONS: Array<{
  id: ViewId;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: "timer", label: "Timer", description: "Start a new solve", icon: Timer },
  { id: "insights", label: "Stats", description: "Full statistics & analysis", icon: BarChart3 },
  { id: "training", label: "Training", description: "Drills, SRS review, challenges", icon: Target },
  { id: "algorithms", label: "Algorithms", description: "Browse and practice algorithms", icon: BookOpen },
  { id: "skill-tree", label: "Skills", description: "Skill tree progression", icon: Network },
];

const CATEGORY_LABELS: Record<string, string> = {
  fundamentals: "Fundamentals",
  cross: "Cross",
  f2l: "F2L",
  "last-layer": "Last layer",
  lookahead: "Lookahead",
  "finger-tricks": "Finger tricks",
  inspection: "Inspection",
};

function PuzzleRow({ p }: { p: PuzzleStats }) {
  return (
    <div className="grid grid-cols-[1fr_repeat(4,auto)] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
      <span className="text-xs font-semibold text-ink">{p.puzzle}</span>
      <span className="w-16 text-right">
        <span className="nums text-ink">{statLabel(p.stats.best)}</span>
      </span>
      <span className="w-16 text-right">
        <span className="nums text-ink-2">{statLabel(p.stats.ao5)}</span>
      </span>
      <span className="w-16 text-right">
        <span className="nums text-ink-2">{statLabel(p.stats.ao12)}</span>
      </span>
      <span className="w-16 text-right">
        <span className="nums text-ink-3">{p.count}</span>
      </span>
    </div>
  );
}

function LastSolves({ solves }: { solves: UISolve[] }) {
  const recent = solves.slice(0, 5);
  if (recent.length === 0) return null;
  const bestEff = bestEffectiveTime(recent);
  return (
    <div className="rounded-xl border border-line bg-surface">
      {recent.map((solve, i) => {
        const eff = effectiveTime(solve);
        const isDnf = !Number.isFinite(eff);
        return (
          <div
            key={solve.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div className="flex items-center gap-2 text-ink-3">
              <span className="w-4 text-right text-[0.65rem]">{i + 1}</span>
              <span className="text-[0.65rem] uppercase tracking-wide">
                {new Date(solve.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <span
              className={`nums ${isDnf ? "text-dnf" : eff === bestEff ? "text-ready" : "text-ink"}`}
            >
              {isDnf ? "DNF" : formatTime(eff)}
              {solve.penalty === "+2" ? "+" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OverviewTab({ stats }: { stats: ProfileStats | null }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title="Activity" eyebrow="last 52 weeks" />
        {stats && stats.solves.length > 0 ? (
          <ActivityHeatmap counts={stats.heatmapCounts} weeks={52} className="mt-3" />
        ) : (
          <EmptyState
            icon={<Activity className="size-5" />}
            title="No solves yet"
            description="Your practice activity will appear here once you complete your first solves."
          />
        )}
      </div>
      {stats && stats.solves.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SectionHeader title="Recent solves" eyebrow="last 5" />
          <div className="mt-3">
            <LastSolves solves={stats.solves} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatsTab({ stats }: { stats: ProfileStats | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-[1fr_repeat(4,auto)] items-center gap-x-4 px-4 pb-1.5 pt-3 text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
        <span>Puzzle</span>
        <span className="w-16 text-right">PB</span>
        <span className="w-16 text-right">Ao5</span>
        <span className="w-16 text-right">Ao12</span>
        <span className="w-16 text-right">Solves</span>
      </div>
      <div className="divide-y divide-line/60">
        {stats && stats.byPuzzle.length > 0 ? (
          stats.byPuzzle.map((p) => <PuzzleRow key={p.puzzle} p={p} />)
        ) : (
          <div className="px-4 py-8">
            <EmptyState
              icon={<BarChart3 className="size-5" />}
              title="No statistics yet"
              description="Solve times per puzzle will show here once you start practicing."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingTab() {
  const { queue, ready, loading, error, refresh } = useSRSQueue();
  const due = useMemo(() => queue.filter((q) => q.reason === "overdue").length, [queue]);
  const review = useMemo(() => queue.filter((q) => q.reason === "review").length, [queue]);
  const weak = useMemo(
    () => queue.filter((q) => q.reason === "weak" || (q.reason === "review" && q.overdueDays > 0)).length,
    [queue],
  );
  const newCount = useMemo(() => queue.filter((q) => q.reason === "new").length, [queue]);

  // A failed load must never leave the tab frozen on a skeleton — surface the
  // error with a retry instead.
  if (error) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <EmptyState
          icon={<Target className="size-5" />}
          title="Training data unavailable"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-ink/90"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  // The shared tracker (DB worker + migrations + catalog seed) initializes
  // lazily on first use — on a brand-new profile that can take a few seconds.
  // Show an explicit "preparing" state instead of an indefinite skeleton so
  // the tab never looks frozen.
  if (!ready) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-line bg-surface p-8">
        <Spinner size="sm" label="Preparing training data…" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title="Review queue" eyebrow="today" />
        <div className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-dnf">{due}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">Overdue</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-caution">{weak}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">Weak</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-ink-2">{review}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">Review</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-ink">{newCount}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">New</span>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="mt-3 text-xs text-ink-3">
            Your review queue is empty — practice a few algorithms and your SRS schedule will build
            itself.
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink-3">
            {due > 0
              ? `${due} algorithm${due > 1 ? "s" : ""} overdue — review them to keep retention high.`
              : `${queue.length} algorithm${queue.length > 1 ? "s" : ""} in today's queue.`}
          </p>
        )}
      </div>
    </div>
  );
}

function AlgorithmsTab() {
  const { getSRSInsights, ready } = useTrainingProgress();
  const [insights, setInsights] = useState<{
    totalCases: number;
    reviewed: number;
    stateCounts: { new: number; learning: number; review: number; relearning: number };
    avgMastery: number;
  } | null>(null);
  // A rejected insights query (transient DB hiccup, etc.) must never leave the
  // tab frozen on the skeleton — report it as a recoverable error instead.
  const [insightsError, setInsightsError] = useState<string | null>(null);
  // Bump to re-run the insights load after a failure (Retry button).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (ready) {
      setInsightsError(null);
      void getSRSInsights()
        .then((data) => {
          if (!cancelled) setInsights(data);
        })
        .catch((err) => {
          if (cancelled) return;
          setInsightsError(
            err instanceof Error ? err.message : "Failed to load algorithm mastery",
          );
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ready, getSRSInsights, reloadKey]);

  const mastered = insights ? insights.stateCounts.review : 0;
  const learning = insights
    ? insights.stateCounts.learning + insights.stateCounts.relearning
    : 0;
  const fresh = insights ? insights.stateCounts.new : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title="Algorithm mastery" eyebrow="SRS states" />
        {insightsError ? (
          <div className="mt-3">
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="Algorithm data unavailable"
              description={insightsError}
              action={
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-ink/90"
                >
                  Retry
                </button>
              }
            />
          </div>
        ) : !ready ? (
          <div className="mt-3 flex justify-center rounded-lg border border-dashed border-line py-6">
            <Spinner size="sm" label="Preparing algorithm data…" />
          </div>
        ) : !insights ? (
          <Skeleton className="mt-3 h-24 w-full rounded-lg" />
        ) : insights.totalCases === 0 ? (
          <p className="mt-3 text-xs text-ink-3">
            The algorithm catalog is empty — open the Algorithms view to start practicing cases
            (OLL, PLL, F2L…).
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-4">
              <MetricRing
                value={Math.round(insights.avgMastery)}
                max={100}
                label={`${Math.round(insights.avgMastery)}%`}
                sub="avg mastery"
                size={84}
                strokeWidth={6}
                color="ready"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-[0.65rem]">
                  <span className="text-ink-2">Reviewed</span>
                  <span className="nums text-ink-3">
                    {insights.reviewed}/{insights.totalCases}
                  </span>
                </div>
                <Progress
                  value={(insights.reviewed / Math.max(1, insights.totalCases)) * 100}
                  className="h-1.5"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-ready">{mastered}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
                  Mastered
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-caution">{learning}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
                  Learning
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-ink">{fresh}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">New</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Mastery reflects your FSRS review state across the whole catalog. Cases in
              relearning (lapsed) count as learning until they reach a stable review state.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SkillsTab() {
  const { completedIds, ready } = useSkillProgress();
  const allNodes = useMemo(() => ALL_SKILL_NODES, []);
  const completed = useMemo(
    () => allNodes.filter((n) => completedIds.includes(n.id)),
    [allNodes, completedIds],
  );
  const xp = useMemo(() => completed.reduce((sum, n) => sum + n.xpReward, 0), [completed]);
  const totalXp = useMemo(() => allNodes.reduce((sum, n) => sum + n.xpReward, 0), [allNodes]);
  const pct = totalXp > 0 ? Math.round((xp / totalXp) * 100) : 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const n of allNodes) {
      const entry = map.get(n.category) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (completedIds.includes(n.id)) entry.done += 1;
      map.set(n.category, entry);
    }
    return [...map.entries()];
  }, [allNodes, completedIds]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title="Skill tree" eyebrow="xp" />
        <div className="mt-3 flex items-center gap-4">
          <MetricRing
            value={pct}
            max={100}
            label={`${pct}%`}
            sub="complete"
            size={84}
            strokeWidth={6}
            color="ready"
          />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="nums text-lg text-ink">{xp.toLocaleString()}</span>
              <span className="text-[0.65rem] text-ink-3">of {totalXp.toLocaleString()} XP</span>
            </div>
            <Progress value={pct} className="h-1.5" />
            <p className="text-[0.65rem] text-ink-3">
              {completed.length} of {allNodes.length} skills completed
            </p>
          </div>
        </div>
      </div>

      {ready && byCategory.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SectionHeader title="By category" eyebrow="progress" />
          <div className="mt-3 space-y-3">
            {byCategory.map(([cat, { done, total }]) => {
              const catPct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-baseline justify-between text-[0.65rem]">
                    <span className="text-ink-2">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <span className="nums text-ink-3">
                      {done}/{total}
                    </span>
                  </div>
                  <Progress value={catPct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ProfileViewProps {
  onNavigate?: (view: ViewId) => void;
  /** Opens the Profile editor (Settings → Profile). */
  onOpenSettings?: () => void;
}

/**
 * F3/F4 (docs/plan_profile) — the user's identity center.
 * Hero (B1) + Stat strip (B2) + content tabs (B3) with REAL data:
 * solves across all sessions (Stats), SRS review queue (Training), the
 * algorithm catalog (Algorithms) and skill-tree XP (Skills).
 */
export function ProfileView({ onNavigate, onOpenSettings }: ProfileViewProps) {
  const { profile, loading: profileLoading } = useProfile();
  const { stats, loading: statsLoading } = useProfileStats();

  // Sub-X milestone badges ("Sub 5 · 3×3"…) derived from each puzzle's PB.
  const badges = useMemo(
    () => computeSubBadges(stats, profile?.mainPuzzle),
    [stats, profile?.mainPuzzle],
  );

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
        Profile
      </h1>

      <ProfileHero
        profile={profile}
        loading={profileLoading}
        onEdit={onOpenSettings}
        badges={badges}
      />

      <div className="mt-4">
        <StatStrip stats={stats} loading={statsLoading} />
      </div>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList
          aria-label="Profile sections"
          className="w-full justify-start overflow-x-auto bg-transparent p-0"
        >
          {(
            [
              ["overview", "Overview"],
              ["stats", "Stats"],
              ["training", "Training"],
              ["algorithms", "Algorithms"],
              ["skills", "Skills"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-surface data-[state=active]:shadow-sm rounded-lg border border-transparent px-3 text-xs data-[state=active]:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab stats={stats} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab stats={stats} />
        </TabsContent>
        <TabsContent value="training" className="mt-4">
          <TrainingTab />
        </TabsContent>
        <TabsContent value="algorithms" className="mt-4">
          <AlgorithmsTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsTab />
        </TabsContent>
      </Tabs>

      <section className="mt-6">
        <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {QUICK_ACTIONS.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              aria-label={`${label} — ${description}`}
              className="group flex flex-col items-start gap-2 rounded-xl border border-line bg-surface p-3.5 text-left transition-all duration-150 hover:border-ink-2/40 hover:bg-surface-2 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            >
              <div className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2/60 text-ink-2 transition-colors group-hover:text-ink">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold text-ink">{label}</span>
              <span className="text-[0.6rem] leading-tight text-ink-3">{description}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        aria-label="Local data notice"
        className="mt-8 flex items-center justify-center gap-1.5 pb-4 text-[0.6rem] text-ink-3"
      >
        <CheckCircle2 className="size-3 text-ready" aria-hidden="true" />
        <span>All data local</span>
      </section>
    </div>
  );
}
