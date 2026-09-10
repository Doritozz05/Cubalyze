import { useMemo } from "react";
import { deriveTpsSeries } from "@cubeforge/analysis-engine";
import type { Solve } from "@/types";

interface SlotTpsCurveProps {
  solves: Solve[];
  className?: string;
}

export function SlotTpsCurve({ solves, className }: SlotTpsCurveProps) {
  const points = useMemo(() => deriveTpsSeries(solves).slice(-25), [solves]);

  if (points.length < 2) {
    return (
      <div className="flex size-full items-center justify-center p-2 text-xs text-ink-3">
        Sin datos TPS
      </div>
    );
  }

  const tpsVals = points.map((p) => p.tps);
  const min = Math.min(...tpsVals);
  const max = Math.max(...tpsVals);
  const range = max - min || 1;

  const width = 240;
  const height = 60;
  const padding = 6;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = points.map((pt, idx) => {
    const x = padding + (idx / (points.length - 1)) * innerW;
    const y = height - padding - ((pt.tps - min) / range) * innerH;
    return { x, y, val: pt.tps };
  });

  const pathD = coords.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`),
    "",
  );

  const avgTps = tpsVals.reduce((a, b) => a + b, 0) / tpsVals.length;

  return (
    <div className={`flex size-full flex-col justify-center min-w-0 ${className ?? ""}`}>
      <div className="flex items-center justify-between text-[0.6rem] text-ink-3 pb-1">
        <span>TPS Medio: {avgTps.toFixed(2)}</span>
        <span>Máx: {max.toFixed(2)} TPS</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-12 overflow-visible"
        preserveAspectRatio="none"
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-ink, currentColor)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? "2.5" : "1.5"}
            className={i === coords.length - 1 ? "fill-ready" : "fill-ink/50"}
          />
        ))}
      </svg>
    </div>
  );
}
