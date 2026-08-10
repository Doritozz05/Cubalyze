"use client";

/**
 * SRSInsightsView — memory-health dashboard for the spaced-repetition system.
 *
 * Read-only aggregates produced by computeSRSInsights (packages/training):
 *   - headline stats (cases, reviewed, total reviews, mastery, retention)
 *   - retention distribution — current retrievability buckets
 *   - interval-growth curve — cross-sectional spacing effect per review count
 *   - FSRS state breakdown (new / learning / review / relearning)
 *   - due projection across 1/3/7/30 day horizons
 *
 * Nothing here mutates progress — it is a pure window over the SRS database.
 * The method filter is seeded from the Review Queue section (all vs one method).
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS } from "@cubeforge/algorithm-db";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import type { SRSInsights } from "@cubeforge/training";
import { TrainingBreadcrumb } from "./components";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  BookOpen,
  Brain,
  Repeat2,
  Target,
  TrendingUp,
  CalendarClock,
  BarChart3,
} from "lucide-react";

/* ── metadata ─────────────────────────────────────────────────────────── */

const STATE_META: { key: keyof SRSInsights["stateCounts"]; label: string; bar: string }[] = [
  { key: "new", label: "New", bar: "bg-ink-3" },
  { key: "learning", label: "Learning", bar: "bg-phase-blue" },
  { key: "review", label: "Review", bar: "bg-phase-emerald" },
  { key: "relearning", label: "Relearning", bar: "bg-caution" },
];

