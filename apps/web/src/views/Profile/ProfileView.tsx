"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Target, BookOpen, CheckCircle2, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/hooks/useProfile";
import { useProfileStats, type PuzzleStats, type ProfileStats, bestEffectiveTime } from "@/hooks/useProfileStats";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import { useSkillProgress } from "@/hooks/useSkillProgress";
import { ProfileHero } from "@/components/Identity/ProfileHero";
import { AccountCard } from "@/components/Account/AccountCard";
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
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import { effectiveTime } from "@/types";
import { ALL_SKILL_NODES, CATEGORY_KEY } from "@/views/SkillTree/skillTreeData";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Solve as UISolve } from "@/types";
import { ProfileFriendsPanel } from "./components/ProfileFriendsPanel";

function PuzzleRow({ p }: { p: PuzzleStats }) {
  return (
    <div className="grid grid-cols-[1fr_72px_72px_72px_100px] sm:grid-cols-[1fr_80px_80px_80px_110px] items-center gap-x-3 px-4 py-2.5 text-sm">
      <span className="truncate text-xs font-semibold text-ink">{puzzleTypeLabel(p.puzzle)}</span>
      <span className="text-right">
        <span className="nums text-ink">{statLabel(p.stats.best)}</span>
      </span>
      <span className="text-right">
        <span className="nums text-ink-2">{statLabel(p.stats.ao5)}</span>
      </span>
      <span className="text-right">
        <span className="nums text-ink-2">{statLabel(p.stats.ao12)}</span>
      </span>
      <span className="text-right">
        <span className="nums text-ink-3">{p.count}</span>
      </span>
    </div>
  );
}

