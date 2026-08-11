"use client";

/**
 * ReviewQueueSection — "Today's Queue" preview for the SRS daily review.
 *
 * Renders the prioritized queue built by the scheduler (FSRS retrievability +
 * overdue + weakness + new-case injection) with:
 *  - reason badges (Overdue / Due / Weak / New)
 *  - method filter (all vs a single method)
 *  - quick summary stats (total, overdue, weak, new)
 *  - a Start Review button that opens the full review session (SRSReviewView)
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSRSQueue } from "@/hooks/useSRSQueue";
import { METHODS } from "@cubeforge/algorithm-db";
import type { QueueReason } from "@cubeforge/training";
import type { ParseKeys } from "i18next";
import { Spinner } from "@/components/ui/spinner";
import {
  RotateCcw,
  Play,
  CheckCircle2,
  TriangleAlert,
  Flame,
  Sparkles,
  BarChart3,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASON_META: Record<QueueReason, { labelKey: ParseKeys<"training">; badge: string; dot: string }> = {
  overdue: { labelKey: "review.reason.overdue", badge: "bg-caution text-surface font-semibold", dot: "bg-caution" },
  review: { labelKey: "review.reason.due", badge: "bg-phase-blue text-white font-semibold", dot: "bg-phase-blue" },
  weak: { labelKey: "review.reason.weak", badge: "bg-phase-violet text-white font-semibold", dot: "bg-phase-violet" },
  new: { labelKey: "review.reason.new", badge: "bg-phase-emerald text-white font-semibold", dot: "bg-phase-emerald" },
};


export interface ReviewQueueSectionProps {
  /** Navigates to the review session for the selected method (undefined = all). */
  onStartReview: (methodId?: string) => void;
  /** Opens the SRS insights dashboard, seeding it with the current method filter. */
  onOpenInsights?: (methodId?: string) => void;
  /**
   * Reports the live total of reviewable queue items so the dashboard
   * "N due for review" badge always matches this queue — and the
   * "Start Review (N)" button — (single source of truth).
   */
  onDueCountChange?: (due: number) => void;
}

export function ReviewQueueSection({ onStartReview, onOpenInsights, onDueCountChange }: ReviewQueueSectionProps) {
  const { t } = useTranslation("training");
  const { ready, loading, error, queue } = useSRSQueue();
  const [methodFilter, setMethodFilter] = useState<string>("all");

  // Only methods that actually have items in the queue.
  const queueMethods = useMemo(() => {
    const ids = new Set(queue.map((q) => q.methodId).filter(Boolean));
    return METHODS.filter((m) => ids.has(m.id));
  }, [queue]);

  const filtered = useMemo(
    () => (methodFilter === "all" ? queue : queue.filter((q) => q.methodId === methodFilter)),
    [queue, methodFilter],
  );

  const counts = useMemo(() => {
    const by = (r: QueueReason) => queue.filter((q) => q.reason === r).length;
    return { total: queue.length, overdue: by("overdue"), weak: by("weak"), fresh: by("new") };
  }, [queue]);

  // Report the live reviewable total to the dashboard so the header badge is
  // always derived from the same queue the user sees AND matches the
  // "Start Review (N)" button (weak/overdue/review items are all reviewable).
  useEffect(() => {
    onDueCountChange?.(queue.length);
  }, [queue, onDueCountChange]);

  const methodName = (methodId: string) =>
    METHODS.find((m) => m.id === methodId)?.name ?? methodId;

  const handleStart = () => {
    onStartReview(methodFilter === "all" ? undefined : methodFilter);
  };

  if (!ready || loading) {
    return (
      <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="size-3.5 text-ink-2" />
          <h2 className="text-[0.72rem] font-semibold text-ink">{t("review.queue.title")}</h2>
        </div>
        <div className="flex items-center gap-2 text-[0.62rem] text-ink-3">
          <Spinner size="xs" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="size-3.5 text-ink-2" />
          <h2 className="text-[0.72rem] font-semibold text-ink">{t("review.queue.title")}</h2>
        </div>
        <p className="text-[0.62rem] text-hold">{error}</p>
      </section>
    );
  }

  return (
    <section className="shrink-0 rounded-xl border border-line bg-surface p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="size-3.5 text-ink-2" />
        <h2 className="text-[0.72rem] font-semibold text-ink">{t("review.queue.title")}</h2>
        {onOpenInsights && (
          <button
            onClick={() => onOpenInsights(methodFilter === "all" ? undefined : methodFilter)}
            className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[0.58rem] font-medium text-ink-2 transition-colors hover:bg-line hover:text-ink"
          >
            <BarChart3 className="size-3" /> {t("review.queue.insights")}
          </button>
        )}
        <span className="nums text-[0.6rem] text-ink-3 ml-auto">
          {t("review.queue.itemCount", { count: counts.total })}
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="flex items-center gap-2 text-[0.62rem] text-ink-3">
          <CheckCircle2 className="size-3.5 text-ready shrink-0" />
          {t("review.queue.allCaughtUp")}
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2/60 p-2">
              <span className="flex items-center gap-1 text-[0.55rem] text-ink-3">
                <TriangleAlert className="size-2.5 text-caution" />{t("review.reason.overdue")}
              </span>
              <span className="nums text-[0.8rem] font-semibold text-ink">{counts.overdue}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2/60 p-2">
              <span className="flex items-center gap-1 text-[0.55rem] text-ink-3">
                <Flame className="size-2.5 text-phase-violet" />{t("review.reason.weak")}
              </span>
              <span className="nums text-[0.8rem] font-semibold text-ink">{counts.weak}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2/60 p-2">
              <span className="flex items-center gap-1 text-[0.55rem] text-ink-3">
                <Sparkles className="size-2.5 text-phase-emerald" />{t("review.reason.new")}
              </span>
              <span className="nums text-[0.8rem] font-semibold text-ink">{counts.fresh}</span>
            </div>
          </div>

          {/* Method filter */}
          {queueMethods.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[0.58rem] text-ink-3 shrink-0">{t("method")}</span>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-7 w-32 rounded-md border-line bg-surface-2 px-2 text-[0.65rem] font-medium text-ink">
                  <SelectValue placeholder={t("allMethods")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[0.68rem]">{t("allMethods")}</SelectItem>
                  {queueMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[0.68rem]">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Queue list */}
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1 mb-3">
            {filtered.map((item) => {
              const meta = REASON_META[item.reason];
              return (
                <div
                  key={item.algorithmId}
                  className="flex items-center gap-2.5 rounded-lg bg-surface-2/50 px-2.5 py-1.5"
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
                  <span className="nums text-[0.62rem] font-medium text-ink shrink-0">
                    {item.caseNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.6rem] text-ink-2">
                    {item.name}
                  </span>
                  <span className="hidden shrink-0 text-[0.55rem] text-ink-3 sm:inline">
                    {methodName(item.methodId)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-1.5 py-px text-[0.55rem] font-medium",
                      meta.badge,
                    )}
                  >
                    {t(meta.labelKey)}
                  </span>
                  <span className="nums shrink-0 text-[0.55rem] text-ink-3 w-8 text-right">
                    {Math.round(item.retrievability * 100)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Start review */}
          <button
            onClick={handleStart}
            disabled={filtered.length === 0}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[0.68rem] font-semibold text-surface transition-colors hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed max-lg:py-2.5"
          >
            <Play className="size-3.5" />
            {t("review.queue.startReview", { count: filtered.length })}
          </button>
        </>
      )}
    </section>
  );
}
