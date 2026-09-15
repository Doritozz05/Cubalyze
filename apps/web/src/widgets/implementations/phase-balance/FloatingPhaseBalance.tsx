"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Info, Scale, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { formatTime } from "@/utils/formatTime";
import { phaseColorHex } from "@/utils/phaseColors";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PhaseSkipBadge } from "@/widgets/components/PhaseSkipBadge";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubalyze/types";
import {
  buildPhaseBalance,
  getLatestComparableAnalysis,
  getPhaseSegments,
  type CfopPhaseName,
  type PhaseBalanceRow,
} from "./phaseBalance";
import type { CfopBenchmarkReference } from "./benchmarks";

export interface FloatingPhaseBalanceProps {
  solves: Solve[];
  lastAnalysis?: SolveMetrics | null;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function deltaLabel(delta: number | undefined): string {
  if (delta === undefined || Math.abs(delta) < 0.005) return "balanced";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1)}%`;
}

function statusFor(row: PhaseBalanceRow): {
  labelKey: ParseKeys<"widgets">;
  tone: string;
  icon: typeof ArrowUp;
} {
  const delta = row.latestDelta ?? 0;
  if (Math.abs(delta) < 0.025)
    return { labelKey: "panel.phaseBalance.balanced", tone: "text-ink-3", icon: Minus };
  if (delta > 0)
    return { labelKey: "panel.phaseBalance.aboveSelfAvg", tone: "text-caution", icon: ArrowUp };
  return { labelKey: "panel.phaseBalance.belowSelfAvg", tone: "text-ready", icon: ArrowDown };
}

function PhaseBar({
  phaseName,
  share,
  colorIndex,
  muted = false,
  skipped = false,
  showLabel = true,
}: {
  phaseName: CfopPhaseName;
  share: number;
  colorIndex: number;
  muted?: boolean;
  skipped?: boolean;
  showLabel?: boolean;
}) {
  const color = phaseColorHex(phaseName, colorIndex);
  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="w-9 shrink-0 text-[0.58rem] font-medium text-ink-2">{phaseName}</span>}
      <div className={cn(
        "h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2",
        skipped && "border border-dashed border-ink-3/35 bg-transparent",
      )}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`, backgroundColor: color, opacity: muted ? 0.35 : 0.85 }}
        />
      </div>
      <span className={cn("nums w-8 text-right text-[0.62rem]", muted ? "text-ink-3" : "font-medium text-ink")}>
        {pct(share)}
      </span>
    </div>
  );
}

function LatestBreakdown({ analysis }: { analysis: SolveMetrics }) {
  const { t } = useTranslation("widgets");
  const segments = getPhaseSegments(analysis);
  return (
    <div className="space-y-1.5">
      <div className="mb-2 flex items-center justify-between text-[0.56rem] uppercase tracking-wider text-ink-3">
        <span>{t("panel.phaseBalance.latestComparable")}</span>
        <span className="nums">{formatTime(analysis.totalTimeMs)}</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {segments.map((segment, index) => (
          <div
            key={segment.phaseName}
            style={{ width: `${Math.max(segment.share * 100, segment.share > 0 ? 1 : 0)}%`, backgroundColor: phaseColorHex(segment.phaseName, index), opacity: 0.85 }}
          />
        ))}
      </div>
      {segments.map((segment, index) => (
        <div key={segment.phaseName} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <PhaseBar
              phaseName={segment.phaseName}
              share={segment.share}
              colorIndex={index}
              skipped={segment.skipped}
            />
          </div>
          {segment.skipped && <PhaseSkipBadge phaseName={segment.phaseName} />}
        </div>
      ))}
    </div>
  );
}

function BenchmarkDisclosure({ benchmark }: { benchmark: CfopBenchmarkReference }) {
  const { t } = useTranslation("widgets");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-help items-center gap-1 outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50"
          aria-label={t("panel.phaseBalance.aboutReference", {
            label: benchmark.label,
          })}
        >
          <Info className="size-2.5" />
          <span>
            {benchmark.rangeLabel} {t("panel.phaseBalance.reference")}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        <span className="font-medium">{benchmark.source.label}</span> · v{benchmark.version}.{" "}
        {t("panel.phaseBalance.referenceTooltipContent", {
          caveat: benchmark.caveat,
        })}
      </TooltipContent>
    </Tooltip>
  );
}

