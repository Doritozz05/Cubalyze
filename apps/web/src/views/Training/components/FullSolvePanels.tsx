"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { buildMethodPhases } from "@cubeforge/training";
import type { PhaseSplit, PhaseSplitTarget } from "./fullSolveTypes";

/** Per-phase default target times (seconds) for Full Solve phase mode. */
export const DEFAULT_PHASE_TARGETS: Record<string, { name: string; targetS: number }> = {
  cross: { name: "Cross", targetS: 2.0 },
  f2l: { name: "F2L", targetS: 6.0 },
  af2l: { name: "Advanced F2L", targetS: 6.5 },
  oll: { name: "OLL", targetS: 1.5 },
  pll: { name: "PLL", targetS: 1.2 },
  "first-block": { name: "First block", targetS: 2.5 },
  "second-block": { name: "Second block", targetS: 2.0 },
  cmll: { name: "CMLL", targetS: 1.5 },
  lse: { name: "LSE", targetS: 2.0 },
  eoline: { name: "EOLine", targetS: 3.0 },
  "f2l-zz": { name: "F2L (ZZ)", targetS: 6.0 },
  "ll-zz": { name: "Last layer", targetS: 2.0 },
  "block-222": { name: "2×2×2", targetS: 2.5 },
  "block-223": { name: "2×2×3", targetS: 2.8 },
  "eo-petrus": { name: "EO", targetS: 1.2 },
  "f2l-petrus": { name: "F2L", targetS: 3.5 },
  "ll-petrus": { name: "Last layer", targetS: 2.5 },
};

/** Build default split targets from the catalog's phases for a method. */
export function defaultPhaseTargets(methodName: string): PhaseSplitTarget[] {
  return buildMethodPhases(methodName)
    .map((phase) => {
      const def = DEFAULT_PHASE_TARGETS[phase.id];
      return def ? { phaseId: phase.id, phaseName: def.name, targetS: def.targetS } : null;
    })
    .filter((t): t is PhaseSplitTarget => t !== null);
}

/* ──────────────────────────────────────────────────────────────────────────
   Full Solve info panels (extracted from FullSolveView)
   ─────────────────────────────────────────────────────────────────────── */

export function PhaseTargetsPanel({
  splits, totalTarget, totalActual, onMarkSplit,
}: {
  splits: PhaseSplit[];
  totalTarget: number;
  totalActual: number;
  onMarkSplit: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">
        Phase Targets
      </h3>
      <div className="space-y-2.5">
        {splits.map((split) => {
          const isDone = split.status === "done";
          const isActive = split.status === "active";
          const pct = split.targetS > 0
            ? Math.min(100, Math.round((split.actualMs / 1000 / split.targetS) * 100))
            : 0;
          return (
            <button
              key={split.phaseId}
              onClick={isActive ? onMarkSplit : undefined}
              className={cn(
                "w-full rounded-lg p-2.5 transition-colors text-left",
                isActive && "bg-surface-2 ring-1 ring-ink/10 cursor-pointer hover:bg-surface-2/80",
                isDone && "bg-surface-2/50",
                !isActive && !isDone && "opacity-40 cursor-default",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[0.62rem] font-medium",
                  isActive ? "text-ink" : "text-ink-3",
                )}>
                  {split.phaseName}
                </span>
                <span className={cn(
                  "nums text-[0.6rem]",
                  isDone ? "text-ready" : "text-ink-3/60",
                )}>
                  {isDone
                    ? `${(split.actualMs / 1000).toFixed(1)}s / ${split.targetS.toFixed(1)}s`
                    : `${split.targetS.toFixed(1)}s`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                {isDone && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      "h-full rounded-full",
                      pct <= 100 ? "bg-ready" : "bg-hold",
                    )}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
        <span className="text-[0.6rem] text-ink-3">Total target</span>
        <div className="flex items-center gap-2">
          <span className="nums text-[0.68rem] font-semibold text-ink">
            {totalTarget.toFixed(1)}s
          </span>
          {totalActual > 0 && (
            <span className={cn(
              "nums text-[0.62rem]",
              totalActual <= totalTarget ? "text-ready" : "text-hold",
            )}>
              ({(totalActual).toFixed(1)}s)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MoveLimitInfo({ moveLimit }: { moveLimit: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">
        Move Limit
      </h3>
      <div className="text-center py-4">
        <span className="nums text-[2.5rem] font-bold text-ink">{moveLimit}</span>
        <p className="text-[0.6rem] text-ink-3 mt-1">max moves allowed</p>
      </div>
      <div className="space-y-1.5 text-[0.58rem] text-ink-3/70">
        <p>• CFOP average: ~55-60 moves</p>
        <p>• Roux average: ~45-50 moves</p>
        <p>• Advanced goal: ≤ 50 moves</p>
        <p>• World-class: ≤ 45 moves</p>
      </div>
    </div>
  );
}

export function TpsInfo({ tpsThreshold }: { tpsThreshold: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">
        TPS Challenge
      </h3>
      <div className="text-center py-4">
        <span className="nums text-[2.5rem] font-bold text-ink">{tpsThreshold}</span>
        <p className="text-[0.6rem] text-ink-3 mt-1">minimum TPS</p>
      </div>
      <div className="space-y-1.5 text-[0.58rem] text-ink-3/70">
        <p>• Beginner: 2-3 TPS</p>
        <p>• Intermediate: 3-5 TPS</p>
        <p>• Advanced: 5-8 TPS</p>
        <p>• Elite: 8-12+ TPS</p>
      </div>
    </div>
  );
}

export function RotationlessInfo({ hadRotations }: { hadRotations: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-3">
        Rotationless
      </h3>
      <div className="text-center py-4">
        <Lock className={cn("size-10 mx-auto mb-2", hadRotations ? "text-hold" : "text-ready")} />
        <p className={cn("text-[0.72rem] font-semibold", hadRotations ? "text-hold" : "text-ready")}>
          {hadRotations ? "Rotation Used" : "Clean Solve!"}
        </p>
      </div>
      <div className="space-y-1.5 text-[0.58rem] text-ink-3/70">
        <p>• Use d moves instead of y + U</p>
        <p>• Learn F2L cases from all angles</p>
        <p>• ZZ method forces rotationless solving</p>
        <p>• Reduces pauses from re-orientation</p>
      </div>
    </div>
  );
}
