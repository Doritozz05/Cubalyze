"use client";

export function PbProgressionPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-3 select-none">
      {/* Mini step staircase preview */}
      <div className="flex items-center justify-between text-[8px] font-mono">
        <span className="text-ink-3">PB</span>
        <span className="font-semibold text-ink">9.42s</span>
      </div>
      <svg className="h-7 w-full text-ink-2" viewBox="0 0 100 24" fill="none">
        <path
          d="M 5 4 L 35 4 L 35 12 L 70 12 L 70 20 L 95 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
        <circle cx="5" cy="4" r="2" className="fill-surface stroke-ink-3" strokeWidth="1" />
        <circle cx="35" cy="12" r="2" className="fill-surface stroke-ink-3" strokeWidth="1" />
        <circle cx="70" cy="20" r="2" className="fill-ready stroke-ready" strokeWidth="1" />
      </svg>
    </div>
  );
}