function AverageBreakdown({
  rows,
  benchmark,
  hasEnoughForTrend,
}: {
  rows: PhaseBalanceRow[];
  benchmark: CfopBenchmarkReference | null;
  hasEnoughForTrend: boolean;
}) {
  const { t } = useTranslation("widgets");
  return (
    <div className="space-y-1.5">
      <div className="mb-2 flex items-center justify-between text-[0.56rem] uppercase tracking-wider text-ink-3">
        <span>{t("panel.phaseBalance.recentAverage")}</span>
        {benchmark ? (
          <BenchmarkDisclosure benchmark={benchmark} />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="cursor-help outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50"
                aria-label={t("panel.phaseBalance.communityUnavailable")}
              >
                {t("panel.phaseBalance.last20Comparable")}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              {hasEnoughForTrend
                ? t("panel.phaseBalance.referenceTooltip")
                : t("panel.phaseBalance.needFiveTooltip")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {benchmark && (
        <>
          <div className="flex items-center justify-between text-[0.6rem] text-ink-3">
            <span>{t("panel.phaseBalance.baselineSplit")}</span>
            <span className="nums">12 · 50 · 16.5 · 21.5%</span>
          </div>
          <div className="flex justify-end gap-3 text-[0.48rem] text-ink-3">
            <span>{t("panel.phaseBalance.legendSolid")}</span>
            <span>{t("panel.phaseBalance.legendMuted")}</span>
          </div>
        </>
      )}
      {rows.map((row, index) => {
        const status = statusFor(row);
        const StatusIcon = status.icon;
        return (
          <div key={row.phaseName} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.58rem] font-medium text-ink-2">{row.phaseName}</span>
                {row.latestSkipped && <PhaseSkipBadge phaseName={row.phaseName} />}
              </div>
              <div className="flex items-center gap-2 nums text-[0.58rem]">
                <span className="text-ink-3">{formatTime(row.avgDurationMs)}</span>
                {row.latestDelta !== undefined && (
                  <span className={cn("flex w-14 items-center justify-end gap-0.5", status.tone)}>
                    <StatusIcon className="size-2.5" />
                    {deltaLabel(row.latestDelta)}
                  </span>
                )}
                {row.benchmarkDelta !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="nums w-14 text-right text-ink-3 outline-none focus-visible:ring-1 focus-visible:ring-ink-3/50 rounded-sm"
                      >
                        ref {row.benchmarkDelta > 0 ? "+" : ""}
                        {(row.benchmarkDelta * 100).toFixed(1)}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("panel.phaseBalance.yourAvgMinusRef")}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <PhaseBar
              phaseName={row.phaseName}
              share={row.share}
              colorIndex={index}
              skipped={row.latestSkipped}
              showLabel={false}
            />
            {benchmark && row.benchmarkShare !== undefined && (
              <PhaseBar
                phaseName={row.phaseName}
                share={row.benchmarkShare}
                colorIndex={index}
                muted
                showLabel={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FloatingPhaseBalance({ solves, lastAnalysis }: FloatingPhaseBalanceProps) {
  const { t } = useTranslation("widgets");
  const data = useMemo(() => buildPhaseBalance(solves, lastAnalysis, 20), [solves, lastAnalysis]);
  const latest = useMemo(() => getLatestComparableAnalysis(solves, lastAnalysis), [solves, lastAnalysis]);

  return (
    <FloatingWidgetWrapper
      widgetId="phase-balance"
      icon={Scale}
      label={t("def.phaseBalance")}
      pillBadge={
        data.analysedSolves > 0
          ? t("panel.phaseBalance.analysed", { count: data.analysedSolves })
          : undefined
      }
      pillBadge2="CFOP"
      panelWidth={350}
      panelMaxHeight={520}
      defaultPosition={{ x: 420, y: 300 }}
    >
      <div className="space-y-4 p-3">
        {data.analysedSolves === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Scale className="size-7 text-ink-3/30" />
            <p className="text-sm font-medium text-ink-2">
              {t("panel.phaseBalance.notEnoughData")}
            </p>
            <p className="max-w-60 text-[0.66rem] leading-relaxed text-ink-3">
              {t("panel.phaseBalance.notEnoughDataHint")}
            </p>
          </div>
        ) : (
          <>
            {latest && <LatestBreakdown analysis={latest} />}
            <div className="border-t border-line/60 pt-3">
              <AverageBreakdown
                rows={data.rows}
                benchmark={data.benchmark}
                hasEnoughForTrend={data.hasEnoughForTrend}
              />
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[0.56rem] text-ink-3">
              <span>{t("panel.phaseBalance.comparableSolves", { count: data.analysedSolves })}</span>
              <span>
                {data.hasEnoughForTrend
                  ? t("panel.phaseBalance.selfBaselineReady")
                  : t("panel.phaseBalance.needMoreForTrend", {
                      count: 5 - data.analysedSolves,
                    })}
              </span>
            </div>
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
