"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Scale, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { formatTime } from "@/utils/formatTime";
import { phaseColorHex } from "@/utils/phaseColors";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import {
  buildPhaseBalance,
  getLatestComparableAnalysis,
  getPhaseSegments,
  type CfopPhaseName,
  type PhaseBalanceRow,
} from "./phaseBalance";

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

function statusFor(row: PhaseBalanceRow): { label: string; tone: string; icon: typeof ArrowUp } {
  const delta = row.latestDelta ?? 0;
  if (Math.abs(delta) < 0.025) return { label: "Balanced", tone: "text-ink-3", icon: Minus };
  if (delta > 0) return { label: "Above avg", tone: "text-caution", icon: ArrowUp };
  return { label: "Below avg", tone: "text-ready", icon: ArrowDown };
}

function PhaseBar({
  phaseName,
  share,
  colorIndex,
  muted = false,
}: {
  phaseName: CfopPhaseName;
  share: number;
  colorIndex: number;
  muted?: boolean;
}) {
  const color = phaseColorHex(phaseName, colorIndex);
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[0.58rem] font-medium text-ink-2">{phaseName}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
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
  const segments = getPhaseSegments(analysis);
  return (
    <div className="space-y-1.5">
      <div className="mb-2 flex items-center justify-between text-[0.56rem] uppercase tracking-wider text-ink-3">
        <span>Latest comparable solve</span>
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
        <PhaseBar key={segment.phaseName} phaseName={segment.phaseName} share={segment.share} colorIndex={index} />
      ))}
    </div>
  );
}

function AverageBreakdown({ rows }: { rows: PhaseBalanceRow[] }) {
  return (
    <div className="space-y-1.5">
      <div className="mb-2 flex items-center justify-between text-[0.56rem] uppercase tracking-wider text-ink-3">
        <span>Recent average</span>
        <span>last 20 comparable</span>
      </div>
      {rows.map((row, index) => {
        const status = statusFor(row);
        const StatusIcon = status.icon;
        return (
          <div key={row.phaseName} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[0.58rem] font-medium text-ink-2">{row.phaseName}</span>
              <div className="flex items-center gap-2 nums text-[0.58rem]">
                <span className="text-ink-3">{formatTime(row.avgDurationMs)}</span>
                <span className="font-medium text-ink">{pct(row.share)}</span>
                {row.latestDelta !== undefined && (
                  <span className={cn("flex w-14 items-center justify-end gap-0.5", status.tone)}>
                    <StatusIcon className="size-2.5" />
                    {deltaLabel(row.latestDelta)}
                  </span>
                )}
              </div>
            </div>
            <PhaseBar phaseName={row.phaseName} share={row.share} colorIndex={index} />
          </div>
        );
      })}
    </div>
  );
}

export function FloatingPhaseBalance({ solves, lastAnalysis }: FloatingPhaseBalanceProps) {
  const data = useMemo(() => buildPhaseBalance(solves, lastAnalysis, 20), [solves, lastAnalysis]);
  const latest = useMemo(() => getLatestComparableAnalysis(solves, lastAnalysis), [solves, lastAnalysis]);

  return (
    <FloatingWidgetWrapper
      widgetId="phase-balance"
      icon={Scale}
      label="Phase balance"
      pillBadge={data.analysedSolves > 0 ? `${data.analysedSolves} analysed` : undefined}
      pillBadge2="CFOP"
      panelWidth={350}
      panelMaxHeight={520}
      defaultPosition={{ x: 420, y: 300 }}
    >
      <div className="space-y-4 p-3">
        {data.analysedSolves === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Scale className="size-7 text-ink-3/30" />
            <p className="text-sm font-medium text-ink-2">Not enough comparable CFOP data</p>
            <p className="max-w-60 text-[0.66rem] leading-relaxed text-ink-3">
              Complete analysed CFOP solves that reach a solved state. Legacy, incomplete, non-CFOP, and DNF solves stay out of this comparison.
            </p>
          </div>
        ) : (
          <>
            {latest && <LatestBreakdown analysis={latest} />}
            <div className="border-t border-line/60 pt-3">
              <AverageBreakdown rows={data.rows} />
            </div>
            <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[0.56rem] text-ink-3">
              <span>{data.analysedSolves} comparable solves</span>
              <span>{data.hasEnoughForTrend ? "self-baseline ready" : `need ${5 - data.analysedSolves} more for trend`}</span>
            </div>
          </>
        )}
      </div>
    </FloatingWidgetWrapper>
  );
}
