"use client";

/**
 * FriendStatsPanel — what a friend is willing to show about their solving.
 *
 * These are AGGREGATES computed in SQL, not rows: the server never sends a
 * solve, so there is no scramble, no note, no move list and no session to
 * display here even if we wanted to. The panel therefore shows a summary and
 * says so, rather than pretending to be a solve list.
 *
 * Two honest empty states, because they mean opposite things:
 *   - `not_shared`  the friend turned stats off (their choice, reversible)
 *   - no data       they share, but have not solved anything in a session
 *
 * The heatmap is the most revealing thing that crosses the wire (365 daily
 * counts say *when* someone practises), which is exactly why it is behind its
 * own switch in Settings and off by default for everyone.
 */

import { BarChart3, Flame, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/Insights/atoms/ActivityHeatmap";
import { EmptyState } from "@/components/Insights/atoms/EmptyState";
import { SectionHeader } from "@/components/Insights/atoms/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, statLabel } from "@/utils/formatTime";
import { puzzleTypeLabel } from "@/utils/puzzleTypes";
import { FRIEND_FAILURE_KEY } from "../friendsCopy";
import type { AverageValue, FriendStats, FriendsFailure } from "@/services/friends";

export interface FriendStatsPanelProps {
  stats: FriendStats | null;
  error?: FriendsFailure;
  loading: boolean;
}

/** `{ms}`, `{dnf}` or `null` — the wire's explicit encoding of a trimmed avg. */
function averageLabel(value: AverageValue): string {
  if (value == null) return "—";
  if ("dnf" in value) return "DNF";
  return formatTime(value.ms);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-surface px-3 py-3">
      <span className="nums text-lg text-ink">{value}</span>
      <span className="text-[0.6rem] uppercase tracking-[0.14em] text-ink-3">{label}</span>
    </div>
  );
}

export function FriendStatsPanel({ stats, error, loading }: FriendStatsPanelProps) {
  const { t, i18n } = useTranslation("friends");

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <EmptyState
          icon={error === "not_shared" ? <Lock className="size-5" /> : <BarChart3 className="size-5" />}
          title={t(
            error === "not_shared" ? "stats.notSharedTitle" : "stats.unavailableTitle",
          )}
          description={t(FRIEND_FAILURE_KEY[error])}
        />
      </div>
    );
  }

  if (!stats) return null;

  const hasSolves = stats.overall.total > 0;
  const lastActive =
    stats.overall.lastActiveAt && stats.overall.lastActiveAt > 0
      ? new Date(stats.overall.lastActiveAt).toLocaleDateString(i18n.language, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <SectionHeader title={t("stats.summary")} eyebrow={t("stats.allTime")} />
        {!hasSolves ? (
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title={t("stats.emptyTitle")}
            description={t("stats.emptyDescription")}
          />
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
              <Metric label={t("stats.solves")} value={String(stats.overall.total)} />
              <Metric label={t("stats.best")} value={statLabel(stats.overall.best)} />
              <Metric
                label={t("stats.mean")}
                value={stats.overall.mean == null ? "—" : formatTime(stats.overall.mean)}
              />
              <Metric label={t("stats.totalTime")} value={formatTime(stats.overall.sessionTime)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="size-3.5 text-caution" aria-hidden="true" />
                {t("stats.streak", { count: stats.streakDays })}
              </span>
              {lastActive && <span>{t("stats.lastActive", { date: lastActive })}</span>}
            </div>
          </>
        )}
      </div>

      {hasSolves && (
        <div className="rounded-xl border border-line bg-surface">
          <div className="px-4 pt-3">
            <SectionHeader title={t("stats.byPuzzle")} eyebrow={t("stats.aggregates")} />
          </div>
          <div className="grid grid-cols-[1fr_70px_70px_70px_60px] items-center gap-x-2 px-4 pb-2 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
            <span>{t("stats.puzzle")}</span>
            <span className="text-right">{t("stats.best")}</span>
            <span className="text-right">Ao5</span>
            <span className="text-right">Ao12</span>
            <span className="text-right">{t("stats.count")}</span>
          </div>
          <div className="divide-y divide-line/60">
            {stats.byPuzzle.map((p) => (
              <div
                key={p.puzzle}
                className="grid grid-cols-[1fr_70px_70px_70px_60px] items-center gap-x-2 px-4 py-2.5 text-sm"
              >
                <span className="truncate text-xs font-semibold text-ink">
                  {puzzleTypeLabel(p.puzzle)}
                </span>
                <span className="nums text-right text-ink">{statLabel(p.best)}</span>
                <span className="nums text-right text-ink-2">{averageLabel(p.ao5)}</span>
                <span className="nums text-right text-ink-2">{averageLabel(p.ao12)}</span>
                <span className="nums text-right text-ink-3">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.heatmap.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <SectionHeader title={t("stats.activity")} eyebrow={t("stats.lastYear")} />
          <ActivityHeatmap counts={stats.heatmap} weeks={52} className="mt-3" />
          <p className="mt-3 text-[0.68rem] leading-4 text-ink-3">{t("stats.privacyNote")}</p>
        </div>
      )}
    </div>
  );
}
