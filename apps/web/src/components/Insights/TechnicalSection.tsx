"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { PANEL_BASE } from "@/lib/panel";
import { formatTime } from "@/utils/formatTime";

import { deriveMoveMetrics, deriveSkillRadarProfile } from "@/utils/insights";
import { phaseColorHex } from "@/utils/phaseColors";
import { SectionHeader, SkillRadarChart } from "./atoms";
import { FACE_HEX } from "./atoms/faceColors";
import type { Solve } from "@/types";

// ─── Shared card chrome ──────────────────────────────────────────────────────

/** @see {@link PANEL_BASE} in lib/panel — imported as the single source of truth. */
const CARD = PANEL_BASE;

// Recharts tooltip chrome reused by every chart in this section.
const TOOLTIP_STYLE = {
  border: "1px solid var(--line)",
  borderRadius: "6px",
  background: "var(--glass-bg-dense)",
  color: "var(--ink)",
  fontSize: "0.7rem",
  padding: "4px 8px",
  boxShadow: "none",
} as const;

// ─── Rolling average ─────────────────────────────────────────────────────────

function rolling(points: (number | null)[], w: number): (number | null)[] {
  return points.map((_, i) => {
    if (i + 1 < w) return null;
    const win = points
      .slice(i - w + 1, i + 1)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return win.length >= w ? win.reduce((a, b) => a + b, 0) / w : null;
  });
}

// ─── Histogram bins ──────────────────────────────────────────────────────────

// ─── Main section ────────────────────────────────────────────────────────────

export interface TechnicalSectionProps {
  solves: Solve[];
  className?: string;
}

