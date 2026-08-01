"use client";

const phases = [
  { label: "Cross", width: "14%", color: "#4c9a6a" },
  { label: "F2L", width: "51%", color: "#3a6ea5" },
  { label: "OLL", width: "16%", color: "#a8650a" },
  { label: "PLL", width: "19%", color: "#b3261e" },
];

export function PhaseBalancePreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-2.5">
      <div className="flex h-3.5 w-full overflow-hidden rounded-[3px]">
        {phases.map((phase) => (
          <div
            key={phase.label}
            style={{ width: phase.width, backgroundColor: phase.color, opacity: 0.82 }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {phases.map((phase) => (
          <div key={phase.label} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-[2px]" style={{ backgroundColor: phase.color }} />
            <span className="text-[0.35rem] font-medium uppercase tracking-wider text-ink-3/70">
              {phase.label}
            </span>
            <div className="h-1 flex-1 rounded-full bg-line/50">
              <div className="h-full rounded-full" style={{ width: phase.width, backgroundColor: phase.color, opacity: 0.65 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
