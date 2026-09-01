"use client";

import { useTranslation } from "react-i18next";
import { Trophy, RotateCcw, Sliders, Zap, Clock, Hash, Activity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useIsTouch } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { FinalSessionStats } from "./useInfiniteF2LSession";

export interface InfiniteF2LSummaryDialogProps {
  open: boolean;
  stats: FinalSessionStats | null;
  targetPairs?: number;
  onRestart: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  if (minutes > 0) {
    const secPadded = Number(seconds) < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${secPadded}`;
  }
  return `${seconds}s`;
}

export function InfiniteF2LSummaryDialog({
  open,
  stats,
  targetPairs = 0,
  onRestart,
  onOpenSettings,
  onBack,
}: InfiniteF2LSummaryDialogProps) {
  const { t } = useTranslation("training");
  const isTouch = useIsTouch();

  if (!stats) return null;

  const content = (
    <div className="flex flex-col gap-6 p-6 max-sm:p-4">
      {/* Hero Time Display */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-2/40 py-6 px-4 text-center">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
          <Clock className="size-3.5" />
          <span>{t("infiniteF2l.summary.finalTime")}</span>
        </div>
        <div className="nums text-4xl sm:text-5xl font-extrabold tracking-tight text-ink mt-2">
          {formatDuration(stats.totalTimeMs)}
        </div>
        {targetPairs > 0 && (
          <span className="nums mt-2 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
            {stats.solvedCount} / {targetPairs} {t("infiniteF2l.setup.pairUnitPlural")}
          </span>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Solved Pairs */}
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Trophy className="size-3.5 text-amber-500" />
            <span>{t("infiniteF2l.summary.pairsSolved")}</span>
          </div>
          <div className="nums text-2xl font-bold text-ink mt-1">
            {stats.solvedCount}
          </div>
        </div>

        {/* Avg TPS */}
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Zap className="size-3.5 text-amber-500" />
            <span>{t("infiniteF2l.summary.avgTps")}</span>
          </div>
          <div className="nums text-2xl font-bold text-ink mt-1">
            {stats.avgTps.toFixed(2)}
          </div>
          <span className="nums text-[0.65rem] text-ink-3">
            {t("infiniteF2l.summary.peakTps")}: {stats.peakTps.toFixed(1)}
          </span>
        </div>

        {/* Pace (Seconds per pair) */}
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Activity className="size-3.5 text-blue-500" />
            <span>{t("infiniteF2l.summary.pace")}</span>
          </div>
          <div className="nums text-2xl font-bold text-ink mt-1">
            {stats.paceSecPerPair > 0 ? `${stats.paceSecPerPair.toFixed(2)}s` : "-"}
          </div>
          <span className="text-[0.65rem] text-ink-3 truncate">
            {t("infiniteF2l.summary.perPair")}
          </span>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-2">
        <div className="flex items-center gap-2">
          <Hash className="size-3.5 text-ink-3" />
          <span>{t("infiniteF2l.summary.totalMoves")}</span>
        </div>
        <span className="nums font-semibold text-ink">{stats.totalMoves} {t("infiniteF2l.summary.moves")}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
        <Button
          type="button"
          onClick={onRestart}
          className="w-full sm:flex-1 h-11 gap-2 rounded-xl bg-ink text-surface font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RotateCcw className="size-4" />
          {t("infiniteF2l.summary.retry")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenSettings}
          className="w-full sm:w-auto h-11 gap-2 rounded-xl border-line bg-surface text-ink text-sm hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <Sliders className="size-4" />
          {t("infiniteF2l.settings")}
        </Button>

      </div>
    </div>
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={() => {}}>
        <DrawerContent className="max-h-[90vh] bg-surface">
          <DrawerHeader className="border-b border-line px-6 py-4">
            <DrawerTitle className="flex items-center gap-2 text-base font-semibold text-ink">
              <Trophy className="size-5 text-amber-500" />
              {t("infiniteF2l.summary.title")}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-ink-3">
              {t("infiniteF2l.summary.subtitle")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md border-line bg-surface/95 backdrop-blur-md p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="border-b border-line px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <Trophy className="size-5 text-amber-500" />
            {t("infiniteF2l.summary.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {t("infiniteF2l.summary.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[85vh]">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
