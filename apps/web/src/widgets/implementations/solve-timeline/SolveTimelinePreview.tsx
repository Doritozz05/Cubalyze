"use client";

export function SolveTimelinePreview() {
  const phases = [
    { color: "var(--color-chart-1, #4c9a6a)", w: 28 },
    { color: "var(--color-chart-2, #3a6ea5)", w: 35 },
    { color: "var(--color-chart-3, #a8650a)", w: 18 },
    { color: "var(--color-chart-5, #b3261e)", w: 19 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-2.5">
      <div className="flex h-3.5 w-full overflow-hidden rounded-[3px]">
        {phases.map((p, i) => (
          <div
            key={i}
            style={{
              width: `${p.w}%`,
              backgroundColor: p.color,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {["Cross", "F2L", "OLL", "PLL"].map((name, i) => (
          <div key={name} className="flex items-center gap-1">
            <span
              className="size-1.5 rounded-[2px]"
              style={{ backgroundColor: phases[i].color, opacity: 0.7 }}
            />
            <span className="text-[0.35rem] font-medium uppercase tracking-wider text-ink-3/60">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