function LastSolves({ solves, locale }: { solves: UISolve[]; locale: string }) {
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
                {new Date(solve.timestamp).toLocaleDateString(locale, {
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
  const { t, i18n } = useTranslation("profile");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title={t("overview.activity")} eyebrow={t("overview.last52Weeks")} />
        {stats && stats.solves.length > 0 ? (
          <ActivityHeatmap counts={stats.heatmapCounts} weeks={52} className="mt-3" />
        ) : (
          <EmptyState
            icon={<Activity className="size-5" />}
            title={t("overview.noSolvesTitle")}
            description={t("overview.noSolvesDescription")}
          />
        )}
      </div>
      {stats && stats.solves.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SectionHeader title={t("overview.recentSolves")} eyebrow={t("overview.last5")} />
          <div className="mt-3">
            <LastSolves solves={stats.solves} locale={i18n.language} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatsTab({ stats }: { stats: ProfileStats | null }) {
  const { t } = useTranslation("profile");
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="-mx-px overflow-x-auto px-px [scrollbar-width:thin]">
        <div className="min-w-[540px]">
          <div className="grid grid-cols-[1fr_72px_72px_72px_100px] sm:grid-cols-[1fr_80px_80px_80px_110px] items-center gap-x-3 px-4 pb-2 pt-3 text-[0.6rem] uppercase tracking-[0.08em] text-ink-3 font-semibold">
            <span className="truncate">{t("stats.puzzle")}</span>
            <span className="truncate text-right">{t("stats.pb")}</span>
            <span className="truncate text-right">{t("stats.ao5")}</span>
            <span className="truncate text-right">{t("stats.ao12")}</span>
            <span className="truncate text-right">{t("stats.solves")}</span>
          </div>
          <div className="divide-y divide-line/60">
            {stats && stats.byPuzzle.length > 0 ? (
              stats.byPuzzle.map((p) => <PuzzleRow key={p.puzzle} p={p} />)
            ) : (
              <div className="px-4 py-8">
                <EmptyState
                  icon={<BarChart3 className="size-5" />}
                  title={t("stats.noStatsTitle")}
                  description={t("stats.noStatsDescription")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingTab() {
  const { t, i18n } = useTranslation("profile");
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
          title={t("training.unavailable")}
          description={error}
          action={
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-ink/90"
            >
              {t("retry")}
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
        <Spinner size="sm" label={t("training.preparing")} />
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
        <SectionHeader title={i18n.t("training:review.queue.title")} eyebrow={t("training.today")} />
        <div className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-dnf">{due}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
              {i18n.t("training:review.reason.overdue")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-caution">{weak}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
              {i18n.t("training:review.reason.weak")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-ink-2">{review}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
              {i18n.t("training:review.reason.due")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
            <span className="nums text-lg text-ink">{newCount}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
              {i18n.t("training:review.reason.new")}
            </span>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="mt-3 text-xs text-ink-3">{t("training.empty")}</p>
        ) : (
          <p className="mt-3 text-xs text-ink-3">
            {due > 0
              ? t("training.overdueCount", { count: due })
              : t("training.queueCount", { count: queue.length })}
          </p>
        )}
      </div>
    </div>
  );
}

function AlgorithmsTab() {
  const { t, i18n } = useTranslation("profile");
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

  // t is stable across renders; the fallback error message is static per render
  /* eslint-disable react-hooks/exhaustive-deps */
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
          setInsightsError(err instanceof Error ? err.message : t("algorithms.errorLoad"));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ready, getSRSInsights, reloadKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const mastered = insights ? insights.stateCounts.review : 0;
  const learning = insights
    ? insights.stateCounts.learning + insights.stateCounts.relearning
    : 0;
  const fresh = insights ? insights.stateCounts.new : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title={t("algorithms.title")} eyebrow={t("algorithms.eyebrow")} />
        {insightsError ? (
          <div className="mt-3">
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title={t("algorithms.unavailable")}
              description={insightsError}
              action={
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="cursor-pointer rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-ink/90"
                >
                  {t("retry")}
                </button>
              }
            />
          </div>
        ) : !ready ? (
          <div className="mt-3 flex justify-center rounded-lg border border-dashed border-line py-6">
            <Spinner size="sm" label={t("algorithms.preparing")} />
          </div>
        ) : !insights ? (
          <Skeleton className="mt-3 h-24 w-full rounded-lg" />
        ) : insights.totalCases === 0 ? (
          <p className="mt-3 text-xs text-ink-3">{t("algorithms.emptyCatalog")}</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-4">
              <MetricRing
                value={Math.round(insights.avgMastery)}
                max={100}
                label={`${Math.round(insights.avgMastery)}%`}
                size={76}
                strokeWidth={6}
                color="ready"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold capitalize text-ink">
                    {t("algorithms.avgMastery")}
                  </span>
                  <span className="nums text-ink-3">
                    {insights.reviewed}/{insights.totalCases} {t("algorithms.reviewed")}
                  </span>
                </div>
                <Progress
                  value={(insights.reviewed / Math.max(1, insights.totalCases)) * 100}
                  className="h-2"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-ready">{mastered}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-3">
                  {i18n.t("training:mastery.mastered")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-caution">{learning}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-3">
                  {i18n.t("training:mastery.learning")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
                <span className="nums text-lg text-ink">{fresh}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-3">
                  {i18n.t("training:mastery.new")}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-3">{t("algorithms.masteryNote")}</p>
          </>
        )}
      </div>
    </div>
  );
}

function SkillsTab() {
  const { t } = useTranslation("profile");
  const { t: tSkills } = useTranslation("skillTree");
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
        <SectionHeader title={tSkills("title")} eyebrow={t("skills.eyebrow")} />
        <div className="mt-3 flex items-center gap-4">
          <MetricRing
            value={pct}
            max={100}
            label={`${pct}%`}
            size={76}
            strokeWidth={6}
            color="ready"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold capitalize text-ink">
                {t("skills.progress")}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="nums text-sm font-bold text-ink">{xp.toLocaleString()}</span>
                <span className="text-[0.65rem] text-ink-3">
                  {t("skills.ofXp", { xp: totalXp.toLocaleString() })}
                </span>
              </div>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-[0.65rem] text-ink-3">
              {t("skills.completedCount", { count: completed.length, total: allNodes.length })}
            </p>
          </div>
        </div>
      </div>

      {ready && byCategory.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SectionHeader title={t("skills.byCategory")} eyebrow={t("skills.progress")} />
          <div className="mt-3 space-y-3">
            {byCategory.map(([cat, { done, total }]) => {
              const catPct = total > 0 ? Math.round((done / total) * 100) : 0;
              const catKey = CATEGORY_KEY[cat as keyof typeof CATEGORY_KEY];
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-baseline justify-between text-[0.65rem]">
                    <span className="text-ink-2">
                      {catKey ? tSkills(catKey) : cat}
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
  /**
   * Opens Settings pre-selected to *Privacidad y amigos*. Wired to the
   * friends panel shortcut ("¿qué comparto?").
   */
  onOpenPrivacySettings?: () => void;
}

/**
 * F3/F4 (docs/plan_profile) — the user's identity center.
 * Hero (B1) + Stat strip (B2) + content tabs (B3) with REAL data:
 * solves across all sessions (Stats), SRS review queue (Training), the
 * algorithm catalog (Algorithms) and skill-tree XP (Skills).
 */
export function ProfileView({ onNavigate, onOpenSettings, onOpenPrivacySettings }: ProfileViewProps) {
  const { t, i18n } = useTranslation("profile");
  const { profile, identiconSeed, loading: profileLoading } = useProfile();
  const { stats, loading: statsLoading } = useProfileStats();

  // Sub-X milestone badges ("Sub 5 · 3×3"…) derived from each puzzle's PB.
  const badges = useMemo(
    () => computeSubBadges(stats, profile?.mainPuzzle),
    [stats, profile?.mainPuzzle],
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
        {i18n.t("common:profile")}
      </h1>

      {/* ── Top section: Full-width Hero + StatStrip ───────────────── */}
      <div className="space-y-4">
        <ProfileHero
          profile={profile}
          loading={profileLoading}
          onEdit={onOpenSettings}
          badges={badges}
          seed={identiconSeed ?? profile?.userId}
        />

        <StatStrip stats={stats} loading={statsLoading} />
      </div>

      {/* ── Main content: Tabs (left 1fr) + Sidebar (Friends & Account 320px) ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Primary column: Content tabs */}
        <div className="min-w-0">
          <Tabs defaultValue="overview">
            <TabsList
              aria-label={t("tabs.aria")}
              className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-1 py-1.5"
            >
              {(
                [
                  ["overview", t("tabs.overview")],
                  ["stats", i18n.t("nav:stats")],
                  ["training", i18n.t("nav:training")],
                  ["algorithms", i18n.t("nav:algorithms")],
                  ["skills", i18n.t("nav:skills")],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-8 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface dark:data-[state=active]:bg-surface data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
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
        </div>

        {/* Secondary column: Friends & Account sync */}
        <div className="min-w-0 space-y-6">
          <ProfileFriendsPanel
            onNavigate={onNavigate}
            onOpenPrivacySettings={onOpenPrivacySettings}
          />

          <section>
            <AccountCard />
          </section>
        </div>
      </div>

      <section
        aria-label={t("localNoticeAria")}
        className="mt-8 flex items-center justify-center gap-1.5 pb-4 text-[0.6rem] text-ink-3"
      >
        <CheckCircle2 className="size-3 text-ready" aria-hidden="true" />
        <span>{t("localNotice")}</span>
      </section>
    </div>
  );
}
