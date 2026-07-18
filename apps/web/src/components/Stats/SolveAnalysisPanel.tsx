"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import type { Solve } from "@/types";
import type { SolveMetrics } from "@cubeforge/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface SolveAnalysisPanelProps {
  solve: Solve;
  className?: string;
}

/** Single metric tile for the grid. */
function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-3.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span
        className={cn(
          "nums text-lg",
          accent ? "text-ready" : "text-ink",
        )}
      >
        {value}
      </span>
      {sub && (
        <span className="nums text-[0.65rem] text-ink-3">{sub}</span>
      )}
    </div>
  );
}

/** Small phase row. */
function PhaseRow({ name, time, moves, tps }: {
  name: string;
  time: number;
  moves: number;
  tps: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-sm border-b border-line/50 last:border-0">
      <span className="font-medium text-ink-2 text-xs uppercase tracking-wide">
        {name}
      </span>
      <div className="flex items-center gap-3 nums text-xs text-ink-3">
        <span>{moves}m</span>
        {time > 0 ? (
          <>
            <span>{formatTime(time)}</span>
            <span className="text-ink font-medium">{tps.toFixed(1)} tps</span>
          </>
        ) : (
          <span className="text-ink-3/50">—</span>
        )}
      </div>
    </div>
  );
}

/**
 * Post-solve analysis panel shown in the sidebar.
 *
 * Displays the most recent solve's phase breakdown, TPS, pauses,
 * and method-specific metrics. Only renders when the solve has
 * `analysis` data (Smart Cube solves).
 */
