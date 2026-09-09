"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { StatChip } from "./";
import { formatTime } from "@/hooks/usePracticeSession";
import { Lightbulb, Crosshair, Flame, Target, Clock, Gauge } from "lucide-react";

/** A recorded cross-training attempt (from DB history or the current session). */
export interface CrossAttemptView {
  id: string;
  userMoves: number;
  optimalDepth: number;
  face: string;
  timestamp: number;
  efficient: boolean;
}

export interface CrossStats {
  accuracy: number;
  avgMoves: number;
  bestMoves: number;
  streak: number;
  total: number;
  efficiency: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Stats grid (column 3)
   ─────────────────────────────────────────────────────────────────────── */

export function CrossStatsPanel({
  stats,
  avgTimeMs,
}: {
  stats: CrossStats;
  avgTimeMs: number;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Flame} label={t("practice.attempts")} value={`${stats.total}`} />
        <StatChip icon={Target} label={t("drill.accuracy")} value={`${stats.accuracy}%`} />
        <StatChip icon={Crosshair} label={t("practice.best")} value={stats.bestMoves > 0 ? `${stats.bestMoves}` : "--"} />
        <StatChip icon={Clock} label={t("crossTrainer.avgMoves")} value={stats.avgMoves > 0 ? `${stats.avgMoves}` : "--"} />
        <StatChip icon={Clock} label={t("drill.avgTime")} value={avgTimeMs > 0 ? formatTime(avgTimeMs) : "--"} />
        <StatChip icon={Gauge} label={t("statsView.efficiency")} value={stats.efficiency > 0 ? `${stats.efficiency}%` : "--"} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tips panel (column 3)
   ─────────────────────────────────────────────────────────────────────── */

export function CrossTipsPanel() {
  const { t, i18n } = useTranslation("training");
  const tipsRaw = (i18n.t as (key: string, options?: object) => unknown)(
    "training:crossTrainer.tips",
    { returnObjects: true, defaultValue: [] },
  );
  const tips: string[] = Array.isArray(tipsRaw) ? (tipsRaw as string[]) : [];
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-caution" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">{t("practice.tips")}</h4>
      </div>
      <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-caution/60 shrink-0 mt-0.5">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Current scramble info (column 3)
   ─────────────────────────────────────────────────────────────────────── */

export function CrossScrambleInfoPanel({
  cnMode,
  face,
  optimalDepth,
  lastUserMoves,
  streak,
}: {
  cnMode: boolean;
  face: string;
  optimalDepth: number;
  lastUserMoves: number | undefined;
  streak: number;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Crosshair className="size-3.5 text-phase-blue" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">
          {t("crossTrainer.currentScramble")}
        </h4>
      </div>
      <div className="space-y-1 text-[0.6rem]">
        <div className="flex justify-between">
          <span className="text-ink-3">{t("crossTrainer.mode")}</span>
          <span className="nums font-medium text-ink">
            {cnMode ? t("crossTrainer.colorNeutral") : t("crossTrainer.faceFixed", { face })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">{t("crossTrainer.solvedFace")}</span>
          <span className="nums font-medium text-ink">{face}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">{t("crossTrainer.optimalDepth")}</span>
          <span className="nums font-medium text-ink">
            {optimalDepth}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">{t("crossTrainer.yourLast")}</span>
          <span className="nums font-medium text-ink">
            {lastUserMoves ?? "--"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">{t("practice.streak")}</span>
          <span className="nums font-medium text-ink">
            {streak}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Recent attempts list (column 2)
   ─────────────────────────────────────────────────────────────────────── */

export function RecentAttemptsList({ attempts }: { attempts: CrossAttemptView[] }) {
  const { t } = useTranslation("training");
  if (attempts.length === 0) {
    return (
      <p className="text-[0.58rem] text-ink-3/40 italic text-center py-4">
        {t("crossTrainer.noAttempts")}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {attempts.slice(0, 12).map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.6rem] hover:bg-surface-2"
        >
          <span
            className={cn(
              "nums font-semibold",
              a.efficient ? "text-ready" : "text-hold",
            )}
          >
            {a.userMoves}
          </span>
          <span className="text-ink-3/50">/ {a.optimalDepth}</span>
          <span className="text-ink-3/40 ml-auto">
            {a.face}
          </span>
          <span
            className={cn(
              "size-1.5 rounded-full",
              a.efficient ? "bg-ready" : "bg-hold",
            )}
          />
        </div>
      ))}
    </div>
  );
}
