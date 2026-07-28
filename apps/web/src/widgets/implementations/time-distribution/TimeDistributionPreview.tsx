"use client";

export function TimeDistributionPreview() {
  const bars = [0.25, 0.55, 0.85, 0.70, 0.40, 0.15];
  return (
    <div className="flex size-full items-end justify-center gap-0.75 px-2.5 pb-2 pt-4">
      {bars.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5" style={{ height: "100%" }}>
          <div
            className="w-full rounded-[2px] transition-all"
            style={{
              height: `${h * 100}%`,
              backgroundColor: i === 2 ? "var(--color-ready, #4c9a6a)" : "var(--color-ink-3, #868e96)",
              opacity: i === 2 ? 0.9 : 0.35,
            }}
          />
        </div>
      ))}
    </div>
  );
}
