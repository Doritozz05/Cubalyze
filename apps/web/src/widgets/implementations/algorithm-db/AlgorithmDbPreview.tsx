"use client";

import { BookOpen, Layers, Sparkles } from "lucide-react";

export function AlgorithmDbPreview() {
  return (
    <div className="flex size-full flex-col justify-between p-2 select-none bg-surface border border-line rounded">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <div className="flex items-center gap-1 text-ink">
          <BookOpen className="size-3 text-accent-cyan" />
          <span className="text-[9px] font-bold tracking-tight text-ink lowercase">
            algoritmos
          </span>
        </div>
        <span className="rounded bg-accent-cyan/15 border border-accent-cyan/30 px-1 font-mono text-[7px] font-semibold text-accent-cyan lowercase">
          cfop / pll
        </span>
      </div>

      {/* Mini preview content */}
      <div className="flex-1 my-1 space-y-1 overflow-hidden">
        {/* Sample Case Banner */}
        <div className="flex items-center justify-between bg-surface-2 px-1.5 py-0.5 rounded border border-line">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[8px] font-bold text-accent-cyan">T</span>
            <span className="text-[8px] text-ink-2 lowercase">t permutation</span>
          </div>
        </div>

        {/* Algorithm moves preview */}
        <div className="rounded bg-surface-2 p-1 border border-line font-mono text-[7px] text-accent-cyan/90 leading-tight">
          (R U R' U') R' F R2 U' R' U' (R U R' F')
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[7px] text-ink-3 pt-0.5 border-t border-line/60">
        <div className="flex items-center gap-0.5">
          <Layers className="size-2 text-ink-3" />
          <span className="lowercase">2d & 3d</span>
        </div>
        <div className="flex items-center gap-0.5 text-accent-cyan">
          <Sparkles className="size-2" />
          <span className="lowercase">interactivo</span>
        </div>
      </div>
    </div>
  );
}
