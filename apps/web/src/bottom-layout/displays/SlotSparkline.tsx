import { useMemo } from "react";
import { deriveSparkline } from "@cubeforge/analysis-engine";
import type { Solve } from "@/types";

interface SlotSparklineProps {
  solves: Solve[];
  className?: string;
}

export function SlotSparkline({ solves, className }: SlotSparklineProps) {
  const statSolves = useMemo(
    () => solves.map((s) => ({ time: s.time ?? 0, penalty: s.penalty })),
    [solves],
  );
  // Last 30 solves in chronological order
  const points = useMemo(() => deriveSparkline(statSolves, 30), [statSolves]);

  if (points.length < 2) {
    return (
      <div className="flex size-full items-center justify-center p-2 text-xs text-ink-3">
        —
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const width = 240;
  const height = 60;
  const padding = 6;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const coords = points.map((val, idx) => {
    const x = padding + (idx / (points.length - 1)) * innerW;
    const y = height - padding - ((val - min) / range) * innerH;
    return { x, y, val };
  });

  const pathD = coords.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`),
    "",
  );

  const fillD = `${pathD} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;
  const minPt = coords.reduce((prev, curr) => (curr.val < prev.val ? curr : prev), coords[0]);

  return (
    <div className={`flex size-full flex-col justify-center min-w-0 ${className ?? ""}`}>
      <div className="flex items-center justify-between text-[0.6rem] text-ink-3 pb-1">
        <span>PB: {(min / 1000).toFixed(2)}s</span>
        <span>Último: {(points[points.length - 1] / 1000).toFixed(2)}s</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-12 overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ink, currentColor)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-ink, currentColor)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#sparkGradient)" />
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-ink, currentColor)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={minPt.x} cy={minPt.y} r="3" className="fill-ready stroke-surface stroke-[1.5]" />
      </svg>
    </div>
  );
}
