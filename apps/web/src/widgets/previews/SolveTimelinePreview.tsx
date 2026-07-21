"use client";

export function SolveTimelinePreview() {
  const phases = [
    { color: "#4F8CF7", w: 28 },
    { color: "#22C55E", w: 35 },
    { color: "#F59E0B", w: 18 },
    { color: "#EF4444", w: 19 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-2.5">
      <div className="flex h-[14px] w-full overflow-hidden rounded-[3px]">
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
