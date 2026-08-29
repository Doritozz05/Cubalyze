"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Minimal CFOP distribution bar in the table header */
export function CfopMiniBar({
  crossMoves,
  f2lMoves,
  ollMoves,
  pllMoves,
  totalMoves,
}: {
  crossMoves: number;
  f2lMoves: number;
  ollMoves: number;
  pllMoves: number;
  totalMoves: number;
}) {
  if (totalMoves <= 0) return null;
  const crossPct = (crossMoves / totalMoves) * 100;
  const f2lPct = (f2lMoves / totalMoves) * 100;
  const ollPct = (ollMoves / totalMoves) * 100;
  const pllPct = (pllMoves / totalMoves) * 100;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 border border-line/60">
          <div style={{ width: `${crossPct}%` }} className="h-full bg-phase-blue" />
          <div style={{ width: `${f2lPct}%` }} className="h-full bg-phase-emerald" />
          <div style={{ width: `${ollPct}%` }} className="h-full bg-phase-amber" />
          <div style={{ width: `${pllPct}%` }} className="h-full bg-phase-violet" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-mono">
        <div>Cross: {crossMoves}m ({crossPct.toFixed(0)}%)</div>
        <div>F2L: {f2lMoves}m ({f2lPct.toFixed(0)}%)</div>
        <div>OLL: {ollMoves}m ({ollPct.toFixed(0)}%)</div>
        <div>PLL: {pllMoves}m ({pllPct.toFixed(0)}%)</div>
      </TooltipContent>
    </Tooltip>
  );
}