export function SolveAnalysisPanel({ solve, className }: SolveAnalysisPanelProps) {
  const metrics = solve.analysis;
  const hasAnalysis = metrics != null;

  if (!hasAnalysis) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-16 text-center">
          <p className="text-sm text-ink-2">No analysis available</p>
          <p className="text-xs text-ink-3">
            Connect a Smart Cube to get per-move analysis.
          </p>
        </div>
      </div>
    );
  }

  const m = metrics;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Solve summary */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.62rem] uppercase tracking-[0.2em] text-ink-3">
            Last Solve Analysis
          </span>
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-blue-500">
            {solve.method || "CFOP"}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="nums text-2xl text-ink">
            {formatTime(m.totalTimeMs)}
          </p>
          <span className="nums text-[0.7rem] text-ink-3">
            {m.totalMoves} moves · {formatTime(solve.time)} timer
          </span>
        </div>
      </div>

      {/* TPS overview */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <MetricTile
          label="TPS Global"
          value={m.tps.global.toFixed(2)}
          accent={m.tps.global > 4}
        />
        <MetricTile
          label="TPS Peak"
          value={m.tps.peakInstantaneous.toFixed(2)}
          accent={m.tps.peakInstantaneous > 7}
        />
        <MetricTile label="Pauses" value={`${m.pauses.totalCount}`} />
        <MetricTile
          label="Pause Time"
          value={formatTime(m.pauses.totalPauseTimeMs)}
        />
      </div>

      {/* Phase breakdown (accordion) */}
      <Accordion type="single" collapsible defaultValue="phases">
        <AccordionItem value="phases" className="border-0">
          <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wide text-ink-2 hover:no-underline">
            Phase Breakdown
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-lg border border-line bg-surface overflow-hidden">
              {m.phases.map((p) => (
                <PhaseRow
                  key={p.phaseName}
                  name={p.phaseName}
                  time={p.durationMs}
                  moves={p.moveCount}
                  tps={p.tps}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Advanced metrics (accordion) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="border-0">
          <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wide text-ink-2 hover:no-underline">
            Advanced Metrics
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <MetricTile
                label="Fluidity (CV)"
                value={m.fluidity.coefficientOfVariation.toFixed(3)}
                sub={`σ=${m.fluidity.stdDevMs}ms`}
              />
              <MetricTile label="Bursts" value={`${m.fluidity.burstCount}`} />
              <MetricTile
                label="Pause Ratio"
                value={`${(m.pauses.pauseRatio * 100).toFixed(0)}%`}
              />
              <MetricTile
                label="Max Pause"
                value={formatTime(m.pauses.maxDurationMs)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Rotation & Efficiency (accordion) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="rotation" className="border-0">
          <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wide text-ink-2 hover:no-underline">
            Rotations &amp; Efficiency
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <MetricTile
                label="Rotations"
                value={`${m.rotation.totalCount}`}
                sub={`x:${m.rotation.byAxis.x} y:${m.rotation.byAxis.y} z:${m.rotation.byAxis.z}`}
              />
              <MetricTile
                label="Rot Time"
                value={formatTime(m.rotation.estimatedRotationTimeMs)}
              />
              <MetricTile
                label="Efficiency"
                value={m.efficiency.moveEfficiencyRatio.toFixed(2)} sub={`opt=${m.efficiency.optimalMoveCount}m`}
              />
              <MetricTile
                label="Drift"
                value={`${(m.efficiency.forwardDrift * 100).toFixed(0)}%`}
              />
              {m.redundancy && (
                <>
                  <MetricTile
                    label="Redundancies"
                    value={`${m.redundancy.totalRedundancies}`}
                    sub={`${(m.redundancy.redundancyRate * 100).toFixed(0)}% rate`}
                    accent={m.redundancy.totalRedundancies > 0}
                  />
                  <MetricTile
                    label="Cancellations"
                    value={`${m.redundancy.cancellations}`}
                    sub={`${m.redundancy.repetitions} reps`}
                  />
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Method-specific (CFOP / Roux) */}
      {(m.cfop || m.roux) && (
        <Accordion type="single" collapsible>
          <AccordionItem value="method-specific" className="border-0">
            <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wide text-ink-2 hover:no-underline">
              {m.cfop ? "CFOP Details" : "Roux Details"}
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {m.cfop && (
                  <>
                    <MetricTile label="Cross Eff" value={m.cfop.crossEfficiency.toFixed(2)} />
                    <MetricTile label="Cross→F2L" value={formatTime(m.cfop.crossToF2LTransitionMs)} />
                    <MetricTile label="OLL Recog" value={formatTime(m.cfop.ollRecognitionMs)} />
                    <MetricTile label="OLL TPS" value={m.cfop.ollTPS.toFixed(2)} />
                    <MetricTile label="PLL Recog" value={formatTime(m.cfop.pllRecognitionMs)} />
                    <MetricTile label="PLL TPS" value={m.cfop.pllTPS.toFixed(2)} />
                    <MetricTile
                      label="Lookahead"
                      value={m.cfop.f2lLookaheadScore.toFixed(2)}
                      accent={m.cfop.f2lLookaheadScore > 0.7}
                    />
                    <MetricTile label="F2L Pairs" value={`${m.cfop.f2lPairs.length}`} />
                  </>
                )}
                {m.roux && (
                  <>
                    <MetricTile label="FB Eff" value={m.roux.firstBlockEfficiency.toFixed(2)} />
                    <MetricTile label="FB TPS" value={m.roux.firstBlockTPS.toFixed(2)} />
                    <MetricTile label="SB TPS" value={m.roux.secondBlockTPS.toFixed(2)} />
                    <MetricTile label="CMLL Recog" value={formatTime(m.roux.cmllRecognitionMs)} />
                    <MetricTile label="CMLL TPS" value={m.roux.cmllTPS.toFixed(2)} />
                    <MetricTile label="LSE-EO" value={formatTime(m.roux.lseEOTimeMs)} />
                    <MetricTile label="LSE-ULUR" value={formatTime(m.roux.lseULURTimeMs)} />
                    <MetricTile label="M-slice" value={formatTime(m.roux.lseMsliceTimeMs)} />
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
