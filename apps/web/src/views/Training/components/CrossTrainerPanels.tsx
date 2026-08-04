"use client";

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
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Flame} label="Attempts" value={`${stats.total}`} />
        <StatChip icon={Target} label="Accuracy" value={`${stats.accuracy}%`} />
        <StatChip icon={Crosshair} label="Best" value={stats.bestMoves > 0 ? `${stats.bestMoves}` : "--"} />
        <StatChip icon={Clock} label="Avg moves" value={stats.avgMoves > 0 ? `${stats.avgMoves}` : "--"} />
        <StatChip icon={Clock} label="Avg time" value={avgTimeMs > 0 ? formatTime(avgTimeMs) : "--"} />
        <StatChip icon={Gauge} label="Efficiency" value={stats.efficiency > 0 ? `${stats.efficiency}%` : "--"} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tips panel (column 3)
   ─────────────────────────────────────────────────────────────────────── */

export function CrossTipsPanel() {
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-caution" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">Tips</h4>
      </div>
      <ul className="space-y-2 text-[0.58rem] text-ink-3/80">
        <li className="flex gap-2">
          <span className="text-caution/60 shrink-0 mt-0.5">•</span>
          Plan your entire cross during inspection — no move counting
          during execution.
        </li>
        <li className="flex gap-2">
          <span className="text-caution/60 shrink-0 mt-0.5">•</span>
          World-class crosses are ≤ 6 moves. The theoretical max is 8.
        </li>
        <li className="flex gap-2">
          <span className="text-caution/60 shrink-0 mt-0.5">•</span>
          Use the replay to study the optimal path and spot missed
          efficiencies.
        </li>
        <li className="flex gap-2">
          <span className="text-caution/60 shrink-0 mt-0.5">•</span>
          Toggle the cross highlight to track the 4 target edges
          visually.
        </li>
        <li className="flex gap-2">
          <span className="text-caution/60 shrink-0 mt-0.5">•</span>
          Color-neutral (CN) mode finds the best face for each scramble
          — saves ~0.5s per solve.
        </li>
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
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <Crosshair className="size-3.5 text-phase-blue" />
        <h4 className="text-[0.62rem] font-medium text-ink-2">
          Current scramble
        </h4>
      </div>
      <div className="space-y-1 text-[0.6rem]">
        <div className="flex justify-between">
          <span className="text-ink-3">Mode</span>
          <span className="nums font-medium text-ink">
            {cnMode ? "Color-neutral" : `${face} fixed`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">Solved face</span>
          <span className="nums font-medium text-ink">{face}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">Optimal depth</span>
          <span className="nums font-medium text-ink">
            {optimalDepth}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">Your last</span>
          <span className="nums font-medium text-ink">
            {lastUserMoves ?? "--"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">Streak</span>
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
  if (attempts.length === 0) {
    return (
      <p className="text-[0.58rem] text-ink-3/40 italic text-center py-4">
        No attempts yet. Time your cross and enter your move count above.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {attempts.slice(0, 12).map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.6rem] hover:bg-surface-2/50"
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