const BUCKET_BAR: Record<string, string> = {
  "<60%": "bg-hold",
  "60–80%": "bg-caution",
  "80–90%": "bg-phase-blue",
  "90%+": "bg-ready",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtDays(d: number): string {
  if (!Number.isFinite(d) || d <= 0) return "—";
  return d < 10 ? d.toFixed(1) : Math.round(d).toString();
}

function retentionTone(r: number): string {
  if (r < 0.6) return "text-hold";
  if (r < 0.85) return "text-caution";
  return "text-ready";
}

/* ────────────────────────────────────────────────────────────────────────
   Component
   ─────────────────────────────────────────────────────────────────────── */

export interface SRSInsightsViewProps {
  /** Restrict to a single method (undefined = all methods). */
  methodId?: string;
  onBack: () => void;
}

export function SRSInsightsView({ methodId, onBack }: SRSInsightsViewProps) {
  const { ready, getSRSInsights } = useTrainingProgress();
  const [filter, setFilter] = useState<string>(methodId ?? "all");
  const [insights, setInsights] = useState<SRSInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSRSInsights(filter === "all" ? undefined : filter)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load SRS insights");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, getSRSInsights, filter]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <TrainingBreadcrumb
          onBack={onBack}
          segments={[{ label: "Training" }, { label: "SRS Insights", isCurrent: true }]}
        />

        {!ready || loading ? (
          <Spinner variant="centered" size="md" />
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-[0.7rem] text-hold">{error}</p>
            <button
              onClick={onBack}
              className="rounded-md bg-surface-2 px-3 py-1.5 text-[0.65rem] text-ink"
            >
              Back to training
            </button>
          </div>
        ) : insights ? (
          <InsightsBody insights={insights} filter={filter} onFilter={setFilter} />
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Body
   ─────────────────────────────────────────────────────────────────────── */

function InsightsBody({
  insights,
  filter,
  onFilter,
}: {
  insights: SRSInsights;
  filter: string;
  onFilter: (v: string) => void;
}) {
  const maxBucket = Math.max(1, ...insights.retention.buckets.map((b) => b.count));
  const maxState = Math.max(1, ...STATE_META.map((s) => insights.stateCounts[s.key]));
  const maxInterval = Math.max(1, ...insights.intervalGrowth.map((g) => g.avgIntervalDays));
  const maxDue = Math.max(1, ...insights.dueProjection.map((d) => d.count));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      {/* Method filter */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[0.58rem] text-ink-3">Method</span>
        <Select value={filter} onValueChange={onFilter}>
          <SelectTrigger className="h-7 w-40 rounded-md border-line bg-surface px-2 text-[0.65rem] font-medium text-ink">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[0.68rem]">All methods</SelectItem>
            {METHODS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-[0.68rem]">{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {insights.totalCases === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface p-10 text-center">
          <BarChart3 className="size-6 text-ink-3/50" />
          <p className="text-[0.7rem] font-medium text-ink">No cases in the catalog yet</p>
          <p className="text-[0.62rem] text-ink-3">
            Progress you record through drills, recognition and reviews will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile icon={BookOpen} label="Cases" value={String(insights.totalCases)} />
            <StatTile icon={Brain} label="Reviewed" value={String(insights.reviewed)} />
            <StatTile icon={Repeat2} label="Reviews" value={String(insights.totalReviews)} />
            <StatTile icon={Target} label="Mastery" value={`${insights.avgMastery}%`} />
            <StatTile
              icon={TrendingUp}
              label="Retention"
              value={pct(insights.retention.average)}
              tone={retentionTone(insights.retention.average)}
            />
          </div>

          {/* Retention distribution */}
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-3.5 text-ink-2" />
              <h2 className="text-[0.72rem] font-semibold text-ink">Retention distribution</h2>
              <span className="nums text-[0.6rem] text-ink-3 ml-auto">
                avg {pct(insights.retention.average)}
              </span>
            </div>
            {insights.retention.buckets.length === 0 ? (
              <p className="text-[0.62rem] text-ink-3">
                No cases have been reviewed yet — retention appears after your first graded review.
              </p>
            ) : (
              <div className="space-y-2">
                {insights.retention.buckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2.5">
                    <span className="w-12 shrink-0 text-[0.6rem] text-ink-2">{b.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(b.count / maxBucket) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full", BUCKET_BAR[b.label] ?? "bg-ink-3")}
                      />
                    </div>
                    <span className="nums w-6 shrink-0 text-right text-[0.62rem] text-ink">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Interval growth curve */}
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="size-3.5 text-ink-2" />
              <h2 className="text-[0.72rem] font-semibold text-ink">Interval growth</h2>
              <span className="text-[0.58rem] text-ink-3 ml-auto">avg days between reviews</span>
            </div>
            {insights.intervalGrowth.length === 0 ? (
              <p className="text-[0.62rem] text-ink-3">
                Grade some reviews to see the spacing effect build up.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1 min-h-28">
                {insights.intervalGrowth.map((g) => (
                  <div key={g.reviewCount} className="flex min-w-8 flex-col items-center gap-1">
                    <span className="nums text-[0.55rem] text-ink-2">{fmtDays(g.avgIntervalDays)}</span>
                    <div
                      className={cn(
                        "w-6 rounded-t-md transition-colors",
                        g.avgIntervalDays > 0 ? "bg-phase-blue" : "bg-surface-2",
                      )}
                      style={{ height: `${Math.max(3, (g.avgIntervalDays / maxInterval) * 64)}px` }}
                    />
                    <span className="nums text-[0.55rem] text-ink-3">{g.reviewCount}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* State breakdown + due projection */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="size-3.5 text-ink-2" />
                <h2 className="text-[0.72rem] font-semibold text-ink">Memory states</h2>
              </div>
              <div className="space-y-2">
                {STATE_META.map((s) => (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <span className="w-16 shrink-0 text-[0.6rem] text-ink-2">{s.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(insights.stateCounts[s.key] / maxState) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full", s.bar)}
                      />
                    </div>
                    <span className="nums w-6 shrink-0 text-right text-[0.62rem] text-ink">
                      {insights.stateCounts[s.key]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="size-3.5 text-ink-2" />
                <h2 className="text-[0.72rem] font-semibold text-ink">Due in</h2>
              </div>
              <div className="flex items-end gap-2">
                {insights.dueProjection.map((d) => (
                  <div key={d.withinDays} className="flex flex-1 flex-col items-center gap-1">
                    <span className="nums text-[0.68rem] font-medium text-ink">{d.count}</span>
                    <div
                      className={cn(
                        "w-full rounded-t-md",
                        d.count > 0 ? "bg-caution/60" : "bg-surface-2",
                      )}
                      style={{ height: `${(d.count / maxDue) * 48 + 4}px` }}
                    />
                    <span className="text-[0.55rem] text-ink-3">≤{d.withinDays}d</span>
                  </div>
                ))}
              </div>
              <p className="text-[0.58rem] text-ink-3 mt-3">
                Lapses and relearning cases count toward the nearest horizon.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
      <span className="flex items-center gap-1.5 text-[0.55rem] text-ink-3">
        <Icon className="size-3 text-ink-2" />
        {label}
      </span>
      <span className={cn("nums text-[0.95rem] font-semibold", tone ?? "text-ink")}>{value}</span>
    </div>
  );
}
