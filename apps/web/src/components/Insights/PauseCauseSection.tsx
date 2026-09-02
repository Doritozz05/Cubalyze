"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { derivePauseCauseSums } from "@/utils/insights";
import { formatTime } from "@/utils/formatTime";
import { SectionHeader } from "./atoms";
import { PANEL_BASE } from "@/lib/panel";
import { phaseColorHex } from "@/utils/phaseColors";
import type { Solve } from "@/types";

const TOOLTIP_STYLE = {
  border: "1px solid var(--line)",
  borderRadius: "6px",
  background: "var(--glass-bg-dense)",
  color: "var(--ink)",
  fontSize: "0.7rem",
  padding: "4px 8px",
  boxShadow: "none",
} as const;

/**
 * Session-level pause breakdown by probable cause.
 *
 * The per-solve timeline already shows WHERE each pause sits. This card rolls
 * every pause across the session up per cause — summed pause time, count and
 * share — so you see at a glance "I lose most paused time recognizing OLL /
 * searching cross pieces / hesitating inside PLL" instead of a flat total.
 *
 * Cause labels reuse the SAME translated strings as the per-solve timeline
 * (insights.analysis.pauseCause*) so both views say the same thing.
 */
export function PauseCauseSection({ solves }: { solves: Solve[] }) {
  const { t } = useTranslation("insights");
  // `t` is bound to the `insights` namespace and typed with literal ParseKeys,
  // but the cause keys are dynamic — cast to the string-key form (same pattern
  // as SkillNodeModal's i18n.t cast in this repo).
  const tAny = t as (key: string, options?: object) => string;

  const { rows, totalMs } = useMemo(() => {
    const sums = derivePauseCauseSums(solves);
    const total = sums.reduce((s, r) => s + r.totalMs, 0);
    return { rows: sums.slice(0, 8), totalMs: total };
  }, [solves]);

  const causeLabel = useMemo(() => {
    return (cause: string, phase: string): string => {
      const key = causeKey(cause);
      if (key) return tAny(key);
      if (cause.endsWith(" hesitation")) {
        return t("analysis.pauseCauseHesitation", { phase });
      }
      if (cause.endsWith(" recognition")) {
        return t("analysis.pauseCauseRecognition", { phase });
      }
      return cause;
    };
  }, [t, tAny]);

  if (rows.length === 0) {
    return (
      <div className={PANEL_BASE}>
        <SectionHeader title={t("overview.pauseByCause")} />
        <div className="mt-3 flex h-14 items-center justify-center text-center text-[0.7rem] text-ink-3">
          {t("overview.pauseByCauseEmpty")}
        </div>
      </div>
    );
  }

  // Color per cause by its phase (same semantic phase palette as the rest of
  // Insights — blue cross, green F2L, amber OLL/CMLL, red PLL/LSE).
  const colorFor = (phase: string, index: number) => phaseColorHex(phase, index);

  const chartRows = rows.map((r) => ({
    ...r,
    label: causeLabel(r.cause, r.phase),
    raw: r.cause,
  }));

  return (
    <div className={PANEL_BASE}>
      <SectionHeader
        title={t("overview.pauseByCause")}
        eyebrow={t("overview.pauseByCauseEyebrow", { total: formatTime(totalMs) })}
      />
      <div className="mt-3 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartRows}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fontSize: 9, fill: "var(--ink-2)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
              contentStyle={TOOLTIP_STYLE}
              itemStyle={{ color: "var(--ink)" }}
              formatter={(v: unknown) => [formatTime(Number(v ?? 0)), t("overview.pauseTime")]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Bar dataKey="totalMs" radius={[0, 3, 3, 0]} isAnimationActive={false} minPointSize={2}>
              {chartRows.map((r, i) => (
                <Cell key={r.raw} fill={colorFor(r.phase, i)} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: full cause name, share and pause count, top 5. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.62rem] text-ink-3">
        {chartRows.slice(0, 5).map((r, i) => (
          <span key={r.raw} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: colorFor(r.phase, i) }} />
            {causeLabel(r.cause, r.phase)} · {Math.round(r.share * 100)}% · {r.count}×
          </span>
        ))}
      </div>
    </div>
  );
}

/** Raw cause string → existing insights.analysis.pauseCause* translation key. */
function causeKey(cause: string): string | null {
  const map: Record<string, string> = {
    "OLL recognition": "analysis.pauseCauseOllRecog",
    "PLL recognition": "analysis.pauseCausePllRecog",
    "CMLL recognition": "analysis.pauseCauseCmllRecog",
    "LSE recognition": "analysis.pauseCauseLseRecog",
    "F2L pair recognition": "analysis.pauseCauseF2lPair",
    "Cross piece search": "analysis.pauseCauseCrossSearch",
    "Block building search": "analysis.pauseCauseBlockSearch",
    "Edge orientation": "analysis.pauseCauseEdgeOrientation",
  };
  return map[cause] ?? null;
}