export function TechnicalSection({ solves, className }: TechnicalSectionProps) {
  const { t } = useTranslation("insights");

  // Chronological (oldest first) solves with analysis — the ordering baseline
  // for every time-series chart in this section.
  const chrono = useMemo(
    () =>
      [...solves]
        .filter((s) => s.analysis?.phases?.length)
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
    [solves],
  );
  const analysed = useMemo(
    () => chrono.filter((s) => !!s.analysis),
    [chrono],
  );

  // ── Stacked area: % of solve time per phase, solve-to-solve ──────────
  const stacked = useMemo(
    () =>
      chrono.map((s, i) => {
        const total = s.analysis!.phases.reduce((x, p) => x + p.durationMs, 0) || 1;
        const row: Record<string, number> = { idx: i };
        for (const p of s.analysis!.phases) {
          if (p.skipped) continue;
          row[p.phaseName] = (p.durationMs / total) * 100;
        }
        return row;
      }),
    [chrono],
  );

  // Phase name set used consistently across the phase charts.
  const phasesInData = useMemo(
    () => Array.from(new Set(stacked.flatMap((r) => Object.keys(r).filter((k) => k !== "idx")))),
    [stacked],
  );

  // ── Phase trends (rolling mean) ──────────────────────────────────────
  const trendSeries = useMemo(() => {
    const series: Record<string, (number | null)[]> = {};
    for (const name of phasesInData) series[name] = [];
    for (const s of chrono) {
      for (const name of phasesInData) {
        const p = s.analysis!.phases.find((x) => x.phaseName === name);
        series[name].push(p && !p.skipped ? p.durationMs : null);
      }
    }
    const rows = chrono.map((__, i) => {
      const row: Record<string, number | null> = { idx: i };
      for (const name of phasesInData) {
        row[name] = rolling(series[name], 5)[i];
      }
      return row;
    });
    return rows;
  }, [chrono, phasesInData]);

  // ── Face usage (aggregate across analysed moves) + rhythm ────────────
  const faceUsage = useMemo(() => {
    const agg: Record<string, number> = {};
    let total = 0;
    const rhythm: number[] = [];
    const doublesPct: number[] = [];
    let wide = 0;
    let consecutive = 0;
    for (const s of solves) {
      if (!s.moves?.length) continue;
      const mm = deriveMoveMetrics(s.moves);
      for (const [f, c] of Object.entries(mm.faceFreq)) {
        agg[f] = (agg[f] ?? 0) + c;
        total += c;
      }
      wide += mm.wideCount;
      consecutive += mm.consecutiveSameFace;
      if (mm.gapMeanMs != null) rhythm.push(mm.gapMeanMs);
      if (mm.doublesPct != null) doublesPct.push(mm.doublesPct);
    }
    const order = ["U", "L", "F", "R", "B", "D"];
    const rows = order
      .filter((f) => agg[f] != null)
      .map((f) => ({ face: f, value: total > 0 ? (agg[f] / total) * 100 : 0 }));
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    return { rows, total, wide, consecutive, avgGapMs: avg(rhythm), avgDoublesPct: avg(doublesPct) };
  }, [solves]);

  // ── Fingerprint: latest analysed solve's move barcode ────────────────
  const fingerprint = useMemo(() => {
    const latest = [...solves].find((s) => s.moves?.length);
    if (!latest || !latest.moves) return null;
    const moves = latest.moves;
    const gaps: number[] = [];
    for (let i = 1; i < moves.length; i++) {
      const g = moves[i].hostTimestamp - moves[i - 1].hostTimestamp;
      if (Number.isFinite(g) && g >= 0) gaps.push(g);
    }
    const maxGap = gaps.length ? Math.max(...gaps) : 1;
    return { latest, moves, gaps, maxGap };
  }, [solves]);

  // ── Skill Radar Profile: 6 Universal Dimensions ─────────────────────
  const skillRadar = useMemo(
    () => deriveSkillRadarProfile(solves),
    [solves],
  );

  if (analysed.length === 0) {
    return (
      <div className={cn(CARD, className)}>
        <SectionHeader
          title={t("overview.technical")}
          eyebrow={t("overview.technicalNoData")}
        />
        <div className="mt-4 flex h-20 items-center justify-center text-[0.7rem] text-ink-3">
          {t("overview.technicalEmpty")}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 max-lg:gap-4", className)}>
      <div className="px-1">
        <SectionHeader
          title={t("overview.technical")}
          eyebrow={t("overview.technicalEyebrow", { count: analysed.length })}
        />
      </div>

      {/* ── Skill Radar: 6 Universal Dimensions ────────────────────────── */}
      <div className={CARD}>
        <SectionHeader
          title={t("skillRadar.title")}
          eyebrow={t("skillRadar.eyebrow")}
        />
        <div className="mt-4">
          <SkillRadarChart sessionProfile={skillRadar} />
        </div>
      </div>

      {/* ── Stacked area: % of time per phase over the session ─────────── */}
      {stacked.length >= 2 && (
        <div className={CARD}>
          <SectionHeader title={t("overview.techPhaseArea")} eyebrow={t("overview.techPhaseAreaEyebrow")} />
          <div className="mt-3 h-28 w-full sm:h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stacked} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="idx" hide domain={["dataMin", "dataMax"]} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  cursor={false}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: "var(--ink)" }}
                  labelFormatter={(_, payload) => {
                    const pt = payload?.[0]?.payload as { idx?: number } | undefined;
                    return pt?.idx != null ? t("overview.solveNumber", { number: pt.idx + 1 }) : "";
                  }}
                  formatter={(v: unknown, name: unknown) => [`${Math.round(Number(v ?? 0))}%`, String(name)]}
                />
                {phasesInData.map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="phase"
                    stroke={phaseColorHex(name, i)}
                    strokeWidth={1}
                    fill={phaseColorHex(name, i)}
                    fillOpacity={0.75}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.62rem] text-ink-3">
            {phasesInData.map((name, i) => (
              <span key={name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: phaseColorHex(name, i) }} />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Face usage + fingerprint ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(CARD, "max-lg:px-4 max-lg:py-3")}>
          <SectionHeader title={t("overview.techFaceUsage")} eyebrow={t("overview.techMoves", { count: faceUsage.total })} />
          {faceUsage.rows.length === 0 ? (
            <div className="mt-4 flex h-20 items-center justify-center text-[0.7rem] text-ink-3">
              {t("overview.technicalNoData")}
            </div>
          ) : (
            <>
              <div className="mt-2 h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faceUsage.rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="face" tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={{ stroke: "var(--line)", strokeOpacity: 0.25 }} />
                    <YAxis hide domain={[0, "dataMax + 8"]} />
                    <Tooltip
                      cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: "var(--ink)" }}
                      formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, t("overview.techUsage")]}
                    />
                    <Bar dataKey="value" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                      {faceUsage.rows.map((r) => (
                        <Cell
                          key={r.face}
                          fill={FACE_HEX[r.face] ?? "#6b7280"}
                          // Subtle outline so light faces (white U, yellow D)
                          // stay visible on the light surface.
                          stroke="var(--line-2)"
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.62rem] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-ink-3" /> {t("overview.techDoubles")}:{" "}
                  <b className="nums text-ink">{faceUsage.avgDoublesPct != null ? `${faceUsage.avgDoublesPct.toFixed(1)}%` : "—"}</b>
                </span>
                <span>{t("overview.techWide")}: <b className="nums text-ink">{faceUsage.wide}</b></span>
                <span>{t("overview.techConsecutive")}: <b className="nums text-ink">{faceUsage.consecutive}</b></span>
                <span>{t("overview.techGap")}: <b className="nums text-ink">{faceUsage.avgGapMs != null ? `${Math.round(faceUsage.avgGapMs)}ms` : "—"}</b></span>
              </div>
            </>
          )}
        </div>

        <div className={cn(CARD, "flex flex-col max-lg:px-4 max-lg:py-3")}>
          <SectionHeader title={t("overview.techFingerprint")} eyebrow={t("overview.techFingerprintEyebrow")} />
          {fingerprint ? (
            <div className="my-auto flex flex-1 flex-col justify-center py-2">
              <div className="flex h-6 w-full gap-px overflow-hidden rounded-md">
                {fingerprint.moves.map((m, i) => (
                  <div
                    key={i}
                    title={`${m.face}${m.direction === 2 ? "2" : m.direction === 1 ? "" : "'"} · ${formatTime(m.hostTimestamp)}`}
                    className="h-full flex-1"
                    style={{ background: FACE_HEX[m.face] ?? "#6b7280" }}
                  />
                ))}
              </div>
              {/* Speed layer: darker bar = slower inter-move gap (rhythm). */}
              <div className="mt-1 flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                {fingerprint.moves.slice(0, -1).map((_, i) => {
                  const g = fingerprint.gaps[i] ?? 0;
                  const speed = 1 - g / fingerprint.maxGap;
                  return (
                    <div key={i} className="flex-1" style={{ background: `rgba(55,65,81,${0.15 + speed * 0.6})` }} />
                  );
                })}
              </div>
              <p className="mt-2 text-[0.6rem] text-ink-3/70">{t("overview.techFingerprintHint")}</p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[0.7rem] text-ink-3 min-h-20">
              {t("overview.technicalNoData")}
            </div>
          )}
        </div>
      </div>

      {/* ── Phase trends (rolling mean) ────────────────────────────────── */}
      {trendSeries.length >= 5 && (
        <div className={CARD}>
          <SectionHeader title={t("overview.techTrend")} eyebrow={t("overview.techTrendEyebrow")} />
          <div className="mt-3 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="idx" tick={false} axisLine={{ stroke: "var(--line)", strokeOpacity: 0.25 }} tickLine={false} />
                <YAxis
                  width={36}
                  tickFormatter={(v: number) => formatTime(v)}
                  tick={{ fontSize: 9, fill: "var(--ink-3)" }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, "dataMax + 200"]}
                />
                <Tooltip
                  cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: "var(--ink)" }}
                  labelFormatter={(_, payload) => {
                    const pt = payload?.[0]?.payload as { idx?: number } | undefined;
                    return pt?.idx != null ? t("overview.solveNumber", { number: pt.idx + 1 }) : "";
                  }}
                  formatter={(v: unknown, name: unknown) => [formatTime(Number(v ?? 0)), String(name)]}
                />
                {phasesInData.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={phaseColorHex(name, i)}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
