"use client";

import { memo, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import type { SkillRadarProfile, SkillAxisData } from "@/utils/insights";

export interface SkillRadarChartProps {
  sessionProfile: SkillRadarProfile;
  solveProfile?: SkillRadarProfile | null;
  solveNumber?: number;
  className?: string;
}

interface RadarDataPoint {
  axisId: string;
  name: string;
  sessionScore: number;
  solveScore?: number;
  sessionAxis: SkillAxisData;
  solveAxis?: SkillAxisData;
}

export const SkillRadarChart = memo(function SkillRadarChart({
  sessionProfile,
  solveProfile,
  solveNumber,
  className,
}: SkillRadarChartProps) {
  const { t } = useTranslation("insights");

  const getAxisName = useCallback((id: string): string => {
    switch (id) {
      case "tps":
        return t("skillRadar.axes.tps");
      case "lookahead":
        return t("skillRadar.axes.lookahead");
      case "economy":
        return t("skillRadar.axes.economy");
      case "ergonomics":
        return t("skillRadar.axes.ergonomics");
      case "recognition":
        return t("skillRadar.axes.recognition");
      case "consistency":
        return t("skillRadar.axes.consistency");
      default:
        return id;
    }
  }, [t]);

  const getAxisHint = useCallback((id: string): string => {
    switch (id) {
      case "tps":
        return t("skillRadar.hints.tps");
      case "lookahead":
        return t("skillRadar.hints.lookahead");
      case "economy":
        return t("skillRadar.hints.economy");
      case "ergonomics":
        return t("skillRadar.hints.ergonomics");
      case "recognition":
        return t("skillRadar.hints.recognition");
      case "consistency":
        return t("skillRadar.hints.consistency");
      default:
        return "";
    }
  }, [t]);

  const chartData: RadarDataPoint[] = useMemo(() => {
    return sessionProfile.axes.map((sessionAxis) => {
      const solveAxis = solveProfile?.axes.find((a) => a.id === sessionAxis.id);
      return {
        axisId: sessionAxis.id,
        name: getAxisName(sessionAxis.id),
        sessionScore: sessionAxis.score,
        solveScore: solveAxis ? solveAxis.score : undefined,
        sessionAxis,
        solveAxis,
      };
    });
  }, [sessionProfile, solveProfile, getAxisName]);

  const isComparative = solveProfile != null && solveProfile.analysedCount > 0;
  const primaryStrength = isComparative ? solveProfile.primaryStrength : sessionProfile.primaryStrength;
  const primaryBottleneck = isComparative ? solveProfile.primaryBottleneck : sessionProfile.primaryBottleneck;
  const overallScore = isComparative ? solveProfile.overallScore : sessionProfile.overallScore;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Radar visual canvas ────────────────────────────────────────── */}
      <div className="relative mx-auto h-64 w-full max-w-sm sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={chartData}
            margin={{ top: 12, right: 28, bottom: 12, left: 28 }}
          >
            <PolarGrid
              stroke="var(--line)"
              strokeDasharray="2 2"
              className="opacity-70"
            />
            <PolarAngleAxis
              dataKey="name"
              tick={({ payload, x, y, textAnchor }) => (
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill="var(--ink-2)"
                  className="font-mono text-[0.62rem] font-medium tracking-tight"
                >
                  {payload.value}
                </text>
              )}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              ticks={[25, 50, 75, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload as RadarDataPoint;
                const axis = isComparative && data.solveAxis ? data.solveAxis : data.sessionAxis;
                const hint = getAxisHint(data.axisId);
                return (
                  <div className="rounded-md border border-line bg-[var(--glass-bg-dense)] p-2.5 shadow-none text-ink text-[0.7rem] max-w-56">
                    <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 font-medium">
                      <span className="text-ink">{data.name}</span>
                      <span className="font-mono font-semibold text-ink">
                        {axis.score}/100
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1 text-[0.62rem] text-ink-2">
                      <div className="flex justify-between">
                        <span className="text-ink-3">{t("skillRadar.actual")}:</span>
                        <span className="font-mono font-medium">
                          {axis.formattedValue === "—"
                            ? "—"
                            : `${axis.formattedValue} ${axis.unit}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-3">{t("skillRadar.benchmark")}:</span>
                        <span className="font-mono text-ink-3">{axis.benchmark}</span>
                      </div>
                      {isComparative && data.solveAxis && (
                        <div className="flex justify-between border-t border-line/40 pt-1 text-ink-3">
                          <span>{t("skillRadar.legendSession")}:</span>
                          <span className="font-mono">{data.sessionAxis.score}/100</span>
                        </div>
                      )}
                    </div>
                    {hint ? (
                      <p className="mt-1.5 border-t border-line/40 pt-1 text-[0.58rem] text-ink-3 leading-tight">
                        {hint}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />

            {/* Session Baseline Radar */}
            <Radar
              name={t("skillRadar.legendSession")}
              dataKey="sessionScore"
              stroke={isComparative ? "var(--ink-3)" : "var(--ink)"}
              strokeWidth={isComparative ? 1.2 : 1.8}
              strokeDasharray={isComparative ? "3 3" : undefined}
              fill="var(--ink)"
              fillOpacity={isComparative ? 0.05 : 0.12}
              isAnimationActive={false}
            />

            {/* Selected Solve Radar (when in comparative mode) */}
            {isComparative && (
              <Radar
                name={
                  solveNumber != null
                    ? t("skillRadar.singleSolveEyebrow", { number: solveNumber })
                    : t("skillRadar.legendSolve")
                }
                dataKey="solveScore"
                stroke="var(--ink)"
                strokeWidth={2}
                fill="var(--ink)"
                fillOpacity={0.25}
                isAnimationActive={false}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend (when comparative) ─────────────────────────────────── */}
      {isComparative && (
        <div className="flex items-center justify-center gap-5 text-[0.62rem] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-ink" />
            <span className="text-ink-2 font-medium">
              {solveNumber != null
                ? t("overview.solveNumber", { number: solveNumber })
                : t("skillRadar.legendSolve")}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-b border-dashed border-ink-3" />
            <span>{t("skillRadar.legendSession")}</span>
          </span>
        </div>
      )}

      {/* ── Diagnostic Highlights & Index ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Overall Index */}
        <div className="flex flex-col justify-center rounded border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-[0.58rem] font-medium uppercase tracking-wider text-ink-3">
            {t("skillRadar.overallScore")}
          </span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono text-base font-semibold text-ink">
              {overallScore}
            </span>
            <span className="font-mono text-[0.65rem] text-ink-3">/ 100</span>
          </div>
        </div>

        {/* Primary Strength */}
        <div className="flex flex-col justify-center rounded border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-[0.58rem] font-medium uppercase tracking-wider text-ready">
            {t("skillRadar.primaryStrength")}
          </span>
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <span className="text-[0.72rem] font-medium text-ink truncate">
              {primaryStrength
                ? getAxisName(primaryStrength.id)
                : "—"}
            </span>
            {primaryStrength ? (
              <span className="font-mono text-[0.65rem] font-semibold text-ready shrink-0">
                {primaryStrength.score}/100
              </span>
            ) : null}
          </div>
        </div>

        {/* Primary Bottleneck */}
        <div className="flex flex-col justify-center rounded border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-[0.58rem] font-medium uppercase tracking-wider text-hold">
            {t("skillRadar.primaryBottleneck")}
          </span>
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <span className="text-[0.72rem] font-medium text-ink truncate">
              {primaryBottleneck
                ? getAxisName(primaryBottleneck.id)
                : "—"}
            </span>
            {primaryBottleneck ? (
              <span className="font-mono text-[0.65rem] font-semibold text-hold shrink-0">
                {primaryBottleneck.score}/100
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
